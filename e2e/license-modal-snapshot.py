"""Visual regression snapshot for the LicenseModal in default (non-compact) mode.

Captures deterministic baselines of the license-key entry modal so future spacing
regressions (body padding or section gaps) are caught by diffing the output PNGs.
Snapshots are taken after animations settle and fonts load.

Run: python3 e2e/license-modal-snapshot.py
"""
import asyncio, sys
from pathlib import Path
from playwright.async_api import async_playwright

BASE = "http://localhost:8080"
T = 15000
SNAPSHOT_DIR = Path("/tmp/browser/snapshots")
SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)

LICENSE_KEYS = [
    "bizcase:license",
    "bizcase-license",
    "bizcase:licenseKey",
    "bizcaseLicense",
    "license",
]

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


async def clear_license_state(page):
    """Ensure the Settings panel shows the free-tier 'Enter License Key' button."""
    for key in LICENSE_KEYS:
        await page.evaluate(f"localStorage.removeItem({key!r})")


async def open_license_modal(page):
    """Open Settings, then click 'Enter License Key' and wait for the modal."""
    await page.get_by_role("button", name="Settings").first.click()
    settings_modal = page.locator("[role='dialog'][aria-label='Settings']")
    await settings_modal.wait_for(state="attached", timeout=T)
    await page.wait_for_timeout(300)

    await page.get_by_role("button", name="Enter License Key").click()
    license_modal = page.locator("[role='dialog'][aria-label='Enter License Key']")
    await license_modal.wait_for(state="attached", timeout=T)
    await page.wait_for_timeout(400)
    return license_modal


async def capture_snapshot(page, label, filename):
    modal = await open_license_modal(page)

    # --- Assert default (non-compact) body mode is active ---
    body = page.locator(
        "[role='dialog'][aria-label='Enter License Key'] .surface-card > div:last-child"
    )
    padding_class = await body.get_attribute("class")
    check(f"{label}: modal body uses p-5 default padding", padding_class and "p-5" in padding_class)
    check(f"{label}: modal body does NOT use p-4 compact padding", not (padding_class and "p-4" in padding_class))

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
        await clear_license_state(page)
        await page.reload(wait_until="domcontentloaded")
        await wait_app_ready(page)
        await page.wait_for_timeout(1500)
        await capture_snapshot(page, "desktop", "license-modal-default.png")
        await ctx.close()

        # --- Mobile snapshot ---
        mobile_ctx = await browser.new_context(viewport={"width": 393, "height": 706})
        mobile_page = await mobile_ctx.new_page()
        await mobile_page.goto(BASE, wait_until="domcontentloaded")
        await suppress_onboarding(mobile_page)
        await clear_license_state(mobile_page)
        await mobile_page.reload(wait_until="domcontentloaded")
        await wait_app_ready(mobile_page)
        await mobile_page.wait_for_timeout(2500)
        await capture_snapshot(mobile_page, "mobile", "license-modal-default-mobile.png")
        await mobile_ctx.close()

        await browser.close()

    print(f"\n{'ALL CHECKS PASSED' if not fails else 'FAILURES: ' + ', '.join(fails)}")
    sys.exit(1 if fails else 0)


asyncio.run(main())
