"""
World Front Page — News Cron Job
Fetches RSS feeds for G7 + major economies (China, India), translates via DeepL,
and stores structured JSON in Vercel KV (Upstash Redis REST API).

Schedule: 4x/day — 01:00 / 07:00 / 13:00 / 19:00 JST
"""

import json
import logging
import os
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

if not os.environ.get("KV_REST_API_URL") and os.environ.get("UPSTASH_REDIS_REST_URL"):
    os.environ["KV_REST_API_URL"] = os.environ["UPSTASH_REDIS_REST_URL"]
if not os.environ.get("KV_REST_API_TOKEN") and os.environ.get("UPSTASH_REDIS_REST_TOKEN"):
    os.environ["KV_REST_API_TOKEN"] = os.environ["UPSTASH_REDIS_REST_TOKEN"]

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
    {
        "code": "cn",
        "flag": "🇨🇳",
        "name": {"ja": "中国", "en": "China"},
        "source": {
            "name": "SCMP",
            "url": "https://www.scmp.com",
            "originalLang": {"ja": "英語", "en": "English"},
        },
        "rss": "https://www.scmp.com/rss/91/feed/",
        "lang": "EN",
    },
    {
        "code": "in",
        "flag": "🇮🇳",
        "name": {"ja": "インド", "en": "India"},
        "source": {
            "name": "The Hindu",
            "url": "https://www.thehindu.com",
            "originalLang": {"ja": "英語", "en": "English"},
        },
        "rss": "https://www.thehindu.com/feeder/default.rss",
        "lang": "EN",
    },
]

RSS_FETCH_TIMEOUT = 60

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
    "cn": [
        {
            "rss": "https://www.scmp.com/rss/4/feed/",
            "source": {
                "name": "SCMP",
                "url": "https://www.scmp.com/news/china",
                "originalLang": {"ja": "英語", "en": "English"},
            },
        },
        {
            "rss": "https://feeds.bbci.co.uk/news/world/asia/china/rss.xml",
            "source": {
                "name": "BBC",
                "url": "https://www.bbc.com/news/world/asia/china",
                "originalLang": {"ja": "英語", "en": "English"},
            },
        },
    ],
}

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
        timeout=RSS_FETCH_TIMEOUT,
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
    """Try primary RSS, then fallbacks. Returns (entries, effective_source)."""
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


def process_country(src: dict) -> dict | None:
    log.info("Processing %s (%s)...", src["code"], src["source"]["name"])
    entries, source = fetch_rss_for_country(src)
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
        "source": source,
        "headlines": headlines,
    }


def set_kv(key: str, value: dict) -> None:
    # Upstash REST: POST body is the Redis value (JSON string of payload).
    body = json.dumps(value, ensure_ascii=False)
    resp = requests.post(
        f"{KV_REST_API_URL}/set/{key}",
        headers={
            "Authorization": f"Bearer {KV_REST_API_TOKEN}",
            "Content-Type": "application/json; charset=utf-8",
        },
        data=body.encode("utf-8"),
        timeout=30,
    )
    resp.raise_for_status()
    log.info("KV set %s → %s", key, resp.status_code)


def main() -> None:
    for key in ("DEEPL_API_KEY", "KV_REST_API_URL", "KV_REST_API_TOKEN"):
        if not os.environ.get(key):
            log.error("Missing required env var: %s", key)
            raise SystemExit(1)

    log.info("=== World Front Page cron started ===")
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
        raise SystemExit(1)

    payload = {
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "countries": countries,
    }
    set_kv("news:latest", payload)
    log.info("=== Done: %d/%d countries written ===", len(countries), len(SOURCES))


if __name__ == "__main__":
    main()
