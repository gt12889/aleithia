"""Configuration constants and environment variable references."""

import os
from pathlib import Path

from dotenv import load_dotenv

# Load .env from the project root
load_dotenv(Path(__file__).resolve().parent.parent / ".env")

# --- Pipeline limits ---
MAX_VIDEOS_PER_QUERY = 5
MAX_SEARCH_TERMS = 3

# --- API keys (read from environment) ---
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
KERNEL_API_KEY = os.environ.get("KERNEL_API_KEY", "")

# --- Model settings ---
OPENAI_MODEL = "gpt-4o"

# --- Modal app name ---
MODAL_APP_NAME = "alethia"
