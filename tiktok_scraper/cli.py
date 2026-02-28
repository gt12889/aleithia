"""CLI orchestrator — ties the full TikTok trend-scraping pipeline together."""

from __future__ import annotations

import argparse
import pathlib
import sys

from rich.console import Console
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn
from rich.table import Table

from .analyze import expand_query, synthesize_insights
from .config import MAX_VIDEOS_PER_QUERY

# The project has a local `modal/` directory that shadows the installed `modal`
# pip package.  Temporarily remove the project root from sys.path so we can
# import the real one.
_project_root = str(pathlib.Path(__file__).resolve().parent.parent)

def _import_modal():
    """Import the installed modal package, not the local modal/ directory."""
    _removed = []
    for p in (sys.path[:]):
        # Remove entries that resolve to the project root (covers "", ".", and abs)
        try:
            resolved = str(pathlib.Path(p).resolve()) if p else _project_root
        except (OSError, ValueError):
            resolved = p
        if resolved == _project_root:
            sys.path.remove(p)
            _removed.append(p)

    # Also evict any already-imported local modal so importlib finds the real one
    cached = {k: v for k, v in sys.modules.items() if k == "modal" or k.startswith("modal.")}
    for k in cached:
        del sys.modules[k]

    import modal  # noqa: the real package

    # Restore sys.path and cached modules
    for p in reversed(_removed):
        sys.path.insert(0, p)

    return modal

console = Console()


def _flatten_and_dedup(nested: list[list[dict]]) -> list[dict]:
    """Flatten list-of-lists and deduplicate by video_url."""
    seen: set[str] = set()
    out: list[dict] = []
    for group in nested:
        for v in group:
            url = v.get("video_url", "")
            if url and url not in seen:
                seen.add(url)
                out.append(v)
    return out


def run(query: str, max_videos: int = MAX_VIDEOS_PER_QUERY, verbose: bool = False) -> None:
    """Execute the full pipeline for *query*."""
    modal = _import_modal()
    Function = modal.Function

    console.print(Panel(f"[bold]Query:[/bold] {query}", title="TikTok Trend Scraper"))

    # ── Step 1: Query expansion ───────────────────────────────────────
    with Progress(SpinnerColumn(), TextColumn("{task.description}"), console=console) as p:
        task = p.add_task("Expanding query with GPT…", total=None)
        try:
            search_terms = expand_query(query)
        except Exception as exc:
            console.print(f"[red]Query expansion failed:[/red] {exc}")
            sys.exit(1)
        p.update(task, completed=True)

    console.print(f"\n[bold]Search terms:[/bold] {', '.join(search_terms)}\n")

    # ── Step 2: Scrape TikTok (parallel via Modal .map) ───────────────
    console.print("[bold]Scraping TikTok…[/bold]")
    try:
        scrape_fn = Function.from_name("tiktok-scraper-browser", "scrape_tiktok")
    except Exception as exc:
        console.print(
            f"[red]Could not find deployed scrape function:[/red] {exc}\n"
            "  Run: modal deploy modal/tiktok_scrape.py"
        )
        sys.exit(1)

    scrape_args = [(term, max_videos) for term in search_terms]
    nested_results: list[list[dict]] = []
    with Progress(SpinnerColumn(), TextColumn("{task.description}"), console=console) as p:
        task = p.add_task(f"Scraping {len(search_terms)} search terms…", total=len(search_terms))
        for result in scrape_fn.starmap(scrape_args):
            nested_results.append(result if result else [])
            p.advance(task)

    videos = _flatten_and_dedup(nested_results)
    console.print(f"  Found [green]{len(videos)}[/green] unique videos\n")

    if verbose:
        tbl = Table(title="Scraped Videos")
        tbl.add_column("#", width=3)
        tbl.add_column("Creator", max_width=20)
        tbl.add_column("Description", max_width=50)
        tbl.add_column("Views")
        for i, v in enumerate(videos, 1):
            tbl.add_row(
                str(i),
                f"@{v.get('creator', '?')}",
                v.get("description", "")[:50],
                v.get("views", ""),
            )
        console.print(tbl)
        console.print()

    if not videos:
        console.print("[yellow]No videos found. Try a different query.[/yellow]")
        return

    # ── Step 3: Transcribe (parallel via Modal .map) ──────────────────
    console.print("[bold]Transcribing audio…[/bold]")
    try:
        transcribe_fn = Function.from_name("tiktok-scraper", "transcribe_video")
    except Exception as exc:
        console.print(
            f"[red]Could not find deployed transcribe function:[/red] {exc}\n"
            "  Run: modal deploy modal/transcribe.py"
        )
        console.print("[yellow]Skipping transcription — synthesizing from metadata only.[/yellow]\n")
        transcribe_fn = None

    if transcribe_fn is not None:
        video_urls = [v["video_url"] for v in videos]
        transcriptions: list[dict] = []
        with Progress(SpinnerColumn(), TextColumn("{task.description}"), console=console) as p:
            task = p.add_task(f"Transcribing {len(video_urls)} videos…", total=len(video_urls))
            for result in transcribe_fn.map(video_urls):
                transcriptions.append(result if result else {})
                p.advance(task)

        # Merge transcriptions into video dicts
        success_count = 0
        for v, t in zip(videos, transcriptions):
            v["transcription"] = t.get("transcription", "")
            v["language"] = t.get("language", "")
            v["duration"] = t.get("duration", 0)
            v["transcription_error"] = t.get("error", "")
            if v["transcription"]:
                success_count += 1

        console.print(f"  Transcribed [green]{success_count}[/green]/{len(videos)} videos\n")

        if verbose:
            for i, v in enumerate(videos, 1):
                if v.get("transcription_error"):
                    console.print(f"  [red]Video {i} error:[/red] {v['transcription_error']}")
                elif v.get("transcription"):
                    console.print(f"  [dim]Video {i}:[/dim] {v['transcription'][:100]}…")

    # ── Step 4: Synthesize insights ───────────────────────────────────
    with Progress(SpinnerColumn(), TextColumn("{task.description}"), console=console) as p:
        task = p.add_task("Synthesizing insights with GPT…", total=None)
        try:
            insights = synthesize_insights(query, videos)
        except Exception as exc:
            console.print(f"[red]Insight synthesis failed:[/red] {exc}")
            sys.exit(1)
        p.update(task, completed=True)

    console.print()
    console.print(Panel(insights, title="[bold green]Trend Analysis[/bold green]", expand=False))


def main() -> None:
    parser = argparse.ArgumentParser(
        prog="tiktok_scraper",
        description="Scrape TikTok trends and synthesize insights for a business question.",
    )
    parser.add_argument("query", help="Business question or topic to research")
    parser.add_argument(
        "--max-videos",
        type=int,
        default=MAX_VIDEOS_PER_QUERY,
        help=f"Max videos per search term (default: {MAX_VIDEOS_PER_QUERY})",
    )
    parser.add_argument("--verbose", "-v", action="store_true", help="Show detailed output")
    args = parser.parse_args()

    try:
        run(args.query, max_videos=args.max_videos, verbose=args.verbose)
    except KeyboardInterrupt:
        console.print("\n[yellow]Interrupted.[/yellow]")
        sys.exit(1)
