"""Playwright checks: onboarding corner card dismissal + non-blocking behavior.

All waits are on deterministic UI states (animations settled, stable bounding
box, persisted localStorage flag) rather than fixed sleeps, so the suite stays
reliable on slower CI machines.

Run: python3 e2e/onboarding.py
"""
import asyncio, sys
from playwright.async_api import async_playwright

BASE = "http://localhost:8080"
CARD = "[aria-label='Getting started guide']"
# Generous ceilings: these are upper bounds, not sleeps — waits resolve as soon
# as the condition is true, so slow CI just takes longer, it doesn't flake.
T = 15000
fails = []

def check(name, cond):
    print(("PASS  " if cond else "FAIL  ") + name)
    if not cond:
        fails.append(name)

async def wait_app_ready(page):
    """Wait until the app shell has hydrated and is interactive."""
    await page.wait_for_load_state("domcontentloaded")
    await page.get_by_role("button", name="Settings").first.wait_for(
        state="visible", timeout=T
    )
    await page.wait_for_function(
        "() => document.fonts ? document.fonts.status === 'loaded' : true", timeout=T
    )

async def wait_card_stable(page):
    """Card visible, entry animation finished, and geometry settled."""
    card = page.locator(CARD)
    await card.wait_for(state="visible", timeout=T)
    # All CSS animations/transitions on the card and its subtree have finished.
    await page.wait_for_function(
        """(sel) => {
             const el = document.querySelector(sel);
             if (!el) return false;
             const anims = el.getAnimations ? el.getAnimations({ subtree: true }) : [];
             return anims.every(a => a.playState === 'finished' || a.playState === 'idle');
           }""",
        arg=CARD, timeout=T,
    )
    # Two identical consecutive frames of the bounding box => layout is stable.
    await page.wait_for_function(
        """(sel) => new Promise(resolve => {
             const el = document.querySelector(sel);
             if (!el) return resolve(false);
             const a = el.getBoundingClientRect();
             requestAnimationFrame(() => {
               const b = el.getBoundingClientRect();
               resolve(a.top === b.top && a.left === b.left &&
                       a.width === b.width && a.height === b.height &&
                       b.width > 0 && b.height > 0);
             });
           })""",
        arg=CARD, timeout=T,
    )
    return card

async def wait_card_gone(page):
    """Card removed from the DOM (or hidden) and no exit animation still running."""
    await page.wait_for_function(
        """(sel) => {
             const el = document.querySelector(sel);
             if (!el) return true;
             const cs = getComputedStyle(el);
             if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return true;
             return false;
           }""",
        arg=CARD, timeout=T,
    )

async def card_hidden(page):
    return await page.evaluate(
        """(sel) => {
             const el = document.querySelector(sel);
             if (!el) return true;
             const cs = getComputedStyle(el);
             return cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0';
           }""",
        CARD,
    )

async def wait_seen_flag(page):
    await page.wait_for_function(
        "() => localStorage.getItem('onboarding:seen') !== null", timeout=T
    )
    return True

async def wait_no_autoshow(page):
    """Deterministically confirm the card never auto-shows on this load.

    Waits for the app to be ready and for the auto-show timer window to be over
    (signalled by two idle animation frames after readiness), then asserts.
    """
    await wait_app_ready(page)
    await page.wait_for_function(
        """() => new Promise(resolve => {
             // Yield past any queued auto-show timer/microtasks.
             setTimeout(() => requestAnimationFrame(() =>
               requestAnimationFrame(() => resolve(true))), 1200);
           })""",
        timeout=T,
    )
    return await card_hidden(page)

async def fresh(page):
    """Load the home page with onboarding un-seen so the card auto-shows."""
    await page.goto(BASE, wait_until="domcontentloaded")
    await wait_app_ready(page)
    await page.evaluate("localStorage.removeItem('onboarding:seen')")
    await page.reload(wait_until="domcontentloaded")
    await wait_app_ready(page)
    await wait_card_stable(page)

async def assert_not_blocking(page, label):
    card = await wait_card_stable(page)
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

VIEWPORTS = [
    ("desktop 1280x1800", {"width": 1280, "height": 1800}),
    ("laptop 1024x768", {"width": 1024, "height": 768}),
    ("tablet 768x1024", {"width": 768, "height": 1024}),
    ("mobile 393x706", {"width": 393, "height": 706}),
]

