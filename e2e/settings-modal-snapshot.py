"""Visual regression snapshot for the Settings modal in compactBody mode.

Captures deterministic baselines of the Settings modal so future spacing
regressions (body padding or section gaps) are caught by diffing the output
PNGs. Snapshots are taken after animations settle and fonts load.

Run: python3 e2e/settings-modal-snapshot.py
"""
import asyncio, sys
from pathlib import Path
from playwright.async_api import async_playwright

BASE = "http://localhost:8080"
T = 15000
SNAPSHOT_DIR = Path("/tmp/browser/snapshots")
SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)

fails = []

def check(name, cond):
    print(("PASS  " if cond else "FAIL  ") + name)
    if not cond:
        fails.append(name)

async def wait_app_ready(page):
    await page.wait_for_load_state("domcontentloaded")
    await page.get_by_role("button", name="Settings").first.wait_for(
        state="visible", timeout=T
    )
    await page.wait_for_function(
        "() => document.fonts ? document.fonts.status === 'loaded' : true", timeout=T
    )

async def suppress_onboarding(page):
    """Mark the tutorial as already seen so the corner card never auto-shows."""
    await page.evaluate("localStorage.setItem('onboarding:seen', '1')")

async def open_settings_modal(page):
    """Click Settings and wait for the modal to render and settle."""
    await page.get_by_role("button", name="Settings").first.click()
    # Wait for the dialog to exist in the DOM (it may start at opacity 0 during entry animation).
    modal = page.locator("[role='dialog'][aria-label='Settings']")
    await modal.wait_for(state="attached", timeout=T)
    # Allow the zoom/fade entry animation to finish.
    await page.wait_for_timeout(400)
    return modal

async def capture_snapshot(page, label, filename):
    modal = await open_settings_modal(page)

    # --- Assert compactBody mode is active ---
    body = page.locator("[role='dialog'][aria-label='Settings'] .surface-card > div:last-child")
    padding_class = await body.get_attribute("class")
    check(f"{label}: modal body uses p-4 compact padding", padding_class and "p-4" in padding_class)

    sections = page.locator("[role='dialog'][aria-label='Settings'] .flex.flex-col.gap-5")
    check(f"{label}: section stack uses gap-5", await sections.count() == 1)

    # --- Capture baseline snapshot ---
    snapshot_path = SNAPSHOT_DIR / filename
    await modal.screenshot(path=str(snapshot_path))
    check(
        f"{label}: snapshot written to {snapshot_path}",
        snapshot_path.exists() and snapshot_path.stat().st_size > 0,
    )
    return snapshot_path

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)

        # --- Desktop snapshot ---
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()
        await page.goto(BASE, wait_until="domcontentloaded")
        await suppress_onboarding(page)
        await page.reload(wait_until="domcontentloaded")
        await wait_app_ready(page)
        # Give React a moment to finish hydration so the Settings trigger is interactive.
        await page.wait_for_timeout(1500)
        await capture_snapshot(page, "desktop", "settings-modal-compact.png")
        await ctx.close()

        # --- Mobile snapshot ---
        mobile_ctx = await browser.new_context(viewport={"width": 393, "height": 706})
        mobile_page = await mobile_ctx.new_page()
        await mobile_page.goto(BASE, wait_until="domcontentloaded")
        await suppress_onboarding(mobile_page)
        await mobile_page.reload(wait_until="domcontentloaded")
        await wait_app_ready(mobile_page)
        # Mobile can take longer to hydrate the stacked header controls.
        await mobile_page.wait_for_timeout(2500)
        await capture_snapshot(mobile_page, "mobile", "settings-modal-compact-mobile.png")
        await mobile_ctx.close()

        await browser.close()

    print(f"\n{'ALL CHECKS PASSED' if not fails else 'FAILURES: ' + ', '.join(fails)}")
    sys.exit(1 if fails else 0)

asyncio.run(main())
