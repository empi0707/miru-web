// Fork-only: PWA manifest built from the BRAND env var (replaces public/manifest.json).
import type { MetadataRoute } from "next";
import manifest from "../../public/manifest.json";
import { BRAND } from "@/fork/config";

export default function buildManifest(): MetadataRoute.Manifest {
  return {
    ...(manifest as MetadataRoute.Manifest),
    name: `${BRAND} - Stream Anime with No Ads`,
    short_name: BRAND,
    description: `Watch your favorite anime anywhere, anytime with ease and no ads on ${BRAND}`,
  };
}
