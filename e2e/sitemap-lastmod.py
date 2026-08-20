import re

import requests

CALCULATOR_PATHS = [
    "/irr-calculator",
    "/npv-calculator",
    "/payback-period-calculator",
]


def main():
    url = "http://localhost:8080/sitemap.xml"
    response = requests.get(url, timeout=30)
    response.raise_for_status()
    xml = response.text

    missing = []
    for path in CALCULATOR_PATHS:
        # Match each <url> block by its <loc>, then require a <lastmod> inside the same block.
        pattern = re.compile(
            rf"<url>\s*<loc>https://[^<]+{re.escape(path)}</loc>(.*?)</url>",
            re.DOTALL,
        )
        match = pattern.search(xml)
        if not match:
            missing.append(f"{path}: URL block not found")
            continue
        block = match.group(1)
        if not re.search(r"<lastmod>\d{4}-\d{2}-\d{2}</lastmod>", block):
            missing.append(f"{path}: missing or malformed <lastmod>")

    if missing:
        raise AssertionError("Sitemap lastmod assertions failed:\n" + "\n".join(missing))

    print("All calculator URLs include a valid lastmod value in sitemap.xml")


if __name__ == "__main__":
    main()
