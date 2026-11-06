# Fork customisations

Code specific to the empi0707/miru-web fork lives here. Upstream files are
touched only with minimal hooks into this folder (an import + a one-line
change), so syncing with `upstream` (LuckDay21/miru-web) causes as few
conflicts as possible. When a sync conflicts, re-apply the touch points below.

## Environment variables

Add to `.env` (`NEXT_PUBLIC_*` are inlined at build time — restart dev / rebuild after changing):

```env
# Brand (empty = Miru defaults)
NEXT_PUBLIC_BRAND=Miru                # name in UI, <title>, metadata, PWA manifest
NEXT_PUBLIC_BRAND_TAGLINE=            # default title "<BRAND> - <TAGLINE>" ("Stream Anime with No Ads")
NEXT_PUBLIC_BRAND_DESCRIPTION=        # meta / OG / PWA description
NEXT_PUBLIC_BRAND_LOGO=               # navbar, footer, favicon, PWA icon — path under /public (/miru-logo.svg)
NEXT_PUBLIC_BRAND_APPLE_ICON=         # apple-touch-icon PNG under /public (/icon-192x192.png)
NEXT_PUBLIC_BRAND_PRIMARY="#22d3ee"   # primary accent hex — QUOTE IT (# starts a comment in .env)
NEXT_PUBLIC_BRAND_SECONDARY=          # gradient partner hex; empty = derived from primary

# Language
NEXT_PUBLIC_LANGUAGE=fr               # UI language: en (default) | fr

# Features
NEXT_PUBLIC_ENABLE_AUTH=false         # login / sign up
NEXT_PUBLIC_ENABLE_COMMENTS=false     # episode comments + recent comments on home

# Embed players
NEXT_PUBLIC_EMBED_SOURCES=en          # en = Megaplay / VidLink / Autoembed | fr = French sites (VOSTFR / VF)
NEXT_PUBLIC_ENABLE_PRIMARY_PLAYER=    # HLS API player first; default true for en, false for fr
# fr only — read by the server at runtime (no rebuild):
EMBED_PROVIDERS=french-manga,voir-anime,anime-sama   # subset / order; empty = all
FRENCH_MANGA_URL=https://w16.french-manga.net        # domains move often: update here
VOIR_ANIME_URL=https://voir-anime.to
ANIME_SAMA_URL=https://anime-sama.to
```

Put brand assets in `public/brand/` (fork-only folder) rather than replacing
upstream files in `public/`.

### How the colour works

Components hard-code Tailwind `cyan-*` (primary accent) and `blue-*` (gradient
partner). `tailwind.config.ts` remaps those two palettes to CSS variables
(`brand-colors.ts`), and `<BrandStyle />` generates an 11-shade scale from the
hex in `NEXT_PUBLIC_BRAND_PRIMARY` (the hex itself is shade 500). The shadcn
`--primary` / `--ring` tokens follow it too. Every variable falls back to
Tailwind's original value, so with no colour set the site is identical to
upstream. New upstream components using `cyan-*`/`blue-*` are themed automatically.

## Features & upstream touch points

