/**
 * Fork-only configuration (empi0707/miru-web).
 * Keep fork customisations in src/fork/ so upstream syncs stay conflict-free.
 *
 * NEXT_PUBLIC_* vars are inlined at build time: restart `npm run dev` /
 * rebuild after changing them.
 */

import { t } from "./i18n";

const env = (value: string | undefined, fallback: string) =>
  value && value.trim() ? value.trim() : fallback;

/* ---------- Brand ---------- */

/** Brand name shown across the UI, metadata and PWA manifest. */
export const BRAND = env(process.env.NEXT_PUBLIC_BRAND, "Miru");

/** Short slogan used in the default <title> and PWA name: "<BRAND> - <TAGLINE>". */
export const BRAND_TAGLINE = env(process.env.NEXT_PUBLIC_BRAND_TAGLINE, t("Stream Anime with No Ads"));

/** Meta / Open Graph / PWA description. */
export const BRAND_DESCRIPTION = env(
  process.env.NEXT_PUBLIC_BRAND_DESCRIPTION,
  t("Watch your favorite anime anywhere, anytime with ease and no ads on {brand}.", { brand: BRAND }),
);

/** Logo (navbar, footer, favicon, PWA icon). A path under /public, e.g. /brand/logo.svg. */
export const BRAND_LOGO = env(process.env.NEXT_PUBLIC_BRAND_LOGO, "/miru-logo.svg");

/** Apple touch icon (PNG, ideally 180–192px). A path under /public. */
export const BRAND_APPLE_ICON = env(process.env.NEXT_PUBLIC_BRAND_APPLE_ICON, "/icon-192x192.png");

/** Primary accent colour (hex, e.g. #22d3ee). Empty = original theme. */
export const BRAND_PRIMARY = env(process.env.NEXT_PUBLIC_BRAND_PRIMARY, "");

/** Secondary accent used in gradients (hex). Empty = derived from primary. */
export const BRAND_SECONDARY = env(process.env.NEXT_PUBLIC_BRAND_SECONDARY, "");

/* ---------- Feature flags ---------- */

/** Login / sign up. Disabled by default; set NEXT_PUBLIC_ENABLE_AUTH=true to re-enable. */
export const AUTH_ENABLED = process.env.NEXT_PUBLIC_ENABLE_AUTH === "true";

/** Comments (per-episode + recent comments on home). Disabled by default. */
export const COMMENTS_ENABLED = process.env.NEXT_PUBLIC_ENABLE_COMMENTS === "true";

/** Show brand text next to the logo in navbar/footer. Empty / unset = hidden. */
export const LOGO_TEXT_ENABLED = process.env.NEXT_PUBLIC_ENABLE_LOGO_TEXT === "true";

/* ---------- Embed sources ---------- */

/**
 * Embed player set: "en" = Megaplay / VidLink / Autoembed (by AniList id),
 * "fr" = French sites scraped server-side (/api/fork-embeds), VF / VOSTFR.
 */
export const EMBED_SOURCES: "en" | "fr" =
  env(process.env.NEXT_PUBLIC_EMBED_SOURCES, "en").toLowerCase() === "fr" ? "fr" : "en";

/**
 * Primary (HLS API) player before the embeds. Defaults to on for "en" and off
 * for "fr" (its streams are English sub/dub only).
 */
export const PRIMARY_PLAYER_ENABLED =
  env(process.env.NEXT_PUBLIC_ENABLE_PRIMARY_PLAYER, EMBED_SOURCES === "en" ? "true" : "false") === "true";
