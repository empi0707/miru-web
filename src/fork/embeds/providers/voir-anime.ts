/**
 * Fork-only: Voir-Anime (WordPress Madara, VOIR_ANIME_URL, default voir-anime.to).
 *
 * 1. Search: GET /?s=<q>&post_type=wp-manga → cards with title, "Alternative"
 *    names (AniList-like: "Sousou no Frieren 2nd Season") and "Année".
 *    VOSTFR and VF are separate entries: /anime/<slug>/ and /anime/<slug>-vf/ ("(VF)" in the title).
 * 2. Entry page lists episodes: <li class="wp-manga-chapter"><a href=…>Sousou no Frieren - 28 VOSTFR - 28</a>.
 * 3. Episode page: `var thisChapterSources = {"LECTEUR VOE":"<iframe src=…>", …};`
 */
import type { AnimeMeta, EmbedCategory, EmbedPlayer, EmbedProvider } from "../types";
import { cached, decodeHtml, fetchText, HOUR, isHttpUrl, siteBase, stripTags } from "../http";
import { normalizeTitle, sameTitle, searchQueries, titleVariants, yearScore } from "../matching";

/** Undefined when VOIR_ANIME_URL is not set → provider is disabled. */
const BASE = process.env.VOIR_ANIME_URL?.trim()
  ? siteBase(process.env.VOIR_ANIME_URL, "")
  : undefined;

interface Card {
  url: string;
  name: string;
  alternatives: string[];
  year: number | null;
  dub: boolean;
}

export function parseCards(html: string): Card[] {
  const cards: Card[] = [];
  for (const chunk of html.split('<div class="row c-tabs-item__content">').slice(1)) {
    const title = chunk.match(/<div class="post-title">\s*<h3[^>]*>\s*<a href="([^"]+)">([\s\S]*?)<\/a>/);
    if (!title) continue;
    const alt = chunk.match(/mg_alternative[\s\S]*?<div class="summary-content">([\s\S]*?)<\/div>/);
    const year = chunk.match(/release-year">\s*<a[^>]*>(\d{4})</);
    const rawName = stripTags(title[2]);
    cards.push({
      url: title[1],
      name: rawName.replace(/\s*\(VF\)\s*$/i, ""),
      alternatives: alt ? stripTags(alt[1]).split(/\s*,\s*/).filter(Boolean) : [],
      year: year ? Number(year[1]) : null,
      dub: /\(VF\)\s*$/i.test(rawName) || /-vf\/?$/.test(title[1]),
    });
  }
  return cards;
}

const search = (query: string) =>
  cached(`va:search:${query.toLowerCase()}`, 6 * HOUR, async () =>
    parseCards(await fetchText(`${BASE}/?s=${encodeURIComponent(query)}&post_type=wp-manga`)),
  );

/** Episode number → episode page URL. */
const episodeList = (url: string) =>
  cached(`va:list:${url}`, 2 * HOUR, async () => {
    const html = await fetchText(url);
    const list: Record<number, string> = {};
    for (const m of html.matchAll(/<li class="wp-manga-chapter[^"]*">\s*<a href="([^"]+)">([\s\S]*?)<\/a>/g)) {
      const text = stripTags(m[2]);
      const num = text.match(/-\s*(\d+)\s*$/) || m[1].match(/-(\d+)-(?:vostfr|vf)\/?$/i);
      if (num && !(Number(num[1]) in list)) list[Number(num[1])] = m[1];
    }
    return list;
  });

const episodeSources = (url: string) =>
  cached(`va:ep:${url}`, 6 * HOUR, async () => {
    const html = await fetchText(url);
    const json = html.match(/var thisChapterSources\s*=\s*(\{[\s\S]*?\});\s*(?:\n|var |<\/script>)/);
    if (!json) return {} as Record<string, string>;
    const sources = JSON.parse(json[1]) as Record<string, string>;
    const out: Record<string, string> = {};
    for (const [name, iframe] of Object.entries(sources)) {
      const src = String(iframe).match(/src=["']([^"']+)["']/);
      const url = src ? decodeHtml(src[1]).trim() : "";
      if (isHttpUrl(url)) out[name.replace(/^LECTEUR\s+/i, "").trim() || name] = url;
    }
    return out;
  });

/** Best entry for this AniList title, VOSTFR or VF. */
function pick(cards: Card[], meta: AnimeMeta, dub: boolean): Card | null {
  const variants = titleVariants(meta);
  const exact = meta.titles.map(normalizeTitle);
  const scored = cards
    .filter((card) => card.dub === dub)
    .map((card) => {
      const names = [card.name, ...card.alternatives];
      // Exact AniList title (with its season marker) beats a base-title match, which only counts for season 1.
      const strong = names.some((n) => exact.includes(normalizeTitle(n)));
      const weak = meta.season === 1 && names.some((n) => sameTitle(n, variants));
      const years = yearScore(meta.year, card.year);
      if ((!strong && !weak) || years < 0) return null;
      return { card, score: (strong ? 4 : 0) + years };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.card || null;
}

export const voirAnime: EmbedProvider = {
  id: "voir-anime",
  name: "Voir-Anime",
  async players(meta, episode) {
    if (!BASE) return [];
    const cards: Card[] = [];
    for (const query of searchQueries(meta)) {
      cards.push(...(await search(query)));
      if (pick(cards, meta, false) || pick(cards, meta, true)) break;
    }
    const entries: [Card | null, EmbedCategory][] = [
      [pick(cards, meta, false), "sub"],
      [pick(cards, meta, true), "dub"],
    ];
    const groups = await Promise.all(
      entries.map(async ([card, category]) => {
        if (!card) return [];
        const pageUrl = (await episodeList(card.url))[episode];
        if (!pageUrl) return [];
        return Object.entries(await episodeSources(pageUrl)).map(
          ([server, url]): EmbedPlayer => ({
            id: `voir-anime:${category}:${normalizeTitle(server).replace(/ /g, "-")}`,
            source: "Voir-Anime",
            server: server.charAt(0).toUpperCase() + server.slice(1).toLowerCase(),
            category,
            url,
          }),
        );
      }),
    );
    return groups.flat();
  },
};
