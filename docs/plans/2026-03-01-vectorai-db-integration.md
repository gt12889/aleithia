# Actian VectorAI DB Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Actian VectorAI DB as a local semantic search layer complementing Supermemory, embedded at ingestion time and queried by the agent swarm + chat endpoint.

**Architecture:** Documents are embedded with `all-MiniLM-L6-v2` (384d) in `classify.py` after enrichment and upserted to VectorAI DB running as a Modal service. Agents query VectorAI DB with semantic search + filter DSL instead of scanning JSON files. Supermemory continues running in parallel. All VectorAI DB operations degrade gracefully via `vectordb_available()` guard.

**Tech Stack:** Actian VectorAI DB (Docker: `williamimoh/actian-vectorai-db:1.0b`), `actiancortex` Python client (gRPC), `sentence-transformers/all-MiniLM-L6-v2`, Modal `@modal.cls`

**Design doc:** `docs/plans/2026-03-01-vectorai-db-integration-design.md`

---

### Task 1: Create VectorAI DB Modal Image

**Files:**
- Modify: `modal_app/volume.py` (add image definition after line 134)

**Step 1: Add vectordb_image to volume.py**

Add after `parking_image` (line 134):

```python
# VectorAI DB: Actian vector database + embedding model + Python client
vectordb_image = (
    modal.Image.from_registry("williamimoh/actian-vectorai-db:1.0b")
    .pip_install(
        "sentence-transformers==3.3.1",
        "torch>=2.4.0",
        "grpcio>=1.60.0",
        "httpx==0.27.0",
        "pydantic==2.9.0",
        *_arize_packages,
    )
    .add_local_python_source("modal_app", copy=True)
)
```

**Step 2: Verify import succeeds**

Run: `cd /home/gt120/projects/hackillinois2026 && python3 -c "from modal_app.volume import vectordb_image; print('OK')"`
Expected: `OK`

**Step 3: Commit**

```bash
git add modal_app/volume.py
git commit -m "feat: add VectorAI DB Modal image definition"
```

---

### Task 2: Create vectordb.py — Availability Guard + Embedding Helper

**Files:**
- Create: `modal_app/vectordb.py`
- Test: `tests/test_vectordb.py`

**Step 1: Write failing tests for vectordb_available() and embed_text()**

Create `tests/test_vectordb.py`:

```python
"""Tests for VectorAI DB service module."""
import os
from unittest.mock import patch, MagicMock


def test_vectordb_available_returns_false_without_service():
    """vectordb_available() returns False when no VectorDB service is reachable."""
    from modal_app.vectordb import vectordb_available
    # Without a running VectorDB container, should return False
    assert vectordb_available() is False


def test_vectordb_available_env_override():
    """VECTORDB_DISABLED=1 forces vectordb_available() to False."""
    from modal_app.vectordb import vectordb_available
    with patch.dict(os.environ, {"VECTORDB_DISABLED": "1"}):
        assert vectordb_available() is False


def test_build_payload_from_doc():
    """build_payload creates correct metadata dict from a document."""
    from modal_app.vectordb import build_payload

    doc = {
        "id": "test-123",
        "source": "news",
        "title": "Test Article",
        "content": "Some content about Loop neighborhood",
        "timestamp": "2026-03-01T00:00:00Z",
        "geo": {"neighborhood": "Loop"},
        "metadata": {},
    }
    classification = {"labels": ["regulatory", "economic"], "scores": [0.9, 0.7]}
    sentiment = {"label": "positive", "score": 0.85}

    payload = build_payload(doc, classification, sentiment)

    assert payload["doc_id"] == "test-123"
    assert payload["source"] == "news"
    assert payload["neighborhood"] == "Loop"
    assert payload["category"] == "regulatory"
    assert payload["sentiment_label"] == "positive"
    assert payload["sentiment_score"] == 0.85


def test_build_payload_handles_missing_fields():
    """build_payload handles docs with missing optional fields."""
    from modal_app.vectordb import build_payload

    doc = {"id": "bare-doc", "source": "reddit", "title": "Minimal", "content": ""}
    payload = build_payload(doc, {}, {})

    assert payload["doc_id"] == "bare-doc"
    assert payload["neighborhood"] == ""
    assert payload["category"] == ""
    assert payload["sentiment_label"] == "neutral"


def test_build_embed_text():
    """build_embed_text concatenates title + truncated content."""
    from modal_app.vectordb import build_embed_text

    doc = {"title": "My Title", "content": "A" * 2000}
    text = build_embed_text(doc)

    assert text.startswith("My Title ")
    assert len(text) <= len("My Title ") + 1000
```

