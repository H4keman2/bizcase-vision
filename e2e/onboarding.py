"""Playwright checks: onboarding corner card dismissal + non-blocking behavior.

Run: python3 e2e/onboarding.py
"""
import asyncio, sys
from playwright.async_api import async_playwright

BASE = "http://localhost:8080"
CARD = "[aria-label='Getting started guide']"
fails = []

def check(name, cond):
    print(("PASS  " if cond else "FAIL  ") + name)
    if not cond:
        fails.append(name)

async def fresh(page):
    """Load the home page with onboarding un-seen so the card auto-shows."""
    await page.goto(BASE, wait_until="domcontentloaded")
    await page.evaluate("localStorage.removeItem('onboarding:seen')")
    await page.reload(wait_until="domcontentloaded")
    await page.wait_for_selector(CARD, timeout=10000)

async def assert_not_blocking(page, label):
    card = page.locator(CARD)
    box = await card.bounding_box()
    check(f"{label}: card is anchored top-right", box is not None and box["y"] < 120)
    # No dimming/blocking overlay covering the viewport centre.
    centre = await page.evaluate(
        "() => { const el = document.elementFromPoint(innerWidth/2, innerHeight/2);"
        " return el ? el.closest(\"[aria-label='Getting started guide']\") !== null : false }"
    )
    check(f"{label}: page centre not covered by the card", centre is False)
    # Focus is not trapped: clicking an app control behind the card works.
    new_case = page.get_by_role("button", name="New Case").or_(
        page.get_by_role("link", name="New Case")
    ).first
    if await new_case.count():
        await new_case.focus()
        focused = await page.evaluate(
            "() => document.activeElement.closest(\"[aria-label='Getting started guide']\") === null"
        )
        check(f"{label}: app controls behind the card stay focusable", focused)

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()

        # --- 1. First visit: card shows and does not block ---
        await fresh(page)
        check("first visit: card visible", await page.locator(CARD).is_visible())
        await assert_not_blocking(page, "first visit")

        # --- 2. Escape dismisses ---
        await page.keyboard.press("Escape")
        await page.wait_for_selector(CARD, state="detached", timeout=3000)
        check("escape: card dismissed", await page.locator(CARD).count() == 0)
        check("escape: seen flag persisted",
              await page.evaluate("localStorage.getItem('onboarding:seen')") == "1")
        await page.reload(wait_until="domcontentloaded")
        await page.wait_for_timeout(500)
        check("escape: stays dismissed after reload", await page.locator(CARD).count() == 0)

        # --- 3. SKIP dismisses ---
        await fresh(page)
        await page.get_by_role("button", name="Skip tutorial").click()
        await page.wait_for_selector(CARD, state="detached", timeout=3000)
        check("skip: card dismissed", await page.locator(CARD).count() == 0)
        check("skip: seen flag persisted",
              await page.evaluate("localStorage.getItem('onboarding:seen')") == "1")

        # --- 4. Reopen from Settings > Help, then dismiss both ways ---
        for mode in ("skip", "escape"):
            await page.get_by_role("button", name="Settings").first.click()
            await page.get_by_role("button", name="Show Tutorial").click()
            await page.wait_for_selector(CARD, timeout=5000)
            check(f"reopen ({mode}): card visible from Settings > Help",
                  await page.locator(CARD).is_visible())
            check(f"reopen ({mode}): settings modal closed",
                  await page.get_by_role("button", name="Show Tutorial").count() == 0)
            await assert_not_blocking(page, f"reopen ({mode})")
            if mode == "skip":
                await page.get_by_role("button", name="Skip tutorial").click()
            else:
                await page.keyboard.press("Escape")
            await page.wait_for_selector(CARD, state="detached", timeout=3000)
            check(f"reopen ({mode}): card dismissed", await page.locator(CARD).count() == 0)

        # --- 5. App still usable after dismissal ---
        clickable = await page.evaluate(
            "() => { const el = document.elementFromPoint(innerWidth/2, 200);"
            " return el ? el.tagName : null }"
        )
        check("after dismissal: page hit-testable (no leftover overlay)", clickable is not None)

        await page.screenshot(path="/tmp/browser/onboarding-final.png")
        await browser.close()

    print(f"\n{'ALL CHECKS PASSED' if not fails else 'FAILURES: ' + ', '.join(fails)}")
    sys.exit(1 if fails else 0)

asyncio.run(main())
