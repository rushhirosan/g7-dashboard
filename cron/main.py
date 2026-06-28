"""
G7 News Cron Job
Fetches RSS feeds for each G7 country, translates titles via DeepL,
and stores structured JSON in Vercel KV (Upstash Redis REST API).

Schedule: 4x/day — 01:00 / 07:00 / 13:00 / 19:00 JST
"""

import json
import logging
import os
import time
from datetime import datetime, timezone

import feedparser
import requests

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

DEEPL_API_KEY = os.environ.get("DEEPL_API_KEY")
KV_REST_API_URL = os.environ.get("KV_REST_API_URL")
KV_REST_API_TOKEN = os.environ.get("KV_REST_API_TOKEN")

SOURCES = [
    {
        "code": "jp",
        "flag": "🇯🇵",
        "name": {"ja": "日本", "en": "Japan"},
        "source": {
            "name": "NHK",
            "url": "https://www3.nhk.or.jp",
            "originalLang": {"ja": "日本語", "en": "Japanese"},
        },
        "rss": "https://www3.nhk.or.jp/rss/news/cat0.xml",
        "lang": "JA",
    },
    {
        "code": "us",
        "flag": "🇺🇸",
        "name": {"ja": "アメリカ", "en": "United States"},
        "source": {
            "name": "AP News",
            "url": "https://apnews.com",
            "originalLang": {"ja": "英語", "en": "English"},
        },
        "rss": "https://feeds.apnews.com/rss/apf-topnews",
        "lang": "EN",
    },
    {
        "code": "gb",
        "flag": "🇬🇧",
        "name": {"ja": "イギリス", "en": "United Kingdom"},
        "source": {
            "name": "BBC",
            "url": "https://www.bbc.com",
            "originalLang": {"ja": "英語", "en": "English"},
        },
        "rss": "http://feeds.bbci.co.uk/news/rss.xml",
        "lang": "EN",
    },
    {
        "code": "de",
        "flag": "🇩🇪",
        "name": {"ja": "ドイツ", "en": "Germany"},
        "source": {
            "name": "Deutsche Welle",
            "url": "https://www.dw.com",
            "originalLang": {"ja": "英語", "en": "English"},
        },
        "rss": "https://rss.dw.com/rdf/rss-en-top",
        "lang": "EN",
    },
    {
        "code": "fr",
        "flag": "🇫🇷",
        "name": {"ja": "フランス", "en": "France"},
        "source": {
            "name": "Le Monde",
            "url": "https://www.lemonde.fr",
            "originalLang": {"ja": "フランス語", "en": "French"},
        },
        "rss": "https://www.lemonde.fr/rss/une.xml",
        "lang": "FR",
    },
    {
        "code": "it",
        "flag": "🇮🇹",
        "name": {"ja": "イタリア", "en": "Italy"},
        "source": {
            "name": "ANSA",
            "url": "https://www.ansa.it",
            "originalLang": {"ja": "イタリア語", "en": "Italian"},
        },
        "rss": "https://www.ansa.it/sito/notizie/topnews/topnews_rss.xml",
        "lang": "IT",
    },
    {
        "code": "ca",
        "flag": "🇨🇦",
        "name": {"ja": "カナダ", "en": "Canada"},
        "source": {
            "name": "CBC",
            "url": "https://www.cbc.ca",
            "originalLang": {"ja": "英語", "en": "English"},
        },
        "rss": "https://www.cbc.ca/webfeed/rss/rss-topstories",
        "lang": "EN",
    },
]

DEEPL_FREE_URL = "https://api-free.deepl.com/v2/translate"


def translate(texts: list[str], target_lang: str) -> list[str]:
    resp = requests.post(
        DEEPL_FREE_URL,
        headers={"Authorization": f"DeepL-Auth-Key {DEEPL_API_KEY}"},
        json={"text": texts, "target_lang": target_lang},
        timeout=30,
    )
    resp.raise_for_status()
    return [t["text"] for t in resp.json()["translations"]]


def fetch_rss(url: str, limit: int = 5) -> list[dict]:
    resp = requests.get(
        url,
        headers={"User-Agent": "g7-dashboard/0.1 (+https://github.com/g7-dashboard)"},
        timeout=30,
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


def process_country(src: dict) -> dict | None:
    log.info("Processing %s (%s)...", src["code"], src["source"]["name"])
    entries = fetch_rss(src["rss"])
    if not entries:
        log.warning("No entries for %s", src["code"])
        return None

    titles = [e["title"] for e in entries]
    lang = src["lang"]

    if lang == "JA":
        ja_titles = titles
        en_titles = translate(titles, "EN-US")
    elif lang in ("EN", "EN-US", "EN-GB"):
        ja_titles = translate(titles, "JA")
        en_titles = titles
    else:
        # FR / IT / DE → translate to both
        ja_titles = translate(titles, "JA")
        time.sleep(0.5)
        en_titles = translate(titles, "EN-US")

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
        "source": src["source"],
        "headlines": headlines,
    }


def set_kv(key: str, value: dict) -> None:
    resp = requests.post(
        f"{KV_REST_API_URL}/set/{key}",
        headers={
            "Authorization": f"Bearer {KV_REST_API_TOKEN}",
            "Content-Type": "application/json",
        },
        # Vercel KV REST API expects the value as a JSON string
        data=json.dumps({"value": json.dumps(value)}),
        timeout=30,
    )
    resp.raise_for_status()
    log.info("KV set %s → %s", key, resp.status_code)


def main() -> None:
    for key in ("DEEPL_API_KEY", "KV_REST_API_URL", "KV_REST_API_TOKEN"):
        if not os.environ.get(key):
            log.error("Missing required env var: %s", key)
            raise SystemExit(1)

    log.info("=== G7 news cron started ===")
    countries = []

    for src in SOURCES:
        try:
            result = process_country(src)
            if result:
                countries.append(result)
        except Exception as exc:
            log.error("Failed %s: %s", src["code"], exc)
        time.sleep(0.3)  # be polite to RSS servers

    if not countries:
        log.error("Nothing processed — aborting KV write")
        return

    payload = {
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "countries": countries,
    }
    set_kv("news:latest", payload)
    log.info("=== Done: %d/%d countries written ===", len(countries), len(SOURCES))


if __name__ == "__main__":
    main()
