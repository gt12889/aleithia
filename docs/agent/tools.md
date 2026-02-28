# Tools

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Backend | Python 3.11+ | Server-side logic |
| API Framework | FastAPI | REST API endpoints |
| Data Processing | pandas, polars | Dataset manipulation |
| Frontend | React | User interface |
| Build Tool | Vite | Frontend bundling |
| Styling | Tailwind CSS | UI styling |

## Project Structure

```
hackillinois2026/
├── backend/
│   ├── main.py              # FastAPI app entry point
│   ├── requirements.txt     # Python dependencies
│   ├── routers/             # API route modules
│   ├── models/              # Pydantic models
│   ├── services/            # Business logic
│   └── tests/               # pytest tests
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Root component
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Page-level components
│   │   └── api/             # API client functions
│   ├── package.json
│   └── vite.config.js
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

## Key Libraries

- **FastAPI:** Auto-generates OpenAPI docs at `/docs`
- **pandas:** Use for CSV/Excel ingestion and transforms
- **polars:** Use for large dataset performance-critical operations
- **pydantic:** All API models inherit from `BaseModel`
- **httpx:** Use for async HTTP requests if needed

## Database

TBD — Start with file-based storage (CSV/JSON uploads). Add SQLite or PostgreSQL if time permits.

## Deployment

TBD — Likely Vercel (frontend) + Railway/Render (backend) for demo.
