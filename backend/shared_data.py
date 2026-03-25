"""Shared dataset helpers for backend access to Modal Volume-backed raw and processed data."""

from __future__ import annotations

import fnmatch
import json
import logging
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from types import SimpleNamespace
from typing import Any, Callable, Iterable, Mapping, Protocol

import modal
from modal.volume import FileEntryType

logger = logging.getLogger(__name__)

DEFAULT_MODAL_VOLUME_NAME = "alethia-data"
DEFAULT_RAW_PREFIX = "raw"
DEFAULT_PROCESSED_PREFIX = "processed"

_LAST_LOGGED_LAYOUT: tuple[str, str] | None = None
_VOLUME: modal.Volume | None = None


class SharedDataAccessor(Protocol):
    def get_entry(self, relative_path: str) -> "SharedFileEntry | None": ...

    def list_entries(self, relative_path: str, *, recursive: bool = False) -> list["SharedFileEntry"]: ...

    def read_bytes(self, relative_path: str) -> bytes: ...


@dataclass(frozen=True)
class SharedFileEntry:
    path: str
    is_file: bool
    is_dir: bool
    mtime: float
    size: int = 0

    @property
    def name(self) -> str:
        return PurePosixPath(self.path).name

    @property
    def suffix(self) -> str:
        return PurePosixPath(self.path).suffix

    @property
    def stem(self) -> str:
        return PurePosixPath(self.path).stem


def _normalize_relative_path(value: str | PurePosixPath | "SharedDataPath") -> str:
    if isinstance(value, SharedDataPath):
        return value.relative_path
    raw = str(value or "").strip().replace("\\", "/")
    if raw in ("", "."):
        return ""
    normalized = str(PurePosixPath(raw))
    return "" if normalized == "." else normalized.strip("/")


@dataclass(frozen=True)
class SharedDataPath:
    accessor: SharedDataAccessor
    relative_path: str

    def __post_init__(self) -> None:
        object.__setattr__(self, "relative_path", _normalize_relative_path(self.relative_path))

    def __str__(self) -> str:
        volume_name = os.getenv("ALEITHIA_MODAL_VOLUME_NAME", DEFAULT_MODAL_VOLUME_NAME).strip() or DEFAULT_MODAL_VOLUME_NAME
        return f"modal://{volume_name}/{self.relative_path}" if self.relative_path else f"modal://{volume_name}"

    def __repr__(self) -> str:
        return f"SharedDataPath({self.relative_path!r})"

    def __lt__(self, other: object) -> bool:
        if not isinstance(other, SharedDataPath):
            return NotImplemented
        return self.relative_path < other.relative_path

    def __truediv__(self, key: str) -> "SharedDataPath":
        return self.joinpath(key)

    @property
    def name(self) -> str:
        return PurePosixPath(self.relative_path).name

    @property
    def suffix(self) -> str:
        return PurePosixPath(self.relative_path).suffix

    @property
    def stem(self) -> str:
        return PurePosixPath(self.relative_path).stem

    @property
    def parent(self) -> "SharedDataPath":
        parent = PurePosixPath(self.relative_path).parent
        parent_str = "" if str(parent) == "." else str(parent)
        return SharedDataPath(self.accessor, parent_str)

    def joinpath(self, *parts: str) -> "SharedDataPath":
        current = PurePosixPath(self.relative_path) if self.relative_path else PurePosixPath()
        joined = current.joinpath(*[str(part) for part in parts])
        return SharedDataPath(self.accessor, str(joined))

    def relative_to(self, other: "SharedDataPath") -> PurePosixPath:
        return PurePosixPath(self.relative_path).relative_to(PurePosixPath(other.relative_path))

    def exists(self) -> bool:
        return self.accessor.get_entry(self.relative_path) is not None

    def is_file(self) -> bool:
        entry = self.accessor.get_entry(self.relative_path)
        return bool(entry and entry.is_file)

    def is_dir(self) -> bool:
        entry = self.accessor.get_entry(self.relative_path)
        return bool(entry and entry.is_dir)

    def stat(self) -> SimpleNamespace:
        entry = self.accessor.get_entry(self.relative_path)
        if entry is None:
            raise OSError(f"No such file or directory: {self}")
        return SimpleNamespace(st_mtime=entry.mtime, st_size=entry.size)

    def read_bytes(self) -> bytes:
        return self.accessor.read_bytes(self.relative_path)

    def read_text(self, encoding: str = "utf-8") -> str:
        return self.read_bytes().decode(encoding)

    def iterdir(self) -> list["SharedDataPath"]:
        return [SharedDataPath(self.accessor, entry.path) for entry in self.accessor.list_entries(self.relative_path)]

    def glob(self, pattern: str) -> list["SharedDataPath"]:
        return _glob_paths(self, pattern, recursive=False)

    def rglob(self, pattern: str) -> list["SharedDataPath"]:
        return _glob_paths(self, pattern, recursive=True)


