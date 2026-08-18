"""Visual regression: onboarding card neon glow on every tutorial step.

Captures desktop + mobile element snapshots of the "Getting started guide"
card at each of the 4 steps, and asserts the permanent multi-layered neon
glow box-shadow is present (not only on hover/focus).

Run: python3 e2e/onboarding-glow-snapshot.py
"""
import asyncio, re, sys
from pathlib import Path
from playwright.async_api import async_playwright

BASE = "http://localhost:8080"
CARD = "[aria-label='Getting started guide'], [role='dialog'][aria-labelledby='onboarding-step-title']"
OUT = Path("/tmp/browser/snapshots")
OUT.mkdir(parents=True, exist_ok=True)
T = 15000

fails = []

def check(name, cond):
    print(("PASS  " if cond else "FAIL  ") + name)
    if not cond:
        fails.append(name)

async def wait_app_ready(page):
    await page.wait_for_load_state("domcontentloaded")
    await page.get_by_role("button", name="Settings").first.wait_for(state="visible", timeout=T)
    await page.wait_for_function(
        "() => document.fonts ? document.fonts.status === 'loaded' : true", timeout=T
    )

async def wait_card_stable(page):
    card = page.locator(CARD).first
    await card.wait_for(state="visible", timeout=T)
    await page.wait_for_function(
        """(sel) => {
             const el = document.querySelector(sel);
             if (!el) return false;
             const anims = el.getAnimations ? el.getAnimations({ subtree: true }) : [];
             return anims.every(a => a.playState === 'finished' || a.playState === 'idle');
           }""",
        arg=CARD, timeout=T,
    )
    return card

async def glow_shadow(page):
    return await page.evaluate(
        "(sel) => { const el = document.querySelector(sel);"
        " return el ? getComputedStyle(el).boxShadow : null }",
        CARD,
    )

def has_neon_glow(shadow: str | None) -> bool:
    """Multi-layered shadow including the neon accent rgb(199, 249, 43)."""
    if not shadow or shadow == "none":
        return False
    neon = re.search(r"rgba?\(\s*199,\s*249,\s*43", shadow) is not None
    layers = shadow.count("rgb")
    return neon and layers >= 2

async def run_viewport(browser, label, vp):
    ctx = await browser.new_context(viewport=vp)
    page = await ctx.new_page()
    V = f"[{label}] "

    await page.goto(BASE, wait_until="domcontentloaded")
    await wait_app_ready(page)
    await page.evaluate("localStorage.removeItem('onboarding:seen')")
    await page.reload(wait_until="domcontentloaded")
    await wait_app_ready(page)
    card = await wait_card_stable(page)

    for step in range(1, 5):
        # Step counter in the header confirms which step we're snapshotting.
        header = await page.locator(CARD).first.inner_text()
        check(V + f"step {step}: card shows step {step}/4", f"{step}/4" in header)

        shadow = await glow_shadow(page)
        check(V + f"step {step}: neon glow present", has_neon_glow(shadow))
        if not has_neon_glow(shadow):
            print("    box-shadow was:", shadow)

        await card.screenshot(
            path=str(OUT / f"onboarding-glow-{label}-step{step}.png")
        )

        if step < 4:
            await page.get_by_role("button", name="Next").click()
            await wait_card_stable(page)

    await ctx.close()

VIEWPORTS = [
    ("desktop", {"width": 1280, "height": 1800}),
    ("mobile", {"width": 393, "height": 706}),
]

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        for label, vp in VIEWPORTS:
            print(f"\n=== {label} ===")
            await run_viewport(browser, label, vp)
        await browser.close()
    print(f"\n{'ALL CHECKS PASSED' if not fails else 'FAILURES: ' + ', '.join(fails)}")
    print(f"snapshots: {OUT}")
    sys.exit(1 if fails else 0)

asyncio.run(main())
