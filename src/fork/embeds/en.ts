/** Fork-only: English embed players (upstream's fallback servers), built from the AniList id. */
import type { EmbedCategory, EmbedPlayer } from "./types";

export function englishPlayers(anilistId: string, episode: number): EmbedPlayer[] {
  const players: EmbedPlayer[] = [];
  for (const category of ["sub", "dub"] as EmbedCategory[]) {
    players.push(
      {
        id: `megaplay:${category}`,
        source: "Megaplay",
        server: "Megaplay",
        category,
        url: `https://megaplay.buzz/stream/ani/${anilistId}/${episode}/${category}`,
      },
      {
        id: `vidlink:${category}`,
        source: "VidLink",
        server: "VidLink",
        category,
        url: `https://vidlink.pro/anime/${anilistId}/${episode}?sub=${category === "sub" ? 1 : 0}`,
      },
      {
        // Autoembed has no sub/dub switch: same URL in both categories.
        id: `autoembed:${category}`,
        source: "Autoembed",
        server: "Autoembed",
        category,
        url: `https://player.autoembed.cc/embed/anime/${anilistId}/${episode}`,
      },
    );
  }
  return players;
}
