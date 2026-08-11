import asyncio, sys
from playwright.async_api import async_playwright

fails = []
def check(name, cond):
    print(("PASS  " if cond else "FAIL  ") + name)
    if not cond: fails.append(name)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        c = await b.new_context(viewport={"width":1280,"height":1800})
        pg = await c.new_page()
        await pg.goto("http://localhost:8080/", wait_until="domcontentloaded")
        await pg.wait_for_timeout(2000)
        for _ in range(3):
            await pg.get_by_role("button", name="+ New Case").first.click()
            try:
                await pg.wait_for_url("**/case/**", timeout=5000)
                break
            except Exception:
                await pg.wait_for_timeout(1000)
        await pg.wait_for_timeout(1500)
        print("URL:", pg.url)

        trigger = pg.locator('button[aria-label^="What is"]').first
        await trigger.wait_for()

        # --- baseline: closed
        check("closed: aria-expanded=false", await trigger.get_attribute("aria-expanded") == "false")
        check("closed: no aria-describedby", await trigger.get_attribute("aria-describedby") is None)
        check("closed: no tooltip in DOM", await pg.get_by_role("tooltip").count() == 0)

        # --- Tab/focus opens (hover state)
        await trigger.focus()
        await pg.wait_for_timeout(150)
        desc = await trigger.get_attribute("aria-describedby")
        check("focus: aria-expanded=true", await trigger.get_attribute("aria-expanded") == "true")
        check("focus: aria-describedby present", bool(desc))
        tip = pg.locator(f"#{desc}") if desc else None
        check("focus: describedby resolves to role=tooltip",
              bool(desc) and await tip.get_attribute("role") == "tooltip")
        check("focus: tooltip visible with text", bool(desc) and await tip.is_visible() and len((await tip.inner_text()).strip()) > 10)

        # --- Escape from focused (unpinned) state closes
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(150)
        check("escape(focused): tooltip removed", await pg.get_by_role("tooltip").count() == 0)
        check("escape(focused): aria-describedby cleared", await trigger.get_attribute("aria-describedby") is None)
        check("escape(focused): focus retained on trigger", await trigger.evaluate("el => el === document.activeElement"))

        # --- Enter pins
        await trigger.focus()
        await pg.keyboard.press("Enter")
        await pg.wait_for_timeout(150)
        check("enter: tooltip open", await pg.get_by_role("tooltip").count() == 1)
        # pinned survives blur
        await pg.keyboard.press("Tab")
        await pg.wait_for_timeout(200)
        check("enter: still open after Tab away (pinned)", await pg.get_by_role("tooltip").count() == 1)
        check("enter: focus moved off trigger", not await trigger.evaluate("el => el === document.activeElement"))

        # --- Escape while pinned closes and restores focus to trigger
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(200)
        check("escape(pinned): tooltip removed", await pg.get_by_role("tooltip").count() == 0)
        check("escape(pinned): focus returned to trigger", await trigger.evaluate("el => el === document.activeElement"))
        check("escape(pinned): aria-expanded=false", await trigger.get_attribute("aria-expanded") == "false")

        # --- Space toggles open then closed
        await trigger.focus()
        await pg.keyboard.press("Space")
        await pg.wait_for_timeout(150)
        check("space: opens/pins tooltip", await pg.get_by_role("tooltip").count() == 1)
        await pg.keyboard.press("Space")
        await pg.wait_for_timeout(150)
        check("space: second press closes", await pg.get_by_role("tooltip").count() == 0)
        check("space: no page scroll", await pg.evaluate("window.scrollY") == 0)

        # --- outside click dismisses pinned tooltip
        await trigger.focus()
        await pg.keyboard.press("Enter")
        await pg.wait_for_timeout(150)
        await pg.mouse.click(5, 400)
        await pg.wait_for_timeout(200)
        check("outside click: pinned tooltip dismissed", await pg.get_by_role("tooltip").count() == 0)

        # --- focus order: tooltip content is never a tab stop
        async def active():
            return await pg.evaluate(
                "() => { const el = document.activeElement; return { tag: el.tagName, label: el.getAttribute('aria-label'), inTip: !!el.closest('[role=tooltip]') }; }"
            )

        await trigger.focus()
        before = await active()
        # capture the neighbours in DOM tab order around the trigger
        await pg.keyboard.press("Tab")
        await pg.wait_for_timeout(150)
        after_tab = await active()
        check("tab: focus leaves trigger", after_tab != before)
        check("tab: focus never lands inside tooltip", not after_tab["inTip"])
        check("tab: tooltip closed after leaving trigger", await pg.get_by_role("tooltip").count() == 0)

        # Shift+Tab returns to the trigger itself
        await pg.keyboard.press("Shift+Tab")
        await pg.wait_for_timeout(150)
        back = await active()
        check("shift+tab: focus returns to trigger", back["label"] == before["label"])
        check("shift+tab: reopens tooltip on focus", await pg.get_by_role("tooltip").count() == 1)
        check("shift+tab: focus not inside tooltip", not back["inTip"])

        # pinned tooltip: tabbing forward still skips tooltip content entirely
        await trigger.focus()
        await pg.keyboard.press("Enter")
        await pg.wait_for_timeout(150)
        check("pinned: tooltip open before tabbing", await pg.get_by_role("tooltip").count() == 1)
        seen_in_tip = False
        for _ in range(5):
            await pg.keyboard.press("Tab")
            await pg.wait_for_timeout(80)
            if (await active())["inTip"]:
                seen_in_tip = True
                break
        check("pinned: 5 forward tabs never enter tooltip", not seen_in_tip)
        # and Shift+Tab back the same number of steps is not trapped
        for _ in range(5):
            await pg.keyboard.press("Shift+Tab")
            await pg.wait_for_timeout(80)
            if (await active())["inTip"]:
                seen_in_tip = True
        check("pinned: reverse tabbing never enters tooltip", not seen_in_tip)

        # closing with Escape restores focus to the trigger control, not body
        await trigger.focus()
        await pg.keyboard.press("Enter")
        await pg.wait_for_timeout(150)
        await pg.keyboard.press("Escape")
        await pg.wait_for_timeout(200)
        restored = await active()
        check("escape: focus restored to trigger (not body)", restored["tag"] == "BUTTON" and restored["label"] == before["label"])
        check("escape: focus not lost to document.body", restored["tag"] != "BODY")
        # and the next Tab from there moves on normally
        await pg.keyboard.press("Tab")
        await pg.wait_for_timeout(150)
        onward = await active()
        check("escape: tab after close moves forward normally", onward["label"] != before["label"] and not onward["inTip"])

        await b.close()
    print("\n%d failure(s)" % len(fails), fails)
    sys.exit(1 if fails else 0)

asyncio.run(main())
