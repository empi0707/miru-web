/**
 * Fork-only: "Also Watch" / "Recommended" lists built dynamically from AniList,
 * based on the genres of the anime being viewed.
 *
 * - alsoWatch:   same-franchise ANIME relations first (no manga/novels), then
 *                the most popular titles sharing the most genres.
 * - recommended: AniList community recommendations, topped up with the
 *                best-scored titles sharing the most genres.
 */
import { useQuery } from "react-query";
import { fetchAniListGraphQL } from "@/lib/anilist";
import { IAnime } from "@/types/anime";

const LIST_SIZE = 20;
/** Genres used for matching (AniList returns them most-relevant first). */
const MAX_GENRES = 4;

type AniMedia = {
  id: number;
  type?: string;
  format?: string | null;
  episodes?: number | null;
  genres?: string[];
  isAdult?: boolean;
  title?: { english?: string | null; romaji?: string | null; native?: string | null };
  coverImage?: { large?: string | null; extraLarge?: string | null };
};

const CARD_FIELDS = `
  id type format episodes genres isAdult
  title { english romaji native }
  coverImage { large extraLarge }
`;

const BASE_QUERY = `
  query ($id: Int) {
    Media(id: $id, type: ANIME) {
      id
      genres
      relations { edges { node { ${CARD_FIELDS} } } }
      recommendations(perPage: 25, sort: RATING_DESC) {
        nodes { mediaRecommendation { ${CARD_FIELDS} } }
      }
    }
  }
`;

const GENRE_QUERY = `
  query ($genres: [String], $exclude: [Int]) {
    popular: Page(perPage: 50) {
      media(type: ANIME, genre_in: $genres, id_not_in: $exclude, isAdult: false, sort: POPULARITY_DESC) { ${CARD_FIELDS} }
    }
    topRated: Page(perPage: 50) {
      media(type: ANIME, genre_in: $genres, id_not_in: $exclude, isAdult: false, sort: SCORE_DESC, popularity_greater: 5000) { ${CARD_FIELDS} }
    }
  }
`;

const toCard = (m: AniMedia): IAnime => ({
  id: String(m.id),
  name: m.title?.english || m.title?.romaji || m.title?.native || "Untitled",
  jname: m.title?.native || m.title?.romaji || "",
  poster: m.coverImage?.extraLarge || m.coverImage?.large || "",
  type: (m.format || "TV") as IAnime["type"],
  episodes: { sub: m.episodes || 0, dub: m.episodes || 0 },
});

const isWatchable = (m?: AniMedia | null): m is AniMedia =>
  !!m && !!m.id && m.type === "ANIME" && !m.isAdult;

/** Stable sort by number of shared genres (keeps AniList's order inside ties). */
const byGenreOverlap = (list: AniMedia[], genres: string[]) =>
  list
    .map((m, idx) => ({
      m,
      idx,
      score: (m.genres || []).filter((g) => genres.includes(g)).length,
    }))
    .sort((a, b) => b.score - a.score || a.idx - b.idx)
    .map((x) => x.m);

export async function getSimilarAnime(animeId: string) {
  const id = parseInt(animeId, 10);
  const base = await fetchAniListGraphQL<{ Media: any }>(BASE_QUERY, { id });
  const media = base.Media;
  const genres: string[] = (media?.genres || []).slice(0, MAX_GENRES);

  const relations: AniMedia[] = (media?.relations?.edges || [])
    .map((e: any) => e?.node)
    .filter(isWatchable);
  const communityRecs: AniMedia[] = (media?.recommendations?.nodes || [])
    .map((n: any) => n?.mediaRecommendation)
    .filter(isWatchable);

  let popular: AniMedia[] = [];
  let topRated: AniMedia[] = [];
  if (genres.length) {
    const exclude = [id, ...relations.map((m) => m.id)];
    const res = await fetchAniListGraphQL<any>(GENRE_QUERY, { genres, exclude });
    popular = byGenreOverlap(res.popular?.media || [], genres);
    topRated = byGenreOverlap(res.topRated?.media || [], genres);
  }

  // Franchise relations are reserved for "Also Watch"; both lists never overlap.
  const used = new Set<number>([id, ...relations.map((m) => m.id)]);
  const take = (sources: AniMedia[][], limit: number) => {
    const out: AniMedia[] = [];
    for (const m of sources.flat()) {
      if (out.length >= limit) break;
      if (!isWatchable(m) || used.has(m.id)) continue;
      used.add(m.id);
      out.push(m);
    }
    return out;
  };

  // Recommended first so community picks aren't swallowed by the genre fill.
  const recommended = take([communityRecs, topRated], LIST_SIZE).map(toCard);
  const franchise = relations.slice(0, LIST_SIZE);
  const alsoWatch = [...franchise, ...take([popular], LIST_SIZE - franchise.length)].map(toCard);

  return { genres, alsoWatch, recommended };
}

export const useSimilarAnime = (animeId?: string | null) =>
  useQuery(["fork-similar-anime", animeId], () => getSimilarAnime(animeId!), {
    enabled: !!animeId,
    staleTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
  });
