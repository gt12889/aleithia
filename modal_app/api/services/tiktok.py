"""TikTok normalization, ranking, and refresh helpers for the Modal API."""
from __future__ import annotations

import asyncio
import json
import re
import time
from datetime import datetime, timezone

import modal

from modal_app.api.services.documents import BUSINESS_TYPE_KEYWORDS, is_count_only_text, sanitize_business_type
from modal_app.runtime import get_modal_function

_TIKTOK_CREATOR_RE = re.compile(r"tiktok\.com/@([^/?#]+)/video/", re.IGNORECASE)

tiktok_refresh_recent_dict = modal.Dict.from_name("alethia-tiktok-refresh-recent", create_if_missing=True)
TIKTOK_TARGET_COUNT = 5
TIKTOK_LOCAL_RESERVE = 2
TIKTOK_TRIGGER_DEBOUNCE_SECONDS = 20
_tiktok_refresh_locks: dict[str, asyncio.Lock] = {}
_tiktok_refresh_locks_guard = asyncio.Lock()


async def spawn_reddit_fallback_persist(docs: list[dict]) -> None:
    """Fire-and-forget persistence for query-time fallback Reddit hits."""
    if not docs:
        return
    try:
        persist_fn = get_modal_function("persist_reddit_fallback_batch")
        await persist_fn.spawn.aio(docs=docs)
    except Exception as exc:
        print(f"Reddit fallback persist spawn failed: {exc}")


def extract_tiktok_creator_from_url(video_url: str) -> str:
    match = _TIKTOK_CREATOR_RE.search(video_url or "")
    if not match:
        return ""
    return match.group(1).strip().lstrip("@")


def extract_transcript_headline(content: str, max_len: int = 120) -> str:
    text = (content or "").strip()
    if not text:
        return ""
    if "[Transcript]" in text:
        text = text.split("[Transcript]", 1)[1].strip()
    text = re.sub(r"^\d[\d,.\s]*[KMBkmb]?\s*[:\-]?\s*", "", text)
    text = re.sub(r"\s+", " ", text)
    for sep in (". ", "! ", "? "):
        if sep in text:
            text = text.split(sep, 1)[0].strip()
            break
    if len(text) > max_len:
        text = text[:max_len].rsplit(" ", 1)[0]
    return text.strip(" -:;,.")


def normalize_tiktok_content(content: str) -> str:
    text = (content or "").strip()
    if not text:
        return ""
    if "\n[Transcript]" in text:
        first_line, remainder = text.split("\n", 1)
        if is_count_only_text(first_line):
            text = remainder.strip()
    if is_count_only_text(text):
        return ""
    return text


def parse_view_count(value: str) -> int:
    text = (value or "").strip().replace(",", "").upper()
    if not text:
        return 0
    match = re.match(r"^(\d+(?:\.\d+)?)\s*([KMB])?$", text)
    if not match:
        return 0
    num = float(match.group(1))
    suffix = match.group(2) or ""
    if suffix == "K":
        num *= 1_000
    elif suffix == "M":
        num *= 1_000_000
    elif suffix == "B":
        num *= 1_000_000_000
    return int(round(num))


def normalize_tiktok_doc(doc: dict) -> dict:
    normalized = dict(doc)
    metadata = dict(normalized.get("metadata") or {})
    normalized["metadata"] = metadata

    content = normalize_tiktok_content(normalized.get("content", ""))
    normalized["content"] = content

    creator = str(metadata.get("creator", "") or "").strip().lstrip("@")
    if not creator:
        creator = extract_tiktok_creator_from_url(normalized.get("url", ""))
    if creator:
        metadata["creator"] = creator

    search_query = str(metadata.get("search_query", "") or "").strip()
    if not search_query:
        query_match = re.search(r"TikTok video related to:\s*(.+)$", content, re.IGNORECASE)
        if query_match:
            search_query = query_match.group(1).strip()
    if search_query:
        metadata["search_query"] = search_query

    views_normalized = parse_view_count(str(metadata.get("views_normalized", "") or ""))
    if views_normalized <= 0:
        views_normalized = parse_view_count(str(metadata.get("views", "") or ""))
    metadata["views_normalized"] = views_normalized

    query_scope = str(metadata.get("query_scope", "") or "").strip().lower()
    if query_scope in ("city", "local"):
        metadata["query_scope"] = query_scope

    title = str(normalized.get("title", "") or "").strip()
    if not title or is_count_only_text(title) or title.lower() == "tiktok video":
        transcript_title = extract_transcript_headline(content)
        if transcript_title:
            title = transcript_title
        elif creator:
            title = f"@{creator}"
        elif search_query:
            title = f"TikTok: {search_query}"
        else:
            title = "TikTok video"
    normalized["title"] = title

    return normalized