**Step 2: Run tests to verify they fail**

Run: `cd /home/gt120/projects/hackillinois2026 && python3 -m pytest tests/test_vectordb.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'modal_app.vectordb'`

**Step 3: Write minimal vectordb.py implementation**

Create `modal_app/vectordb.py`:

```python
"""Actian VectorAI DB integration — local vector search layer.

Complements Supermemory with fast local semantic retrieval using
HNSW-indexed vectors. Documents are embedded with all-MiniLM-L6-v2 (384d)
at ingestion time and queried by the agent swarm at search time.

All operations degrade gracefully via vectordb_available().
"""
import os


# ---------------------------------------------------------------------------
# Availability guard (same pattern as openai_utils.py)
# ---------------------------------------------------------------------------

_vectordb_healthy = False


def vectordb_available() -> bool:
    """Check if VectorAI DB service is reachable and healthy.

    Returns False if VECTORDB_DISABLED=1 env var is set or if no
    VectorDB container has registered as healthy.
    """
    if os.environ.get("VECTORDB_DISABLED", "").strip() == "1":
        return False
    return _vectordb_healthy


# ---------------------------------------------------------------------------
# Payload + text helpers (pure functions, no DB dependency)
# ---------------------------------------------------------------------------

EMBED_CONTENT_LIMIT = 1000
VECTOR_DIMENSION = 384


def build_payload(doc: dict, classification: dict, sentiment: dict) -> dict:
    """Build VectorAI DB payload dict from a document + enrichment results."""
    geo = doc.get("geo", {}) or {}
    labels = classification.get("labels", [])
    return {
        "doc_id": doc.get("id", ""),
        "source": doc.get("source", ""),
        "title": doc.get("title", ""),
        "neighborhood": geo.get("neighborhood", ""),
        "timestamp": doc.get("timestamp", ""),
        "category": labels[0] if labels else "",
        "sentiment_label": sentiment.get("label", "neutral"),
        "sentiment_score": sentiment.get("score", 0.5),
    }


def build_embed_text(doc: dict) -> str:
    """Build text string for embedding from doc title + truncated content."""
    title = doc.get("title", "")
    content = doc.get("content", "")[:EMBED_CONTENT_LIMIT]
    return f"{title} {content}".strip()
```

**Step 4: Run tests to verify they pass**

Run: `cd /home/gt120/projects/hackillinois2026 && python3 -m pytest tests/test_vectordb.py -v`
Expected: 5 passed

**Step 5: Commit**

```bash
git add modal_app/vectordb.py tests/test_vectordb.py
git commit -m "feat: add vectordb module with availability guard and payload helpers"
```

---

### Task 3: Create VectorDBService Modal Class

**Files:**
- Modify: `modal_app/vectordb.py` (add service class)

**Step 1: Add VectorDBService class to vectordb.py**

Append to `modal_app/vectordb.py`:

```python
import modal

from modal_app.volume import app, volume, vectordb_image


VECTORDB_DATA_PATH = "/data/vectordb"

# Source-specific collections + unified enriched collection
COLLECTIONS = [
    "news", "politics", "reddit", "reviews", "realestate",
    "federal_register", "tiktok", "demographics", "public_data",
    "traffic", "cctv", "vision", "parking", "worldpop", "enriched",
]


@app.cls(
    image=vectordb_image,
    volumes={"/data": volume},
    secrets=[modal.Secret.from_name("arize-secrets")],
    min_containers=1,
    scaledown_window=300,
    timeout=120,
)
class VectorDBService:
    """Actian VectorAI DB service with sentence-transformer embeddings.

    Manages the VectorAI DB process, creates collections, and provides
    embed/upsert/search methods for the agent swarm and enrichment pipeline.
    """

    @modal.enter()
    def startup(self):
        """Start VectorAI DB process and connect client."""
        import subprocess
        from pathlib import Path
        from sentence_transformers import SentenceTransformer

        from modal_app.instrumentation import init_tracing, get_tracer
        init_tracing()
        self._tracer = get_tracer("alethia.vectordb")

        # Ensure data directory exists
        Path(VECTORDB_DATA_PATH).mkdir(parents=True, exist_ok=True)

        # Start VectorAI DB server process (background)
        self._server_proc = subprocess.Popen(
            ["vectoraidb", "--data-dir", VECTORDB_DATA_PATH, "--port", "50051"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )

        # Load embedding model
        self._embedder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

        # Wait for server to be ready, then connect
        import time
        from cortex.client import CortexClient
        from cortex.models import DistanceMetric

        for attempt in range(30):
            try:
                self._client = CortexClient(host="localhost", port=50051)
                self._client.health_check()
                break
            except Exception:
                time.sleep(1)
        else:
            raise RuntimeError("VectorAI DB failed to start within 30s")

        # Create collections if they don't exist
        for collection_name in COLLECTIONS:
            if not self._client.has_collection(collection_name):
                self._client.create_collection(
                    name=collection_name,
                    dimension=VECTOR_DIMENSION,
                    distance_metric=DistanceMetric.COSINE,
                )

        # Mark as healthy
        global _vectordb_healthy
        _vectordb_healthy = True
        print(f"VectorAI DB ready: {len(COLLECTIONS)} collections initialized")

    @modal.method()
    def embed_text(self, text: str) -> list[float]:
        """Embed text using all-MiniLM-L6-v2. Returns 384-dim float vector."""
        span_ctx = self._tracer.start_as_current_span("vectordb.embed") if self._tracer else None
        span = span_ctx.__enter__() if span_ctx else None
        try:
            embedding = self._embedder.encode(text, normalize_embeddings=True)
            if span:
                span.set_attribute("vectordb.text_length", len(text))
            return embedding.tolist()
        finally:
            if span_ctx:
                span_ctx.__exit__(None, None, None)

    @modal.method()
    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Batch embed texts. Returns list of 384-dim float vectors."""
        span_ctx = self._tracer.start_as_current_span("vectordb.embed_batch") if self._tracer else None
        span = span_ctx.__enter__() if span_ctx else None
        try:
            embeddings = self._embedder.encode(texts, normalize_embeddings=True, batch_size=32)
            if span:
                span.set_attribute("vectordb.batch_size", len(texts))
            return [e.tolist() for e in embeddings]
        finally:
            if span_ctx:
                span_ctx.__exit__(None, None, None)

    @modal.method()
    def upsert_doc(self, doc_id: str, embedding: list[float], payload: dict, collection: str = "enriched"):
        """Upsert a single document vector + payload into a collection."""
        span_ctx = self._tracer.start_as_current_span("vectordb.upsert") if self._tracer else None
        span = span_ctx.__enter__() if span_ctx else None
        try:
            self._client.upsert(
                collection=collection,
                id=doc_id,
                vector=embedding,
                payload=payload,
            )
            if span:
                span.set_attribute("vectordb.collection", collection)
                span.set_attribute("vectordb.doc_id", doc_id)
        finally:
            if span_ctx:
                span_ctx.__exit__(None, None, None)

    @modal.method()
    def batch_upsert_docs(self, doc_ids: list[str], embeddings: list[list[float]], payloads: list[dict], collection: str = "enriched"):
        """Batch upsert documents into a collection."""
        span_ctx = self._tracer.start_as_current_span("vectordb.batch_upsert") if self._tracer else None
        span = span_ctx.__enter__() if span_ctx else None
        try:
            self._client.batch_upsert(
                collection=collection,
                ids=doc_ids,
                vectors=embeddings,
                payloads=payloads,
            )
            self._client.flush(collection)
            if span:
                span.set_attribute("vectordb.collection", collection)
                span.set_attribute("vectordb.batch_size", len(doc_ids))
        finally:
            if span_ctx:
                span_ctx.__exit__(None, None, None)

    @modal.method()
    def search(self, query_embedding: list[float], collection: str = "enriched", top_k: int = 20, filter_dict: dict | None = None) -> list[dict]:
        """Semantic search with optional payload filters.

        Args:
            query_embedding: 384-dim query vector
            collection: Collection name to search
            top_k: Number of results to return
            filter_dict: Optional filter spec, e.g. {"neighborhood": "Loop"}

        Returns:
            List of dicts with keys: id, score, payload
        """
        span_ctx = self._tracer.start_as_current_span("vectordb.search") if self._tracer else None
        span = span_ctx.__enter__() if span_ctx else None
        try:
            if filter_dict:
                from cortex.filters import Filter, Field
                f = Filter()
                for key, value in filter_dict.items():
                    f = f.must(Field(key).eq(value))
                results = self._client.search_filtered(collection, query_embedding, f, top_k=top_k)
            else:
                results = self._client.search(collection, query_embedding, top_k=top_k)

            output = [
                {"id": r.id, "score": r.score, "payload": r.payload}
                for r in results
            ]
            if span:
                span.set_attribute("vectordb.collection", collection)
                span.set_attribute("vectordb.top_k", top_k)
                span.set_attribute("vectordb.results_count", len(output))
                span.set_attribute("vectordb.has_filter", bool(filter_dict))
            return output
        finally:
            if span_ctx:
                span_ctx.__exit__(None, None, None)

    @modal.method()
    def search_neighborhood(self, query_embedding: list[float], neighborhood: str, top_k: int = 50) -> list[dict]:
        """Convenience: search enriched collection filtered by neighborhood."""
        return self.search.local(
            query_embedding=query_embedding,
            collection="enriched",
            top_k=top_k,
            filter_dict={"neighborhood": neighborhood},
        )

    @modal.method()
    def health_check(self) -> dict:
        """Return health status and collection stats."""
        try:
            self._client.health_check()
            stats = {}
            for name in COLLECTIONS:
                try:
                    count = self._client.count(name)
                    stats[name] = count
                except Exception:
                    stats[name] = -1
            return {"status": "healthy", "collections": stats}
        except Exception as e:
            return {"status": "unhealthy", "error": str(e)}
```

