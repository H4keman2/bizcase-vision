"""Verify the visible FAQ section on each free calculator landing page.

Asserts each page renders a "Frequently Asked Questions" heading followed by
exactly the 3 expected questions, and that those match the FAQPage JSON-LD.

Run: python3 e2e/calculator-faq.py
"""
import asyncio, json, sys
from playwright.async_api import async_playwright

BASE = "http://localhost:8080"
T = 15000

PAGES = {
    "/irr-calculator": [
        "What is IRR (internal rate of return)?",
        "What is a good IRR?",
        "How is IRR different from NPV?",
    ],
    "/npv-calculator": [
        "What is NPV (net present value)?",
        "What discount rate should I use?",
        "What does a negative NPV mean?",
    ],
    "/payback-period-calculator": [
        "What is payback period?",
        "What's a good payback period?",
        "What are the limits of payback period as a metric?",
    ],
}

fails = []

def check(name, cond):
    print(("PASS  " if cond else "FAIL  ") + name)
    if not cond:
        fails.append(name)

async def run_page(page, path, expected):
    await page.goto(BASE + path, wait_until="domcontentloaded")
    heading = page.get_by_role("heading", name="Frequently Asked Questions")
    await heading.wait_for(state="visible", timeout=T)
    check(f"{path}: FAQ heading visible", True)

    # The FAQ <dl> immediately follows the heading.
    dts = page.locator("dl dt", has_text="?")
    texts = [t.strip() for t in await dts.all_inner_texts()]
    check(f"{path}: renders exactly 3 questions (got {len(texts)})", len(texts) == 3)
    for i, q in enumerate(expected):
        got = texts[i] if i < len(texts) else None
        check(f"{path}: question {i + 1} is {q!r}", got == q)
        if got != q:
            print("    got:", repr(got))

    # Visible questions must match the FAQPage JSON-LD for schema validity.
    scripts = await page.locator("script[type='application/ld+json']").all_text_contents()
    schema_qs = []
    for s in scripts:
        try:
            data = json.loads(s)
        except json.JSONDecodeError:
            continue
        if data.get("@type") == "FAQPage":
            schema_qs = [e["name"] for e in data.get("mainEntity", [])]
    check(f"{path}: JSON-LD questions match visible questions", schema_qs == expected)
    if schema_qs != expected:
        print("    schema:", schema_qs)

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()
        for path, expected in PAGES.items():
            print(f"\n=== {path} ===")
            await run_page(page, path, expected)
        await ctx.close()
        await browser.close()
    print(f"\n{'ALL CHECKS PASSED' if not fails else 'FAILURES: ' + ', '.join(fails)}")
    sys.exit(1 if fails else 0)

asyncio.run(main())
