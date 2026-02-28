"""Modal function: scrape TikTok search results via kernel.sh cloud browser."""

from __future__ import annotations

import asyncio
import json
import logging
import os

import modal

logger = logging.getLogger(__name__)

app = modal.App("tiktok-scraper-browser")

scraper_image = (
    modal.Image.debian_slim(python_version="3.12")
    .pip_install(
        "kernel>=0.1.0",
        "playwright>=1.40.0",
    )
    .run_commands("playwright install chromium")
)

MAX_VIDEOS = int(os.environ.get("MAX_VIDEOS_PER_QUERY", "5"))


async def _scrape_async(search_query: str, max_videos: int) -> list[dict]:
    """Async implementation of the TikTok scraper."""
    from kernel import Kernel
    from playwright.async_api import async_playwright

    kernel_api_key = os.environ.get("KERNEL_API_KEY", "")
    if not kernel_api_key:
        logger.error("KERNEL_API_KEY not set")
        return []

    k = Kernel(api_key=kernel_api_key)
    try:
        kernel_browser = k.browsers.create()
    except Exception as exc:
        logger.error("Failed to create kernel browser session: %s", exc)
        return []

    async with async_playwright() as pw:
        browser = await pw.chromium.connect_over_cdp(kernel_browser.cdp_ws_url)
        context = browser.contexts[0] if browser.contexts else await browser.new_context()
        page = context.pages[0] if context.pages else await context.new_page()

        try:
            # Navigate to TikTok search
            encoded_query = search_query.replace(" ", "+")
            url = f"https://www.tiktok.com/search?q={encoded_query}"
            logger.info("Navigating to %s", url)
            await page.goto(url, wait_until="domcontentloaded", timeout=30_000)

            # Give the page a moment to settle
            await page.wait_for_timeout(3000)

            # Dismiss cookie banner if present
            for selector in [
                "button:has-text('Accept all')",
                "button:has-text('Accept')",
                "[data-testid='cookie-banner-accept']",
            ]:
                try:
                    btn = page.locator(selector).first
                    if await btn.is_visible(timeout=2000):
                        await btn.click()
                        break
                except Exception:
                    continue

            # Dismiss login prompt if it appears
            for selector in [
                "[data-e2e='modal-close-inner-button']",
                "button[aria-label='Close']",
                ".close-button",
            ]:
                try:
                    btn = page.locator(selector).first
                    if await btn.is_visible(timeout=2000):
                        await btn.click()
                        break
                except Exception:
                    continue

            # Wait for video cards — try multiple selectors
            card_selectors = [
                "[data-e2e='search_top-item']",
                "[data-e2e='search-card-desc']",
                "[data-e2e='search_video-item']",
                "[class*='DivItemContainerV2']",
                "[class*='VideoListContainer'] a",
            ]
            found_selector = None
            for sel in card_selectors:
                try:
                    await page.wait_for_selector(sel, timeout=5_000)
                    found_selector = sel
                    logger.info("Found cards with selector: %s", sel)
                    break
                except Exception:
                    continue

            if not found_selector:
                # Debug: dump page title and URL to understand what we're seeing
                title = await page.title()
                current_url = page.url
                body_text = await page.evaluate("() => document.body?.innerText?.slice(0, 500) || ''")
                logger.error(
                    "No video cards found. title=%r url=%r body_preview=%r",
                    title, current_url, body_text,
                )
                return []

            # Scroll a couple times to load more content
            for _ in range(3):
                await page.mouse.wheel(0, 1500)
                await page.wait_for_timeout(1500)

            # Extract video data — use a broad approach to find links + metadata
            videos_raw = await page.evaluate(
                """() => {
                const results = [];

                // Approach 1: find all video links on the page
                const links = document.querySelectorAll('a[href*="/video/"]');
                const seen = new Set();

                for (const link of links) {
                    const href = link.href;
                    if (seen.has(href)) continue;
                    seen.add(href);

                    // Walk up to find the card container
                    let card = link.closest('[data-e2e]') || link.parentElement?.parentElement;

                    // Try to extract metadata from the card or nearby elements
                    const getText = (el, selectors) => {
                        if (!el) return '';
                        for (const sel of selectors) {
                            const found = el.querySelector(sel);
                            if (found) return found.textContent.trim();
                        }
                        return '';
                    };

                    const description = getText(card, [
                        '[data-e2e="search-card-desc"]',
                        '[class*="SpanText"]',
                        '[class*="desc"]',
                    ]) || link.textContent?.trim() || '';

                    const creator = getText(card, [
                        '[data-e2e="search-card-user-unique-id"]',
                        '[class*="SpanUniqueId"]',
                        '[class*="author"]',
                    ]);

                    const views = getText(card, [
                        '[class*="video-count"]',
                        '[class*="StrongVideoCount"]',
                        'strong',
                    ]);

                    const hashtags = [];
                    if (card) {
                        const hashEls = card.querySelectorAll('a[href*="/tag/"]');
                        for (const h of hashEls) {
                            hashtags.push(h.textContent.trim());
                        }
                    }

                    results.push({
                        description,
                        video_url: href,
                        creator,
                        views,
                        likes: '',
                        hashtags,
                    });
                }

                return results;
            }"""
            )

            logger.info("Extracted %d raw video entries", len(videos_raw))

            # Deduplicate and cap results
            seen_urls: set[str] = set()
            videos: list[dict] = []
            for v in videos_raw:
                if not v.get("video_url") or v["video_url"] in seen_urls:
                    continue
                seen_urls.add(v["video_url"])
                videos.append(v)
                if len(videos) >= max_videos:
                    break

            return videos

        except Exception as exc:
            logger.error("Scrape failed for query '%s': %s", search_query, exc)
            return []
        finally:
            await browser.close()
            try:
                k.browsers.delete_by_id(kernel_browser.session_id)
            except Exception:
                pass


@app.function(
    image=scraper_image,
    timeout=120,
    secrets=[modal.Secret.from_name("tiktok-scraper-secrets")],
)
def scrape_tiktok(search_query: str, max_videos: int = MAX_VIDEOS) -> list[dict]:
    """Scrape TikTok search results for a given query.

    Uses kernel.sh for a cloud browser session and Playwright to drive it.
    Returns a list of video metadata dicts.
    """
    return asyncio.run(_scrape_async(search_query, max_videos))


# ---------------------------------------------------------------------------
# Standalone test: modal run modal/tiktok_scrape.py
# ---------------------------------------------------------------------------

@app.local_entrypoint()
def main():
    results = scrape_tiktok.remote("coffee shop trends")
    print(json.dumps(results, indent=2))