**Step 2: Verify syntax**

Run: `cd /home/gt120/projects/hackillinois2026 && python3 -c "import ast; ast.parse(open('modal_app/vectordb.py').read()); print('Syntax OK')"`
Expected: `Syntax OK`

**Step 3: Commit**

```bash
git add modal_app/vectordb.py
git commit -m "feat: add VectorDBService Modal class with embed/upsert/search"
```

---

### Task 4: Register vectordb in __init__.py

**Files:**
- Modify: `modal_app/__init__.py` (add import)

**Step 1: Add vectordb import**

Add after line 35 (`from modal_app import lead_analyst`):

```python
    from modal_app import vectordb  # noqa: F401
```

**Step 2: Verify imports**

Run: `cd /home/gt120/projects/hackillinois2026 && python3 -c "import modal_app; print('OK')"`
Expected: `OK`

**Step 3: Commit**

```bash
git add modal_app/__init__.py
git commit -m "feat: register vectordb module for Modal function discovery"
```

---

### Task 5: Integrate VectorAI DB Upsert into classify.py

**Files:**
- Modify: `modal_app/classify.py` (add upsert after enrichment at line 190)
- Test: `tests/test_vectordb.py` (add integration test)

**Step 1: Write failing test for classify → vectordb upsert flow**

Append to `tests/test_vectordb.py`:

