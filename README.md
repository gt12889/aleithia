Aleithia: Bridging the Regulatory and Analytical Divide

The modern operational environment for businesses is characterized by immense complexity and constant flux. Entities must navigate a vast, interlocking web of constraints spanning multiple jurisdictions—federal, state, and local—covering everything from stringent employment law to evolving consumer safety standards and taxation requirements.

Beyond statutory compliance, businesses must adapt to unpredictable market forces: shifting political landscapes and unique regional logistical challenges. This creates a fundamental inequity: large, established firms have the capital and human resources (general counsels, lobbyists, and data analysts) to meticulously analyze these diverse data streams. Alethia is designed to democratize this high-level, data-driven expertise for small business owners.

Our Vision and Proposed Solution
Alethia is an intelligent platform that: Aggregates disparate regulatory, political, and consumer sentiment data. Analyzes this data using advanced AI/ML (Modal/AI Inference track) to identify critical risks. Translates complex findings into actionable, context-specific recommendations.

How We Built It
The backend architecture leverages Modal's asynchronous job functionalities. A swarm of jobs fetches news across relevant sources in Python, scheduled periodically by Modal. Distributed AI inference allows us to parse this data into a detailed assessment in seconds.

Architecture

Modal — Elastic Serverless Compute

Modal is the backbone — 33 serverless functions leveraging 21 distinct Modal features:

GPU Inference: Qwen3-8B AWQ (INT4) self-hosted on H100 via vLLM. @modal.enter(snap=True) creates GPU memory snapshots for <3s cold starts. bart-large-mnli + roberta classifiers run on T4 GPUs using @modal.batched — 32 docs/pass, 10x cost efficiency. YOLOv8n (CCTV) and SegFormer-b5 + YOLOv8m (satellite parking) on additional T4 instances.
Event Bus: modal.Queue decouples CPU-bound ingestion from GPU enrichment. 14 pipelines push; classifiers drain every 2 min.
Recursive Agents: Lead Analyst scores enriched docs via Qwen3-8B. High-impact events (7+/10) trigger .spawn() fan-out to 4 parallel worker agents.
Self-Healing: modal.Period reconciler checks modal.Dict health metrics every 5 min — auto-restarts stale pipelines.
Deep Dive: modal.Sandbox executes GPT-4o-generated Python analysis scripts against real pipeline data, returning stats, charts, and generated code.
Web API: @modal.asgi_app() serves 25+ FastAPI endpoints with @modal.concurrent(max_inputs=20) and min_containers=1 warm pools.
Supermemory — Unified Graph-RAG Memory

Replaces the traditional Postgres + Pinecone + Redis stack with a single Graph-RAG system:

Hierarchical Isolation: container_tag separates chicago_data (world knowledge) from user_{id} (personal context). User profiles and past interactions persist across sessions.
State Mutation: Handles temporal updates (changing regulations, new ordinances) without re-indexing. Infers cross-source relationships — connecting Reddit sentiment to City Council hearings automatically.
Context Injection: On every query, agents retrieve the user's Supermemory profile + relevant facts, injected into the Qwen3-8B prompt for personalized responses.
Actian VectorAI DB — Local Semantic Retrieval

Complements Supermemory with HNSW-indexed 384-dim embeddings (all-MiniLM-L6-v2):

Documents are embedded at ingestion time and stored with enrichment metadata (category, sentiment, geo).
Agent swarm queries VectorAI DB for sub-15ms semantic search at query time, retrieving the most relevant documents by cosine similarity.
Degrades gracefully via vectordb_available() guard — same pattern as all optional integrations.
OpenTelemetry tracing with connected spans across the entire pipeline:

W3C trace context propagation via inject_context() / extract_context() links spans across Modal containers: web → orchestrator → agents → LLM.
OpenAI auto-instrumentor captures every GPT-4o call (Deep Dive, follow-up suggestions, regulatory enrichment, vision assessment).
InMemorySpanExporter + 35 unit tests validate trace integrity.
E2B — Sandboxed Agent Execution

The Lead Analyst's 4 specialized workers (real estate, legal, economic, community sentiment) execute in E2B cloud sandboxes:

Full process isolation — untrusted analysis code runs safely.
Workers analyze cross-domain data in parallel, return structured findings.
Falls back to in-process execution without an E2B_API_KEY.
OpenAI GPT-4o — Targeted Hybrid Layer

GPT-4o handles 4 specific capabilities where it outperforms the self-hosted LLM:

Deep Dive: Generates Python analysis scripts executed in modal.Sandbox
Follow-up Suggestions: Contextual next questions after chat responses
Regulatory Enrichment: Federal regulation impact summaries for small businesses
Vision Assessment: Street-level GPT-4V analysis of neighborhood conditions
All features check openai_available() and fall back gracefully.

Frontend

React 19 + TypeScript + Vite + Tailwind CSS v4 — 21 components including:

Streaming chat with inline process flow traces and follow-up suggestion chips
WLC risk scoring — ISO 31000-aligned, 6 MCDA dimensions, sigmoid-normalized inputs
Satellite parking detection display (SegFormer + YOLOv8m + SAHI)
CCTV highway traffic cards with live IDOT camera frames
Professional PDF export — 9-section "Investment Committee" proposal format
Interactive knowledge graph — drag-and-filter node visualization
Recursive agent panel — live pipeline status, GPU fleet monitoring, agent deployment log
Challenges

Mapbox GeoJSON heatmap rendering required a custom compression pipeline to aggregate per-neighborhood stats
IDOT CCTV feeds limited to highway cameras (not street-level) — walk-in potential sourced from CTA L-station ridership data instead
Cross-container tracing required building W3C context propagation from scratch ### What's Next for Alethia Data Expansion: Identifying higher-quality data sources and expanding beyond the Chicago area to support global metropolitan regions.
Advanced Insights: Developing deeper anomaly detection to provide prospective founders with even more granular locale-specific insights.
