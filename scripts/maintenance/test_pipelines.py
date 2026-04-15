#!/usr/bin/env python3
"""Local test harness for data ingestion pipelines.

Mocks Modal entirely so every pipeline's _fetch_* functions can run locally.

Usage:
    python3 test_pipelines.py
"""
from __future__ import annotations

import asyncio
import os
import sys
import tempfile
import time
import types
from pathlib import Path


def _identity(fn=None, **_kw):
    """Return fn unchanged, or return a decorator that does the same."""
    if fn is not None:
        return fn
    return lambda f: f


def _identity_cls(cls=None, **_kw):
    if cls is not None:
        return cls
    return lambda c: c


class _FakeImage:
    """Fluent builder that returns itself for every chained call."""

    def __getattr__(self, _name):
        return lambda *_a, **_kw: self


class _FakeApp:
    """Fake modal.App — decorators are no-ops."""

    def __init__(self, *_a, **_kw):
        pass

    def function(self, fn=None, **_kw):
        return _identity(fn, **_kw)

    def cls(self, cls=None, **_kw):
        return _identity_cls(cls, **_kw)

    def local_entrypoint(self, fn=None, **_kw):
        return _identity(fn, **_kw)


class _FakeVolume:
    @staticmethod
    def from_name(*_a, **_kw):
        return _FakeVolume()

    def commit(self):
        pass

    def reload(self):
        pass


class _FakeQueue:
    @staticmethod
    def from_name(*_a, **_kw):
        return _FakeQueue()

    def put(self, *_a, **_kw):
        pass

    def get(self, *_a, **_kw):
        return None


class _FakeSecret:
    @staticmethod
    def from_name(*_a, **_kw):
        return _FakeSecret()


class _FakeDict:
    """Fake modal.Dict — in-memory dict with .from_name() constructor."""

    _store: dict = {}

    @staticmethod
    def from_name(*_a, **_kw):
        return _FakeDict()

    def __getitem__(self, key):
        return self._store[key]

    def __setitem__(self, key, value):
        self._store[key] = value

    def keys(self):
        return iter(self._store.keys())

    def get(self, key):
        return self._store.get(key)


def _bootstrap_fake_modal_environment() -> None:
    tmpdir = tempfile.mkdtemp(prefix="pipeline_test_")

    # Avoid importing full local discovery graph from modal_app.__init__.
    # For this harness we only need direct pipeline modules.
    os.environ.setdefault("MODAL_IS_REMOTE", "1")

    modal_module = types.ModuleType("modal")
    modal_module.App = _FakeApp
    modal_module.Volume = _FakeVolume
    modal_module.Queue = _FakeQueue
    modal_module.Secret = _FakeSecret
    modal_module.Image = _FakeImage()
    modal_module.enter = _identity
    modal_module.exit = _identity
    modal_module.method = _identity
    modal_module.batched = _identity
    modal_module.build = _identity
    modal_module.web_endpoint = _identity
    modal_module.asgi_app = _identity
    modal_module.Period = lambda **_kw: None
    modal_module.Retries = lambda *_a, **_kw: None
    modal_module.Cron = lambda *_a, **_kw: None
    modal_module.concurrent = _identity
    modal_module.Dict = _FakeDict
    sys.modules["modal"] = modal_module

    vol_mod = types.ModuleType("modal_app.volume")
    vol_mod.app = _FakeApp("alethia")
    vol_mod.volume = _FakeVolume()
    vol_mod.weights_volume = _FakeVolume()
    vol_mod.VOLUME_MOUNT = os.path.join(tmpdir, "data")
    vol_mod.WEIGHTS_MOUNT = os.path.join(tmpdir, "weights")
    vol_mod.RAW_DATA_PATH = os.path.join(tmpdir, "data", "raw")
    vol_mod.PROCESSED_DATA_PATH = os.path.join(tmpdir, "data", "processed")
    vol_mod.CACHE_PATH = os.path.join(tmpdir, "data", "cache")

    for image_name in (
        "base_image",
        "reddit_image",
        "politics_image",
        "data_image",
        "vllm_image",
        "classify_image",
        "web_image",
        "video_image",
        "label_image",
        "yolo_image",
        "tiktok_image",
        "transcribe_image",
    ):
        setattr(vol_mod, image_name, _FakeImage())

    sys.modules["modal_app.volume"] = vol_mod

    cls_mod = types.ModuleType("modal_app.classify")
    cls_mod.doc_queue = _FakeQueue()
    sys.modules["modal_app.classify"] = cls_mod

    for subdir in ("data/raw", "data/cache", "data/dedup", "data/processed"):
        Path(os.path.join(tmpdir, subdir)).mkdir(parents=True, exist_ok=True)


def _load_pipeline_modules():
    from modal_app.pipelines import news, reddit, politics, public_data
    from modal_app.pipelines import demographics, federal_register
    from modal_app.pipelines import realestate, reviews
    from modal_app.pipelines import cctv, traffic

    return {
        "news": news,
        "reddit": reddit,
        "politics": politics,
        "public_data": public_data,
        "demographics": demographics,
        "federal_register": federal_register,
        "realestate": realestate,
        "reviews": reviews,
        "cctv": cctv,
        "traffic": traffic,
    }

