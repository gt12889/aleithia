"""FallbackChain — tries primary → secondary → cached data from last success.

Cache stored on Modal Volume at /data/cache/{source}/{key}.json.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Callable, Coroutine

from modal_app.volume import CACHE_PATH


class FallbackChain:
    """Executes a list of async fetchers in order, caches on success.

    Usage:
        chain = FallbackChain("news", "rss_blockclub")
        result = await chain.execute([
            fetch_rss_direct,      # Tier 0: primary
            fetch_google_news_rss, # Tier 1: secondary
        ])
        # On total failure, returns cached data from last success
    """

    def __init__(self, source: str, key: str):
        self.source = source
        self.key = key
        self.cache_dir = Path(CACHE_PATH) / source
        self.cache_file = self.cache_dir / f"{key}.json"

    def _read_cache(self) -> Any | None:
        """Read cached data from last successful fetch."""
        try:
            if self.cache_file.exists():
                data = json.loads(self.cache_file.read_text())
                print(f"FallbackChain [{self.source}/{self.key}]: using cached data")
                return data
        except Exception as e:
            print(f"FallbackChain [{self.source}/{self.key}]: cache read error: {e}")
        return None

    def _write_cache(self, data: Any) -> None:
        """Cache successful fetch result."""
        try:
            self.cache_dir.mkdir(parents=True, exist_ok=True)
            self.cache_file.write_text(json.dumps(data, default=str))
        except Exception as e:
            print(f"FallbackChain [{self.source}/{self.key}]: cache write error: {e}")

    async def execute(
        self,
        fetchers: list[Callable[[], Coroutine[Any, Any, Any]]],
    ) -> Any | None:
        """Try each fetcher in order. Cache on success. Return cache on total failure."""
        for i, fetcher in enumerate(fetchers):
            try:
                result = await fetcher()
                if result is not None and result != [] and result != {}:
                    print(f"FallbackChain [{self.source}/{self.key}]: Tier {i} succeeded")
                    self._write_cache(result)
                    return result
                print(f"FallbackChain [{self.source}/{self.key}]: Tier {i} returned empty")
            except Exception as e:
                print(f"FallbackChain [{self.source}/{self.key}]: Tier {i} failed: {e}")

        # All tiers failed — try cache
        return self._read_cache()
