# Tools

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Backend | Python 3.11+ | Server-side logic |
| API Framework | FastAPI | REST API + WebSocket endpoints |
| AI Inference | Modal (A10G GPU) | Llama 3.1 8B + MiniLM embeddings |
| Data Pipelines | Modal (cron) | Live data ingestion from Chicago sources |
| Chat Generation | OpenAI API | Natural language response generation |
| Memory/Context | Supermemory | User Profiles, Memory, Retrieval, Connectors, Multi-modal Extractors |
| Data Processing | pandas, polars | Regulatory data manipulation |
| Frontend | React | User interface |
| Build Tool | Vite | Frontend bundling |
| Styling | Tailwind CSS | UI styling (Best UI/UX track) |
| Hosting (FE) | Cloudflare Pages | Frontend deployment (sponsor track) |
| Hosting (BE) | Railway or Render | Backend deployment |
| Domain | alethia.tech | MLH .Tech Domain prize |

## Project Structure

```
hackillinois2026/
├── backend/
│   ├── main.py              # FastAPI app entry point
│   ├── requirements.txt     # Python dependencies
│   ├── routers/
│   │   ├── chat.py          # WebSocket chat endpoint
│   │   ├── analysis.py      # AI analysis REST endpoints
│   │   └── business.py      # Business profile endpoints
│   ├── models/              # Pydantic models
│   ├── services/
│   │   ├── rag.py           # RAG orchestration (Modal + Supermemory)
│   │   ├── supermemory.py   # Supermemory API integration
│   │   └── openai_chat.py   # OpenAI chat generation
│   └── tests/               # pytest tests
├── modal_app/               # Modal serverless functions
│   ├── inference.py         # Llama 3.1 8B + MiniLM embedding
│   ├── pipelines/
│   │   ├── news.py          # News ingester (NewsAPI, RSS) — 30 min
│   │   ├── politics.py      # Legistar API + PDF parsing — daily
│   │   ├── social.py        # Reddit (asyncpraw) — hourly
│   │   ├── reviews.py       # Yelp Fusion + Google Places — daily
│   │   ├── public_data.py   # Socrata API (city data portal) — daily
│   │   ├── demographics.py  # Census/ACS — monthly
│   │   └── realestate.py    # LoopNet scrape — weekly
│   └── processing.py        # Embed, classify, geo-tag, index
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Root component
│   │   ├── components/
│   │   │   ├── Chat/        # Chat panel (WebSocket streaming)
│   │   │   ├── Dashboard/   # Dashboard panel (risk cards, actions)
│   │   │   ├── Onboarding/  # Business profile setup
│   │   │   ├── RiskCard/    # Risk/opportunity cards
│   │   │   ├── LocalPulse/  # News + Reddit + Reviews feed
│   │   │   └── NeighborhoodMap/ # Chicago ward/neighborhood map
│   │   ├── pages/           # Page-level components
│   │   └── api/             # API client functions
│   ├── package.json
│   └── vite.config.js
├── docs/
│   ├── agent/               # Agent config documents
│   └── plans/               # Design and implementation plans
└── README.md
```

## Commands

### Backend
```bash
# Setup
python -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt

# Run
uvicorn backend.main:app --reload --port 8000

# Test
pytest backend/tests/ -v

# Lint
ruff check backend/
```

### Frontend
```bash
# Setup
cd frontend && npm install

# Run
npm run dev

# Build
npm run build

# Lint
npm run lint

# Deploy to Cloudflare Pages
npx wrangler pages deploy dist/
```

### Modal
```bash
# Setup
pip install modal
modal token new

# Redeem $250 credits (IMPORTANT — do this first)
# Go to modal.com/credits and use code: VVN-YQS-E55

# Deploy all functions
modal deploy modal_app/inference.py
modal deploy modal_app/pipelines/news.py

# Local test
modal run modal_app/inference.py

# Check cron status
modal app list
```

## Key Libraries

- **FastAPI:** REST API + WebSocket support, auto-generates docs at `/docs`
- **Modal:** Entire compute backbone — GPU inference (Llama 3.1 8B on A10G, MiniLM embeddings) + data pipeline cron jobs. Judges want ambitious inference
- **OpenAI:** Chat generation from retrieved context. Sponsor track ($5K credits/member)
- **Supermemory:** Context Engineering APIs — Retrieval, Memory, User Profiles, Connectors, Multi-modal Extractors. Judges want apps that remember, understand, adapt
- **vLLM:** Fast LLM serving on Modal (Llama 3.1 8B)
- **sentence-transformers:** MiniLM embedding model for semantic search
- **asyncpraw:** Reddit API client for r/chicago subreddit monitoring
- **pymupdf/pdfplumber:** PDF parsing for city council transcripts
- **feedparser:** RSS feed parsing for local news
- **pandas:** Data ingestion and transforms
- **pydantic:** All API models inherit from `BaseModel`
- **httpx:** Async HTTP for external APIs (Yelp, Google Places, Socrata, NewsAPI)

## Live Data Sources

| Source | API/Method | Cadence | Modal Function |
|--------|-----------|---------|---------------|
| Local News | NewsAPI, RSS (Chicago Tribune, Block Club Chicago) | 30 min | `news_ingester` |
| City Council | Chicago Legistar API | Daily | `politics_ingester` |
| Meeting Transcripts | Zoning Board, Plan Commission PDFs | Daily | `pdf_processor` |
| Reddit | asyncpraw (r/chicago, r/chicagofood, neighborhood subs) | Hourly | `reddit_ingester` |
| Yelp | Yelp Fusion API | Daily | `review_ingester` |
| Google Places | Places API | Daily | `review_ingester` |
| City Data Portal | Socrata API (data.cityofchicago.org) | Daily | `public_data_ingester` |
| Census/ACS | Census API | Monthly | `demographics_ingester` |
| Real Estate | LoopNet scrape | Weekly | `realestate_ingester` |

## Storage

- **Modal Volume:** Raw ingested documents, embedded vectors, FAISS/similar index
- **Supermemory:** User profiles, conversation memory, per-user context

## Deployment

| Component | Platform |
|-----------|----------|
| Frontend | Cloudflare Pages (sponsor track) |
| Backend | Railway or Render |
| AI Inference + Pipelines | Modal (A10G GPU + cron) |
| User Memory | Supermemory |
| Domain | alethia.tech (MLH .Tech Domain) |
