# Alethia Implementation Plan — Phase 1: Data Pipelines

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build all Modal data pipeline ingesters that pull live Chicago-area data from 9 sources, store raw documents to Modal Volume, and establish the shared infrastructure (Modal app, volume, data models) they rely on.

**Architecture:** Each data source gets its own Modal function with source-specific cadence. All functions share a common Modal app, Volume, and document schema. Processing (embedding, classification, geo-tagging) is deferred to a later phase. Supermemory and analysis are tabled for later.

**Tech Stack:** Python 3.11+, Modal, feedparser, httpx, asyncpraw, pymupdf, pdfplumber, pandas

**Phases:**
- **Phase 1 (this plan):** Data pipeline infrastructure + all 9 ingesters
- **Phase 2 (later):** Processing pipeline (embed, classify, geo-tag, index)
- **Phase 3 (later):** Backend API + Frontend scaffolding
- **Phase 4 (later):** Supermemory integration + RAG query flow + OpenAI chat
- **Phase 5 (later):** Polish + deployment + Solana stretch goal

---

## Task 1: Modal App Scaffolding + Shared Infrastructure

**Files:**
- Create: `modal_app/__init__.py`
- Create: `modal_app/common.py`
- Create: `modal_app/volume.py`
- Create: `requirements-modal.txt`

**Step 1: Create Modal requirements file**

```
# requirements-modal.txt
modal==0.64.0
httpx==0.27.0
feedparser==6.0.11
asyncpraw==7.7.1
pymupdf==1.24.0
pdfplumber==0.11.0
pandas==2.2.0
pydantic==2.9.0
```

**Step 2: Create shared data models and constants**

```python
# modal_app/common.py
"""Shared data models and constants for all Alethia Modal pipelines."""
from datetime import datetime, timezone
from enum import Enum
from pydantic import BaseModel, Field


class SourceType(str, Enum):
    NEWS = "news"
    POLITICS = "politics"
    REDDIT = "reddit"
    YELP = "yelp"
    GOOGLE_PLACES = "google_places"
    PUBLIC_DATA = "public_data"
    DEMOGRAPHICS = "demographics"
    REAL_ESTATE = "real_estate"


class Document(BaseModel):
    """Unified document schema for all ingested data."""
    id: str
    source: SourceType
    title: str
    content: str
    url: str = ""
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: dict = Field(default_factory=dict)
    geo: dict = Field(default_factory=dict)  # neighborhood, ward, lat/lng


# Chicago neighborhoods for geo-tagging
CHICAGO_NEIGHBORHOODS = [
    "Albany Park", "Andersonville", "Avondale", "Beverly", "Boystown",
    "Bridgeport", "Bronzeville", "Bucktown", "Chatham", "Chinatown",
    "Douglas", "Edgewater", "Englewood", "Gold Coast", "Humboldt Park",
    "Hyde Park", "Irving Park", "Jefferson Park", "Kenwood", "Lakeview",
    "Lincoln Park", "Lincoln Square", "Little Italy", "Little Village",
    "Logan Square", "Loop", "Morgan Park", "Near North Side", "Near West Side",
    "North Center", "North Lawndale", "Old Town", "Pilsen", "Portage Park",
    "Pullman", "Ravenswood", "River North", "Rogers Park", "Roscoe Village",
    "South Loop", "South Shore", "Streeterville", "Ukrainian Village",
    "Uptown", "West Loop", "West Town", "Wicker Park", "Woodlawn"
]

# Socrata dataset IDs for Chicago Data Portal
SOCRATA_DATASETS = {
    "business_licenses": "r5kz-chrr",
    "food_inspections": "4ijn-s7e5",
    "building_permits": "ydr8-5enu",
    "crimes": "ijzp-q8t2",
    "cta_ridership_L": "t2rn-p8d7",
    "cta_ridership_bus": "jyb9-n7fm",
    "business_owners": "ezma-pppn",
    "zoning": "unjd-c2ca",
}

# Reddit subreddits to monitor
REDDIT_SUBREDDITS = [
    "chicago",
    "chicagofood",
    "ChicagoNWside",
    "SouthSideChicago",
]
```

**Step 3: Create Modal app and volume setup**

```python
# modal_app/volume.py
"""Modal app definition, volume, and image configuration."""
import modal

app = modal.App("alethia")

volume = modal.Volume.from_name("alethia-data", create_if_missing=True)

VOLUME_MOUNT = "/data"
RAW_DATA_PATH = f"{VOLUME_MOUNT}/raw"
PROCESSED_DATA_PATH = f"{VOLUME_MOUNT}/processed"

# Base image with common dependencies
base_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "httpx==0.27.0",
        "pydantic==2.9.0",
        "feedparser==6.0.11",
    )
)

# Image for pipelines that need additional dependencies
reddit_image = base_image.pip_install("asyncpraw==7.7.1")

politics_image = base_image.pip_install(
    "pymupdf==1.24.0",
    "pdfplumber==0.11.0",
)

data_image = base_image.pip_install("pandas==2.2.0")
```

**Step 4: Create __init__.py**

```python
# modal_app/__init__.py
```

**Step 5: Run Modal app list to verify Modal CLI is working**

Run: `modal app list`
Expected: Modal CLI responds (may show empty list or existing apps)

**Step 6: Commit**

```bash
git add modal_app/ requirements-modal.txt
git commit -m "feat: scaffold Modal app with shared data models, volume, and images"
```

---

## Task 2: News Ingester (NewsAPI + RSS Feeds)

**Files:**
- Create: `modal_app/pipelines/__init__.py`
- Create: `modal_app/pipelines/news.py`

**Step 1: Create pipelines __init__.py**

```python
# modal_app/pipelines/__init__.py
```

**Step 2: Write the news ingester**