def parse_timestamp_epoch(value: str) -> float:
    text = (value or "").strip()
    if not text:
        return 0.0
    try:
        dt = datetime.fromisoformat(text.replace("Z", "+00:00"))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.timestamp()
    except ValueError:
        return 0.0


def is_local_tiktok_candidate(doc: dict, neighborhood: str) -> bool:
    nb_lower = (neighborhood or "").strip().lower()
    if not nb_lower:
        return False

    metadata = doc.get("metadata", {}) or {}
    query_scope = str(metadata.get("query_scope", "") or "").strip().lower()
    query_nb = str(metadata.get("query_neighborhood", "") or "").strip().lower()
    if query_scope == "local" and query_nb == nb_lower:
        return True

    geo_nb = str((doc.get("geo", {}) or {}).get("neighborhood", "") or "").strip().lower()
    if geo_nb == nb_lower:
        return True

    combined = f"{doc.get('title', '')} {doc.get('content', '')[:600]}".lower()
    return nb_lower in combined


def score_tiktok_business_relevance(doc: dict, business_type: str) -> int:
    biz = sanitize_business_type(business_type)
    if not biz:
        return 0

    keyword_sets = [biz]
    for key, values in BUSINESS_TYPE_KEYWORDS.items():
        if sanitize_business_type(key) == biz:
            keyword_sets = values
            break
    combined = f"{doc.get('title', '')} {doc.get('content', '')[:700]}".lower()

    score = 0
    for kw in keyword_sets:
        kw_clean = sanitize_business_type(kw)
        if kw_clean and kw_clean in combined:
            score += 3
    for generic in ("business", "startup", "opening", "owner", "restaurant", "shop", "store"):
        if generic in combined:
            score += 1
    return score


def rank_tiktok_docs(docs: list[dict], business_type: str, neighborhood: str) -> list[dict]:
    if not docs:
        return []

    deduped: list[dict] = []
    seen_ids: set[str] = set()
    for doc in docs:
        doc_id = str(doc.get("id", "") or "")
        if doc_id and doc_id in seen_ids:
            continue
        if doc_id:
            seen_ids.add(doc_id)
        deduped.append(doc)

    def sort_key(doc: dict) -> tuple[int, int, float]:
        meta = doc.get("metadata", {}) or {}
        views = int(meta.get("views_normalized", 0) or 0)
        if views <= 0:
            views = parse_view_count(str(meta.get("views", "") or ""))
            meta["views_normalized"] = views
        relevance = score_tiktok_business_relevance(doc, business_type)
        ts = parse_timestamp_epoch(str(doc.get("timestamp", "") or ""))
        return (views, relevance, ts)

    local_docs: list[dict] = []
    non_local_docs: list[dict] = []
    for doc in deduped:
        if is_local_tiktok_candidate(doc, neighborhood):
            local_docs.append(doc)
        else:
            non_local_docs.append(doc)

    local_docs.sort(key=sort_key, reverse=True)
    non_local_docs.sort(key=sort_key, reverse=True)

    selected: list[dict] = []
    selected_ids: set[str] = set()
    for doc in local_docs[:TIKTOK_LOCAL_RESERVE]:
        selected.append(doc)
        doc_id = str(doc.get("id", "") or "")
        if doc_id:
            selected_ids.add(doc_id)

    remainder = [
        doc
        for doc in (local_docs[TIKTOK_LOCAL_RESERVE:] + non_local_docs)
        if str(doc.get("id", "") or "") not in selected_ids
    ]
    remainder.sort(key=sort_key, reverse=True)

    for doc in remainder:
        if len(selected) >= TIKTOK_TARGET_COUNT:
            break
        selected.append(doc)

    return selected[:TIKTOK_TARGET_COUNT]


def profile_tiktok_freshness(docs: list[dict], business_type: str, neighborhood: str) -> tuple[int, int, float]:
    biz = sanitize_business_type(business_type) or "small business"
    nb_lower = (neighborhood or "").strip().lower()
    profile_docs = []
    local_docs = []

    for doc in docs:
        metadata = doc.get("metadata", {}) or {}
        scope = str(metadata.get("query_scope", "") or "").strip().lower()
        q_biz = sanitize_business_type(str(metadata.get("query_business_type", "") or ""))
        q_nb = str(metadata.get("query_neighborhood", "") or "").strip().lower()

        if scope not in ("city", "local"):
            continue
        if q_biz and q_biz != biz:
            continue
        if scope == "local" and q_nb == nb_lower:
            local_docs.append(doc)
            profile_docs.append(doc)
            continue
        if scope == "city":
            profile_docs.append(doc)

    freshest = 0.0
    if profile_docs:
        freshest = max(parse_timestamp_epoch(str(doc.get("timestamp", "") or "")) for doc in profile_docs)
    return (len(profile_docs), len(local_docs), freshest)


