# Actian VectorAI DB Integration Design

**Date**: 2026-03-01
**Status**: Approved
**Goal**: Complement Supermemory with local VectorAI DB for fast semantic search

## Summary

Integrate Actian VectorAI DB (beta) as a local vector search layer running inside Modal alongside the existing Supermemory cloud RAG. Documents are embedded at ingestion time using `all-MiniLM-L6-v2` (384d) and upserted into VectorAI DB. The agent swarm and chat endpoint query VectorAI DB for semantic retrieval instead of scanning JSON files, with Supermemory queries running in parallel.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Role | Complement Supermemory | Local fast retrieval + cloud RAG with user profiles |
| Deployment | Modal container | Runs alongside existing app, uses Modal volumes for persistence |
| Scope | Agent swarm + chat | Highest-impact retrieval paths; other endpoints unchanged |
| Embedding model | all-MiniLM-L6-v2 | 384d, fast CPU inference, recommended by Actian |
| Integration pattern | Ingestion-time embedding | Embed in classify.py after enrichment; cleanest pipeline integration |

## Architecture

```
Pipeline → doc_queue → classify.py → embed (MiniLM) → VectorAI DB upsert
                                   → /data/processed/enriched/ (unchanged)
                                   → Supermemory (unchanged)

Agent query → VectorAI DB search_filtered() → top-k docs ─┐
           → Supermemory search() (parallel) ──────────────┤
                                                           ↓
                                              deduplicate by doc_id
                                                           ↓
                                              LLM synthesis (Qwen3-8B)
```

## Section 1: VectorAI DB Modal Service

**New file: `modal_app/vectordb.py`**

- **Custom Modal Image**: Based on `williamimoh/actian-vectorai-db:1.0b` Docker image with `actiancortex` Python wheel and `sentence-transformers/all-MiniLM-L6-v2` pre-downloaded.
- **`VectorDBService` class** (`@modal.cls`):
  - `@modal.enter`: Starts VectorAI DB process, connects via `AsyncCortexClient` on localhost:50051. Persistent data at `/data/vectordb/` on `data_volume`.
  - `min_containers=1`, `scaledown_window=300` (always warm).
- **Collections**: One per source type (news, politics, reddit, reviews, realestate, federal_register, tiktok, demographics, public_data, traffic, cctv, vision, parking, worldpop) + one `enriched` collection. All: 384 dimensions, cosine distance.
- **Methods**:
  - `upsert_doc(doc, embedding, classification, sentiment)` — vector + payload (id, source, neighborhood, timestamp, title, category, sentiment_label, sentiment_score)
  - `batch_upsert_docs(docs, embeddings, classifications, sentiments)` — batch variant
  - `search(query_embedding, collection, top_k, filter)` — filtered semantic search
  - `search_neighborhood(query_embedding, neighborhood, top_k)` — convenience search on `enriched` collection filtered by neighborhood
  - `embed_text(text) -> list[float]` — `SentenceTransformer('all-MiniLM-L6-v2')` loaded at `@modal.enter`
  - `health_check() -> dict` — container and collection health
- **`vectordb_available()` function**: Availability guard (like `openai_available()`). All consumers degrade gracefully if VectorAI DB is unavailable.

## Section 2: Enrichment Pipeline Integration

**Modified file: `modal_app/classify.py`**

After existing classification + sentiment analysis in `process_queue_batch()`:

1. Embed document: `embed_text(doc.title + " " + doc.content[:1000])` — truncate to keep embedding focused.
2. Upsert to VectorAI DB via `batch_upsert_docs()` for the batch (up to 32 docs per `@modal.batched` invocation).
3. Graceful degradation: Wrapped in try/except with `vectordb_available()` guard. Pipeline continues normally if VectorAI DB is down.
4. No changes to: Volume JSON writes, Supermemory sync, impact_queue push.

**New function: `backfill_vectordb()`** — reads all `/data/processed/enriched/*.json`, embeds, bulk-upserts. Run once after initial deployment.

## Section 3: Agent Swarm Query Integration

**Modified file: `modal_app/agents.py`**

### neighborhood_intel_agent()

1. **Semantic retrieval first**: Embed query (`business_type + neighborhood + keywords`) → `search_neighborhood(query_embedding, neighborhood, top_k=50)`.
2. **Filter DSL**: Use VectorAI DB's type-safe filters for source type, date range, sentiment, classification category — replaces in-memory Python filtering.
3. **Fallback**: If `vectordb_available()` is False, fall back to existing JSON file scan (current behavior preserved).
4. **Supermemory parallel**: Keep existing Supermemory query in `asyncio.gather()`. Merge + deduplicate by doc_id. Rank by VectorAI DB similarity score.

### orchestrate_query()

- Compute query embedding once, pass to all 3 neighborhood_intel_agent spawns (primary + 2 comparison neighborhoods).
- No changes to regulatory_agent (does live API fetches, not volume scans).

## Section 4: Chat Endpoint Integration

**Modified file: `modal_app/web.py`**

- `/chat` endpoint: Embed user message via `embed_text()` before calling `orchestrate_query()`. Pass pre-computed embedding downstream.
- No direct VectorAI DB query from /chat — delegates to agent swarm.
- No changes to: `/analyze`, `/brief/{neighborhood}`, `/neighborhood/{name}`, or other endpoints.

## Section 5: Deployment & Observability

### Modal deployment
- `@modal.cls` with `min_containers=1` (always warm)
- Custom image from `williamimoh/actian-vectorai-db:1.0b` + dependencies
- Data persisted to `data_volume` at `/data/vectordb/`

### Tracing
- New spans: `vectordb.upsert`, `vectordb.search`, `vectordb.embed`
- Connected to agent spans via existing W3C trace context propagation

### Health monitoring
- `health_check()` exposed via `/health` and `/status` endpoints
- Reconciler updated to monitor VectorAI DB container health

## Files Changed

| File | Change |
|------|--------|
| `modal_app/vectordb.py` | **NEW** — VectorAI DB service, embedding, availability guard |
| `modal_app/classify.py` | Add embedding + upsert after enrichment |
| `modal_app/agents.py` | Semantic retrieval in neighborhood_intel_agent, shared embedding in orchestrate_query |
| `modal_app/web.py` | Pre-embed chat query, pass to orchestrate_query |
| `modal_app/volume.py` | Add VectorAI DB custom image definition |
| `modal_app/__init__.py` | Import vectordb module |
| `modal_app/reconciler.py` | Add VectorAI DB health monitoring |

## Graceful Degradation

All VectorAI DB operations are guarded by `vectordb_available()`. If the container is down or unhealthy:
- classify.py: Enrichment proceeds normally (JSON + Supermemory still work)
- agents.py: Falls back to existing JSON file scan
- web.py: Chat works via agent fallback path
- No user-facing errors — just slower retrieval via file scan