```python
# modal_app/pipelines/news.py
"""News ingester — pulls local Chicago news from NewsAPI and RSS feeds.

Cadence: Every 30 minutes
Sources: NewsAPI (chicago business/regulation keywords), RSS (Block Club Chicago, Chicago Tribune)
"""
import json
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path

import feedparser
import httpx
import modal

from modal_app.common import Document, SourceType
from modal_app.volume import app, volume, base_image, RAW_DATA_PATH

# RSS feeds for Chicago local news
RSS_FEEDS = [
    ("Block Club Chicago", "https://blockclubchicago.org/feed/"),
    ("Chicago Tribune Local", "https://www.chicagotribune.com/arcio/rss/category/news/local/"),
    ("Crain's Chicago Business", "https://www.chicagobusiness.com/section/news.rss"),
]

NEWSAPI_KEYWORDS = [
    "Chicago business regulation",
    "Chicago zoning",
    "Chicago small business",
    "Chicago permit",
    "Chicago city council",
    "Chicago restaurant",
    "Illinois business law",
]


def _fetch_rss(feed_name: str, feed_url: str) -> list[Document]:
    """Parse an RSS feed and return Document objects."""
    docs = []
    feed = feedparser.parse(feed_url)
    for entry in feed.entries[:20]:  # limit per feed
        published = entry.get("published_parsed")
        if published:
            ts = datetime(*published[:6], tzinfo=timezone.utc)
        else:
            ts = datetime.now(timezone.utc)

        doc = Document(
            id=f"news-rss-{hash(entry.get('link', entry.get('title', '')))}",
            source=SourceType.NEWS,
            title=entry.get("title", ""),
            content=entry.get("summary", entry.get("description", "")),
            url=entry.get("link", ""),
            timestamp=ts,
            metadata={
                "feed_name": feed_name,
                "author": entry.get("author", ""),
                "tags": [t.get("term", "") for t in entry.get("tags", [])],
            },
        )
        docs.append(doc)
    return docs


def _fetch_newsapi(api_key: str) -> list[Document]:
    """Fetch articles from NewsAPI matching Chicago business keywords."""
    docs = []
    if not api_key:
        print("NEWSAPI_KEY not set, skipping NewsAPI")
        return docs

    since = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    for keyword in NEWSAPI_KEYWORDS[:3]:  # limit queries to conserve API calls
        resp = httpx.get(
            "https://newsapi.org/v2/everything",
            params={
                "q": keyword,
                "from": since,
                "sortBy": "publishedAt",
                "pageSize": 10,
                "language": "en",
            },
            headers={"X-Api-Key": api_key},
            timeout=15,
        )
        if resp.status_code != 200:
            print(f"NewsAPI error for '{keyword}': {resp.status_code}")
            continue

        for article in resp.json().get("articles", []):
            doc = Document(
                id=f"news-api-{hash(article.get('url', ''))}",
                source=SourceType.NEWS,
                title=article.get("title", ""),
                content=article.get("description", "") or article.get("content", ""),
                url=article.get("url", ""),
                timestamp=datetime.fromisoformat(
                    article["publishedAt"].replace("Z", "+00:00")
                ) if article.get("publishedAt") else datetime.now(timezone.utc),
                metadata={
                    "source_name": article.get("source", {}).get("name", ""),
                    "author": article.get("author", ""),
                    "keyword": keyword,
                },
            )
            docs.append(doc)
    return docs


@app.function(
    image=base_image,
    volumes={"/data": volume},
    secrets=[modal.Secret.from_name("alethia-secrets")],
    schedule=modal.Period(minutes=30),
    timeout=120,
)
def news_ingester():
    """Ingest Chicago news from RSS feeds and NewsAPI."""
    all_docs: list[Document] = []

    # RSS feeds
    for name, url in RSS_FEEDS:
        try:
            docs = _fetch_rss(name, url)
            all_docs.extend(docs)
            print(f"RSS [{name}]: {len(docs)} articles")
        except Exception as e:
            print(f"RSS [{name}] error: {e}")

    # NewsAPI
    api_key = os.environ.get("NEWSAPI_KEY", "")
    try:
        docs = _fetch_newsapi(api_key)
        all_docs.extend(docs)
        print(f"NewsAPI: {len(docs)} articles")
    except Exception as e:
        print(f"NewsAPI error: {e}")

    # Save to volume
    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H%M")
    out_dir = Path(RAW_DATA_PATH) / "news" / date_str
    out_dir.mkdir(parents=True, exist_ok=True)

    for doc in all_docs:
        fpath = out_dir / f"{doc.id}.json"
        fpath.write_text(doc.model_dump_json(indent=2))

    volume.commit()
    print(f"News ingester complete: {len(all_docs)} documents saved to {out_dir}")
    return len(all_docs)
```

**Step 3: Test locally with Modal**

Run: `cd /home/gt120/projects/hackillinois2026 && modal run modal_app/pipelines/news.py::news_ingester`
Expected: Function runs, fetches RSS feeds (NewsAPI may skip if no key set), prints counts

**Step 4: Commit**

```bash
git add modal_app/pipelines/
git commit -m "feat: add news ingester pipeline (NewsAPI + RSS feeds, 30min cadence)"
```

---

## Task 3: Politics Ingester (Legistar API + PDF Parsing)

**Files:**
- Create: `modal_app/pipelines/politics.py`

**Step 1: Write the politics ingester**