```python
def test_classify_vectordb_upsert_builds_correct_batch(monkeypatch):
    """Verify classify pipeline builds correct embed texts and payloads for VectorDB."""
    from modal_app.vectordb import build_embed_text, build_payload

    docs = [
        {
            "id": "doc-1",
            "source": "news",
            "title": "New Restaurant Opens",
            "content": "A new restaurant in Wicker Park",
            "geo": {"neighborhood": "Wicker Park"},
            "timestamp": "2026-03-01T00:00:00Z",
        },
        {
            "id": "doc-2",
            "source": "reddit",
            "title": "Gym Review",
            "content": "Best gym in Logan Square",
            "geo": {"neighborhood": "Logan Square"},
            "timestamp": "2026-03-01T00:00:00Z",
        },
    ]
    classifications = [
        {"labels": ["economic", "community"], "scores": [0.8, 0.6]},
        {"labels": ["community"], "scores": [0.7]},
    ]
    sentiments = [
        {"label": "positive", "score": 0.9},
        {"label": "neutral", "score": 0.5},
    ]

    texts = [build_embed_text(d) for d in docs]
    payloads = [build_payload(d, c, s) for d, c, s in zip(docs, classifications, sentiments)]

    assert len(texts) == 2
    assert "New Restaurant Opens" in texts[0]
    assert payloads[0]["neighborhood"] == "Wicker Park"
    assert payloads[0]["category"] == "economic"
    assert payloads[1]["sentiment_label"] == "neutral"
```

**Step 2: Run test**

Run: `cd /home/gt120/projects/hackillinois2026 && python3 -m pytest tests/test_vectordb.py::test_classify_vectordb_upsert_builds_correct_batch -v`
Expected: PASS (uses already-implemented helpers)

**Step 3: Modify classify.py to upsert to VectorAI DB after enrichment**

In `modal_app/classify.py`, after `await volume.commit.aio()` (line 190), add the VectorAI DB upsert block:

```python
        # Upsert enriched docs to VectorAI DB for semantic search
        try:
            from modal_app.vectordb import vectordb_available, build_embed_text, build_payload
            if vectordb_available():
                vdb_cls = modal.Cls.from_name("alethia", "VectorDBService")
                vdb = vdb_cls()

                embed_texts = [build_embed_text(d) for d in docs]
                embeddings = vdb.embed_batch.remote(embed_texts)

                doc_ids = [d.get("id", f"doc-{i}") for i, d in enumerate(docs)]
                payloads = [
                    build_payload(d, d.get("classification", {}), d.get("sentiment", {}))
                    for d in docs
                ]

                vdb.batch_upsert_docs.remote(doc_ids, embeddings, payloads, "enriched")
                print(f"VectorDB: upserted {len(docs)} docs to enriched collection")
        except Exception as e:
            print(f"VectorDB upsert failed (non-critical): {e}")
```

**Step 4: Verify syntax**

Run: `cd /home/gt120/projects/hackillinois2026 && python3 -c "import ast; ast.parse(open('modal_app/classify.py').read()); print('Syntax OK')"`
Expected: `Syntax OK`

**Step 5: Commit**

```bash
git add modal_app/classify.py tests/test_vectordb.py
git commit -m "feat: upsert enriched docs to VectorAI DB in classify pipeline"
```

---

### Task 6: Add Semantic Retrieval to neighborhood_intel_agent

**Files:**
- Modify: `modal_app/agents.py` (add VectorAI DB query path in neighborhood_intel_agent)

**Step 1: Add VectorDB semantic retrieval at top of neighborhood_intel_agent**

In `modal_app/agents.py`, inside `neighborhood_intel_agent()` after the span setup (after line 203, before the `for source in [...]` loop at line 207), add:

```python
        # --- VectorAI DB semantic retrieval (fast path) ---
        vectordb_docs = []
        try:
            from modal_app.vectordb import vectordb_available
            if vectordb_available():
                vdb_cls = modal.Cls.from_name("alethia", "VectorDBService")
                vdb = vdb_cls()

                query_text = f"{business_type} {neighborhood} {' '.join(focus_areas or [])}"
                query_embedding = vdb.embed_text.remote(query_text)
                vectordb_docs = vdb.search_neighborhood.remote(query_embedding, neighborhood, top_k=50)

                if vectordb_docs:
                    report["findings"]["vectordb"] = {
                        "count": len(vectordb_docs),
                        "avg_score": round(sum(d["score"] for d in vectordb_docs) / len(vectordb_docs), 4),
                        "top_categories": _aggregate_categories(vectordb_docs),
                    }
                    report["data_points"] += len(vectordb_docs)
                    if span:
                        span.set_attribute("agent.vectordb_results", len(vectordb_docs))
        except Exception as e:
            print(f"VectorDB query failed (falling back to file scan): {e}")
```

**Step 2: Add _aggregate_categories helper**

Add before the `neighborhood_intel_agent` function:

```python
def _aggregate_categories(vectordb_results: list[dict]) -> dict:
    """Aggregate category counts from VectorDB search results."""
    counts: dict[str, int] = {}
    for r in vectordb_results:
        cat = r.get("payload", {}).get("category", "")
        if cat:
            counts[cat] = counts.get(cat, 0) + 1
    return dict(sorted(counts.items(), key=lambda x: x[1], reverse=True)[:5])
```

**Step 3: Verify syntax**

Run: `cd /home/gt120/projects/hackillinois2026 && python3 -c "import ast; ast.parse(open('modal_app/agents.py').read()); print('Syntax OK')"`
Expected: `Syntax OK`

**Step 4: Commit**

```bash
git add modal_app/agents.py
git commit -m "feat: add VectorAI DB semantic retrieval to neighborhood_intel_agent"
```

---

### Task 7: Pass Pre-computed Embedding Through orchestrate_query

**Files:**
- Modify: `modal_app/agents.py` (orchestrate_query computes embedding once)
- Modify: `modal_app/web.py` (chat endpoint passes embedding)

**Step 1: Modify orchestrate_query to accept and forward query_embedding**

In `modal_app/agents.py`, update `orchestrate_query` signature (line 648) to accept optional `query_embedding`:

```python
async def orchestrate_query(user_id: str, question: str, business_type: str, target_neighborhood: str, trace_context: dict | None = None, query_embedding: list[float] | None = None) -> dict:
```

Before fan-out (after line 679, `child_ctx = inject_context()`), add:

```python
        # Pre-compute query embedding once for all agents (avoids 3x redundant embedding)
        if query_embedding is None:
            try:
                from modal_app.vectordb import vectordb_available
                if vectordb_available():
                    vdb_cls = modal.Cls.from_name("alethia", "VectorDBService")
                    vdb = vdb_cls()
                    query_text = f"{business_type} {target_neighborhood} {question}"
                    query_embedding = vdb.embed_text.remote(query_text)
            except Exception as e:
                print(f"Pre-compute embedding failed (agents will embed individually): {e}")
```

Update `neighborhood_intel_agent.spawn` calls (lines 685, 695) to pass `query_embedding`:

For primary (line 685):
```python
        primary_handle = neighborhood_intel_agent.spawn(
            neighborhood=target_neighborhood,
            business_type=business_type,
            focus_areas=["permits", "sentiment", "competition", "safety", "demographics"],
            trace_context=child_ctx,
            query_embedding=query_embedding,
        )
```

For comparisons (line 695):
```python
            handle = neighborhood_intel_agent.spawn(
                neighborhood=comp_neighborhood,
                business_type=business_type,
                focus_areas=["permits", "competition", "demographics"],
                trace_context=child_ctx,
                query_embedding=query_embedding,
            )
```