def filter_tiktok_pool_for_profile(docs: list[dict], business_type: str) -> list[dict]:
    biz = sanitize_business_type(business_type) or "small business"
    filtered: list[dict] = []
    for doc in docs:
        metadata = doc.get("metadata", {}) or {}
        q_biz = sanitize_business_type(str(metadata.get("query_business_type", "") or ""))
        if not q_biz or q_biz == biz:
            filtered.append(doc)
    return filtered


def is_low_quality_tiktok_doc(doc: dict) -> bool:
    title = (doc.get("title", "") or "").strip()
    content = (doc.get("content", "") or "").strip()
    meta = doc.get("metadata", {}) or {}
    creator = str(meta.get("creator", "") or "").strip()
    hashtags = meta.get("hashtags", []) or []
    transcript_present = "[Transcript]" in content
    meaningful_content = bool(content) and not is_count_only_text(content)
    return bool(
        is_count_only_text(title)
        and not meaningful_content
        and not creator
        and not hashtags
        and not transcript_present
    )


def refresh_key(business_type: str, neighborhood: str) -> str:
    biz = sanitize_business_type(business_type) or "small business"
    nb = (neighborhood or "").strip().lower()
    return f"{biz}|{nb}"


async def get_tiktok_refresh_lock(key: str) -> asyncio.Lock:
    async with _tiktok_refresh_locks_guard:
        lock = _tiktok_refresh_locks.get(key)
        if lock is None:
            lock = asyncio.Lock()
            _tiktok_refresh_locks[key] = lock
        return lock


async def dict_get_float_aio(dct: modal.Dict, key: str, default: float = 0.0) -> float:
    try:
        getter_aio = getattr(dct.__getitem__, "aio", None)
        if callable(getter_aio):
            value = await getter_aio(key)
        else:
            value = dct[key]
    except KeyError:
        return default
    except Exception:
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


async def dict_put_value_aio(dct: modal.Dict, key: str, value: float) -> None:
    put_aio = getattr(getattr(dct, "put", None), "aio", None)
    if callable(put_aio):
        await put_aio(key, value)
    else:
        dct[key] = value


async def maybe_spawn_tiktok_profile_refresh(
    neighborhood: str,
    business_type: str,
    profile_count: int,
    local_count: int,
    freshest_epoch: float,
) -> dict:
    """Trigger non-blocking profile TikTok refresh, debounced for duplicate UI bursts."""
    del freshest_epoch

    status = {
        "requested": False,
        "reason": "pending",
        "cooldown_seconds_remaining": 0,
        "profile_docs": profile_count,
        "local_docs": local_count,
    }

    key = refresh_key(business_type, neighborhood)
    key_lock = await get_tiktok_refresh_lock(key)
    async with key_lock:
        now_epoch = time.time()
        last_trigger_epoch = await dict_get_float_aio(tiktok_refresh_recent_dict, key, default=0.0)
        elapsed = now_epoch - last_trigger_epoch
        if elapsed < TIKTOK_TRIGGER_DEBOUNCE_SECONDS:
            status["reason"] = "debounced"
            status["cooldown_seconds_remaining"] = int(TIKTOK_TRIGGER_DEBOUNCE_SECONDS - elapsed)
            return status

        await dict_put_value_aio(tiktok_refresh_recent_dict, key, now_epoch)
        try:
            from modal_app.pipelines.tiktok import ingest_tiktok_for_profile

            spawn_aio = getattr(ingest_tiktok_for_profile.spawn, "aio", None)
            if callable(spawn_aio):
                await spawn_aio(
                    business_type=business_type or "small business",
                    neighborhood=neighborhood,
                    transcribe=False,
                )
            else:
                ingest_tiktok_for_profile.spawn(
                    business_type=business_type or "small business",
                    neighborhood=neighborhood,
                    transcribe=False,
                )
            status["requested"] = True
            status["reason"] = "requested"
        except Exception as exc:
            await dict_put_value_aio(tiktok_refresh_recent_dict, key, 0.0)
            status["reason"] = f"spawn_error:{exc}"

    return status