```python
# modal_app/pipelines/politics.py
"""Politics ingester — pulls Chicago City Council data from Legistar API + PDF transcripts.

Cadence: Daily
Sources:
  - Chicago Legistar API (legislation, agendas, minutes, voting records)
  - Zoning Board / Plan Commission PDFs (meeting transcripts)
"""
import json
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path

import httpx
import modal

from modal_app.common import Document, SourceType
from modal_app.volume import app, volume, politics_image, RAW_DATA_PATH

# Chicago Legistar OData API base
LEGISTAR_BASE = "https://webapi.legistar.com/v1/chicago"


def _fetch_legislation(since_days: int = 7) -> list[Document]:
    """Fetch recent legislation from Chicago Legistar API."""
    docs = []
    since = (datetime.now(timezone.utc) - timedelta(days=since_days)).strftime("%Y-%m-%d")

    # Fetch matters (legislation items)
    resp = httpx.get(
        f"{LEGISTAR_BASE}/matters",
        params={
            "$filter": f"MatterIntroDate ge datetime'{since}'",
            "$orderby": "MatterIntroDate desc",
            "$top": 50,
        },
        timeout=30,
    )
    if resp.status_code != 200:
        print(f"Legistar matters error: {resp.status_code}")
        return docs

    for matter in resp.json():
        doc = Document(
            id=f"politics-leg-{matter.get('MatterId', '')}",
            source=SourceType.POLITICS,
            title=matter.get("MatterTitle", "") or matter.get("MatterName", ""),
            content=matter.get("MatterBodyName", "")
            + "\n\n"
            + (matter.get("MatterText", "") or ""),
            url=f"https://chicago.legistar.com/LegislationDetail.aspx?ID={matter.get('MatterId', '')}",
            timestamp=datetime.fromisoformat(
                matter["MatterIntroDate"]
            ) if matter.get("MatterIntroDate") else datetime.now(timezone.utc),
            metadata={
                "matter_type": matter.get("MatterTypeName", ""),
                "status": matter.get("MatterStatusName", ""),
                "body": matter.get("MatterBodyName", ""),
                "sponsor": matter.get("MatterSponsorName", ""),
                "enactment_number": matter.get("MatterEnactmentNumber", ""),
            },
        )
        docs.append(doc)
    return docs


def _fetch_events(since_days: int = 30) -> list[Document]:
    """Fetch recent council/committee events (meetings, hearings)."""
    docs = []
    since = (datetime.now(timezone.utc) - timedelta(days=since_days)).strftime("%Y-%m-%d")

    resp = httpx.get(
        f"{LEGISTAR_BASE}/events",
        params={
            "$filter": f"EventDate ge datetime'{since}'",
            "$orderby": "EventDate desc",
            "$top": 30,
        },
        timeout=30,
    )
    if resp.status_code != 200:
        print(f"Legistar events error: {resp.status_code}")
        return docs

    for event in resp.json():
        agenda_url = event.get("EventAgendaFile", "")
        minutes_url = event.get("EventMinutesFile", "")

        doc = Document(
            id=f"politics-event-{event.get('EventId', '')}",
            source=SourceType.POLITICS,
            title=f"{event.get('EventBodyName', '')} — {event.get('EventDate', '')[:10]}",
            content=event.get("EventComment", "") or f"Meeting: {event.get('EventBodyName', '')}",
            url=event.get("EventInSiteURL", ""),
            timestamp=datetime.fromisoformat(
                event["EventDate"]
            ) if event.get("EventDate") else datetime.now(timezone.utc),
            metadata={
                "body": event.get("EventBodyName", ""),
                "location": event.get("EventLocation", ""),
                "agenda_url": agenda_url,
                "minutes_url": minutes_url,
                "has_pdf": bool(agenda_url or minutes_url),
            },
        )
        docs.append(doc)
    return docs


def _extract_pdf_text(pdf_url: str) -> str:
    """Download a PDF and extract text using pymupdf, fallback to pdfplumber."""
    if not pdf_url:
        return ""

    try:
        resp = httpx.get(pdf_url, timeout=30, follow_redirects=True)
        if resp.status_code != 200:
            return ""

        pdf_bytes = resp.content

        # Try pymupdf first (faster)
        try:
            import fitz  # pymupdf
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            text = "\n".join(page.get_text() for page in doc)
            doc.close()
            if text.strip():
                return text
        except Exception:
            pass

        # Fallback to pdfplumber
        try:
            import pdfplumber
            import io
            with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                text = "\n".join(
                    page.extract_text() or "" for page in pdf.pages
                )
            return text
        except Exception:
            pass

    except Exception as e:
        print(f"PDF download error for {pdf_url}: {e}")
    return ""


@app.function(
    image=politics_image,
    volumes={"/data": volume},
    schedule=modal.Period(days=1),
    timeout=300,
)
def politics_ingester():
    """Ingest Chicago politics data: legislation + events + PDF transcripts."""
    all_docs: list[Document] = []

    # Legislation
    try:
        leg_docs = _fetch_legislation(since_days=7)
        all_docs.extend(leg_docs)
        print(f"Legislation: {len(leg_docs)} items")
    except Exception as e:
        print(f"Legislation error: {e}")

    # Events (meetings, hearings)
    try:
        event_docs = _fetch_events(since_days=30)
        all_docs.extend(event_docs)
        print(f"Events: {len(event_docs)} items")
    except Exception as e:
        print(f"Events error: {e}")

    # Extract PDF text for events that have agenda/minutes PDFs
    pdf_count = 0
    for doc in all_docs:
        if doc.metadata.get("has_pdf"):
            for url_key in ["agenda_url", "minutes_url"]:
                pdf_url = doc.metadata.get(url_key, "")
                if pdf_url:
                    text = _extract_pdf_text(pdf_url)
                    if text:
                        doc.content += f"\n\n--- {url_key.replace('_', ' ').title()} ---\n{text[:5000]}"
                        pdf_count += 1
    print(f"PDFs extracted: {pdf_count}")

    # Save to volume
    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    out_dir = Path(RAW_DATA_PATH) / "politics" / date_str
    out_dir.mkdir(parents=True, exist_ok=True)

    for doc in all_docs:
        fpath = out_dir / f"{doc.id}.json"
        fpath.write_text(doc.model_dump_json(indent=2))

    volume.commit()
    print(f"Politics ingester complete: {len(all_docs)} documents saved to {out_dir}")
    return len(all_docs)
```

**Step 2: Test locally**

Run: `cd /home/gt120/projects/hackillinois2026 && modal run modal_app/pipelines/politics.py::politics_ingester`
Expected: Function runs, fetches legislation and events from Legistar API, attempts PDF extraction

**Step 3: Commit**

```bash
git add modal_app/pipelines/politics.py
git commit -m "feat: add politics ingester (Legistar API + PDF parsing, daily cadence)"
```

---

## Task 4: Reddit Ingester (asyncpraw, hourly)

**Files:**
- Create: `modal_app/pipelines/reddit.py`

**Step 1: Write the Reddit ingester**

