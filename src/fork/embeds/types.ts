/** Fork-only: shared types for the embed players (see ./README in src/fork/README.md). */

/** "sub" = subtitled (VOSTFR in fr mode), "dub" = dubbed (VF in fr mode). */
export type EmbedCategory = "sub" | "dub";

export interface EmbedPlayer {
  /** Stable key, e.g. "voir-anime:sub:voe". */
  id: string;
  /** Site the link comes from, e.g. "Voir-Anime". */
  source: string;
  /** Video host / player name, e.g. "Voe". */
  server: string;
  category: EmbedCategory;
  /** iframe URL. */
  url: string;
}

/** What the scrapers know about the AniList entry being watched. */
export interface AnimeMeta {
  id: number;
  /** Romaji, English, Latin-script synonyms (in that order, de-duplicated). */
  titles: string[];
  year: number | null;
  /** Season number read from the title ("2nd Season", "Season 2"), 1 otherwise. */
  season: number;
  /** True when the title states the season (sites often number arcs differently). */
  seasonExplicit: boolean;
  format: string | null;
  episodes: number | null;
}

export interface EmbedProvider {
  id: string;
  name: string;
  /** Players for one episode; throws or returns [] when the site has nothing. */
  players(meta: AnimeMeta, episode: number): Promise<EmbedPlayer[]>;
}
