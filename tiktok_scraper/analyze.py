"""GPT-powered query expansion and insight synthesis."""

from __future__ import annotations

import json

from openai import OpenAI

from .config import MAX_SEARCH_TERMS, OPENAI_API_KEY, OPENAI_MODEL

_client: OpenAI | None = None


def _get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI(api_key=OPENAI_API_KEY)
    return _client


def expand_query(user_query: str) -> list[str]:
    """Turn a business question into TikTok search queries.

    Returns up to MAX_SEARCH_TERMS search strings.
    """
    client = _get_client()
    response = client.chat.completions.create(
        model=OPENAI_MODEL,
        temperature=0.7,
        messages=[
            {
                "role": "system",
                "content": (
                    "You generate TikTok search queries. Given a business question, "
                    f"produce exactly {MAX_SEARCH_TERMS} short TikTok search queries "
                    "that would surface relevant trend content. "
                    "Return ONLY a JSON array of strings, no other text."
                ),
            },
            {"role": "user", "content": user_query},
        ],
    )
    raw = response.choices[0].message.content.strip()
    if raw.startswith("```"):
        raw = raw.split("\n", 1)[1] if "\n" in raw else raw[3:]
        raw = raw.rsplit("```", 1)[0]
    queries: list[str] = json.loads(raw)
    return queries[:MAX_SEARCH_TERMS]


def synthesize_insights(query: str, videos: list[dict]) -> str:
    """Produce a structured trend analysis from scraped + transcribed videos."""
    video_summaries = []
    for i, v in enumerate(videos, 1):
        parts = [f"Video {i}: {v.get('description', 'No description')}"]
        if v.get("creator"):
            parts.append(f"  Creator: @{v['creator']}")
        if v.get("views"):
            parts.append(f"  Views: {v['views']}")
        if v.get("hashtags"):
            parts.append(f"  Hashtags: {', '.join(v['hashtags'])}")
        if v.get("transcription"):
            parts.append(f"  Transcript: {v['transcription'][:500]}")
        video_summaries.append("\n".join(parts))

    video_block = "\n\n".join(video_summaries) if video_summaries else "(no videos)"

    client = _get_client()
    response = client.chat.completions.create(
        model=OPENAI_MODEL,
        temperature=0.4,
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a trend analyst. Given TikTok video data (metadata + "
                    "transcriptions), produce a structured analysis with these sections:\n"
                    "1. **Key Trends & Themes** — common topics across videos\n"
                    "2. **Sentiment Overview** — positive / negative / neutral breakdown\n"
                    "3. **Common Recommendations** — advice or opinions creators share\n"
                    "4. **Actionable Insights** — concrete takeaways for the user's question\n"
                    "5. **Outlier Perspectives** — notable minority views\n\n"
                    "Be specific and cite video numbers where relevant."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Original question: {query}\n\n"
                    f"Video data:\n{video_block}"
                ),
            },
        ],
    )
    return response.choices[0].message.content