```python
# modal_app/pipelines/reddit.py
"""Reddit ingester — monitors Chicago subreddits for business/regulation discussions.

Cadence: Hourly
Sources: r/chicago, r/chicagofood, r/ChicagoNWside, r/SouthSideChicago
"""
import json
import os
from datetime import datetime, timezone
from pathlib import Path

import modal

from modal_app.common import Document, SourceType, REDDIT_SUBREDDITS
from modal_app.volume import app, volume, reddit_image, RAW_DATA_PATH

# Keywords that indicate business/regulation relevance
BUSINESS_KEYWORDS = [
    "permit", "license", "zoning", "regulation", "inspection",
    "restaurant", "bar", "cafe", "shop", "store", "business",
    "opening", "closing", "new", "rent", "lease", "landlord",
    "tax", "fine", "violation", "health department", "alderman",
    "city council", "ordinance", "small business",
]


def _is_relevant(text: str) -> bool:
    """Check if post/comment text contains business-relevant keywords."""
    lower = text.lower()
    return any(kw in lower for kw in BUSINESS_KEYWORDS)


@app.function(
    image=reddit_image,
    volumes={"/data": volume},
    secrets=[modal.Secret.from_name("alethia-secrets")],
    schedule=modal.Period(hours=1),
    timeout=180,
)
async def reddit_ingester():
    """Ingest relevant posts from Chicago subreddits."""
    import asyncpraw

    client_id = os.environ.get("REDDIT_CLIENT_ID", "")
    client_secret = os.environ.get("REDDIT_CLIENT_SECRET", "")

    if not client_id or not client_secret:
        print("Reddit credentials not set, skipping")
        return 0

    reddit = asyncpraw.Reddit(
        client_id=client_id,
        client_secret=client_secret,
        user_agent="alethia:v0.1 (by /u/alethia_bot)",
    )

    all_docs: list[Document] = []

    for sub_name in REDDIT_SUBREDDITS:
        try:
            subreddit = await reddit.subreddit(sub_name)

            # Get hot + new posts
            async for submission in subreddit.hot(limit=25):
                text = f"{submission.title}\n\n{submission.selftext}"
                if not _is_relevant(text):
                    continue

                doc = Document(
                    id=f"reddit-{submission.id}",
                    source=SourceType.REDDIT,
                    title=submission.title,
                    content=submission.selftext[:3000] if submission.selftext else submission.title,
                    url=f"https://reddit.com{submission.permalink}",
                    timestamp=datetime.fromtimestamp(submission.created_utc, tz=timezone.utc),
                    metadata={
                        "subreddit": sub_name,
                        "score": submission.score,
                        "num_comments": submission.num_comments,
                        "upvote_ratio": submission.upvote_ratio,
                        "flair": submission.link_flair_text or "",
                        "author": str(submission.author) if submission.author else "[deleted]",
                    },
                )
                all_docs.append(doc)

            # Get new posts (may catch things 'hot' misses)
            async for submission in subreddit.new(limit=15):
                text = f"{submission.title}\n\n{submission.selftext}"
                if not _is_relevant(text):
                    continue

                doc_id = f"reddit-{submission.id}"
                if any(d.id == doc_id for d in all_docs):
                    continue  # skip duplicates

                doc = Document(
                    id=doc_id,
                    source=SourceType.REDDIT,
                    title=submission.title,
                    content=submission.selftext[:3000] if submission.selftext else submission.title,
                    url=f"https://reddit.com{submission.permalink}",
                    timestamp=datetime.fromtimestamp(submission.created_utc, tz=timezone.utc),
                    metadata={
                        "subreddit": sub_name,
                        "score": submission.score,
                        "num_comments": submission.num_comments,
                        "upvote_ratio": submission.upvote_ratio,
                        "flair": submission.link_flair_text or "",
                        "author": str(submission.author) if submission.author else "[deleted]",
                    },
                )
                all_docs.append(doc)

            print(f"r/{sub_name}: found {sum(1 for d in all_docs if d.metadata.get('subreddit') == sub_name)} relevant posts")

        except Exception as e:
            print(f"r/{sub_name} error: {e}")

    await reddit.close()

    # Save to volume
    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H%M")
    out_dir = Path(RAW_DATA_PATH) / "reddit" / date_str
    out_dir.mkdir(parents=True, exist_ok=True)

    for doc in all_docs:
        fpath = out_dir / f"{doc.id}.json"
        fpath.write_text(doc.model_dump_json(indent=2))

    volume.commit()
    print(f"Reddit ingester complete: {len(all_docs)} documents saved to {out_dir}")
    return len(all_docs)
```

**Step 2: Test locally**

Run: `cd /home/gt120/projects/hackillinois2026 && modal run modal_app/pipelines/reddit.py::reddit_ingester`
Expected: Skips if no Reddit credentials, or fetches posts from subreddits

**Step 3: Commit**

```bash
git add modal_app/pipelines/reddit.py
git commit -m "feat: add Reddit ingester (asyncpraw, hourly cadence, 4 Chicago subs)"
```

---

## Task 5: Review Ingester (Yelp Fusion + Google Places, daily)

**Files:**
- Create: `modal_app/pipelines/reviews.py`

**Step 1: Write the review ingester**

