// FORK: French embed players (src/fork/embeds). GET /api/fork-embeds?anilist=154587&ep=1
import { NextRequest, NextResponse } from "next/server";
import { resolveFrenchEmbeds } from "@/fork/embeds";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const anilist = request.nextUrl.searchParams.get("anilist") || "";
  const ep = request.nextUrl.searchParams.get("ep") || "";
  if (!/^\d{1,9}$/.test(anilist) || !/^\d{1,5}$/.test(ep) || Number(ep) < 1) {
    return NextResponse.json({ players: [], error: "Invalid anilist or ep" }, { status: 400 });
  }
  try {
    const { players, errors } = await resolveFrenchEmbeds(Number(anilist), Number(ep));
    return NextResponse.json(
      { players, errors },
      { headers: { "Cache-Control": players.length ? "public, s-maxage=1800, stale-while-revalidate=3600" : "no-store" } },
    );
  } catch (error) {
    console.error(`[fork-embeds] ${anilist} ep ${ep}:`, error);
    return NextResponse.json({ players: [], error: (error as Error).message }, { status: 502 });
  }
}
