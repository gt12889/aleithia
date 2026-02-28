"""Modal app definition, volume, and image configuration."""
import modal

app = modal.App("alethia")

volume = modal.Volume.from_name("alethia-data", create_if_missing=True)

VOLUME_MOUNT = "/data"
RAW_DATA_PATH = f"{VOLUME_MOUNT}/raw"
PROCESSED_DATA_PATH = f"{VOLUME_MOUNT}/processed"
CACHE_PATH = f"{VOLUME_MOUNT}/cache"

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

# Vision pipeline images
video_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg")
    .pip_install("yt-dlp==2024.8.6")
)

label_image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install("openai==1.50.0", "httpx==0.27.0", "pillow==10.4.0")
)

yolo_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("libgl1-mesa-glx", "libglib2.0-0")
    .pip_install("ultralytics==8.2.0", "opencv-python-headless==4.9.0.80")
)