```python
# modal_app/pipelines/reviews.py
"""Review ingester — pulls business reviews from Yelp Fusion and Google Places.

Cadence: Daily
Sources: Yelp Fusion API, Google Places API
Tracks: review velocity (new reviews per period), rating trends
"""
import json
import os
from datetime import datetime, timezone
from pathlib import Path

import httpx
import modal

from modal_app.common import Document, SourceType, CHICAGO_NEIGHBORHOODS
from modal_app.volume import app, volume, base_image, RAW_DATA_PATH

# Business categories to monitor
YELP_CATEGORIES = [
    "restaurants", "food", "coffee", "bars", "nightlife",
    "shopping", "beautysvc", "autorepair", "professional",
]

# Sample neighborhoods for targeted searches
SEARCH_NEIGHBORHOODS = [
    "Lincoln Park, Chicago, IL",
    "Wicker Park, Chicago, IL",
    "Logan Square, Chicago, IL",
    "West Loop, Chicago, IL",
    "Pilsen, Chicago, IL",
    "Hyde Park, Chicago, IL",
    "Andersonville, Chicago, IL",
    "Chinatown, Chicago, IL",
]


def _fetch_yelp(api_key: str) -> list[Document]:
    """Fetch business data from Yelp Fusion API."""
    docs = []
    if not api_key:
        print("YELP_API_KEY not set, skipping Yelp")
        return docs

    headers = {"Authorization": f"Bearer {api_key}"}

    for location in SEARCH_NEIGHBORHOODS[:4]:  # limit to conserve API calls
        for category in YELP_CATEGORIES[:3]:  # limit categories per location
            try:
                resp = httpx.get(
                    "https://api.yelp.com/v3/businesses/search",
                    params={
                        "location": location,
                        "categories": category,
                        "sort_by": "rating",
                        "limit": 10,
                    },
                    headers=headers,
                    timeout=15,
                )
                if resp.status_code != 200:
                    print(f"Yelp error [{location}/{category}]: {resp.status_code}")
                    continue

                for biz in resp.json().get("businesses", []):
                    doc = Document(
                        id=f"yelp-{biz.get('id', '')}",
                        source=SourceType.YELP,
                        title=biz.get("name", ""),
                        content=f"{biz.get('name', '')} — {', '.join(c.get('title', '') for c in biz.get('categories', []))}. "
                        f"Rating: {biz.get('rating', 'N/A')}/5 ({biz.get('review_count', 0)} reviews). "
                        f"Price: {biz.get('price', 'N/A')}.",
                        url=biz.get("url", ""),
                        timestamp=datetime.now(timezone.utc),
                        metadata={
                            "rating": biz.get("rating"),
                            "review_count": biz.get("review_count", 0),
                            "price": biz.get("price", ""),
                            "categories": [c.get("title", "") for c in biz.get("categories", [])],
                            "address": ", ".join(biz.get("location", {}).get("display_address", [])),
                            "phone": biz.get("phone", ""),
                            "is_closed": biz.get("is_closed", False),
                            "neighborhood": location.split(",")[0],
                        },
                        geo={
                            "lat": biz.get("coordinates", {}).get("latitude"),
                            "lng": biz.get("coordinates", {}).get("longitude"),
                            "neighborhood": location.split(",")[0],
                        },
                    )
                    docs.append(doc)

            except Exception as e:
                print(f"Yelp [{location}/{category}] error: {e}")

    return docs


def _fetch_google_places(api_key: str) -> list[Document]:
    """Fetch business data from Google Places API."""
    docs = []
    if not api_key:
        print("GOOGLE_PLACES_API_KEY not set, skipping Google Places")
        return docs

    for location in SEARCH_NEIGHBORHOODS[:4]:
        try:
            # Text search for businesses in neighborhood
            resp = httpx.get(
                "https://maps.googleapis.com/maps/api/place/textsearch/json",
                params={
                    "query": f"businesses in {location}",
                    "key": api_key,
                },
                timeout=15,
            )
            if resp.status_code != 200:
                print(f"Google Places error [{location}]: {resp.status_code}")
                continue

            for place in resp.json().get("results", [])[:10]:
                doc = Document(
                    id=f"gplaces-{place.get('place_id', '')}",
                    source=SourceType.GOOGLE_PLACES,
                    title=place.get("name", ""),
                    content=f"{place.get('name', '')} — {place.get('formatted_address', '')}. "
                    f"Rating: {place.get('rating', 'N/A')}/5 ({place.get('user_ratings_total', 0)} reviews).",
                    url=f"https://www.google.com/maps/place/?q=place_id:{place.get('place_id', '')}",
                    timestamp=datetime.now(timezone.utc),
                    metadata={
                        "rating": place.get("rating"),
                        "user_ratings_total": place.get("user_ratings_total", 0),
                        "types": place.get("types", []),
                        "business_status": place.get("business_status", ""),
                        "price_level": place.get("price_level"),
                        "address": place.get("formatted_address", ""),
                        "neighborhood": location.split(",")[0],
                    },
                    geo={
                        "lat": place.get("geometry", {}).get("location", {}).get("lat"),
                        "lng": place.get("geometry", {}).get("location", {}).get("lng"),
                        "neighborhood": location.split(",")[0],
                    },
                )
                docs.append(doc)

        except Exception as e:
            print(f"Google Places [{location}] error: {e}")

    return docs


def _compute_review_velocity(docs: list[Document]) -> None:
    """Annotate docs with review velocity estimates.

    Review velocity = review_count / estimated_months_open.
    Higher velocity = more active/popular business.
    """
    for doc in docs:
        review_count = doc.metadata.get("review_count") or doc.metadata.get("user_ratings_total", 0)
        if review_count and review_count > 0:
            # Rough estimate: assume business open ~24 months on average
            velocity = round(review_count / 24, 2)
            doc.metadata["review_velocity"] = velocity
            doc.metadata["velocity_label"] = (
                "high" if velocity > 10
                else "medium" if velocity > 3
                else "low"
            )


@app.function(
    image=base_image,
    volumes={"/data": volume},
    secrets=[modal.Secret.from_name("alethia-secrets")],
    schedule=modal.Period(days=1),
    timeout=300,
)
def review_ingester():
    """Ingest business reviews from Yelp Fusion and Google Places."""
    all_docs: list[Document] = []

    # Yelp
    yelp_key = os.environ.get("YELP_API_KEY", "")
    try:
        yelp_docs = _fetch_yelp(yelp_key)
        all_docs.extend(yelp_docs)
        print(f"Yelp: {len(yelp_docs)} businesses")
    except Exception as e:
        print(f"Yelp error: {e}")

    # Google Places
    gplaces_key = os.environ.get("GOOGLE_PLACES_API_KEY", "")
    try:
        gplaces_docs = _fetch_google_places(gplaces_key)
        all_docs.extend(gplaces_docs)
        print(f"Google Places: {len(gplaces_docs)} businesses")
    except Exception as e:
        print(f"Google Places error: {e}")

    # Compute review velocity
    _compute_review_velocity(all_docs)

    # Save to volume
    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    out_dir = Path(RAW_DATA_PATH) / "reviews" / date_str
    out_dir.mkdir(parents=True, exist_ok=True)

    for doc in all_docs:
        fpath = out_dir / f"{doc.id}.json"
        fpath.write_text(doc.model_dump_json(indent=2))

    volume.commit()
    print(f"Review ingester complete: {len(all_docs)} documents saved to {out_dir}")
    return len(all_docs)
```

**Step 2: Test locally**

Run: `cd /home/gt120/projects/hackillinois2026 && modal run modal_app/pipelines/reviews.py::review_ingester`
Expected: Skips APIs without keys, or fetches business data

**Step 3: Commit**

```bash
git add modal_app/pipelines/reviews.py
git commit -m "feat: add review ingester (Yelp Fusion + Google Places, daily, review velocity)"
```

---

## Task 6: Public Data Ingester (Socrata API — Chicago Data Portal)

**Files:**
- Create: `modal_app/pipelines/public_data.py`

**Step 1: Write the public data ingester**

