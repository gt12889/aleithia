"""Small in-process TTL cache for request-path helpers."""
from __future__ import annotations

import threading
import time
from collections.abc import Callable
from typing import Any


class TTLCache:
    """Thread-safe TTL cache for lightweight request-path memoization."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._entries: dict[str, tuple[float, Any]] = {}

    def get_or_set(self, key: str, ttl_seconds: float, loader: Callable[[], Any]) -> Any:
        now = time.monotonic()
        with self._lock:
            entry = self._entries.get(key)
            if entry is not None and entry[0] > now:
                return entry[1]

        value = loader()

        with self._lock:
            self._entries[key] = (now + ttl_seconds, value)
        return value

    def invalidate(self, key: str) -> None:
        with self._lock:
            self._entries.pop(key, None)

    def invalidate_prefix(self, prefix: str) -> None:
        with self._lock:
            keys = [key for key in self._entries if key.startswith(prefix)]
            for key in keys:
                self._entries.pop(key, None)


cache = TTLCache()