@dataclass(frozen=True)
class SharedDataPaths:
    raw_dir: SharedDataPath
    processed_dir: SharedDataPath


class ModalVolumeAccessor:
    def __init__(self, volume: modal.Volume):
        self._volume = volume

    def _entry_from_modal(self, entry: object) -> SharedFileEntry | None:
        entry_path = getattr(entry, "path", None)
        entry_type = getattr(entry, "type", None)
        if not isinstance(entry_path, str) or entry_type is None:
            return None
        return SharedFileEntry(
            path=entry_path.strip("/"),
            is_file=entry_type == FileEntryType.FILE,
            is_dir=entry_type == FileEntryType.DIRECTORY,
            mtime=float(getattr(entry, "mtime", 0) or 0),
            size=int(getattr(entry, "size", 0) or 0),
        )

    def get_entry(self, relative_path: str) -> SharedFileEntry | None:
        normalized = _normalize_relative_path(relative_path)
        if not normalized:
            return SharedFileEntry(path="", is_file=False, is_dir=True, mtime=0.0, size=0)
        parent = PurePosixPath(normalized).parent
        parent_path = "" if str(parent) == "." else str(parent)
        try:
            entries = self._volume.listdir(parent_path, recursive=False)
        except Exception:
            return None
        for entry in entries:
            parsed = self._entry_from_modal(entry)
            if parsed is None:
                continue
            if parsed.path == normalized:
                return parsed
        return None

    def list_entries(self, relative_path: str, *, recursive: bool = False) -> list[SharedFileEntry]:
        normalized = _normalize_relative_path(relative_path)
        try:
            entries = self._volume.listdir(normalized, recursive=recursive)
        except Exception:
            return []
        parsed_entries = [self._entry_from_modal(entry) for entry in entries]
        return [entry for entry in parsed_entries if entry is not None]

    def read_bytes(self, relative_path: str) -> bytes:
        normalized = _normalize_relative_path(relative_path)
        chunks = []
        for chunk in self._volume.read_file(normalized):
            chunks.append(chunk)
        return b"".join(chunks)


def _get_volume() -> modal.Volume:
    global _VOLUME
    if _VOLUME is not None:
        return _VOLUME

    volume_name = os.getenv("ALEITHIA_MODAL_VOLUME_NAME", DEFAULT_MODAL_VOLUME_NAME).strip() or DEFAULT_MODAL_VOLUME_NAME
    environment_name = os.getenv("ALEITHIA_MODAL_ENVIRONMENT", "").strip() or None
    _VOLUME = modal.Volume.from_name(volume_name, environment_name=environment_name, create_if_missing=False)
    return _VOLUME


def _get_accessor() -> SharedDataAccessor:
    return ModalVolumeAccessor(_get_volume())


def get_shared_data_paths() -> SharedDataPaths:
    global _LAST_LOGGED_LAYOUT

    accessor = _get_accessor()
    paths = SharedDataPaths(
        raw_dir=SharedDataPath(accessor, DEFAULT_RAW_PREFIX),
        processed_dir=SharedDataPath(accessor, DEFAULT_PROCESSED_PREFIX),
    )
    layout = (str(paths.raw_dir), str(paths.processed_dir))
    if layout != _LAST_LOGGED_LAYOUT:
        _LAST_LOGGED_LAYOUT = layout
        logger.info(
            "Resolved Aleithia shared data roots from Modal Volume: raw=%s processed=%s",
            paths.raw_dir,
            paths.processed_dir,
        )
    return paths


