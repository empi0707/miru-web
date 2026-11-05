/**
 * Fork-only configuration (empi0707/miru-web).
 * Keep fork customisations in src/fork/ so upstream syncs stay conflict-free.
 *
 * NEXT_PUBLIC_* vars are inlined at build time: restart `npm run dev` /
 * rebuild after changing them.
 */

/** Brand name shown across the UI, metadata and PWA manifest. */
export const BRAND = process.env.NEXT_PUBLIC_BRAND || "Miru";

/** Login / sign up. Disabled by default; set NEXT_PUBLIC_ENABLE_AUTH=true to re-enable. */
export const AUTH_ENABLED = process.env.NEXT_PUBLIC_ENABLE_AUTH === "true";

/** Comments (per-episode + recent comments on home). Disabled by default. */
export const COMMENTS_ENABLED = process.env.NEXT_PUBLIC_ENABLE_COMMENTS === "true";
