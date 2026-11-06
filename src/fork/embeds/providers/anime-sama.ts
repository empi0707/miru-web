/**
 * Fork-only: Anime-Sama (ANIME_SAMA_URL, default anime-sama.to).
 *
 * Ported from MovixOpenSource routes/animeSama.js. Anime-Sama sits behind
 * Cloudflare and refuses many server IPs (403): the provider then simply
 * returns no players. Check from the deploy server before relying on it.
 *
 * 1. Search: POST /template-php/defaut/fetch.php `query=…` → <a class="asn-search-result" href=".../catalogue/<slug>/">
 *    with <h3> title and <p class="asn-search-result-subtitle"> alternative names.
 * 2. Catalogue page: panneauAnime("Saison 2", "saison2/vostfr"); per season.
 * 3. <catalogue>/<season>/<vostfr|vf>/episodes.js: `var eps1 = ['url', …];` one array per player, index = episode - 1.
 */
import type { AnimeMeta, EmbedCategory, EmbedPlayer, EmbedProvider } from "../types";
import { cached, fetchText, HOUR, HttpError, hostLabel, isHttpUrl, siteBase, stripTags } from "../http";
import { sameTitle, searchQueries, titleVariants } from "../matching";

/** Undefined when ANIME_SAMA_URL is not set → provider is disabled. */
const BASE = process.env.ANIME_SAMA_URL?.trim()
  ? siteBase(process.env.ANIME_SAMA_URL, "")
  : undefined;

interface Card {
  url: string;
  names: string[];
}

/** Embed templates anime-sama emits for an announced but empty player. */
const EMPTY_PLAYER = [
  /sibnet\.[a-z0-9-]+\/shell\.php\?videoid=$/i,
  /vidmoly\.[a-z0-9-]+\/embed-\.html$/i,
  /sendvid\.[a-z0-9-]+\/embed\/$/i,
  /vk\.[a-z0-9-]+\/video_ext\.php\?oid=&hd=3$/i,
];

export function parseCards(html: string): Card[] {
  const cards: Card[] = [];
  for (const m of html.matchAll(/<a\b([^>]*\bclass="asn-search-result"[^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = m[1].match(/href="([^"]+)"/i)?.[1];
    if (!href || !/\/catalogue\/[a-z0-9][\w.-]+/i.test(href)) continue;
    const title = m[2].match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i);
    const subtitle = m[2].match(/<p\b[^>]*class="asn-search-result-subtitle"[^>]*>([\s\S]*?)<\/p>/i);
    if (!title) continue;
    cards.push({
      url: new URL(href, `${BASE}/`).toString().replace(/\/?$/, "/"),
      names: [stripTags(title[1]), ...(subtitle ? stripTags(subtitle[1]).split(",") : [])]
        .map((n) => n.trim())
        .filter(Boolean),
    });
  }
  return cards;
}

const search = (query: string) =>
  cached(`as:search:${query.toLowerCase()}`, 6 * HOUR, async () =>
    parseCards(await fetchText(`${BASE}/template-php/defaut/fetch.php`, { form: { query }, proxy: true })),
  );

/** Season label → relative path, e.g. "Saison 2" → "saison2". */
const seasons = (catalogueUrl: string) =>
  cached(`as:seasons:${catalogueUrl}`, 6 * HOUR, async () => {
    const html = await fetchText(catalogueUrl, { proxy: true, headers: { Referer: "https://anime-sama.to/" } });
    const out: { name: string; path: string }[] = [];
    for (const m of html.matchAll(/panneauAnime\("(.+?)",\s*"(.+?)(?:vostfr|vf)"\);?/g)) {
      if (m[1] === "nom") continue; // template call in the page's own script
      out.push({ name: m[1], path: m[2].replace(/^\/+|\/+$/g, "") });
    }
    return out;
  });

/** One array of episode URLs per player. */
const playerLists = (seasonUrl: string) =>
  cached(`as:eps:${seasonUrl}`, 2 * HOUR, async () => {
    let js: string;
    try {
      js = await fetchText(`${seasonUrl}episodes.js`, {
        proxy: true,
        headers: { Referer: seasonUrl, Accept: "*/*", "sec-fetch-dest": "script", "sec-fetch-mode": "no-cors", "sec-fetch-site": "same-origin" },
      });
    } catch (error) {
      if (error instanceof HttpError && error.status === 404) return [];
      throw error;
    }
    if (/<html|<!doctype/i.test(js)) return [];
    return js
      .split("[")
      .slice(1)
      .map((block) => [...block.split("]")[0].matchAll(/'([^']+)'/g)].map((m) => m[1].trim()));
  });

function pickSeason(list: { name: string; path: string }[], meta: AnimeMeta) {
  if (meta.format === "MOVIE") return list.find((s) => /film/i.test(s.name)) || null;
  const byN = (n: number) =>
    list.find((s) => new RegExp(`^Saison\\s+${n}$`, "i").test(s.name.trim())) ||
    list.find((s) => new RegExp(`^Saison\\s+${n}\\b`, "i").test(s.name.trim()));
  // Exact AniList season match first; then S-1 (site may start at 1 when earlier seasons aren't hosted).
  return byN(meta.season) || (meta.season > 1 ? byN(meta.season - 1) : null) || null;
}

export const animeSama: EmbedProvider = {
  id: "anime-sama",
  name: "Anime-Sama",
  async players(meta, episode) {
    if (!BASE) return [];
    const variants = titleVariants(meta);
    let card: Card | undefined;
    for (const query of searchQueries(meta)) {
      card = (await search(query)).find((c) => c.names.some((n) => sameTitle(n, variants)));
      if (card) break;
    }
    if (!card) return [];
    const season = pickSeason(await seasons(card.url), meta);
    if (!season) return [];
    const langs: [string, EmbedCategory][] = [["vostfr", "sub"], ["vf", "dub"]];
    const groups = await Promise.all(
      langs.map(async ([lang, category]) => {
        const lists = await playerLists(`${card!.url}${season.path}/${lang}/`).catch(() => []);
        return lists
          .map((urls) => urls[episode - 1])
          .filter((url): url is string => isHttpUrl(url) && !EMPTY_PLAYER.some((re) => re.test(url)))
          .map(
            (url, index): EmbedPlayer => ({
              id: `anime-sama:${category}:${index}`,
              source: "Anime-Sama",
              server: hostLabel(url),
              category,
              url,
            }),
          );
      }),
    );
    return groups.flat();
  },
};
