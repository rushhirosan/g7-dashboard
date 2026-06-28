"""
One-off local snapshot for dev UI/UX.
Fetches RSS feeds and writes data/news-snapshot.json (no KV required).
Prefers DeepL (DEEPL_API_KEY in .env.local); falls back to MyMemory for dev.
"""

import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import feedparser
import requests

ROOT = Path(__file__).resolve().parent.parent


def load_dotenv_local() -> None:
    env_path = ROOT / ".env.local"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key, value = key.strip(), value.strip().strip("'\"")
        if key and key not in os.environ:
            os.environ[key] = value


load_dotenv_local()

sys.path.insert(0, str(Path(__file__).parent))
from main import SOURCES, translate  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

DEEPL_API_KEY = os.environ.get("DEEPL_API_KEY")
OUTPUT = ROOT / "data" / "news-snapshot.json"

# Used when primary RSS fails (e.g. AP DNS, CBC timeout)
RSS_FALLBACKS: dict[str, list[dict]] = {
    "us": [
        {
            "rss": "https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml",
            "source": {
                "name": "BBC",
                "url": "https://www.bbc.com/news/world/us_and_canada",
                "originalLang": {"ja": "英語", "en": "English"},
            },
        },
        {
            "rss": "https://feeds.npr.org/1001/rss.xml",
            "source": {
                "name": "NPR",
                "url": "https://www.npr.org",
                "originalLang": {"ja": "英語", "en": "English"},
            },
        },
    ],
    "ca": [
        {
            "rss": "https://www.theglobeandmail.com/arc/outboundfeeds/rss/category/canada/",
            "source": {
                "name": "The Globe and Mail",
                "url": "https://www.theglobeandmail.com/canada/",
                "originalLang": {"ja": "英語", "en": "English"},
            },
        },
    ],
}

LANG_TO_DEEPL = {"JA": "JA", "EN": "EN", "FR": "FR", "IT": "IT", "DE": "DE"}
LANG_TO_MYMEMORY = {"JA": "ja", "EN": "en", "FR": "fr", "IT": "it", "DE": "de"}


def fetch_rss(url: str, limit: int = 5) -> list[dict]:
    resp = requests.get(
        url,
        headers={"User-Agent": "g7-dashboard/0.1 (+https://github.com/g7-dashboard)"},
        timeout=60,
    )
    resp.raise_for_status()
    feed = feedparser.parse(resp.content)
    entries = []
    for entry in feed.entries[:limit]:
        parsed = entry.get("published_parsed") or entry.get("updated_parsed")
        if parsed:
            dt = datetime(*parsed[:6], tzinfo=timezone.utc)
        else:
            dt = datetime.now(timezone.utc)
        entries.append({
            "title": entry.get("title", "").strip(),
            "url": entry.get("link", ""),
            "publishedAt": dt.isoformat(),
        })
    return entries


def fetch_rss_for_country(src: dict) -> tuple[list[dict], dict]:
    """Try primary RSS, then local fallbacks. Returns (entries, effective_source)."""
    candidates = [{"rss": src["rss"], "source": src["source"]}]
    candidates.extend(RSS_FALLBACKS.get(src["code"], []))

    for candidate in candidates:
        try:
            entries = fetch_rss(candidate["rss"])
            if entries:
                if candidate["rss"] != src["rss"]:
                    log.warning(
                        "Using fallback RSS for %s: %s",
                        src["code"],
                        candidate["rss"],
                    )
                return entries, candidate["source"]
        except Exception as exc:
            log.warning("RSS failed %s (%s): %s", src["code"], candidate["rss"], exc)

    return [], src["source"]


def translate_mymemory(texts: list[str], source_lang: str, target_lang: str) -> list[str]:
    src = LANG_TO_MYMEMORY.get(source_lang, "en")
    tgt = "ja" if target_lang == "JA" else "en" if target_lang.startswith("EN") else LANG_TO_MYMEMORY.get(target_lang, "en")

    results: list[str] = []
    for text in texts:
        resp = requests.get(
            "https://api.mymemory.translated.net/get",
            params={"q": text, "langpair": f"{src}|{tgt}"},
            timeout=20,
        )
        resp.raise_for_status()
        translated = resp.json().get("responseData", {}).get("translatedText", text)
        results.append(translated)
        time.sleep(0.25)
    return results


def titles_for_lang(titles: list[str], source_lang: str) -> tuple[list[str], list[str]]:
    if source_lang == "JA":
        ja_titles = titles
        if DEEPL_API_KEY:
            en_titles = translate(titles, "EN-US")
        else:
            log.info("Translating JA→EN via MyMemory (dev fallback)")
            en_titles = translate_mymemory(titles, "JA", "EN-US")
        return ja_titles, en_titles

    if source_lang in ("EN", "EN-US", "EN-GB"):
        en_titles = titles
        if DEEPL_API_KEY:
            ja_titles = translate(titles, "JA")
        else:
            log.info("Translating EN→JA via MyMemory (dev fallback)")
            ja_titles = translate_mymemory(titles, "EN", "JA")
        return ja_titles, en_titles

    # FR / IT / DE
    if DEEPL_API_KEY:
        ja_titles = translate(titles, "JA")
        time.sleep(0.5)
        en_titles = translate(titles, "EN-US")
    else:
        log.info("Translating %s→JA/EN via MyMemory (dev fallback)", source_lang)
        ja_titles = translate_mymemory(titles, source_lang, "JA")
        time.sleep(0.5)
        en_titles = translate_mymemory(titles, source_lang, "EN-US")
    return ja_titles, en_titles


def process_country(src: dict) -> dict | None:
    log.info("Processing %s (%s)...", src["code"], src["source"]["name"])
    entries, source = fetch_rss_for_country(src)
    if not entries:
        log.warning("No entries for %s", src["code"])
        return None

    titles = [e["title"] for e in entries]
    ja_titles, en_titles = titles_for_lang(titles, src["lang"])

    headlines = []
    for i, entry in enumerate(entries):
        headlines.append({
            "title": {
                "original": entry["title"],
                "ja": ja_titles[i] if i < len(ja_titles) else entry["title"],
                "en": en_titles[i] if i < len(en_titles) else entry["title"],
            },
            "publishedAt": entry["publishedAt"],
            "url": entry["url"],
        })

    return {
        "code": src["code"],
        "flag": src["flag"],
        "name": src["name"],
        "source": source,
        "headlines": headlines,
    }


def main() -> None:
    log.info("=== Local snapshot fetch started ===")
    if DEEPL_API_KEY:
        log.info("Using DeepL for translations")
    else:
        log.warning(
            "DEEPL_API_KEY not set — using MyMemory for dev translations. "
            "Add DEEPL_API_KEY to .env.local for production-quality results."
        )

    countries = []
    for src in SOURCES:
        try:
            result = process_country(src)
            if result:
                countries.append(result)
        except Exception as exc:
            log.error("Failed %s: %s", src["code"], exc)
        time.sleep(0.3)

    if len(countries) < len(SOURCES):
        missing = {s["code"] for s in SOURCES} - {c["code"] for c in countries}
        log.error("Missing countries: %s", ", ".join(sorted(missing)))

    if not countries:
        log.error("Nothing fetched — aborting")
        sys.exit(1)

    payload = {
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "countries": countries,
    }

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    log.info("=== Wrote %d/%d countries → %s ===", len(countries), len(SOURCES), OUTPUT)

    if len(countries) < len(SOURCES):
        sys.exit(1)


if __name__ == "__main__":
    main()