```python
# modal_app/pipelines/public_data.py
"""Public data ingester — pulls structured data from Chicago Data Portal (Socrata API).

Cadence: Daily
Sources: data.cityofchicago.org — business licenses, food inspections,
         building permits, crimes, CTA ridership
"""
import json
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path

import httpx
import modal

from modal_app.common import Document, SourceType, SOCRATA_DATASETS
from modal_app.volume import app, volume, data_image, RAW_DATA_PATH

SOCRATA_BASE = "https://data.cityofchicago.org/resource"


def _fetch_socrata_dataset(
    dataset_id: str,
    dataset_name: str,
    date_field: str | None = None,
    since_days: int = 7,
    limit: int = 200,
    app_token: str = "",
) -> list[Document]:
    """Fetch records from a Socrata dataset."""
    docs = []
    url = f"{SOCRATA_BASE}/{dataset_id}.json"

    params: dict = {"$limit": limit, "$order": ":id DESC"}
    headers = {}

    if app_token:
        headers["X-App-Token"] = app_token

    if date_field:
        since = (datetime.now(timezone.utc) - timedelta(days=since_days)).strftime("%Y-%m-%dT%H:%M:%S")
        params["$where"] = f"{date_field} > '{since}'"

    try:
        resp = httpx.get(url, params=params, headers=headers, timeout=30)
        if resp.status_code != 200:
            print(f"Socrata [{dataset_name}] error: {resp.status_code} — {resp.text[:200]}")
            return docs

        records = resp.json()
        for i, record in enumerate(records):
            # Build a readable content string from key fields
            content_parts = []
            for key, value in record.items():
                if value and not key.startswith(":") and not key.startswith("@"):
                    content_parts.append(f"{key}: {value}")

            doc = Document(
                id=f"public-{dataset_name}-{record.get(':id', i)}",
                source=SourceType.PUBLIC_DATA,
                title=f"{dataset_name.replace('_', ' ').title()} Record",
                content="\n".join(content_parts[:20]),  # limit fields
                timestamp=datetime.now(timezone.utc),
                metadata={
                    "dataset": dataset_name,
                    "dataset_id": dataset_id,
                    "raw_record": {k: v for k, v in list(record.items())[:15]},
                },
                geo={
                    "lat": record.get("latitude"),
                    "lng": record.get("longitude"),
                    "neighborhood": record.get("community_area", ""),
                    "ward": record.get("ward", ""),
                },
            )
            docs.append(doc)

    except Exception as e:
        print(f"Socrata [{dataset_name}] error: {e}")

    return docs


@app.function(
    image=data_image,
    volumes={"/data": volume},
    secrets=[modal.Secret.from_name("alethia-secrets")],
    schedule=modal.Period(days=1),
    timeout=300,
)
def public_data_ingester():
    """Ingest public data from Chicago Data Portal via Socrata API."""
    all_docs: list[Document] = []
    app_token = os.environ.get("SOCRATA_APP_TOKEN", "")

    # Dataset-specific date fields for filtering recent records
    date_fields = {
        "business_licenses": "date_issued",
        "food_inspections": "inspection_date",
        "building_permits": "issue_date",
        "crimes": "date",
        "cta_ridership_L": "service_date",
        "cta_ridership_bus": "date",
    }

    for name, dataset_id in SOCRATA_DATASETS.items():
        try:
            date_field = date_fields.get(name)
            docs = _fetch_socrata_dataset(
                dataset_id=dataset_id,
                dataset_name=name,
                date_field=date_field,
                since_days=7,
                limit=100,
                app_token=app_token,
            )
            all_docs.extend(docs)
            print(f"Socrata [{name}]: {len(docs)} records")
        except Exception as e:
            print(f"Socrata [{name}] error: {e}")

    # Save to volume
    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    out_dir = Path(RAW_DATA_PATH) / "public_data" / date_str
    out_dir.mkdir(parents=True, exist_ok=True)

    for doc in all_docs:
        fpath = out_dir / f"{doc.id}.json"
        fpath.write_text(doc.model_dump_json(indent=2))

    volume.commit()
    print(f"Public data ingester complete: {len(all_docs)} documents saved to {out_dir}")
    return len(all_docs)
```

**Step 2: Test locally**

Run: `cd /home/gt120/projects/hackillinois2026 && modal run modal_app/pipelines/public_data.py::public_data_ingester`
Expected: Fetches records from Socrata API (public, no auth required for basic access)

**Step 3: Commit**

```bash
git add modal_app/pipelines/public_data.py
git commit -m "feat: add public data ingester (Socrata API, CTA ridership + permits + crimes)"
```

---

## Task 7: Demographics Ingester (Census/ACS API)

**Files:**
- Create: `modal_app/pipelines/demographics.py`

**Step 1: Write the demographics ingester**

```python
# modal_app/pipelines/demographics.py
"""Demographics ingester — pulls Census/ACS data for Chicago neighborhoods.

Cadence: Monthly (data updates quarterly)
Sources: US Census Bureau ACS 5-Year Estimates API
"""
import json
import os
from datetime import datetime, timezone
from pathlib import Path

import httpx
import modal

from modal_app.common import Document, SourceType
from modal_app.volume import app, volume, data_image, RAW_DATA_PATH

# Chicago FIPS: State=17 (IL), County=031 (Cook)
CHICAGO_STATE_FIPS = "17"
CHICAGO_COUNTY_FIPS = "031"

# ACS variables of interest for business intelligence
ACS_VARIABLES = {
    "B01003_001E": "total_population",
    "B19013_001E": "median_household_income",
    "B25077_001E": "median_home_value",
    "B25064_001E": "median_gross_rent",
    "B23025_005E": "unemployed",
    "B23025_002E": "labor_force",
    "B15003_022E": "bachelors_degree",
    "B15003_023E": "masters_degree",
    "B01002_001E": "median_age",
    "B25003_001E": "total_housing_units",
    "B25003_002E": "owner_occupied",
    "B25003_003E": "renter_occupied",
}


@app.function(
    image=data_image,
    volumes={"/data": volume},
    secrets=[modal.Secret.from_name("alethia-secrets")],
    schedule=modal.Period(days=30),
    timeout=180,
)
def demographics_ingester():
    """Ingest Census/ACS demographics data for Chicago area tracts."""
    census_api_key = os.environ.get("CENSUS_API_KEY", "")
    all_docs: list[Document] = []

    variables = ",".join(ACS_VARIABLES.keys())
    url = "https://api.census.gov/data/2022/acs/acs5"

    params = {
        "get": f"NAME,{variables}",
        "for": "tract:*",
        "in": f"state:{CHICAGO_STATE_FIPS} county:{CHICAGO_COUNTY_FIPS}",
    }
    if census_api_key:
        params["key"] = census_api_key

    try:
        resp = httpx.get(url, params=params, timeout=30)
        if resp.status_code != 200:
            print(f"Census API error: {resp.status_code} — {resp.text[:200]}")
            return 0

        data = resp.json()
        if not data or len(data) < 2:
            print("Census API returned no data")
            return 0

        headers = data[0]
        for row in data[1:]:
            record = dict(zip(headers, row))
            tract_name = record.get("NAME", "")
            tract_id = record.get("tract", "")

            # Map raw variables to readable names
            demographics = {}
            for var_code, var_name in ACS_VARIABLES.items():
                val = record.get(var_code)
                if val and val not in ["-666666666", "-999999999", None]:
                    try:
                        demographics[var_name] = float(val)
                    except (ValueError, TypeError):
                        demographics[var_name] = val

            # Compute derived metrics
            labor_force = demographics.get("labor_force", 0)
            unemployed = demographics.get("unemployed", 0)
            if labor_force and labor_force > 0:
                demographics["unemployment_rate"] = round(unemployed / labor_force * 100, 1)

            total_housing = demographics.get("total_housing_units", 0)
            renter = demographics.get("renter_occupied", 0)
            if total_housing and total_housing > 0:
                demographics["renter_pct"] = round(renter / total_housing * 100, 1)

            content_lines = [f"{k}: {v}" for k, v in demographics.items()]

            doc = Document(
                id=f"demographics-tract-{CHICAGO_STATE_FIPS}{CHICAGO_COUNTY_FIPS}{tract_id}",
                source=SourceType.DEMOGRAPHICS,
                title=f"Demographics: {tract_name}",
                content="\n".join(content_lines),
                timestamp=datetime.now(timezone.utc),
                metadata={
                    "tract_id": tract_id,
                    "state_fips": CHICAGO_STATE_FIPS,
                    "county_fips": CHICAGO_COUNTY_FIPS,
                    "demographics": demographics,
                },
                geo={
                    "tract": tract_id,
                    "county": "Cook",
                    "state": "IL",
                },
            )
            all_docs.append(doc)

        print(f"Census: {len(all_docs)} tracts")

    except Exception as e:
        print(f"Census API error: {e}")

    # Save to volume
    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    out_dir = Path(RAW_DATA_PATH) / "demographics" / date_str
    out_dir.mkdir(parents=True, exist_ok=True)

    for doc in all_docs:
        fpath = out_dir / f"{doc.id}.json"
        fpath.write_text(doc.model_dump_json(indent=2))

    volume.commit()
    print(f"Demographics ingester complete: {len(all_docs)} documents saved to {out_dir}")
    return len(all_docs)
```