| Feature | Fork files | Upstream touch points |
| --- | --- | --- |
| Brand colour | `brand-colors.ts`, `brand-style.tsx` | `tailwind.config.ts` (import + `...brandTailwindColors()`), `src/app/layout.tsx` (`<BrandStyle />` in `<head>`) |
| Brand from env (name, tagline, description, logo, icons) | `config.ts`, `src/app/manifest.ts` | `src/app/layout.tsx` (metadata, icons, manifest path → `/manifest.webmanifest`), `src/components/navbar.tsx`, `src/components/footer.tsx` (text + logo), `src/components/hero-section.tsx`, `src/app/anime/watch/video-player-section.tsx`, `src/app/profile/[username]/components/activity-progression.tsx` |
| Disable login / sign up | `config.ts` (`AUTH_ENABLED`), `with-feature.tsx` | `src/components/login-popover-button.tsx` (export line), `src/components/comments/comments-section.tsx` (login prompt) |
| Disable comments | `config.ts` (`COMMENTS_ENABLED`), `with-feature.tsx` | `src/components/comments/comments-section.tsx`, `src/components/recent-comments-section.tsx` (export lines) |
| UI translation (`NEXT_PUBLIC_LANGUAGE`) | `i18n/index.ts` (`t`, `tMeta`, `LOCALE`), `i18n/fr.ts`, `player-options.ts` (ArtPlayer lang + brand colour) | One-line `t("…")` wraps in displayed strings across components; `import { t } from "@/fork/i18n"` per file; `<html lang>` in `src/app/layout.tsx`; `new Artplayer(withForkPlayerOptions(...))` in `src/components/miru-player.tsx` |
| Embed players EN / FR (`NEXT_PUBLIC_EMBED_SOURCES`) | `embeds/` (scrapers, `fork-embed-player.tsx`, `en.ts`), `src/app/api/fork-embeds/route.ts` | `src/app/anime/watch/video-player-section.tsx` (fallback block → `<ForkEmbedPlayer />`, `PRIMARY_PLAYER_ENABLED` in `useGetEpisodeData` + `isFallbackActive`) |
| Genre-based Also Watch / Recommended (AniList) | `similar-anime.ts` | `src/app/anime/watch/layout.tsx` (hook + 2 carousel props), `src/app/anime/[slug]/page.tsx` ("You Might Also Like") |

`public/manifest.json` is kept untouched; `src/app/manifest.ts` reads it and overrides the brand fields.

## Translations

`t("English text")` looks the string up in `src/fork/i18n/<lang>.ts`; missing
keys fall back to English, so untranslated upstream strings still render.
Wrap at the *display* point (e.g. `Select`, `AnimeCarousel`, `AnimeSections`
translate their `title` / `label` props) so constant lists and callers need no
changes. `tMeta()` also translates composed AniList values word by word
(`SPRING 2024` → `Printemps 2024`). To add a language: create `i18n/<code>.ts`,
register it in `DICTIONARIES` / `LOCALES` in `i18n/index.ts`, and (optionally)
the ArtPlayer pack in `player-options.ts`.

Not translated: AniList content (titles, synopses — AniList only provides
English/Japanese) and the auth / comments / profile UI (disabled in this fork).

## French embed players (`NEXT_PUBLIC_EMBED_SOURCES=fr`)

`GET /api/fork-embeds?anilist=<id>&ep=<n>` → `{ players: [{ id, source, server, category: "sub"|"dub", url }], errors }`
(`sub` = VOSTFR, `dub` = VF). Results are cached in memory (2 h per episode, 6 h per search).
The AniList entry (English / romaji / Latin synonyms, year, season from "2nd Season" / "Season 2", episode count) is matched per site:

| Site | How | Matching |
| --- | --- | --- |
| French Manga (`embeds/providers/french-manga.ts`) | POST `/engine/ajax/search.php`, then JSON `/engine/ajax/manga_episodes_api.php?id=` | title + year (card or URL), season only when AniList states it, word overlap, episode count; long series via the absolute range in the title ("(1089-1155)") |
| Voir-Anime (`voir-anime.ts`) | `/?s=…&post_type=wp-manga`, entry page episode list, `thisChapterSources` on the episode page | exact AniList title in name / "Alternative" + year; VOSTFR and VF are separate entries (`-vf`) |
| Anime-Sama (`anime-sama.ts`) | `fetch.php` search, `panneauAnime(...)` seasons, `episodes.js` | port of MovixOpenSource; **Cloudflare answers 403 to many server IPs** — the site then just contributes nothing (see `errors` in the API response) |

A site that fails or blocks never breaks the others. Movies (`MOVIE`) are only matched on Anime-Sama ("Film" panel).
