# Alethia Architecture Design

**Date:** 2026-02-27
**Project:** Alethia — Regulatory Intelligence for Small Businesses
**Event:** HackIllinois 2026

## Goal

Build an AI-powered regulatory intelligence platform that aggregates live Chicago-area data (news, politics, social, public records), analyzes it on Modal GPUs, and delivers actionable insights to small business owners through a polished chat + dashboard interface.

## Prize Strategy

| Category | Prize | Value |
|----------|-------|-------|
| Path | Best Voyager Hack | $5,000 team |
| Opt-in | Best Social Impact | MARSHALL Speakers + charity each |
| Opt-in | Best UI/UX Design | FUJIFILM Camera each |
| Sponsor | Supermemory | Meta RayBans each |
| Sponsor | OpenAI | $5K API credits each |
| Sponsor | Cloudflare | $5K credits each |
| MLH | .Tech Domain | Desktop mic + 10yr domain each |

**Constraints:** 1 path + 2 opt-in + 3 sponsor + unlimited MLH

---

## System Architecture

```
┌─────────────────── MODAL COMPUTE LAYER ───────────────────────────┐
│                                                                    │
│  ┌─────────────────── DATA PIPELINES (cron) ──────────────────┐  │
│  │                                                             │  │
│  │  ┌──────────────┐  ┌───────────────┐  ┌────────────────┐  │  │
│  │  │ News Ingester│  │ Politics      │  │ Social/Reviews │  │  │
│  │  │ (30 min)     │  │ Ingester      │  │ Ingester       │  │  │
│  │  │              │  │ (daily)       │  │ (1hr / daily)  │  │  │
│  │  │ - NewsAPI    │  │ - Legistar    │  │ - Reddit API   │  │  │
│  │  │ - RSS feeds  │  │   API         │  │ - Yelp Fusion  │  │  │
│  │  │ - Local news │  │ - PDF parse   │  │ - Google Places│  │  │
│  │  │   sources    │  │   (pymupdf)   │  │                │  │  │
│  │  │              │  │ - LLM summary │  │                │  │  │
│  │  └──────┬───────┘  └──────┬────────┘  └───────┬────────┘  │  │
│  │         │                 │                    │           │  │
│  │  ┌──────▼─────────────────▼────────────────────▼────────┐ │  │
│  │  │              Public Data Ingester (daily/weekly)      │ │  │
│  │  │  - data.cityofchicago.org (Socrata API)              │ │  │
│  │  │  - CTA ridership, crime stats, permits, licenses     │ │  │
│  │  │  - Census/ACS demographics (monthly)                 │ │  │
│  │  │  - Commercial real estate (LoopNet scrape)            │ │  │
│  │  └──────────────────────┬───────────────────────────────┘ │  │
│  └─────────────────────────┼─────────────────────────────────┘  │
│                            │                                     │
│                     ┌──────▼──────┐                              │
│                     │ PROCESSING  │                              │
│                     │ - Embed all │                              │
│                     │   docs      │                              │
│                     │ - Entity    │                              │
│                     │   extraction│                              │
│                     │ - Geo-tag   │                              │
│                     │ - Classify  │                              │
│                     └──────┬──────┘                              │
│                            │                                     │
│  ┌─────────────────── INFERENCE ──────────────────────────────┐  │
│  │  ┌────────────────┐        ┌──────────────────────────┐   │  │
│  │  │ Embedding Model│        │ Llama 3.1 8B (A10G GPU)  │   │  │
│  │  │ (MiniLM)       │        │ - Risk/opportunity score │   │  │
│  │  │ - Doc embedding│        │ - Regulation analysis    │   │  │
│  │  │ - Query embed  │        │ - Summarization          │   │  │
│  │  │ - Similarity   │        │ - PDF transcript extract │   │  │
│  │  └────────────────┘        └──────────────────────────┘   │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
│  ┌─────────────────── STORAGE ────────────────────────────────┐  │
│  │  Modal Volume: embedded docs, raw data, vector index       │  │
│  └────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
         │                              │
         │ Query + Retrieve             │ Store user context
         ▼                              ▼
┌──────────────────┐          ┌──────────────────┐
│  FastAPI Backend  │◄────────►│   Supermemory    │
│  - REST API       │          │   - User Profiles│
│  - WebSocket chat │          │   - Memory       │
│  - Orchestration  │          │   - Retrieval    │
└────────┬──────────┘          │   - Connectors   │
         │                     │   - Multi-modal  │
         │ (Chat generation)   └──────────────────┘
         ▼
┌──────────────────┐
│  OpenAI API      │
│  - Chat response │
│  - Summarization │
└──────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────┐
│          FRONTEND (React + Tailwind)              │
│          Hosted on Cloudflare Pages               │
│  ┌──────────┐ ┌──────────────┐ ┌──────────────┐ │
│  │ Onboard  │ │ Chat Panel   │ │ Dashboard    │ │
│  │ (biz     │ │ (streaming)  │ │ (live data   │ │
│  │  profile)│ │              │ │  cards, map) │ │
│  └──────────┘ └──────────────┘ └──────────────┘ │
└──────────────────────────────────────────────────┘
```