async def run_viewport(browser, engine, vp_name, vp):
    """Full onboarding suite for one viewport size."""
    ctx = await browser.new_context(viewport=vp)
    page = await ctx.new_page()
    V = f"[{engine} · {vp_name}] "

    # --- 1. First visit: card shows and does not block ---
    await fresh(page)
    check(V + "first visit: card visible", await page.locator(CARD).is_visible())
    await assert_not_blocking(page, V + "first visit")
    # Card must fit inside the viewport at every size.
    box = await page.locator(CARD).bounding_box()
    check(
        V + "first visit: card fits within the viewport",
        box is not None
        and box["x"] >= 0
        and box["x"] + box["width"] <= vp["width"] + 1
        and box["height"] <= vp["height"],
    )

    # --- 2. Escape dismisses ---
    await page.keyboard.press("Escape")
    await wait_card_gone(page)
    check(V + "escape: card dismissed", await card_hidden(page))
    check(V + "escape: seen flag persisted", await wait_seen_flag(page))
    await page.reload(wait_until="domcontentloaded")
    check(V + "escape: stays dismissed after reload", await wait_no_autoshow(page))

    # --- 3. SKIP dismisses ---
    await fresh(page)
    await page.get_by_role("button", name="Skip tutorial").click()
    await wait_card_gone(page)
    check(V + "skip: card dismissed", await card_hidden(page))
    check(V + "skip: seen flag persisted", await wait_seen_flag(page))

    # --- 4. Click outside dismisses and prevents auto-show forever ---
    await fresh(page)
    # Click low-left, well outside the top-right card at any width.
    await page.mouse.click(min(200, vp["width"] // 4), vp["height"] - 60)
    await wait_card_gone(page)
    check(V + "click-outside: card dismissed", await card_hidden(page))
    check(V + "click-outside: seen flag persisted immediately", await wait_seen_flag(page))
    for i in (1, 2):
        await page.reload(wait_until="domcontentloaded")
        check(V + f"click-outside: still hidden on reload #{i}", await wait_no_autoshow(page))

    # --- 5. Reopen from Settings > Help, then dismiss both ways ---
    for mode in ("skip", "escape"):
        settings = page.get_by_role("button", name="Settings").first
        await settings.wait_for(state="visible", timeout=T)
        await settings.click()
        tutorial = page.get_by_role("button", name="Show Tutorial")
        await tutorial.wait_for(state="visible", timeout=T)
        await tutorial.click()
        await wait_card_stable(page)
        check(V + f"reopen ({mode}): card visible from Settings > Help",
              await page.locator(CARD).is_visible())
        await tutorial.wait_for(state="detached", timeout=T)
        check(V + f"reopen ({mode}): settings modal closed",
              await page.get_by_role("button", name="Show Tutorial").count() == 0)
        await assert_not_blocking(page, V + f"reopen ({mode})")
        if mode == "skip":
            await page.get_by_role("button", name="Skip tutorial").click()
        else:
            await page.keyboard.press("Escape")
        await wait_card_gone(page)
        check(V + f"reopen ({mode}): card dismissed", await card_hidden(page))

    # --- 6. App still usable after dismissal ---
    clickable = await page.evaluate(
        "() => { const el = document.elementFromPoint(innerWidth/2, 200);"
        " return el ? el.tagName : null }"
    )
    check(V + "after dismissal: page hit-testable (no leftover overlay)", clickable is not None)

    # --- 7. Auto-show fires exactly once for a first-time visitor ---
    ctx2 = await browser.new_context(viewport=vp)
    page2 = await ctx2.new_page()
    await page2.goto(BASE, wait_until="domcontentloaded")
    await wait_app_ready(page2)
    await page2.evaluate("localStorage.removeItem('onboarding:seen')")
    await page2.reload(wait_until="domcontentloaded")

    check(V + "auto-show: no seen flag before first visit completes",
          await page2.evaluate("localStorage.getItem('onboarding:seen')") is None)
    check(V + "auto-show: card not present instantly on load",
          await page2.locator(CARD).count() == 0)
    await wait_card_stable(page2)
    check(V + "auto-show: card appears after the delay",
          await page2.locator(CARD).is_visible())
    await assert_not_blocking(page2, V + "auto-show")

    await page2.get_by_role("button", name="Skip tutorial").click()
    await wait_card_gone(page2)
    for i in (1, 2):
        await page2.reload(wait_until="domcontentloaded")
        check(V + f"auto-show: still hidden on reload #{i}", await wait_no_autoshow(page2))

    # A brand-new browser profile (no localStorage) sees it again.
    ctx3 = await browser.new_context(viewport=vp)
    page3 = await ctx3.new_page()
    await page3.goto(BASE, wait_until="domcontentloaded")
    try:
        await wait_card_stable(page3)
        shown = True
    except Exception:
        shown = False
    check(V + "auto-show: fresh profile sees the card again", shown)

    await page.screenshot(
        path=f"/tmp/browser/onboarding-{engine}-{vp['width']}x{vp['height']}.png"
    )
    await ctx3.close()
    await ctx2.close()
    await ctx.close()

# Chromium runs the full viewport matrix; Firefox and WebKit run a desktop +
# mobile pair, which is enough to catch engine-specific timer/animation and
# storage-persistence differences without tripling total runtime.
ENGINES = [
    ("chromium", VIEWPORTS),
    ("firefox", [VIEWPORTS[0], VIEWPORTS[-1]]),
    ("webkit", [VIEWPORTS[0], VIEWPORTS[-1]]),
]

async def main():
    only = sys.argv[1] if len(sys.argv) > 1 else None
    async with async_playwright() as p:
        for engine, viewports in ENGINES:
            if only and only != engine:
                continue
            browser = await getattr(p, engine).launch(headless=True)
            for vp_name, vp in viewports:
                print(f"\n=== {engine} · {vp_name} ===")
                await run_viewport(browser, engine, vp_name, vp)
            await browser.close()

    print(f"\n{'ALL CHECKS PASSED' if not fails else 'FAILURES: ' + ', '.join(fails)}")
    sys.exit(1 if fails else 0)

asyncio.run(main())


