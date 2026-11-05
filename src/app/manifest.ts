// Fork-only: PWA manifest built from the brand env vars (replaces public/manifest.json).
import type { MetadataRoute } from "next";
import manifest from "../../public/manifest.json";
import { BRAND, BRAND_TAGLINE, BRAND_DESCRIPTION, BRAND_LOGO } from "@/fork/config";

const DEFAULT_LOGO = "/miru-logo.svg";

const iconType = (src: string) =>
  src.endsWith(".svg") ? "image/svg+xml" : src.endsWith(".webp") ? "image/webp" : "image/png";

export default function buildManifest(): MetadataRoute.Manifest {
  const base = manifest as MetadataRoute.Manifest;
  return {
    ...base,
    name: `${BRAND} - ${BRAND_TAGLINE}`,
    short_name: BRAND,
    description: BRAND_DESCRIPTION,
    icons: (base.icons || []).map((icon) =>
      icon.src === DEFAULT_LOGO ? { ...icon, src: BRAND_LOGO, type: iconType(BRAND_LOGO) } : icon,
    ),
  };
}
