---
name: g7-dashboard-repo
description: Maps the g7-dashboard (World Front Page) repository layout, Next.js entry points, API routes, config, and Vercel deployment touchpoints. Use when navigating the codebase, adding routes or app wiring, or when the user mentions Vercel, QStash, project structure, or repo layout.
---

# g7-dashboard — Repository Map

Product philosophy and conventions live in `.cursor/rules/g7-dashboard.mdc`. This skill is **where things are** and **how the app boots**.

## Entry points

| Path | Role |
|------|------|
| `app/page.tsx` | Home page; reads KV via `getNewsData()`, renders `Dashboard` |
| `app/layout.tsx` | Root layout, metadata, GA4, theme provider |
| `next.config.ts` | Next.js config |

## API routes

| Path | Role |
|------|------|
| `app/api/cron/fetch/route.ts` | QStash cron: verify signature → `fetchAndStoreNews()` → revalidate → Discord alert |
| `app/api/revalidate/route.ts` | Legacy manual ISR revalidate (`REVALIDATE_SECRET`) |

## Core library

| Path | Role |
|------|------|
| `lib/fetch-news.ts` | Production fetch: RSS → DeepL → KV write |
| `lib/news-sources.ts` | 9-country source config, fallbacks, timeouts |
| `lib/kv.ts` | KV read/write helpers |
| `lib/types.ts` | `NewsData`, `CountryNews`, `Lang`, etc. |
| `lib/notify-discord.ts` | Discord webhook on failure / partial fetch |
| `lib/site-url.ts`, `lib/site-info.ts` | Public URL, footer/about copy |
| `lib/mock-data.ts` | Dev fallback when KV unavailable |

## UI components

| Path | Role |
|------|------|
| `components/Dashboard.tsx` | Main client shell: lang state, country grid |
| `components/Header.tsx` | Title, lang toggle, theme toggle, last updated |
| `components/CountryCard.tsx` | Per-country headline list |
| `components/Footer.tsx` | About / privacy / sister-site links |
| `components/InfoModal.tsx` | About and privacy modals |

## Backup cron (Python)

| Path | Role |
|------|------|
| `cron/main.py` | GitHub Actions manual backup fetch → KV |
| `cron/fetch_local.py` | Local snapshot: `npm run fetch:snapshot` → `data/news-snapshot.json` |

## Scripts and CI

| Path | Role |
|------|------|
| `scripts/setup-qstash.mjs` | One-time QStash schedule registration (`npm run setup:qstash`) |
| `scripts/release.sh` | Preflight: tsc, build, secret scan; optional `--ship` |
| `.github/workflows/fetch-news.yml` | Manual backup cron + Discord partial/failure notify |

## Documentation

| Path | Role |
|------|------|
| `docs/SPEC.md` | Full product spec (UI, data model, i18n) |
| `docs/SCHEDULER.md` | QStash setup, env vars, Discord policy, data flow |
| `docs/README.md` | Quick start |

## Environment variables

See `.env.example`. Key vars: `KV_*`, `DEEPL_API_KEY`, `QSTASH_*`, `DISCORD_WEBHOOK_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_GA_MEASUREMENT_ID`.

## When adding a feature

1. UI-only → `components/` + `app/globals.css`
2. Data/fetch → `lib/` (+ sync `cron/` if RSS sources change)
3. New API → `app/api/` with clear auth (QStash signature or secret)
4. Scheduler/ops → update `docs/SCHEDULER.md` and notify logic if behavior changes
