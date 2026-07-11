---
name: g7-news-pipeline
description: Guides g7-dashboard RSS fetching, DeepL translation, Vercel KV storage, QStash scheduling, Python backup cron, and Discord alert policy. Use when adding or changing news sources, cron jobs, fetch logic, fallbacks, or when the user mentions RSS, QStash, KV, DeepL, or Discord notifications.
---

# g7-dashboard — News Fetch Pipeline

Prefer **official RSS feeds** over scraping. Treat every feed as **unreliable** (redirects, timeouts, empty items).

## Production path (Vercel)

```
QStash (JST 01/07/13/19)
  → POST /api/cron/fetch (signature verify)
  → lib/fetch-news.ts
  → KV key news:latest
  → revalidatePath("/")
  → notifyDiscordPartialFetch / notifyDiscordFailure
```

| Path | Role |
|------|------|
| `app/api/cron/fetch/route.ts` | QStash entry, maxDuration 300 |
| `lib/fetch-news.ts` | Parallel per-country fetch, DeepL, KV write |
| `lib/news-sources.ts` | `NEWS_SOURCES`, `RSS_FALLBACKS`, timeouts |
| `lib/notify-discord.ts` | Alert on **partial** or **failure** only — not full success |
| `lib/kv.ts` | KV helpers |

## Backup / dev paths

| Path | Role |
|------|------|
| `cron/main.py` | GitHub Actions `workflow_dispatch` backup |
| `cron/fetch_local.py` | `npm run fetch:snapshot` → local JSON |
| `scripts/setup-qstash.mjs` | Register QStash schedule |

## Adding or changing a source

1. Add entry to `NEWS_SOURCES` in `lib/news-sources.ts` (code, flag, RSS, DeepL lang).
2. Add matching entry in `cron/main.py` `SOURCES` — keep both in sync.
3. If the primary RSS is flaky, add `RSS_FALLBACKS[code]` with alternate feed + source metadata.
4. Test locally: `npm run fetch:snapshot` or trigger QStash manually.
5. Update `docs/SPEC.md` country table if user-facing source info changes.

## Fetch behavior

- Timeout: `RSS_FETCH_TIMEOUT_MS` (60s); User-Agent set for rss-parser
- Top **5** headlines per country
- Countries fetched in parallel; missing countries reduce `countriesWritten` but don't fail the whole job unless nothing is written
- DeepL: titles only; requires `DEEPL_API_KEY` in Vercel Production

## Discord notification policy

| Outcome | Notify? |
|---------|---------|
| All countries written | No |
| Partial (e.g. 7/9) | Yes ⚠️ |
| Complete failure (exception) | Yes ❌ |

GitHub Actions backup mirrors this in `.github/workflows/fetch-news.yml` (`notify-partial`, `notify-failure`).

## QStash setup

Cron expression: `CRON_TZ=Asia/Tokyo 0 1,7,13,19 * * *`

```bash
SITE_URL=https://g7-dashboard.vercel.app npm run setup:qstash
```

Requires `QSTASH_TOKEN` in `.env.local`. Signing keys must be on Vercel for `/api/cron/fetch`.

## Checklist for feed fixes

- [ ] Root cause identified (redirect? HTTP vs HTTPS? feed URL change?)
- [ ] Fallback added if primary is structurally unreliable
- [ ] Both TS and Python source lists updated
- [ ] Discord policy unchanged unless user asks (alerts only, not success spam)
- [ ] `docs/SCHEDULER.md` updated if ops behavior changed
