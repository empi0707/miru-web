# Fork customisations

Code specific to the empi0707/miru-web fork lives here. Upstream files are
touched only with minimal hooks into this folder (an import + a one-line
change), so syncing with `upstream` (LuckDay21/miru-web) causes as few
conflicts as possible. When a sync conflicts, re-apply the touch points below.

## Environment variables

Add to `.env` (`NEXT_PUBLIC_*` are inlined at build time — restart dev / rebuild after changing):

```env
NEXT_PUBLIC_BRAND=Miru              # brand name in UI, <title>, metadata, PWA manifest
NEXT_PUBLIC_ENABLE_AUTH=false       # login / sign up
NEXT_PUBLIC_ENABLE_COMMENTS=false   # episode comments + recent comments on home
```

## Features & upstream touch points

| Feature | Fork files | Upstream touch points |
| --- | --- | --- |
| Brand from env | `config.ts` (`BRAND`), `src/app/manifest.ts` | `src/app/layout.tsx` (metadata, manifest path → `/manifest.webmanifest`), `src/components/navbar.tsx`, `src/components/footer.tsx`, `src/components/hero-section.tsx`, `src/app/anime/watch/video-player-section.tsx`, `src/app/profile/[username]/components/activity-progression.tsx` |
| Disable login / sign up | `config.ts` (`AUTH_ENABLED`), `with-feature.tsx` | `src/components/login-popover-button.tsx` (export line), `src/components/comments/comments-section.tsx` (login prompt) |
| Disable comments | `config.ts` (`COMMENTS_ENABLED`), `with-feature.tsx` | `src/components/comments/comments-section.tsx`, `src/components/recent-comments-section.tsx` (export lines) |
| Genre-based Also Watch / Recommended (AniList) | `similar-anime.ts` | `src/app/anime/watch/layout.tsx` (hook + 2 carousel props), `src/app/anime/[slug]/page.tsx` ("You Might Also Like") |

`public/manifest.json` is kept untouched; `src/app/manifest.ts` reads it and overrides the brand fields.