## Approach

**Monolith FastAPI + React SPA.** Single backend handles orchestration — Modal for all compute (data pipelines + inference), Supermemory for user context, OpenAI for chat generation. Frontend is a standalone SPA on Cloudflare Pages.

**Why monolith:** Maximum coding speed. One backend, one frontend. Easy to demo, easy to debug. 36-hour constraint means simplicity wins.

## Data Sources

| Source | API/Method | Cadence | Modal Function | Output |
|--------|-----------|---------|---------------|--------|
| Local News | NewsAPI, RSS feeds (Chicago Tribune, Block Club Chicago) | 30 min | `news_ingester` | Articles + metadata (source, timestamp, geo-tags) |
| City Council | Chicago Legistar API | Daily | `politics_ingester` | Legislation, agendas, minutes |
| Meeting Transcripts | Zoning Board, Plan Commission PDFs | Daily | `pdf_processor` (pymupdf/pdfplumber + Llama summarize) | Extracted text, entity summaries |
| Reddit | asyncpraw (r/chicago, r/chicagofood, neighborhood subs) | Hourly | `reddit_ingester` | Posts + sentiment |
| Yelp | Yelp Fusion API | Daily | `review_ingester` | Business ratings, review velocity |
| Google Places | Places API | Daily | `review_ingester` | Ratings, review velocity |
| City Data Portal | Socrata API (data.cityofchicago.org) | Daily | `public_data_ingester` | CTA ridership, crime, permits, licenses |
| Census/ACS | Census API | Monthly | `demographics_ingester` | Demographics by neighborhood |
| Real Estate | LoopNet scrape | Weekly | `realestate_ingester` | Commercial listings, pricing |
| TikTok/Instagram | Deferred — no public API | N/A | — | Nice to have, defer |

## Processing Pipeline

Every ingested document goes through:

1. **Raw storage** → Modal Volume (JSON + original files)
2. **Entity extraction** → Llama 3.1 8B on Modal extracts: businesses mentioned, neighborhoods, regulation types, sentiment
3. **Embedding** → MiniLM embeds each document for semantic search
4. **Geo-tagging** → Attach Chicago neighborhood/ward metadata
5. **Classification** → Categorize: `regulation`, `news`, `sentiment`, `opportunity`, `risk`
6. **Vector index update** → Add to searchable index on Modal Volume

## AI Inference (Modal)

Two models running on Modal:

- **Embedding model** (`sentence-transformers/all-MiniLM-L6-v2`): Runs on CPU or small GPU. Embeds documents and queries for semantic search.
- **Llama 3.1 8B** (via vLLM on A10G GPU): Entity extraction from documents, risk/opportunity scoring, PDF transcript summarization, regulation analysis.

**Why both on Modal:** Judges want "ambitious applications running inference on Modal." Running the full pipeline — ingestion, embedding, LLM analysis — on Modal is genuinely ambitious and solves a real-world problem.

**Credits:** $250 via code `VVN-YQS-E55` at modal.com/credits

## Supermemory Integration

| Supermemory API | Use in Alethia |
|-----------------|---------------|
| **User Profiles** | Business type, location (neighborhood), industry, size, regulatory concerns |
| **Memory** | Past queries, analysis results, recommendations per user |
| **Retrieval** | Augment RAG — pull user-relevant context alongside Modal vector search |
| **Connectors** | Link user's Yelp page, permits, business license data |
| **Multi-modal Extractors** | Extract context from uploaded docs (leases, permits, signage photos) |

