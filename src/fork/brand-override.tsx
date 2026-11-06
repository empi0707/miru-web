"use client";

/**
 * Fork-only: URL-parameter brand override for white-label embedding.
 *
 * Usage: embed the app with ?logo=<image-url>&brand=<name>
 *   e.g. https://animesama.click?logo=https://animesama-fr.org/logo.png&brand=NewAnimeSama
 *
 * The override is stored in sessionStorage so it survives client-side navigation.
 * Browser-tab title and <meta> tags are server-rendered and stay unchanged.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { BRAND, BRAND_LOGO } from "./config";

interface BrandOverride {
  logo?: string;
  brand?: string;
}

const SESSION_KEY = "__forkBrandOverride";
const BrandCtx = createContext<BrandOverride>({});

export function BrandOverrideProvider({ children }: { children: ReactNode }) {
  const [override, setOverride] = useState<BrandOverride>({});

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const logo = params.get("logo") ?? undefined;
    const brand = params.get("brand") ?? undefined;

    if (logo || brand) {
      const o: BrandOverride = {};
      if (logo) o.logo = logo;
      if (brand) o.brand = brand;
      setOverride(o);
      try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(o)); } catch {}
    } else {
      try {
        const stored = sessionStorage.getItem(SESSION_KEY);
        if (stored) setOverride(JSON.parse(stored) as BrandOverride);
      } catch {}
    }
  }, []);

  return <BrandCtx.Provider value={override}>{children}</BrandCtx.Provider>;
}

/** Returns brand name and logo URL, with URL-param overrides applied. */
export function useBrandOverride() {
  const o = useContext(BrandCtx);
  return {
    brand: o.brand ?? BRAND,
    logo: o.logo ?? BRAND_LOGO,
    /** True when logo is an external URL override — use <img> instead of Next <Image>. */
    isExternalLogo: Boolean(o.logo),
  };
}