def get_raw_data_dir() -> SharedDataPath:
    return get_shared_data_paths().raw_dir


def get_processed_data_dir() -> SharedDataPath:
    return get_shared_data_paths().processed_dir


def _relative_entry_path(directory: SharedDataPath, entry_path: str) -> PurePosixPath | None:
    candidate = PurePosixPath(entry_path)
    if directory.relative_path:
        try:
            relative = candidate.relative_to(PurePosixPath(directory.relative_path))
        except ValueError:
            return None
    else:
        relative = candidate
    return None if str(relative) in {"", "."} else relative


def _shared_entries(
    directory: SharedDataPath,
    *,
    recursive: bool,
    pattern: str | None = None,
    files_only: bool | None = None,
) -> list[SharedFileEntry]:
    entries = directory.accessor.list_entries(directory.relative_path, recursive=recursive)
    matched: list[SharedFileEntry] = []
    for entry in entries:
        relative = _relative_entry_path(directory, entry.path)
        if relative is None:
            continue
        if not recursive and len(relative.parts) != 1:
            continue
        if files_only is True and not entry.is_file:
            continue
        if files_only is False and not entry.is_dir:
            continue
        if pattern is not None and not fnmatch.fnmatch(PurePosixPath(entry.path).name, pattern):
            continue
        matched.append(entry)
    return matched


def _glob_paths(directory: SharedDataPath, pattern: str, *, recursive: bool) -> list[SharedDataPath]:
    entries = _shared_entries(directory, recursive=recursive, pattern=pattern)
    return sorted(SharedDataPath(directory.accessor, entry.path) for entry in entries)


def _safe_mtime(path: Path | SharedDataPath) -> float:
    try:
        return float(path.stat().st_mtime)
    except OSError:
        return 0.0


def safe_mtime(path: Path | SharedDataPath) -> float:
    return _safe_mtime(path)


def read_file_bytes(path: Path | SharedDataPath, default: bytes | None = None) -> bytes | None:
    if isinstance(path, SharedDataPath):
        try:
            return path.read_bytes()
        except Exception:
            return default

    if not path.exists() or not path.is_file():
        return default
    try:
        return path.read_bytes()
    except OSError:
        return default


def load_json_file(path: Path | SharedDataPath, default: Any = None) -> Any:
    raw_bytes = read_file_bytes(path, default=None)
    if raw_bytes is None:
        return default
    try:
        return json.loads(raw_bytes.decode("utf-8"))
    except (json.JSONDecodeError, OSError, UnicodeDecodeError):
        return default


def load_processed_json(*parts: str, default: Any = None) -> Any:
    return load_json_file(get_processed_data_dir().joinpath(*parts), default=default)


def load_first_existing_json(paths: Iterable[Path | SharedDataPath], default: Any = None) -> Any:
    for path in paths:
        parsed = load_json_file(path, default=None)
        if parsed is not None:
            return parsed
    return default


def load_first_matching_json(
    paths: Iterable[Path | SharedDataPath],
    *,
    predicate: Callable[[Any], bool],
    default: Any = None,
) -> Any:
    for path in paths:
        parsed = load_json_file(path, default=None)
        if parsed is not None and predicate(parsed):
            return parsed
    return default


def load_processed_json_directory(
    *parts: str,
    stem_suffix_to_strip: str = "",
) -> dict[str, Any]:
    directory = get_processed_data_dir().joinpath(*parts)
    loaded: dict[str, Any] = {}
    if isinstance(directory, SharedDataPath):
        for entry in sorted(_shared_entries(directory, recursive=False, pattern="*.json", files_only=True), key=lambda item: item.path):
            path = SharedDataPath(directory.accessor, entry.path)
            parsed = load_json_file(path, default=None)
            if parsed is None:
                continue
            key = path.stem
            if stem_suffix_to_strip:
                key = key.removesuffix(stem_suffix_to_strip)
            loaded[key] = parsed
        return loaded

    if not directory.exists():
        return {}

    for path in sorted(directory.iterdir()):
        if not path.is_file() or path.suffix != ".json":
            continue
        parsed = load_json_file(path, default=None)
        if parsed is None:
            continue
        key = path.stem
        if stem_suffix_to_strip:
            key = key.removesuffix(stem_suffix_to_strip)
        loaded[key] = parsed
    return loaded


