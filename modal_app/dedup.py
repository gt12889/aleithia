"""SeenSet — persistent deduplication set backed by JSON on Modal Volume.

Stores seen document IDs at /data/dedup/{source}.json.
Follows the same persistence pattern as FallbackChain cache files.
"""
from __future__ import annotations

import json
from pathlib import Path

from modal_app.volume import VOLUME_MOUNT

DEDUP_PATH = f"{VOLUME_MOUNT}/dedup"
MAX_IDS = 10_000


class SeenSet:
    """Persistent set of document IDs for cross-run deduplication.

    Usage:
        seen = SeenSet("news")
        if not seen.contains(doc_id):
            # process document
            seen.add(doc_id)
        seen.save()
    """

    def __init__(self, source: str):
        self.source = source
        self.dir = Path(DEDUP_PATH)
        self.file = self.dir / f"{source}.json"
        self._list: list[str] = []
        self._set: set[str] = set()
        self._load()

    def _load(self) -> None:
        """Load existing IDs from Volume."""
        try:
            if self.file.exists():
                data = json.loads(self.file.read_text())
                if isinstance(data, list):
                    self._list = data
                    self._set = set(data)
                    print(f"SeenSet [{self.source}]: loaded {len(self._set)} IDs")
                    return
        except Exception as e:
            print(f"SeenSet [{self.source}]: load error: {e}")
        print(f"SeenSet [{self.source}]: starting empty")

    def contains(self, doc_id: str) -> bool:
        """Check if a document ID has been seen before."""
        return doc_id in self._set

    def add(self, doc_id: str) -> None:
        """Mark a document ID as seen."""
        if doc_id not in self._set:
            self._list.append(doc_id)
            self._set.add(doc_id)

    def save(self) -> None:
        """Persist the set to Volume. Caps at MAX_IDS, dropping oldest."""
        try:
            if len(self._list) > MAX_IDS:
                self._list = self._list[-MAX_IDS:]
                self._set = set(self._list)
            self.dir.mkdir(parents=True, exist_ok=True)
            self.file.write_text(json.dumps(self._list))
            print(f"SeenSet [{self.source}]: saved {len(self._list)} IDs")
        except Exception as e:
            print(f"SeenSet [{self.source}]: save error: {e}")
