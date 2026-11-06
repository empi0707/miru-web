/**
 * Fork-only: French Manga (DLE engine, FRENCH_MANGA_URL, default w16.french-manga.net).
 *
 * 1. Search: POST /engine/ajax/search.php `query=…&page=1` → cards
 *    `location.href='/1498695-frieren-saison-2-2026.html'` + "Frieren - Saison 2 (2026)".
 *    One page per season; long series show their absolute range: "One Piece - Saison 22 : Egghead (1089-1155) (2024)".
 * 2. Episodes: GET /engine/ajax/manga_episodes_api.php?id=<newsid>
 *    → { vf: { "1": { vidzy: url, luluvid: url } }, vostfr: {…}, alt_titles: { jp, us, … } } (episodes numbered from 1).
 */
import type { AnimeMeta, EmbedCategory, EmbedPlayer, EmbedProvider } from "../types";
import { cached, decodeHtml, fetchText, HOUR, isHttpUrl, siteBase, stripTags } from "../http";
import { looseTitle, searchQueries, stripSeason, titleSimilarity, titleVariants, yearScore } from "../matching";

/** Undefined when FRENCH_MANGA_URL is not set → provider is disabled. */
const BASE = process.env.FRENCH_MANGA_URL?.trim()
  ? siteBase(process.env.FRENCH_MANGA_URL, "")
  : undefined;

interface Card {
  id: string;
  title: string;
  name: string;
  season: number | null;
  year: number | null;
  slugYear: number | null;
  range: [number, number] | null;
}

type EpisodeMap = Record<string, Record<string, string>>;
interface EpisodesPayload {
  vf?: EpisodeMap;
  vostfr?: EpisodeMap;
  alt_titles?: Record<string, string>;
}

export function parseCards(html: string): Card[] {
  const cards: Card[] = [];
  for (const chunk of html.split(/<div class=['"]search-item['"]/).slice(1)) {
    const href = chunk.match(/location\.href='\/?((\d+)-[^']+?\.html)'/);
    const titleHtml = chunk.match(/class=['"]search-title['"]>([\s\S]*?)<\/div>/);
    if (!href || !titleHtml) continue;
    const title = stripTags(titleHtml[1]);
    const years = [...title.matchAll(/\((\d{4})\)/g)].map((m) => Number(m[1]));
    const range = title.match(/\((\d+)\s*-\s*(\d+)\)/);
    const season = title.match(/\bSaison\s+(\d+)/i);
    const slugYear = href[1].match(/-(\d{4})\.html$/);
    cards.push({
      id: href[2],
      title,
      name: title.split(/\s+-\s+Saison\b/i)[0].replace(/\s*\(\d{4}\)\s*$/, "").trim(),
      season: season ? Number(season[1]) : null,
      year: years.length ? years[years.length - 1] : null,
      slugYear: slugYear ? Number(slugYear[1]) : null,
      range: range ? [Number(range[1]), Number(range[2])] : null,
    });
  }
  return cards;
}

const search = (query: string) =>
  cached(`fm:search:${query.toLowerCase()}`, 6 * HOUR, async () =>
    parseCards(
      await fetchText(`${BASE}/engine/ajax/search.php`, {
        form: { query: query.slice(0, 60), page: "1" },
        headers: { "X-Requested-With": "XMLHttpRequest", Referer: `${BASE}/` },
      }),
    ),
  );

const episodes = (id: string) =>
  cached(`fm:eps:${id}`, 2 * HOUR, async () => {
    const text = await fetchText(`${BASE}/engine/ajax/manga_episodes_api.php?id=${id}`, {
      headers: { "X-Requested-With": "XMLHttpRequest", Referer: `${BASE}/` },
    });
    return JSON.parse(text) as EpisodesPayload;
  });

/** Candidate cards, best first, with the episode number to read on that page. */
function rank(cards: Card[], meta: AnimeMeta, episode: number) {
  const variants = titleVariants(meta);
  return cards
    .map((card) => {
      if (!looseTitle(card.name, variants) && !looseTitle(stripSeason(card.title), variants)) return null;
      // Long series: one AniList entry, pages per range of absolute episodes.
      if (card.range) {
        const [from, to] = card.range;
        if (episode < from || episode > to) return null;
        return { card, episode: episode - from + 1, score: 10 };
      }
      const years = yearScore(meta.year, card.year, card.slugYear);
      if (years < 0) return null;
      // Arcs are often numbered differently from AniList: the season only counts when AniList states it.
      const seasonOk = meta.seasonExplicit && (card.season ?? 1) === meta.season;
      const similar = Math.round(titleSimilarity(card.title.replace(/\bSaison\s+\d+\b/i, ""), meta) * 4);
      return { card, episode, score: years * 2 + (seasonOk ? 3 : 0) + similar };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.score - a.score);
}

function toPlayers(payload: EpisodesPayload, episode: number): EmbedPlayer[] {
  const players: EmbedPlayer[] = [];
  const langs: [keyof EpisodesPayload, EmbedCategory][] = [["vostfr", "sub"], ["vf", "dub"]];
  for (const [lang, category] of langs) {
    const hosts = (payload[lang] as EpisodeMap | undefined)?.[String(episode)] || {};
    for (const [host, url] of Object.entries(hosts)) {
      const clean = decodeHtml(String(url || "")).trim();
      if (!isHttpUrl(clean)) continue;
      players.push({
        id: `french-manga:${category}:${host}`,
        source: "French Manga",
        server: host.charAt(0).toUpperCase() + host.slice(1),
        category,
        url: clean,
      });
    }
  }
  return players;
}

export const frenchManga: EmbedProvider = {
  id: "french-manga",
  name: "French Manga",
  async players(meta, episode) {
    if (!BASE) return [];
    const seen = new Set<string>();
    const cards: Card[] = [];
    for (const query of searchQueries(meta)) {
      for (const card of await search(query)) {
        if (!seen.has(card.id)) cards.push(card);
        seen.add(card.id);
      }
      if (rank(cards, meta, episode).length) break;
    }
    // Several pages can share the title and year (seasons, arcs): the episode
    // count closest to AniList's breaks the tie; a page without this episode is skipped.
    const ranked = await Promise.all(
      rank(cards, meta, episode)
        .slice(0, 4)
        .map(async (candidate) => {
          const payload = await episodes(candidate.card.id).catch(() => ({}) as EpisodesPayload);
          const count = Math.max(0, ...[payload.vf, payload.vostfr].map((m) => Object.keys(m || {}).length));
          const fit = candidate.card.range || !meta.episodes || !count ? 0 : Math.abs(count - meta.episodes) <= 1 ? 2 : 0;
          return { players: toPlayers(payload, candidate.episode), score: candidate.score + fit };
        }),
    );
    return ranked.filter((r) => r.players.length).sort((a, b) => b.score - a.score)[0]?.players || [];
  },
};