def find_latest_processed_json_file(*parts: str, pattern: str = "*.json") -> Path | SharedDataPath | None:
    return find_latest_json_file(get_processed_data_dir().joinpath(*parts), pattern=pattern)


def iter_json_files(
    directory: Path | SharedDataPath,
    *,
    recursive: bool = True,
    sort_key: Callable[[Path | SharedDataPath], Any] | None = None,
    reverse: bool = True,
) -> list[Path | SharedDataPath]:
    if isinstance(directory, SharedDataPath):
        entries = _shared_entries(directory, recursive=recursive, pattern="*.json", files_only=True)
        files = [SharedDataPath(directory.accessor, entry.path) for entry in entries]
    else:
        if not directory.exists():
            return []
        iterator = directory.rglob("*.json") if recursive else directory.glob("*.json")
        files = [path for path in iterator if path.is_file()]
    return sorted(files, key=sort_key, reverse=reverse) if sort_key is not None else sorted(files, reverse=reverse)


def iter_files(
    directory: Path | SharedDataPath,
    *,
    recursive: bool = True,
    pattern: str = "*",
    reverse: bool = True,
) -> list[Path | SharedDataPath]:
    if isinstance(directory, SharedDataPath):
        entries = _shared_entries(directory, recursive=recursive, pattern=pattern, files_only=True)
        listed = [SharedDataPath(directory.accessor, entry.path) for entry in entries]
        return sorted(
            listed,
            key=lambda path: (
                next(entry.mtime for entry in entries if entry.path == path.relative_path),
                str(path),
            ),
            reverse=reverse,
        )
    else:
        if not directory.exists():
            return []
        iterator = directory.rglob(pattern) if recursive else directory.glob(pattern)
        listed = [path for path in iterator if path.is_file()]
    return sorted(listed, key=lambda path: (safe_mtime(path), str(path)), reverse=reverse)


def count_files(directory: Path | SharedDataPath, *, pattern: str = "*", recursive: bool = True) -> int:
    if isinstance(directory, SharedDataPath):
        return len(_shared_entries(directory, recursive=recursive, pattern=pattern, files_only=True))
    return len(iter_files(directory, recursive=recursive, pattern=pattern))


def find_latest_json_file(directory: Path | SharedDataPath, pattern: str = "*.json") -> Path | SharedDataPath | None:
    if isinstance(directory, SharedDataPath):
        candidates = _shared_entries(directory, recursive=False, pattern=pattern, files_only=True)
        if not candidates:
            return None
        latest = max(candidates, key=lambda entry: (entry.mtime, PurePosixPath(entry.path).name))
        return SharedDataPath(directory.accessor, latest.path)

    candidates = [path for path in directory.glob(pattern) if path.is_file()]
    if not candidates:
        return None
    return max(candidates, key=lambda path: (_safe_mtime(path), path.name))


def load_json_docs_from_paths(
    paths: Iterable[Path | SharedDataPath],
    *,
    limit: int | None = None,
    on_error: Callable[[Path | SharedDataPath, Exception], None] | None = None,
) -> list[dict]:
    docs: list[dict] = []
    for json_file in paths:
        try:
            raw_bytes = read_file_bytes(json_file, default=None)
            if raw_bytes is None:
                continue
            parsed = json.loads(raw_bytes.decode("utf-8"))
        except (json.JSONDecodeError, OSError, UnicodeDecodeError) as exc:
            if on_error is not None:
                on_error(json_file, exc)
            continue
        if not isinstance(parsed, dict):
            continue
        docs.append(parsed)
        if limit is not None and len(docs) >= limit:
            break
    return docs


