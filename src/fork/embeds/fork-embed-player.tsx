"use client";

/**
 * Fork-only: embed player (iframe + category / server pickers) replacing
 * upstream's fallback player. NEXT_PUBLIC_EMBED_SOURCES picks the set:
 * "en" = Megaplay / VidLink / Autoembed, "fr" = /api/fork-embeds (VOSTFR / VF).
 */
import React, { useEffect, useMemo, useState } from "react";
import { useQuery } from "react-query";
import { AlertCircle, Captions, Mic, Server, Tv } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { t } from "@/fork/i18n";
import { BRAND, EMBED_SOURCES, EN_EMBEDS_ENABLED } from "@/fork/config";
import { englishPlayers } from "./en";
import type { EmbedCategory, EmbedPlayer } from "./types";

const SERVER_KEY = "forkEmbedServer";

const CATEGORY_LABEL: Record<"en" | "fr", Record<EmbedCategory, string>> = {
  en: { sub: "SUB", dub: "DUB" },
  fr: { sub: "VOSTFR", dub: "VF" },
};

const readStored = () => {
  try {
    return localStorage.getItem(SERVER_KEY) || "";
  } catch {
    return "";
  }
};

async function fetchFrenchPlayers(anilistId: string, episode: number): Promise<EmbedPlayer[]> {
  const res = await fetch(`/api/fork-embeds?anilist=${encodeURIComponent(anilistId)}&ep=${episode}`);
  const data = await res.json().catch(() => null);
  return Array.isArray(data?.players) ? data.players : [];
}

interface Props {
  anilistId: string;
  episode: number;
  category: EmbedCategory;
  onCategoryChange: (category: EmbedCategory) => void;
  /** Upstream's sub / dub availability (en mode only). */
  enCategories: Record<EmbedCategory, boolean>;
  /** Shown as "Try Primary Player" when set. */
  onTryPrimary?: () => void;
}

export default function ForkEmbedPlayer({ anilistId, episode, category, onCategoryChange, enCategories, onTryPrimary }: Props) {
  const isFr = EMBED_SOURCES === "fr";
  const { data: frPlayers, isLoading } = useQuery(
    ["fork-embeds", anilistId, episode],
    () => fetchFrenchPlayers(anilistId, episode),
    { enabled: isFr && Boolean(anilistId), staleTime: 1000 * 60 * 30, refetchOnWindowFocus: false, retry: 1 },
  );

  const players = useMemo(
    () => isFr
      ? [...(frPlayers || []), ...(EN_EMBEDS_ENABLED ? englishPlayers(anilistId, episode) : [])]
      : englishPlayers(anilistId, episode),
    [isFr, frPlayers, anilistId, episode],
  );

  const available: Record<EmbedCategory, boolean> = isFr
    ? { sub: players.some((p) => p.category === "sub"), dub: players.some((p) => p.category === "dub") }
    : enCategories;
  // fr: show the other language when the preferred one has no player for this episode.
  const other: EmbedCategory = category === "sub" ? "dub" : "sub";
  const activeCategory: EmbedCategory = isFr && !available[category] && available[other] ? other : category;
  const list = useMemo(() => players.filter((p) => p.category === activeCategory), [players, activeCategory]);

  const [selectedId, setSelectedId] = useState<string>("");
  useEffect(() => {
    if (list.some((p) => p.id === selectedId)) return;
    // Keep the same site + server across episodes when it exists.
    const stored = readStored();
    const next = list.find((p) => `${p.source}:${p.server}` === stored) || list[0];
    setSelectedId(next?.id || "");
  }, [list, selectedId]);

  const selected = list.find((p) => p.id === selectedId) || list[0];

  const choose = (player: EmbedPlayer) => {
    setSelectedId(player.id);
    try {
      localStorage.setItem(SERVER_KEY, `${player.source}:${player.server}`);
    } catch {
      /* storage unavailable */
    }
  };

  // fr: one row per site; en: a single row of servers.
  const rows = isFr ? [...new Set(list.map((p) => p.source))] : [""];
  const labels = CATEGORY_LABEL[EMBED_SOURCES];
  const tabClass = (active: boolean, activeClass: string) =>
    `h-8 px-4 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition ${
      active ? activeClass : "bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-white"
    }`;

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="relative w-full h-auto aspect-video min-h-[20vh] sm:min-h-[30vh] md:min-h-[40vh] lg:min-h-[60vh] max-h-[500px] lg:max-h-[calc(100vh-150px)] bg-black overflow-hidden rounded-xl border border-slate-800">
        {selected ? (
          <iframe
            key={selected.url}
            src={selected.url}
            width="100%"
            height="100%"
            allowFullScreen
            allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
            referrerPolicy="no-referrer-when-downgrade"
            className="w-full h-full border-0"
          ></iframe>
        ) : (
          <div className={`flex h-full w-full items-center justify-center text-sm text-slate-400 ${isLoading ? "animate-pulse bg-slate-800" : ""}`}>
            {isLoading ? t("Searching for players…") : t("No player found for this episode.")}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3 p-4 bg-slate-900/80 backdrop-blur-md rounded-2xl border border-white/10 shadow-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-bold text-slate-400 tracking-wider">{t("CATEGORY:")}</span>
            <Button
              size="sm"
              variant="ghost"
              disabled={!available.sub}
              onClick={() => onCategoryChange("sub")}
              className={tabClass(activeCategory === "sub", "bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold shadow-md shadow-cyan-500/25")}
            >
              <Captions className="h-3.5 w-3.5" /> {labels.sub}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={!available.dub}
              onClick={() => onCategoryChange("dub")}
              className={tabClass(activeCategory === "dub", "bg-emerald-600 text-white font-bold shadow-md shadow-emerald-600/25")}
            >
              <Mic className="h-3.5 w-3.5" /> {labels.dub}
            </Button>
          </div>
          {onTryPrimary && (
            <Button
              size="sm"
              variant="outline"
              onClick={onTryPrimary}
              className="h-8 px-3 text-xs border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-gray-200 flex items-center gap-1.5 shrink-0 self-start md:self-auto"
            >
              <Tv className="h-3.5 w-3.5 text-blue-400" /> {t("Try Primary Player")}
            </Button>
          )}
        </div>

        {rows.map((source) => (
          <div key={source || "servers"} className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-slate-400 tracking-wider flex items-center gap-1">
              <Server className="h-3.5 w-3.5 text-cyan-400" /> {isFr ? `${source} :` : t("SERVER:")}
            </span>
            {list
              .filter((p) => !source || p.source === source)
              .map((player) => (
                <Button
                  key={player.id}
                  size="sm"
                  variant="ghost"
                  onClick={() => choose(player)}
                  className={`h-8 px-3 text-xs font-semibold rounded-xl transition ${
                    player.id === selected?.id
                      ? "bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/25 hover:bg-cyan-400"
                      : "bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-white"
                  }`}
                >
                  {player.server}
                </Button>
              ))}
          </div>
        ))}
      </div>

      <Alert variant="default" className="border-violet-900/60 bg-violet-950/20 text-violet-300 rounded-xl">
        <AlertCircle className="h-4 w-4 text-violet-400" />
        <AlertTitle className="font-bold">{t("{brand} Stream Player Active", { brand: BRAND })}</AlertTitle>
        <AlertDescription className="text-xs text-violet-300/80 mt-1">
          {isFr
            ? t("Streaming via external players. If one does not load, pick another server above.")
            : t("Streaming via fast ad-free player. You can switch servers or categories above at any time.")}
        </AlertDescription>
      </Alert>
    </div>
  );
}
