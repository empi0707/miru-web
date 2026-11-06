/** Fork-only: AniList entry lookup and title matching against the French sites. */
import type { AnimeMeta } from "./types";
import { cached, HOUR } from "./http";

export const normalizeTitle = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const SEASON_PATTERNS = [
  /\b(\d{1,2})(?:st|nd|rd|th)\s+season\b/i,
  /\bseason\s+(\d{1,2})\b/i,
  /\bsaison\s+(\d{1,2})\b/i,
];

export function seasonFromTitle(title: string): number | null {
  for (const re of SEASON_PATTERNS) {
    const m = title.match(re);
    if (m) return Number(m[1]);
  }
  return null;
}

/** Title without its season / part marker: "Sousou no Frieren 2nd Season" → "Sousou no Frieren". */
export const stripSeason = (title: string) =>
  title
    .replace(/\b\d{1,2}(?:st|nd|rd|th)\s+(season|cour)\b/gi, "")
    .replace(/\b(season|saison|part|cour)\s+\d{1,2}\b/gi, "")
    .replace(/[\s:–-]+$/g, "")
    .trim();

/**
 * Normalised names to compare with a site's titles: every title, without its
 * season marker, and the part before a ":" subtitle ("Frieren: Beyond…" → "frieren").
 */
export function titleVariants(meta: AnimeMeta): string[] {
  const out = new Set<string>();
  for (const title of meta.titles) {
    for (const v of [title, stripSeason(title), title.split(/\s*[:：]\s*/)[0]]) {
      const n = normalizeTitle(v);
      if (n.length >= 3) out.add(n);
    }
  }
  return [...out];
}

/** Exact match on a normalised name. */
export const sameTitle = (name: string, variants: string[]) => variants.includes(normalizeTitle(name));

/** `name` equals a variant or contains it as whole words (variant of 5+ chars). */
export function looseTitle(name: string, variants: string[]) {
  const n = ` ${normalizeTitle(name)} `;
  return variants.some((v) => n.trim() === v || (v.length >= 5 && n.includes(` ${v} `)));
}

/** Search queries: English then romaji without season marker, then their part before ":" ("Demon Slayer"). */
export function searchQueries(meta: AnimeMeta, max = 4): string[] {
  const main = meta.titles.slice(0, 2);
  const ordered = [...main.map(stripSeason), ...main.map((t) => t.split(/\s*[:：]\s*/)[0])];
  return [...new Set(ordered.map((q) => q.trim()).filter((q) => q.length >= 2))].slice(0, max);
}

/* ---------- AniList ---------- */

const QUERY = `query ($id: Int) { Media(id: $id, type: ANIME) {
  id format episodes seasonYear startDate { year }
  title { romaji english } synonyms
} }`;

const isLatin = (s: string) => /^[\p{Script=Latin}\p{N}\p{P}\p{Zs}\p{S}]+$/u.test(s);

export function getAnimeMeta(anilistId: number): Promise<AnimeMeta> {
  return cached(`anilist:${anilistId}`, 12 * HOUR, async () => {
    const res = await fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: QUERY, variables: { id: anilistId } }),
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
    const media = (await res.json())?.data?.Media;
    if (!media) throw new Error(`AniList ${anilistId} not found`);
    const titles = [media.title?.english, media.title?.romaji, ...(media.synonyms || []).filter(isLatin)]
      .filter((t): t is string => typeof t === "string" && t.trim().length > 0)
      .map((t) => t.trim());
    const unique = [...new Set(titles)];
    const season = unique.slice(0, 2).map(seasonFromTitle).find((s) => s != null);
    return {
      id: media.id,
      titles: unique,
      year: media.seasonYear || media.startDate?.year || null,
      season: season ?? 1,
      seasonExplicit: season != null,
      format: media.format || null,
      episodes: media.episodes || null,
    };
  });
}

/** Word overlap (0..1) between a site title and the closest AniList title. */
export function titleSimilarity(name: string, meta: AnimeMeta): number {
  const words = (s: string) => new Set(normalizeTitle(s).split(" ").filter((w) => w.length > 1 && !/^\d{4}$/.test(w)));
  const a = words(name);
  let best = 0;
  for (const title of meta.titles) {
    const b = words(title);
    const common = [...a].filter((w) => b.has(w)).length;
    const union = new Set([...a, ...b]).size;
    if (union) best = Math.max(best, common / union);
  }
  return best;
}

/** Score for a candidate year: 2 exact, 1 within a year, 0 unknown, -1 mismatch. */
export function yearScore(want: number | null, ...got: (number | null | undefined)[]) {
  const known = got.filter((y): y is number => typeof y === "number" && y > 0);
  if (!want || known.length === 0) return 0;
  if (known.includes(want)) return 2;
  return known.some((y) => Math.abs(y - want) <= 1) ? 1 : -1;
}
