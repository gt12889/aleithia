from __future__ import annotations

import os
import sys
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import shared_data
import read_helpers
from database import Base
from routes import data_routes as data_routes_module
from routes.data_routes import router as data_router


def _write_json(path: Path, payload: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(payload)


class _LocalAccessor:
    def __init__(self, root: Path):
        self.root = root

    def _local(self, relative_path: str) -> Path:
        relative = Path(relative_path) if relative_path else Path(".")
        return (self.root / relative).resolve()

    def _entry(self, path: Path):
        if not path.exists():
            return None
        relative = path.relative_to(self.root).as_posix()
        stat = path.stat()
        return shared_data.SharedFileEntry(
            path="" if relative == "." else relative,
            is_file=path.is_file(),
            is_dir=path.is_dir(),
            mtime=stat.st_mtime,
            size=stat.st_size,
        )

    def get_entry(self, relative_path: str):
        return self._entry(self._local(relative_path))

    def list_entries(self, relative_path: str, *, recursive: bool = False):
        base = self._local(relative_path)
        if not base.exists():
            return []
        if base.is_file():
            entry = self._entry(base)
            return [entry] if entry is not None else []
        iterator = base.rglob("*") if recursive else base.iterdir()
        entries = []
        for item in iterator:
            entry = self._entry(item)
            if entry is not None:
                entries.append(entry)
        return entries

    def read_bytes(self, relative_path: str) -> bytes:
        return self._local(relative_path).read_bytes()


class _CountingAccessor(_LocalAccessor):
    def __init__(self, root: Path):
        super().__init__(root)
        self.list_entries_calls: list[tuple[str, bool]] = []
        self.get_entry_calls: list[str] = []

    def get_entry(self, relative_path: str):
        self.get_entry_calls.append(relative_path)
        return super().get_entry(relative_path)

    def list_entries(self, relative_path: str, *, recursive: bool = False):
        self.list_entries_calls.append((relative_path, recursive))
        return super().list_entries(relative_path, recursive=recursive)


class _StrictRecursiveAccessor(_CountingAccessor):
    def get_entry(self, relative_path: str):
        normalized = relative_path.replace("\\", "/")
        if normalized.endswith(".json") and "/" in normalized:
            raise AssertionError(f"unexpected child get_entry lookup for {normalized}")
        return super().get_entry(relative_path)


def _install_local_accessor(monkeypatch, data_root: Path) -> None:
    monkeypatch.setattr(shared_data, "_get_accessor", lambda: _LocalAccessor(data_root))
    shared_data._LAST_LOGGED_LAYOUT = None
    shared_data._VOLUME = None
    data_routes_module._DATA_SNAPSHOT_CACHE.clear()


def _make_client(monkeypatch, data_root: Path) -> TestClient:
    _install_local_accessor(monkeypatch, data_root)

    app = FastAPI()
    app.include_router(data_router, prefix="/api/data")
    return TestClient(app)


def _make_user_client(tmp_path: Path) -> TestClient:
    db_path = tmp_path / "user-data.sqlite3"
    engine = create_engine(
        f"sqlite:///{db_path}",
        connect_args={"check_same_thread": False},
    )
    testing_session_local = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    app = FastAPI()
    app.include_router(data_router, prefix="/api/data")

    def override_get_db():
        db = testing_session_local()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[data_routes_module.get_db] = override_get_db
    return TestClient(app)


def test_shared_data_resolution_prefers_env_over_detected_layout(tmp_path, monkeypatch) -> None:
    data_root = tmp_path / "shared"
    (data_root / "raw").mkdir(parents=True)
    (data_root / "processed").mkdir(parents=True)
    _install_local_accessor(monkeypatch, data_root)

    assert shared_data.get_raw_data_dir().relative_path == "raw"
    assert shared_data.get_processed_data_dir().relative_path == "processed"
    assert str(shared_data.get_raw_data_dir()).startswith("modal://")


def test_load_raw_docs_recurses_and_skips_invalid_payloads(tmp_path, monkeypatch) -> None:
    data_root = tmp_path / "shared"
    _install_local_accessor(monkeypatch, data_root)

    _write_json(
        data_root / "raw" / "news" / "2026-03-17" / "latest.json",
        '{"id":"latest","title":"Latest","timestamp":"2026-03-17T12:00:00+00:00"}',
    )
    _write_json(
        data_root / "raw" / "news" / "2026-03-16" / "older.json",
        '{"id":"older","title":"Older","timestamp":"2026-03-16T12:00:00+00:00"}',
    )
    _write_json(data_root / "raw" / "news" / "2026-03-16" / "broken.json", '{"id":')
    _write_json(data_root / "raw" / "news" / "2026-03-16" / "list.json", '["not", "a", "dict"]')

    assert shared_data.count_raw_json_files("news") == 4
    docs = shared_data.load_raw_docs("news")

    assert [doc["id"] for doc in docs] == ["latest", "older"]


def test_shared_data_recursive_scans_do_not_requery_child_entries(tmp_path, monkeypatch) -> None:
    data_root = tmp_path / "shared"
    accessor = _StrictRecursiveAccessor(data_root)
    monkeypatch.setattr(shared_data, "_get_accessor", lambda: accessor)
    shared_data._LAST_LOGGED_LAYOUT = None
    shared_data._VOLUME = None

    _write_json(
        data_root / "raw" / "news" / "2026-03-17" / "latest.json",
        '{"id":"latest","geo":{"neighborhood":"Loop"}}',
    )
    _write_json(
        data_root / "raw" / "news" / "2026-03-16" / "older.json",
        '{"id":"older","geo":{"neighborhood":"West Loop"}}',
    )

    news_dir = shared_data.get_raw_data_dir() / "news"
    files = shared_data.iter_json_files(news_dir)
    assert [path.name for path in files] == ["latest.json", "older.json"]

    stats = shared_data.scan_source_directories({"news": news_dir}, neighborhood_sample_limit=2)
    assert stats["news"]["doc_count"] == 2
    assert stats["news"]["active"] is True
    assert stats["news"]["neighborhoods_covered"] == {"Loop", "West Loop"}


def test_processed_data_helpers_load_json_directory_and_latest_file(tmp_path, monkeypatch) -> None:
    data_root = tmp_path / "shared"
    _install_local_accessor(monkeypatch, data_root)

    _write_json(data_root / "processed" / "geo" / "neighborhood_metrics.json", '{"features": []}')
    _write_json(data_root / "processed" / "summaries" / "news_summary.json", '{"count": 1}')
    _write_json(data_root / "processed" / "summaries" / "politics_summary.json", '{"count": 2}')
    _write_json(data_root / "processed" / "parking" / "analysis" / "loop_old.json", '{"id":"old"}')
    _write_json(data_root / "processed" / "parking" / "analysis" / "loop_new.json", '{"id":"new"}')

    older = data_root / "processed" / "parking" / "analysis" / "loop_old.json"
    newer = data_root / "processed" / "parking" / "analysis" / "loop_new.json"
    os.utime(older, (1, 1))
    os.utime(newer, (2, 2))

    assert shared_data.load_processed_json("geo", "neighborhood_metrics.json", default={}) == {"features": []}
    assert shared_data.load_processed_json_directory("summaries", stem_suffix_to_strip="_summary") == {
        "news": {"count": 1},
        "politics": {"count": 2},
    }
    latest = shared_data.find_latest_processed_json_file("parking", "analysis", pattern="loop_*.json")
    assert latest is not None
    assert latest.name == "loop_new.json"


def test_raw_source_stats_and_read_helpers(tmp_path, monkeypatch) -> None:
    data_root = tmp_path / "shared"
    _install_local_accessor(monkeypatch, data_root)

    _write_json(
        data_root / "raw" / "news" / "2026-03-17" / "latest.json",
        '{"id":"n1","title":"Loop update","content":"Loop storefront changes","geo":{"neighborhood":"Loop"}}',
    )
    _write_json(
        data_root / "raw" / "news" / "2026-03-16" / "older.json",
        '{"id":"n2","title":"Other update","geo":{"neighborhood":"Hyde Park"}}',
    )

    stats = shared_data.get_raw_source_stats(["news", "politics"])
    assert stats["news"]["doc_count"] == 2
    assert stats["news"]["active"] is True
    assert stats["news"]["last_update"] is not None
    assert stats["politics"] == {"doc_count": 0, "active": False, "last_update": None}

    docs = [
        {
            "id": "insp-1",
            "title": "Cafe inspection",
            "content": "Inspection in Loop",
            "metadata": {"dataset": "food_inspections", "raw_record": {"address": "123 Loop Ave"}},
            "geo": {"neighborhood": "Loop"},
        },
        {
            "id": "permit-1",
            "title": "Permit issued",
            "content": "Construction permit",
            "metadata": {"dataset": "building_permits", "raw_record": {"address": "456 Ashland"}},
            "geo": {"neighborhood": "West Town"},
        },
    ]

    assert [doc["id"] for doc in read_helpers.filter_docs_by_neighborhood(docs, "loop")] == ["insp-1"]
    assert [doc["id"] for doc in read_helpers.filter_public_data_by_dataset(docs, "food_inspections")] == ["insp-1"]

    transformed = read_helpers.transform_doc_for_graph(
        {
            "id": "doc-1",
            "title": "Doc",
            "memoryEntries": [
                {
                    "id": "mem-1",
                    "content": "Memory",
                    "memoryRelations": {"mem-0": "updates", "mem-x": "ignored"},
                }
            ],
            "x": 10,
            "y": 20,
        }
    )
    assert transformed["id"] == "doc-1"
    assert transformed["x"] == 10
    assert transformed["memoryEntries"][0]["memoryRelations"] == [
        {"targetMemoryId": "mem-0", "relationType": "updates"}
    ]


def test_backend_routes_read_shared_raw_and_processed_data(tmp_path, monkeypatch) -> None:
    data_root = tmp_path / "shared"
    client = _make_client(monkeypatch, data_root)

    _write_json(
        data_root / "raw" / "news" / "2026-03-17" / "news.json",
        """
        {
          "id": "news-1",
          "title": "Loop storefront demand rises",
          "content": "Loop businesses are seeing more foot traffic.",
          "timestamp": "2026-03-17T12:00:00+00:00",
          "geo": {"neighborhood": "Loop"}
        }
        """.strip(),
    )
    _write_json(
        data_root / "raw" / "politics" / "2026-03-17" / "policy.json",
        """
        {
          "id": "pol-1",
          "title": "Loop zoning update",
          "content": "New permit requirements affect Loop corridors.",
          "timestamp": "2026-03-17T08:00:00+00:00",
          "geo": {"neighborhood": "Loop"}
        }
        """.strip(),
    )
    _write_json(
        data_root / "raw" / "public_data" / "2026-03-17" / "inspection.json",
        """
        {
          "id": "insp-1",
          "title": "Cafe inspection",
          "content": "Inspection in Loop",
          "metadata": {
            "dataset": "food_inspections",
            "raw_record": {
              "results": "Fail",
              "address": "123 Loop Ave",
              "community_area_name": "Loop"
            }
          },
          "geo": {"neighborhood": "Loop"}
        }
        """.strip(),
    )
    _write_json(
        data_root / "raw" / "reddit" / "2026-03-17" / "post.json",
        """
        {
          "id": "reddit-1",
          "title": "Loop coffee shops",
          "content": "People want more late-night cafes.",
          "geo": {"neighborhood": "Loop"}
        }
        """.strip(),
    )
    _write_json(
        data_root / "raw" / "reviews" / "2026-03-17" / "review.json",
        """
        {
          "id": "review-1",
          "title": "Loop cafe reviews",
          "content": "Customers like the all-day coffee program.",
          "geo": {"neighborhood": "Loop"}
        }
        """.strip(),
    )
    _write_json(
        data_root / "raw" / "realestate" / "2026-03-17" / "listing.json",
        """
        {
          "id": "realestate-1",
          "title": "Loop retail lease",
          "content": "Retail space available in the Loop.",
          "geo": {"neighborhood": "Loop"}
        }
        """.strip(),
    )
    _write_json(
        data_root / "raw" / "tiktok" / "2026-03-17" / "video.json",
        """
        {
          "id": "tiktok-1",
          "title": "TikTok video",
          "content": "12K\\n[Transcript] Loop coffee shops are packed after 6pm.",
          "url": "https://www.tiktok.com/@loopcoffee/video/123",
          "metadata": {
            "views": "12K"
          },
          "geo": {"neighborhood": "Loop"}
        }
        """.strip(),
    )
    _write_json(
        data_root / "processed" / "geo" / "neighborhood_metrics.json",
        """
        {
          "type": "FeatureCollection",
          "features": [
            {
              "type": "Feature",
              "properties": {
                "neighborhood": "Loop",
                "population": 5000
              }
            }
          ]
        }
        """.strip(),
    )
    _write_json(
        data_root / "processed" / "demographics_summary.json",
        """
        {
          "city_wide": {
            "total_population": 12345
          }
        }
        """.strip(),
    )
    _write_json(
        data_root / "processed" / "cctv" / "synthetic_analytics.json",
        """
        {
          "Loop": {
            "cameras": {"active_cameras": 3},
            "timeseries": {
              "peak_hour": 17,
              "peak_pedestrians": 120,
              "hours": []
            }
          }
        }
        """.strip(),
    )

    sources = client.get("/api/data/sources")
    assert sources.status_code == 200
    assert sources.json()["news"] == {"count": 1, "active": True}
    assert sources.json()["reddit"] == {"count": 1, "active": True}
    assert sources.json()["tiktok"] == {"count": 1, "active": True}
    assert sources.json()["federal_register"] == {"count": 0, "active": False}

    news = client.get("/api/data/news")
    assert news.status_code == 200
    assert [doc["id"] for doc in news.json()] == ["news-1"]

    summary = client.get("/api/data/summary")
    assert summary.status_code == 200
    assert summary.json() == {
        "total_documents": 7,
        "source_counts": {
            "news": 1,
            "politics": 1,
            "federal_register": 0,
            "public_data": 1,
            "demographics": 0,
            "reddit": 1,
            "reviews": 1,
            "realestate": 1,
            "tiktok": 1,
        },
        "demographics": {"total_population": 12345},
    }

    geo = client.get("/api/data/geo")
    assert geo.status_code == 200
    assert geo.json()["features"][0]["properties"]["neighborhood"] == "Loop"

    inspections = client.get("/api/data/inspections")
    assert inspections.status_code == 200
    assert [doc["id"] for doc in inspections.json()] == ["insp-1"]

    reddit = client.get("/api/data/reddit?neighborhood=Loop")
    assert reddit.status_code == 200
    assert [doc["id"] for doc in reddit.json()] == ["reddit-1"]

    reviews = client.get("/api/data/reviews?neighborhood=Loop")
    assert reviews.status_code == 200
    assert [doc["id"] for doc in reviews.json()] == ["review-1"]

    realestate = client.get("/api/data/realestate?neighborhood=Loop")
    assert realestate.status_code == 200
    assert [doc["id"] for doc in realestate.json()] == ["realestate-1"]

    tiktok = client.get("/api/data/tiktok?neighborhood=Loop")
    assert tiktok.status_code == 200
    tiktok_payload = tiktok.json()
    assert [doc["id"] for doc in tiktok_payload] == ["tiktok-1"]
    assert tiktok_payload[0]["title"] == "Loop coffee shops are packed after 6pm"
    assert tiktok_payload[0]["metadata"]["creator"] == "loopcoffee"
    assert tiktok_payload[0]["metadata"]["views_normalized"] == 12000

    cctv = client.get("/api/data/cctv/timeseries/Loop")
    assert cctv.status_code == 200
    assert cctv.json()["peak_hour"] == 17

    neighborhood = client.get("/api/data/neighborhood/Loop")
    assert neighborhood.status_code == 200
    payload = neighborhood.json()
    assert payload["metrics"]["population"] == 5000
    assert payload["inspection_stats"]["failed"] == 1
    assert payload["news"][0]["id"] == "news-1"
    assert payload["politics"][0]["id"] == "pol-1"
    assert payload["cctv"]["peak_hour"] == 17


def test_backend_route_snapshot_cache_reuses_scan_results(tmp_path, monkeypatch) -> None:
    data_root = tmp_path / "shared"
    accessor = _CountingAccessor(data_root)
    monkeypatch.setattr(shared_data, "_get_accessor", lambda: accessor)
    shared_data._LAST_LOGGED_LAYOUT = None
    shared_data._VOLUME = None
    data_routes_module._DATA_SNAPSHOT_CACHE.clear()

    _write_json(
        data_root / "raw" / "news" / "2026-03-17" / "news.json",
        '{"id":"news-1","geo":{"neighborhood":"Loop"}}',
    )
    _write_json(
        data_root / "processed" / "enriched" / "doc-1.json",
        '{"id":"enriched-1"}',
    )

    app = FastAPI()
    app.include_router(data_router, prefix="/api/data")
    client = TestClient(app)

    sources = client.get("/api/data/sources")
    assert sources.status_code == 200
    calls_after_first = len(accessor.list_entries_calls)
    assert calls_after_first > 0

    status = client.get("/api/data/status")
    assert status.status_code == 200
    assert len(accessor.list_entries_calls) == calls_after_first
    assert status.json()["enriched_docs"] == 1


def test_backend_routes_do_not_read_fixture_tree(tmp_path, monkeypatch) -> None:
    data_root = tmp_path / "shared"
    fixture_root = tmp_path / "fixtures" / "demo_data"

    _write_json(
        fixture_root / "processed" / "geo" / "neighborhood_metrics.json",
        '{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"neighborhood":"Fixture Loop"}}]}',
    )
    _write_json(
        fixture_root / "processed" / "summaries" / "news_summary.json",
        '{"headline_count": 99}',
    )

    _install_local_accessor(monkeypatch, data_root)

    app = FastAPI()
    app.include_router(data_router, prefix="/api/data")
    client = TestClient(app)

    geo = client.get("/api/data/geo")
    assert geo.status_code == 200
    assert geo.json() == {"type": "FeatureCollection", "features": []}

    summary = client.get("/api/data/summary")
    assert summary.status_code == 200
    assert summary.json() == {
        "total_documents": 0,
        "source_counts": {
            "news": 0,
            "politics": 0,
            "federal_register": 0,
            "public_data": 0,
            "demographics": 0,
            "reddit": 0,
            "reviews": 0,
            "realestate": 0,
            "tiktok": 0,
        },
        "demographics": {},
    }


def test_backend_status_and_metrics_routes_own_document_freshness(tmp_path, monkeypatch) -> None:
    data_root = tmp_path / "shared"
    client = _make_client(monkeypatch, data_root)

    _write_json(
        data_root / "raw" / "news" / "2026-03-20" / "recent.json",
        '{"id":"news-1","geo":{"neighborhood":"Loop"}}',
    )
    _write_json(
        data_root / "raw" / "politics" / "2026-03-18" / "older.json",
        '{"id":"pol-1","geo":{"neighborhood":"West Loop"}}',
    )
    _write_json(
        data_root / "processed" / "enriched" / "doc-1.json",
        '{"id":"enriched-1"}',
    )

    recent_path = data_root / "raw" / "news" / "2026-03-20" / "recent.json"
    stale_path = data_root / "raw" / "politics" / "2026-03-18" / "older.json"
    os.utime(recent_path, (1_742_554_800, 1_742_554_800))
    os.utime(stale_path, (1, 1))

    class FrozenDateTime:
        @classmethod
        def now(cls, tz=None):
            from datetime import datetime, timezone

            return datetime(2025, 3, 21, 12, 0, tzinfo=timezone.utc)

        @classmethod
        def fromisoformat(cls, value):
            from datetime import datetime

            return datetime.fromisoformat(value)

    monkeypatch.setattr(data_routes_module, "datetime", FrozenDateTime)

    status = client.get("/api/data/status")
    assert status.status_code == 200
    status_data = status.json()
    assert set(status_data) == {"pipelines", "enriched_docs", "total_docs"}
    assert status_data["pipelines"]["news"]["state"] == "idle"
    assert status_data["pipelines"]["politics"]["state"] == "stale"
    assert status_data["pipelines"]["reddit"]["state"] == "no_data"
    assert status_data["enriched_docs"] == 1
    assert status_data["total_docs"] == 2

    metrics = client.get("/api/data/metrics")
    assert metrics.status_code == 200
    assert metrics.json() == {
        "total_documents": 2,
        "active_pipelines": 2,
        "neighborhoods_covered": 2,
        "data_sources": 9,
        "neighborhoods_total": 77,
    }


def test_backend_user_profile_and_settings_alias_share_storage(tmp_path) -> None:
    client = _make_user_client(tmp_path)
    headers = {"x-user-id": "user-123"}

    create = client.put(
        "/api/data/user/profile",
        headers=headers,
        json={
            "business_type": "Cafe",
            "neighborhood": "Loop",
            "risk_tolerance": "high",
        },
    )
    assert create.status_code == 200
    created = create.json()
    assert created["clerk_user_id"] == "user-123"
    assert created["business_type"] == "Cafe"
    assert created["neighborhood"] == "Loop"
    assert created["risk_tolerance"] == "high"

    alias = client.get("/api/data/user/settings", headers=headers)
    assert alias.status_code == 200
    assert alias.json() == created

    update_via_alias = client.put(
        "/api/data/user/settings",
        headers=headers,
        json={
            "business_type": "Bakery",
            "neighborhood": "West Loop",
        },
    )
    assert update_via_alias.status_code == 200
    updated = update_via_alias.json()
    assert updated["clerk_user_id"] == "user-123"
    assert updated["business_type"] == "Bakery"
    assert updated["neighborhood"] == "West Loop"
    assert updated["risk_tolerance"] == "high"

    profile = client.get("/api/data/user/profile", headers=headers)
    assert profile.status_code == 200
    assert profile.json() == updated


def test_backend_user_queries_are_scoped_by_user_id(tmp_path) -> None:
    client = _make_user_client(tmp_path)
    user_headers = {"x-user-id": "user-a"}
    other_headers = {"x-user-id": "user-b"}

    first = client.post(
        "/api/data/user/queries",
        headers=user_headers,
        json={
            "query_text": "Coffee demand in Loop",
            "business_type": "Cafe",
            "neighborhood": "Loop",
        },
    )
    assert first.status_code == 200
    assert first.json()["clerk_user_id"] == "user-a"

    second = client.post(
        "/api/data/user/queries",
        headers=user_headers,
        json={
            "query_text": "Bakery permits in West Loop",
            "business_type": "Bakery",
            "neighborhood": "West Loop",
        },
    )
    assert second.status_code == 200

    third = client.post(
        "/api/data/user/queries",
        headers=other_headers,
        json={
            "query_text": "Salon outlook in Logan Square",
            "business_type": "Salon",
            "neighborhood": "Logan Square",
        },
    )
    assert third.status_code == 200

    user_queries = client.get("/api/data/user/queries?limit=5", headers=user_headers)
    assert user_queries.status_code == 200
    assert [query["query_text"] for query in user_queries.json()] == [
        "Bakery permits in West Loop",
        "Coffee demand in Loop",
    ]

    other_queries = client.get("/api/data/user/queries?limit=5", headers=other_headers)
    assert other_queries.status_code == 200
    assert [query["query_text"] for query in other_queries.json()] == [
        "Salon outlook in Logan Square",
    ]
