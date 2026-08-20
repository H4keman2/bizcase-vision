"""Sitemap-driven smoke test for calculator landing pages.

Loads every URL listed in /sitemap.xml whose path ends with '-calculator',
asserts the page has a non-empty <title> and a non-empty <h1>.

Run: python3 e2e/sitemap-smoke.py
"""
import asyncio
import re
import sys
from urllib.parse import urlparse

import requests
from playwright.async_api import async_playwright

BASE = "http://localhost:8080"
SITEMAP_URL = f"{BASE}/sitemap.xml"
TIMEOUT = 15000


def get_calculator_paths():
    response = requests.get(SITEMAP_URL, timeout=30)
    response.raise_for_status()
    xml = response.text
    locs = re.findall(r"<loc>([^<]+)</loc>", xml)
    paths = []
    for loc in locs:
        parsed = urlparse(loc)
        if parsed.path.endswith("-calculator"):
            paths.append(parsed.path)
    if not paths:
        raise RuntimeError("No calculator URLs found in sitemap.xml")
    return sorted(set(paths))


async def run():
    paths = get_calculator_paths()
    print(f"Found {len(paths)} calculator URL(s) in sitemap: {paths}")

    fails = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        for path in paths:
            url = BASE + path
            print(f"\n=== {path} ===")
            try:
                await page.goto(url, wait_until="domcontentloaded")
                await page.wait_for_selector("h1", state="visible", timeout=TIMEOUT)

                title = await page.title()
                h1_text = await page.locator("h1").first.text_content()

                title_ok = bool(title and title.strip())
                h1_ok = bool(h1_text and h1_text.strip())

                print(f"  title: {title!r}")
                print(f"  h1:    {(h1_text or '').strip()!r}")
                print(f"  title OK: {title_ok}, h1 OK: {h1_ok}")

                if not title_ok:
                    fails.append(f"{path}: missing page title")
                if not h1_ok:
                    fails.append(f"{path}: missing h1 text")
            except Exception as exc:  # noqa: BLE001
                print(f"  ERROR: {exc}")
                fails.append(f"{path}: {exc}")

        await context.close()
        await browser.close()

    print(f"\n{'ALL CHECKS PASSED' if not fails else 'FAILURES: ' + ', '.join(fails)}")
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    asyncio.run(run())
