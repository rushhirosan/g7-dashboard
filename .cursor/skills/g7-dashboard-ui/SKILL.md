---
name: g7-dashboard-ui
description: Guides World Front Page React components, Tailwind styling, ja/en bilingual patterns, and next-themes dark mode for the single-page news dashboard. Use when editing components, layout, styling, i18n copy, or when the user mentions UI, theme, or frontend behavior.
---

# g7-dashboard — UI and Components

Stack: **Next.js App Router**, **React 19**, **Tailwind CSS**, **next-themes** (no component library).

## Layout

| Area | Path |
|------|------|
| Page shell | `app/page.tsx`, `app/layout.tsx` |
| Styles | `app/globals.css`, `tailwind.config.ts` |
| Components | `components/*.tsx` |
| Brand assets | `app/icon.tsx`, `app/apple-icon.tsx`, `lib/brand-mark.tsx` |

## Bilingual pattern

- Type: `Lang = "ja" | "en"` in `lib/types.ts`
- Copy: `{ ja: "...", en: "..." }` objects on data and in `lib/site-info.ts`
- Language state lives in `Dashboard` (client); passed as `lang` prop
- Initial lang: default `ja`; `navigator.language` starting with `en` → `en`
- **No URL locale segments** — do not add `/en` routes unless explicitly requested

## Theme

- `ThemeProvider` wraps app in `app/layout.tsx`
- Header exposes light/dark toggle
- Use CSS variables / Tailwind dark variants already in `globals.css`
- Test both themes when changing colors or contrast

## Key components

| Component | Notes |
|-----------|-------|
| `Dashboard` | Client root; skeleton until `ready`, then country grid |
| `CountryCard` | Flag, source name, 5 headlines with external links, relative time |
| `Header` | Fixed title in English; localized subtitle |
| `Footer` | Sister-site link to Trend Dashboard, info modals |
| `SkeletonCard` | Loading placeholder matching card layout |

## Principles

- **One-screen scan**: 9 cards, minimal chrome
- Preserve existing grid breakpoints and spacing tokens
- External links: `target="_blank"` + `rel="noopener noreferrer"`
- Use `aria-live="polite"` on the country section (already in `Dashboard`)
- Avoid new UI frameworks or heavy animation libraries

## When changing UI

1. Find the component and check `globals.css` for shared classes first
2. Keep headline count at 5 (driven by fetch, not hardcoded in multiple places)
3. If copy changes affect legal/about content, update `lib/site-info.ts`
4. Run `npm run build` — static generation may call KV; network errors during build are OK locally

## SEO / metadata

- `app/layout.tsx`: `metadataBase`, Open Graph, GA4 via `@next/third-parties`
- `app/sitemap.ts`, `app/robots.ts`: use `getSiteUrl()` from `lib/site-url.ts`