**Flow:** User onboards → profile in Supermemory → every query enriched with profile + memory → recommendations personalize over time → "the app learns you."

## OpenAI Integration

Use OpenAI API for the chat generation step:
- Takes retrieved context (from Modal RAG + Supermemory) and generates natural language responses
- Streaming via WebSocket for responsive UX
- This separates concerns: Modal handles compute-heavy inference, OpenAI handles conversational generation

## Frontend Architecture

Chat + Dashboard hybrid (split-panel layout):

```
┌─────────────────────────────────────────────────────┐
│  HEADER: Alethia logo + business name + location    │
├─────────────────────┬───────────────────────────────┤
│                     │                               │
│   CHAT PANEL        │   DASHBOARD PANEL             │
│   (40% width)       │   (60% width)                 │
│                     │                               │
│   "What permits     │   ┌─────────────────────┐    │
│    do I need to     │   │ RISK SCORE    ██░ 7 │    │
│    open a           │   │ 3 new regulations   │    │
│    restaurant       │   │ affecting you       │    │
│    in Lincoln       │   └─────────────────────┘    │
│    Park?"           │                               │
│                     │   ┌─────────────────────┐    │
│   [AI response      │   │ ACTION ITEMS        │    │
│    streams here     │   │ □ File food permit  │    │
│    with citations]  │   │ □ Zoning review     │    │
│                     │   │ ✓ Business license  │    │
│                     │   └─────────────────────┘    │
│                     │                               │
│                     │   ┌─────────────────────┐    │
│                     │   │ LOCAL PULSE         │    │
│                     │   │ News · Reddit ·     │    │
│                     │   │ Reviews trending    │    │
│                     │   │ in your area        │    │
│                     │   └─────────────────────┘    │
│                     │                               │
│                     │   ┌─────────────────────┐    │
│                     │   │ NEIGHBORHOOD MAP    │    │
│                     │   │ [Chicago map with   │    │
│                     │   │  ward overlays]     │    │
│                     │   └─────────────────────┘    │
│                     │                               │
├─────────────────────┴───────────────────────────────┤
│  FOOTER: "Not legal advice" disclaimer              │
└─────────────────────────────────────────────────────┘
```

**Key screens:**
1. **Onboarding** — Business type, location, industry → stored in Supermemory User Profile
2. **Main view** — Chat + Dashboard side-by-side
3. **Deep dive** — Click risk card → full regulation details, sources, recommendations

## End-to-End Data Flow

```
1. INGEST (Modal cron functions)
   News/Politics/Social/Public → Raw docs → Modal Volume

2. PROCESS (Modal GPU functions)
   Raw docs → Embed (MiniLM) → Extract entities (Llama) → Classify → Index

3. QUERY (User interaction)
   User question → FastAPI WebSocket
   → Modal: embed query, search vector index, retrieve top-k docs
   → Supermemory: pull user profile + memory + past context
   → OpenAI: generate response from retrieved context
   → Stream response back to frontend

4. UPDATE (Post-query)
   → Supermemory: store query + response in user Memory
   → Dashboard: refresh risk cards, action items from analysis
```

## Deployment

| Component | Platform | Why |
|-----------|----------|-----|
| Frontend | Cloudflare Pages | Sponsor track + global CDN |
| Backend | Railway or Render | Easy Python hosting |
| AI Inference | Modal (A10G GPU) | Sponsor track + GPU compute |
| Data Pipelines | Modal (cron) | Unified with inference |
| User Memory | Supermemory | Sponsor track |
| Domain | alethia.tech | MLH .tech domain prize |

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| Monolith over microservices | 36-hour hackathon — simplicity wins |
| Modal for everything compute | Single platform for pipelines + inference = ambitious for judges |
| Llama 3.1 8B over 70B | Fits A10G, fast inference, $250 credits last longer |
| OpenAI for generation | Best chat quality, separates concerns from Modal inference |
| Supermemory over custom memory | Sponsor track + better than building our own |
| Cloudflare Pages over Vercel | Sponsor track + equally easy deployment |
| Chicago focus | Local to HackIllinois, tangible demo, rich public data APIs |
| Live data over pre-curated | More ambitious, better demo, real-time relevance |