**Step 2: Update neighborhood_intel_agent signature to accept query_embedding**

Update line 173:

```python
async def neighborhood_intel_agent(neighborhood: str, business_type: str, focus_areas: list[str] | None = None, trace_context: dict | None = None, query_embedding: list[float] | None = None) -> dict:
```

In the VectorDB query block (added in Task 6), use the passed embedding instead of computing a new one:

```python
                if query_embedding is not None:
                    vectordb_docs = vdb.search_neighborhood.remote(query_embedding, neighborhood, top_k=50)
                else:
                    query_text = f"{business_type} {neighborhood} {' '.join(focus_areas or [])}"
                    embedding = vdb.embed_text.remote(query_text)
                    vectordb_docs = vdb.search_neighborhood.remote(embedding, neighborhood, top_k=50)
```

**Step 3: Modify web.py /chat to pass query_embedding**

In `modal_app/web.py`, before the `orchestrate_query.remote.aio()` call (around line 735), add embedding pre-computation:

```python
            # Pre-compute query embedding for VectorAI DB (shared across all agents)
            query_embedding = None
            try:
                from modal_app.vectordb import vectordb_available
                if vectordb_available():
                    vdb_cls = modal.Cls.from_name("alethia", "VectorDBService")
                    vdb = vdb_cls()
                    query_embedding = await vdb.embed_text.remote.aio(question)
            except Exception as e:
                print(f"Chat query embedding failed (non-critical): {e}")
```

Update the `orchestrate_query.remote.aio()` call to include `query_embedding`:

```python
            result = await orchestrate_query.remote.aio(
                user_id=user_id,
                question=question,
                business_type=business_type,
                target_neighborhood=neighborhood,
                trace_context=inject_context(),
                query_embedding=query_embedding,
            )
```

**Step 4: Verify syntax for both files**

Run: `cd /home/gt120/projects/hackillinois2026 && python3 -c "import ast; ast.parse(open('modal_app/agents.py').read()); ast.parse(open('modal_app/web.py').read()); print('Syntax OK')"`
Expected: `Syntax OK`

**Step 5: Commit**

```bash
git add modal_app/agents.py modal_app/web.py
git commit -m "feat: pass pre-computed query embedding through orchestrate_query to agents"
```

---

### Task 8: Add VectorDB Health to Reconciler and Status Endpoints

**Files:**
- Modify: `modal_app/reconciler.py` (add health check)
- Modify: `modal_app/web.py` (add vectordb status to /health and /status)

**Step 1: Add VectorDB health check to reconciler**

In `modal_app/reconciler.py`, at the end of `data_reconciler()` (before the return at line 198), add:

```python
    # Check VectorAI DB health
    vectordb_status = {"status": "not_configured"}
    try:
        from modal_app.vectordb import vectordb_available
        if vectordb_available():
            vdb_cls = modal.Cls.from_name("alethia", "VectorDBService")
            vdb = vdb_cls()
            vectordb_status = vdb.health_check.remote()
    except Exception as e:
        vectordb_status = {"status": "error", "error": str(e)}
    status_report["vectordb"] = vectordb_status
```

**Step 2: Add VectorDB to /health and /status endpoints in web.py**

Find the `/health` endpoint in web.py and add vectordb health to its response. Find the `/status` endpoint and add vectordb status there too. The exact insertion points depend on the current structure — add a `vectordb` key to each response dict using:

```python
    # VectorDB health
    vectordb_status = {"status": "not_configured"}
    try:
        from modal_app.vectordb import vectordb_available
        if vectordb_available():
            vdb_cls = modal.Cls.from_name("alethia", "VectorDBService")
            vdb = vdb_cls()
            vectordb_status = vdb.health_check.remote()
    except Exception:
        vectordb_status = {"status": "unavailable"}
```

**Step 3: Verify syntax**

Run: `cd /home/gt120/projects/hackillinois2026 && python3 -c "import ast; ast.parse(open('modal_app/reconciler.py').read()); ast.parse(open('modal_app/web.py').read()); print('Syntax OK')"`
Expected: `Syntax OK`

