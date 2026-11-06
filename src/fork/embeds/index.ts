/**
 * Fork-only: server-side resolution of the French embed players.
 * Used by src/app/api/fork-embeds/route.ts. EMBED_PROVIDERS=french-manga,voir-anime,anime-sama
 * limits / orders the sites (default: all, in that order).
 */
import type { EmbedPlayer, EmbedProvider } from "./types";
import { getAnimeMeta } from "./matching";
import { cached, HOUR } from "./http";
import { frenchManga } from "./providers/french-manga";
import { voirAnime } from "./providers/voir-anime";
import { animeSama } from "./providers/anime-sama";

const ALL: EmbedProvider[] = [voirAnime, frenchManga, animeSama];

export function enabledProviders(env = process.env.EMBED_PROVIDERS): EmbedProvider[] {
  const wanted = String(env || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!wanted.length) return ALL;
  return wanted.map((id) => ALL.find((p) => p.id === id)).filter((p): p is EmbedProvider => Boolean(p));
}

export interface ResolveResult {
  players: EmbedPlayer[];
  /** Per-site error messages (a site down or blocking does not fail the others). */
  errors: Record<string, string>;
}

export function resolveFrenchEmbeds(anilistId: number, episode: number): Promise<ResolveResult> {
  const providers = enabledProviders();
  const key = `fr:${providers.map((p) => p.id).join(",")}:${anilistId}:${episode}`;
  return cached(key, 2 * HOUR, async () => {
    const meta = await getAnimeMeta(anilistId);
    const errors: Record<string, string> = {};
    const groups = await Promise.all(
      providers.map((provider) =>
        provider.players(meta, episode).catch((error: Error) => {
          errors[provider.id] = error.message;
          console.warn(`[fork-embeds] ${provider.id} ${anilistId} ep ${episode}: ${error.message}`);
          return [] as EmbedPlayer[];
        }),
      ),
    );
    const seen = new Set<string>();
    const players = groups.flat().filter((p) => !seen.has(p.url) && Boolean(seen.add(p.url)));
    return { players, errors };
  });
}
