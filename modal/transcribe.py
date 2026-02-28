"""Modal function: download TikTok video audio and transcribe with Whisper."""

from __future__ import annotations

import json
import os
import subprocess
import tempfile

import modal

app = modal.App("tiktok-scraper")

transcribe_image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("ffmpeg")
    .pip_install(
        "yt-dlp>=2024.1.0",
        "openai-whisper>=20231117",
        "torch>=2.1.0",
    )
)


@app.function(
    image=transcribe_image,
    gpu="A10G",
    timeout=300,
)
def transcribe_video(video_url: str) -> dict:
    """Download video audio with yt-dlp and transcribe with Whisper.

    Returns dict with keys: transcription, language, duration, error.
    """
    import whisper

    with tempfile.TemporaryDirectory() as tmpdir:
        audio_path = os.path.join(tmpdir, "audio.wav")

        # Download audio with yt-dlp
        cmd = [
            "yt-dlp",
            "--no-check-certificates",
            "-x",
            "--audio-format", "wav",
            "-o", os.path.join(tmpdir, "audio.%(ext)s"),
            "--no-playlist",
            "--socket-timeout", "30",
            video_url,
        ]

        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode != 0:
            return {
                "transcription": "",
                "language": "",
                "duration": 0,
                "error": f"yt-dlp failed: {result.stderr[:500]}",
            }

        # yt-dlp may output with a slightly different name; find the wav
        import glob

        wav_files = glob.glob(os.path.join(tmpdir, "*.wav"))
        if not wav_files:
            return {
                "transcription": "",
                "language": "",
                "duration": 0,
                "error": "No audio file produced by yt-dlp",
            }
        audio_path = wav_files[0]

        # Transcribe with Whisper (base model for speed)
        model = whisper.load_model("base")
        transcription = model.transcribe(audio_path)

        duration = transcription.get("segments", [{}])
        total_duration = duration[-1].get("end", 0) if duration else 0

        return {
            "transcription": transcription.get("text", "").strip(),
            "language": transcription.get("language", ""),
            "duration": round(total_duration, 1),
            "error": "",
        }


# ---------------------------------------------------------------------------
# Standalone test: modal run modal/transcribe.py
# ---------------------------------------------------------------------------

@app.local_entrypoint()
def main():
    test_url = "https://www.tiktok.com/@placeholder/video/1234567890"
    result = transcribe_video.remote(test_url)
    print(json.dumps(result, indent=2))