def load_json_docs_from_directory(
    directory: Path | SharedDataPath,
    *,
    limit: int | None = None,
    recursive: bool = True,
    sort_key: Callable[[Path | SharedDataPath], Any] | None = None,
    reverse: bool = True,
    on_error: Callable[[Path | SharedDataPath, Exception], None] | None = None,
) -> list[dict]:
    return load_json_docs_from_paths(
        iter_json_files(directory, recursive=recursive, sort_key=sort_key, reverse=reverse),
        limit=limit,
        on_error=on_error,
    )


def scan_source_directories(
    source_dirs: Mapping[str, Path | SharedDataPath],
    *,
    neighborhood_sample_limit: int = 100,
    neighborhood_getter: Callable[[dict], str | None] | None = None,
) -> dict[str, dict[str, object]]:
    if neighborhood_getter is None:
        neighborhood_getter = lambda doc: doc.get("geo", {}).get("neighborhood") or None

    stats: dict[str, dict[str, object]] = {}
    for source, source_dir in source_dirs.items():
        neighborhoods: set[str] = set()
        if isinstance(source_dir, SharedDataPath):
            entries = _shared_entries(source_dir, recursive=True, pattern="*.json", files_only=True)
            latest_entry = max(entries, key=lambda entry: (entry.mtime, entry.path), default=None)
            for entry in entries[:neighborhood_sample_limit]:
                parsed = load_json_file(SharedDataPath(source_dir.accessor, entry.path), default=None)
                if not isinstance(parsed, dict):
                    continue
                neighborhood = neighborhood_getter(parsed)
                if neighborhood:
                    neighborhoods.add(neighborhood)

            stats[source] = {
                "doc_count": len(entries),
                "active": bool(entries),
                "last_update": (
                    datetime.fromtimestamp(latest_entry.mtime, tz=timezone.utc).isoformat()
                    if latest_entry is not None
                    else None
                ),
                "neighborhoods_covered": neighborhoods,
            }
            continue

        json_files = iter_json_files(source_dir)
        latest = max(json_files, key=_safe_mtime, default=None)
        for json_file in json_files[:neighborhood_sample_limit]:
            parsed = load_json_file(json_file, default=None)
            if not isinstance(parsed, dict):
                continue
            neighborhood = neighborhood_getter(parsed)
            if neighborhood:
                neighborhoods.add(neighborhood)

        stats[source] = {
            "doc_count": len(json_files),
            "active": bool(json_files),
            "last_update": (
                datetime.fromtimestamp(_safe_mtime(latest), tz=timezone.utc).isoformat()
                if latest is not None
                else None
            ),
            "neighborhoods_covered": neighborhoods,
        }
    return stats


def iter_raw_json_files(source: str) -> list[Path | SharedDataPath]:
    source_dir = get_raw_data_dir() / source

    if isinstance(source_dir, SharedDataPath):
        entries = _shared_entries(source_dir, recursive=True, pattern="*.json", files_only=True)
        entries.sort(
            key=lambda entry: (
                str(_relative_entry_path(source_dir, entry.path).parent),
                entry.mtime,
                entry.path,
            ),
            reverse=True,
        )
        return [SharedDataPath(source_dir.accessor, entry.path) for entry in entries]

    def _sort_key(path: Path | SharedDataPath) -> tuple[str, float]:
        if isinstance(path, SharedDataPath):
            rel_parent = str(path.relative_to(source_dir).parent)
        else:
            try:
                rel_parent = str(path.relative_to(source_dir).parent)
            except ValueError:
                rel_parent = str(path.parent)
        mtime = _safe_mtime(path)
        return (rel_parent, mtime)

    return iter_json_files(source_dir, sort_key=_sort_key, reverse=True)


def count_raw_json_files(source: str) -> int:
    return len(iter_raw_json_files(source))


def load_raw_docs(source: str, limit: int | None = None) -> list[dict]:
    return load_json_docs_from_paths(iter_raw_json_files(source), limit=limit)


def get_raw_source_stats(sources: Iterable[str]) -> dict[str, dict[str, object]]:
    stats = scan_source_directories({source: get_raw_data_dir() / source for source in sources})
    return {
        source: {
            "doc_count": data["doc_count"],
            "active": data["active"],
            "last_update": data["last_update"],
        }
        for source, data in stats.items()
    }