# ── Reporting helpers ─────────────────────────────────────────────────────────

def _geo_count(docs: list[dict]) -> tuple[int, int]:
    """Count docs that have a non-empty geo dict."""
    total = len(docs)
    geo = sum(
        1 for d in docs
        if d.get("geo") and any(d["geo"].values())
    )
    return geo, total

def _sample(docs: list[dict], max_len: int = 70) -> str:
    for d in docs:
        title = d.get("title") or d.get("content", "")
        if title:
            return (title[:max_len] + "...") if len(title) > max_len else title
    return "(no title)"

def _fields(docs: list[dict]) -> str:
    if not docs:
        return ""
    return ", ".join(sorted(docs[0].keys()))

def _report(label: str, docs: list[dict] | None, elapsed: float, error: str = ""):
    print(f"\n{'━' * 3} {label} {'━' * (60 - len(label))}")
    if error:
        print(f"  Status:    ERROR")
        print(f"  Error:     {error}")
        print(f"  Elapsed:   {elapsed:.1f}s")
        return
    if docs is None:
        print(f"  Status:    SKIPPED (no API key)")
        return
    geo, total = _geo_count(docs)
    geo_pct = f"{geo / total * 100:.0f}%" if total else "n/a"
    print(f"  Status:    OK")
    print(f"  Documents: {total}")
    print(f"  Sample:    \"{_sample(docs)}\"")
    print(f"  Geo-tagged: {geo}/{total} ({geo_pct})")
    print(f"  Fields:    {_fields(docs)}")
    print(f"  Elapsed:   {elapsed:.1f}s")


# ── Pipeline runners ──────────────────────────────────────────────────────────

async def run_all():
    modules = _load_pipeline_modules()
    news = modules["news"]
    reddit = modules["reddit"]
    politics = modules["politics"]
    public_data = modules["public_data"]
    demographics = modules["demographics"]
    federal_register = modules["federal_register"]
    realestate = modules["realestate"]
    reviews = modules["reviews"]
    cctv = modules["cctv"]
    traffic = modules["traffic"]

    results: list[tuple[str, list[dict] | None, float, str]] = []

    async def _run(label: str, coro_fn, *args):
        t0 = time.monotonic()
        try:
            docs = await coro_fn(*args)
            if docs is None:
                docs = []
            results.append((label, docs, time.monotonic() - t0, ""))
        except Exception as e:
            results.append((label, [], time.monotonic() - t0, str(e)))

    # ── No API key needed ─────────────────────────────────────────────────

    await _run("NEWS (RSS)", news._fetch_all_rss)
    await _run("NEWS (Google RSS)", news._fetch_google_news_rss)
    await _run(
        "REDDIT (RSS)",
        reddit.RedditRetrievalService().fetch_hourly_candidates_via_rss,
    )
    await _run("POLITICS (Legislation)", politics._fetch_legislation_rest)
    await _run("POLITICS (Events)", politics._fetch_events)
    await _run("PUBLIC DATA (no token)", public_data._fetch_all_without_token)
    await _run("DEMOGRAPHICS (Census)", demographics._fetch_census)
    await _run("FEDERAL REGISTER", federal_register._fetch_federal_register)
    await _run("REAL ESTATE (placeholders)", realestate._create_placeholder_listings)
    await _run("CCTV (IDOT cameras)", cctv._fetch_idot_cameras)

    # ── API-key gated ─────────────────────────────────────────────────────

    newsapi_key = os.environ.get("NEWSAPI_KEY", "")
    if newsapi_key:
        await _run("NEWS (NewsAPI)", news._fetch_newsapi, newsapi_key)
    else:
        results.append(("NEWS (NewsAPI)", None, 0, ""))

    yelp_key = os.environ.get("YELP_API_KEY", "")
    if yelp_key:
        await _run("REVIEWS (Yelp)", reviews._fetch_yelp, yelp_key)
    else:
        results.append(("REVIEWS (Yelp)", None, 0, ""))

    google_key = os.environ.get("GOOGLE_PLACES_API_KEY", "")
    if google_key:
        await _run("REVIEWS (Google Places)", reviews._fetch_google_places, google_key)
    else:
        results.append(("REVIEWS (Google Places)", None, 0, ""))

    tomtom_key = os.environ.get("TOMTOM_API_KEY", "")
    if tomtom_key:
        await _run("TRAFFIC (TomTom)", traffic._fetch_all_traffic, tomtom_key)
    else:
        results.append(("TRAFFIC (TomTom)", None, 0, ""))

    # ── Print report ──────────────────────────────────────────────────────
    print("\n" + "=" * 64)
    print("  PIPELINE TEST REPORT")
    print("=" * 64)

    ok = err = skip = 0
    for label, docs, elapsed, error in results:
        _report(label, docs, elapsed, error)
        if docs is None:
            skip += 1
        elif error:
            err += 1
        else:
            ok += 1

    print("\n" + "=" * 64)
    print(f"  SUMMARY: {ok} OK / {err} ERROR / {skip} SKIPPED")
    print("=" * 64 + "\n")


if __name__ == "__main__":
    _bootstrap_fake_modal_environment()
    asyncio.run(run_all())
