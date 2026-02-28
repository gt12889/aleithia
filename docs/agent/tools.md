# Tools

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Backend | Python 3.11+ | Server-side logic |
| API Framework | FastAPI | REST API endpoints |
| AI Inference | Modal | Serverless AI/ML model hosting |
| Data Processing | pandas, polars | Regulatory data manipulation |
| Memory/Context | Supermemory | Persistent knowledge and context layer |
| Frontend | React | User interface |
| Build Tool | Vite | Frontend bundling |
| Styling | Tailwind CSS | UI styling (Best UI/UX track) |
| Blockchain | Solana | Data provenance / verification (sponsor track) |

## Project Structure

```
hackillinois2026/
├── backend/
│   ├── main.py              # FastAPI app entry point
│   ├── requirements.txt     # Python dependencies
│   ├── routers/             # API route modules
│   │   ├── regulations.py   # Regulatory data endpoints
│   │   ├── analysis.py      # AI analysis endpoints
│   │   └── business.py      # Business profile endpoints
│   ├── models/              # Pydantic models
│   ├── services/            # Business logic
│   │   ├── data_aggregator.py   # Multi-source data ingestion
│   │   ├── ai_analyzer.py       # Modal AI inference
│   │   ├── supermemory.py       # Supermemory integration
│   │   └── recommendation.py   # Actionable recommendations engine
│   └── tests/               # pytest tests
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Root component
│   │   ├── components/      # Reusable UI components
│   │   │   ├── Dashboard/   # Main dashboard views
│   │   │   ├── RiskCard/    # Risk/opportunity display
│   │   │   └── RegMap/      # Regulatory map visualization
│   │   ├── pages/           # Page-level components
│   │   └── api/             # API client functions
│   ├── package.json
│   └── vite.config.js
├── modal/                   # Modal serverless functions
│   └── inference.py         # AI model inference functions
├── docs/
│   └── agent/               # These config documents
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
```

### Modal
```bash
# Setup
pip install modal
modal token new

# Redeem $250 credits (IMPORTANT — do this first)
# Go to modal.com/credits and use code: VVN-YQS-E55

# Deploy
modal deploy modal/inference.py

# Local test
modal run modal/inference.py
```

## Key Libraries

- **FastAPI:** Auto-generates OpenAPI docs at `/docs`
- **Modal:** Serverless AI inference — flexible GPU compute, code sandboxes, storage. Used by Ramp, Suno, Lovable. Judges want ambitious inference, not just API wrapping
- **Supermemory:** Context Engineering APIs — Retrieval, Memory, User Profiles, Connectors, Multi-modal Extractors. Free tier available; top up at booth. Judges want apps that remember, understand, adapt
- **pandas:** Regulatory data ingestion and transforms
- **polars:** Large dataset performance-critical operations
- **pydantic:** All API models inherit from `BaseModel`
- **httpx:** Async HTTP requests for external data sources

## Data Sources

Regulatory and business intelligence data to aggregate:
- Federal/state/local regulatory databases
- Political sentiment and legislative tracking
- Consumer sentiment data
- Employment law databases
- Environmental protection regulations
- Taxation requirements by jurisdiction
- Regional logistics and supply chain data

## Database

TBD — Start with file-based storage. Add SQLite or PostgreSQL if time permits. Consider Supermemory for persistent AI context.

## Deployment

TBD — Likely Vercel (frontend) + Railway/Render (backend) + Modal (AI inference) for demo.