**Step 4: Commit**

```bash
git add modal_app/reconciler.py modal_app/web.py
git commit -m "feat: add VectorAI DB health monitoring to reconciler and status endpoints"
```

---

### Task 9: Add Backfill Function

**Files:**
- Modify: `modal_app/vectordb.py` (add backfill_vectordb function)

**Step 1: Add backfill function to vectordb.py**

Append to `modal_app/vectordb.py`:

```python
@app.function(
    image=vectordb_image,
    volumes={"/data": volume},
    secrets=[modal.Secret.from_name("arize-secrets")],
    timeout=600,
)
async def backfill_vectordb():
    """One-time backfill: read all enriched docs from volume and upsert to VectorAI DB.

    Run manually after initial deployment:
        modal run -m modal_app modal_app.vectordb::backfill_vectordb
    """
    import json
    from pathlib import Path

    enriched_dir = Path("/data/processed/enriched")
    if not enriched_dir.exists():
        print("No enriched directory found")
        return 0

    json_files = list(enriched_dir.rglob("*.json"))
    print(f"Backfill: found {len(json_files)} enriched documents")

    vdb = VectorDBService()
    batch_size = 32
    total_upserted = 0

    for i in range(0, len(json_files), batch_size):
        batch_files = json_files[i:i + batch_size]
        docs = []
        for f in batch_files:
            try:
                doc = json.loads(f.read_text())
                if isinstance(doc, dict):
                    docs.append(doc)
            except Exception:
                continue

        if not docs:
            continue

        texts = [build_embed_text(d) for d in docs]
        embeddings = vdb.embed_batch.remote(texts)
        doc_ids = [d.get("id", f"backfill-{i+j}") for j, d in enumerate(docs)]
        payloads = [
            build_payload(d, d.get("classification", {}), d.get("sentiment", {}))
            for d in docs
        ]
        vdb.batch_upsert_docs.remote(doc_ids, embeddings, payloads, "enriched")
        total_upserted += len(docs)
        print(f"Backfill: {total_upserted}/{len(json_files)} upserted")

    print(f"Backfill complete: {total_upserted} documents indexed")
    return total_upserted
```

**Step 2: Verify syntax**

Run: `cd /home/gt120/projects/hackillinois2026 && python3 -c "import ast; ast.parse(open('modal_app/vectordb.py').read()); print('Syntax OK')"`
Expected: `Syntax OK`

**Step 3: Commit**

```bash
git add modal_app/vectordb.py
git commit -m "feat: add backfill_vectordb function for one-time enriched doc indexing"
```

---

### Task 10: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (document VectorAI DB integration)

**Step 1: Update tech stack, project structure, architecture sections**

Add `VectorAI DB` to tech stack, add `vectordb.py` to project structure, update architecture with vector search layer description, add to implementation status, add `VECTORDB_DISABLED` to secrets section.

Key additions:
- **Tech Stack**: `Actian VectorAI DB (local HNSW vector search, gRPC) + all-MiniLM-L6-v2 embeddings`
- **Project Structure**: `vectordb.py — VectorAI DB service: embed, upsert, search, health check, backfill`
- **Architecture**: Section describing vector search layer complementing Supermemory
- **Key Patterns**: `vectordb_available()` guard pattern
- **Modal Features**: increment function count

**Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document VectorAI DB integration in CLAUDE.md"
```

---

### Task 11: Run Full Test Suite

**Files:**
- None (verification only)

**Step 1: Run all tests**

Run: `cd /home/gt120/projects/hackillinois2026 && python3 -m pytest tests/ -v`
Expected: All tests pass (existing 35+ tests + new vectordb tests)

**Step 2: Verify Modal deploy dry-run**

Run: `cd /home/gt120/projects/hackillinois2026 && python3 -c "import modal_app; print('All modules imported OK')"`
Expected: `All modules imported OK`