**Step 2: Test locally**

Run: `cd /home/gt120/projects/hackillinois2026 && modal run modal_app/pipelines/demographics.py::demographics_ingester`
Expected: Fetches Census data (public API, key optional but recommended)

**Step 3: Commit**

```bash
git add modal_app/pipelines/demographics.py
git commit -m "feat: add demographics ingester (Census/ACS API, monthly cadence)"
```

---

## Task 8: Real Estate Ingester (CoStar API / LoopNet Scrape)

**Files:**
- Create: `modal_app/pipelines/realestate.py`

**Step 1: Write the real estate ingester**

```python
# modal_app/pipelines/realestate.py
"""Real estate ingester — pulls commercial real estate listings for Chicago.

Cadence: Weekly
Sources: CoStar API (preferred) or LoopNet scrape (fallback)
Note: CoStar API requires enterprise access. For hackathon, we use
      publicly available listing data from LoopNet via httpx.
"""
import json
import os
from datetime import datetime, timezone
from pathlib import Path

import httpx
import modal

from modal_app.common import Document, SourceType, CHICAGO_NEIGHBORHOODS
from modal_app.volume import app, volume, base_image, RAW_DATA_PATH

# LoopNet search parameters for Chicago commercial properties
LOOPNET_PROPERTY_TYPES = [
    "retail",
    "restaurant",
    "office",
    "industrial",
]

SEARCH_AREAS = [
    "Lincoln Park", "Wicker Park", "Logan Square", "West Loop",
    "River North", "South Loop", "Pilsen", "Hyde Park",
]


def _fetch_loopnet_listings() -> list[Document]:
    """Fetch commercial real estate listings from LoopNet.

    Note: LoopNet doesn't have a public API, so we fetch their
    public listing pages. For a production app, use CoStar API.
    For the hackathon, this demonstrates the data pipeline pattern.
    """
    docs = []

    for area in SEARCH_AREAS:
        try:
            # Use LoopNet's public search endpoint
            resp = httpx.get(
                "https://www.loopnet.com/api/search",
                params={
                    "q": f"commercial property {area} Chicago IL",
                    "type": "lease",
                },
                headers={
                    "User-Agent": "Mozilla/5.0 (compatible; AlethiaBot/0.1; educational hackathon project)",
                },
                timeout=15,
            )

            if resp.status_code != 200:
                # LoopNet may block API access — that's expected
                # In production, use CoStar API with proper credentials
                print(f"LoopNet [{area}]: {resp.status_code} (expected — use CoStar API for production)")
                continue

            # If we get data, parse it
            data = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
            listings = data.get("listings", data.get("results", []))

            for listing in listings[:10]:
                doc = Document(
                    id=f"realestate-{listing.get('id', hash(str(listing)))}",
                    source=SourceType.REAL_ESTATE,
                    title=listing.get("title", listing.get("address", f"Commercial Property in {area}")),
                    content=f"Commercial property in {area}, Chicago. "
                    f"Type: {listing.get('property_type', 'N/A')}. "
                    f"Size: {listing.get('size', 'N/A')} sqft. "
                    f"Price: {listing.get('price', 'N/A')}.",
                    url=listing.get("url", ""),
                    timestamp=datetime.now(timezone.utc),
                    metadata={
                        "property_type": listing.get("property_type", ""),
                        "size_sqft": listing.get("size", ""),
                        "price": listing.get("price", ""),
                        "neighborhood": area,
                        "listing_type": listing.get("listing_type", "lease"),
                    },
                    geo={
                        "neighborhood": area,
                        "lat": listing.get("latitude"),
                        "lng": listing.get("longitude"),
                    },
                )
                docs.append(doc)

        except Exception as e:
            print(f"LoopNet [{area}] error: {e}")

    return docs


def _create_placeholder_listings() -> list[Document]:
    """Create placeholder listings to demonstrate the pipeline structure.

    In production, these would come from CoStar API or LoopNet.
    For the hackathon demo, this ensures the pipeline has data to show.
    """
    docs = []
    placeholder_data = [
        {
            "area": "Lincoln Park",
            "type": "Retail",
            "size": "1,200",
            "price": "$3,500/mo",
            "desc": "Street-level retail space on Clark St. High foot traffic, near DePaul.",
        },
        {
            "area": "West Loop",
            "type": "Restaurant",
            "size": "2,800",
            "price": "$8,000/mo",
            "desc": "Restaurant space on Randolph St. Former restaurant, grease trap installed.",
        },
        {
            "area": "Wicker Park",
            "type": "Retail/Coffee",
            "size": "900",
            "price": "$2,800/mo",
            "desc": "Corner unit on Milwaukee Ave. Great visibility, outdoor seating potential.",
        },
        {
            "area": "Pilsen",
            "type": "Mixed Use",
            "size": "3,200",
            "price": "$4,200/mo",
            "desc": "Ground floor commercial with apartment above. 18th St corridor.",
        },
    ]

    for i, p in enumerate(placeholder_data):
        doc = Document(
            id=f"realestate-placeholder-{i}",
            source=SourceType.REAL_ESTATE,
            title=f"{p['type']} Space — {p['area']}",
            content=f"{p['desc']} Size: {p['size']} sqft. Price: {p['price']}.",
            timestamp=datetime.now(timezone.utc),
            metadata={
                "property_type": p["type"],
                "size_sqft": p["size"],
                "price": p["price"],
                "neighborhood": p["area"],
                "is_placeholder": True,
            },
            geo={"neighborhood": p["area"]},
        )
        docs.append(doc)

    return docs


@app.function(
    image=base_image,
    volumes={"/data": volume},
    secrets=[modal.Secret.from_name("alethia-secrets")],
    schedule=modal.Period(days=7),
    timeout=180,
)
def realestate_ingester():
    """Ingest commercial real estate data for Chicago neighborhoods."""
    all_docs: list[Document] = []

    # Try LoopNet first
    try:
        loopnet_docs = _fetch_loopnet_listings()
        all_docs.extend(loopnet_docs)
        print(f"LoopNet: {len(loopnet_docs)} listings")
    except Exception as e:
        print(f"LoopNet error: {e}")

    # If no real listings, use placeholders for demo
    if not all_docs:
        placeholder_docs = _create_placeholder_listings()
        all_docs.extend(placeholder_docs)
        print(f"Using {len(placeholder_docs)} placeholder listings (CoStar API needed for production)")

    # Save to volume
    date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    out_dir = Path(RAW_DATA_PATH) / "realestate" / date_str
    out_dir.mkdir(parents=True, exist_ok=True)

    for doc in all_docs:
        fpath = out_dir / f"{doc.id}.json"
        fpath.write_text(doc.model_dump_json(indent=2))

    volume.commit()
    print(f"Real estate ingester complete: {len(all_docs)} documents saved to {out_dir}")
    return len(all_docs)
```

**Step 2: Test locally**

Run: `cd /home/gt120/projects/hackillinois2026 && modal run modal_app/pipelines/realestate.py::realestate_ingester`
Expected: Attempts LoopNet (likely blocked), falls back to placeholder data

**Step 3: Commit**

```bash
git add modal_app/pipelines/realestate.py
git commit -m "feat: add real estate ingester (CoStar/LoopNet + placeholder fallback, weekly)"
```

---

## Task 9: Modal Secrets Setup

**Files:**
- Update: `.env.example`

**Step 1: Update .env.example with all required keys**

Add to `.env.example`:
```
# Alethia Environment Variables

# Modal (redeem $250 credits: modal.com/credits code VVN-YQS-E55)
MODAL_TOKEN_ID=
MODAL_TOKEN_SECRET=

# News
NEWSAPI_KEY=

# Reddit
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=

# Reviews
YELP_API_KEY=
GOOGLE_PLACES_API_KEY=

# Public Data
SOCRATA_APP_TOKEN=

# Census
CENSUS_API_KEY=

# OpenAI (tabled for later)
OPENAI_API_KEY=

# Supermemory (tabled for later)
SUPERMEMORY_API_KEY=
```

**Step 2: Document how to create Modal secrets**

Create a setup guide at `docs/SETUP.md` with instructions to run:
```bash
modal secret create alethia-secrets \
  NEWSAPI_KEY=your_key \
  REDDIT_CLIENT_ID=your_id \
  REDDIT_CLIENT_SECRET=your_secret \
  YELP_API_KEY=your_key \
  GOOGLE_PLACES_API_KEY=your_key \
  SOCRATA_APP_TOKEN=your_token \
  CENSUS_API_KEY=your_key
```

**Step 3: Commit**

```bash
git add .env.example docs/SETUP.md
git commit -m "docs: update env vars and add Modal secrets setup guide"
```

---

## Task 10: Deploy All Pipelines to Modal

**Step 1: Deploy each pipeline**

```bash
modal deploy modal_app/pipelines/news.py
modal deploy modal_app/pipelines/politics.py
modal deploy modal_app/pipelines/reddit.py
modal deploy modal_app/pipelines/reviews.py
modal deploy modal_app/pipelines/public_data.py
modal deploy modal_app/pipelines/demographics.py
modal deploy modal_app/pipelines/realestate.py
```

**Step 2: Verify deployments**

Run: `modal app list`
Expected: Shows `alethia` app with all scheduled functions

**Step 3: Test each pipeline once manually**

```bash
modal run modal_app/pipelines/news.py::news_ingester
modal run modal_app/pipelines/politics.py::politics_ingester
modal run modal_app/pipelines/public_data.py::public_data_ingester
```

**Step 4: Verify data on volume**

```bash
modal volume ls alethia-data /raw/
```
Expected: Shows directories for each data source with timestamped subdirectories

**Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix: pipeline deployment fixes"
```

---

## Summary

| Task | Pipeline | Source | Cadence | Key APIs |
|------|----------|--------|---------|----------|
| 1 | Infrastructure | — | — | Modal App, Volume, shared models |
| 2 | News | NewsAPI + RSS | 30 min | NewsAPI, feedparser |
| 3 | Politics | Legistar + PDFs | Daily | Legistar OData, pymupdf, pdfplumber |
| 4 | Reddit | asyncpraw | Hourly | Reddit API (4 Chicago subs) |
| 5 | Reviews | Yelp + Google Places | Daily | Yelp Fusion, Places API |
| 6 | Public Data | Socrata | Daily | Chicago Data Portal (8 datasets) |
| 7 | Demographics | Census/ACS | Monthly | Census Bureau API |
| 8 | Real Estate | CoStar/LoopNet | Weekly | LoopNet + placeholder fallback |
| 9 | Secrets | — | — | Modal secrets setup |
| 10 | Deploy | — | — | Verify all pipelines running |

**Next phases (tabled for later):**
- Phase 2: Processing pipeline (embed with MiniLM, classify, geo-tag, index with Llama 3.1 8B)
- Phase 3: Backend API (FastAPI) + Frontend (React + Tailwind)
- Phase 4: Supermemory integration + RAG query flow + OpenAI chat generation
- Phase 5: Polish, Cloudflare Pages deployment, alethia.tech domain, Solana stretch goal
