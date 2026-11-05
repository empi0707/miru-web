/**
 * Fork-only: brand colour theming.
 *
 * The UI hard-codes Tailwind `cyan-*` (primary accent) and `blue-*` (gradient
 * partner) classes. Instead of editing every component, tailwind.config remaps
 * those two palettes to CSS variables, and <BrandStyle /> fills the variables
 * from NEXT_PUBLIC_BRAND_PRIMARY / NEXT_PUBLIC_BRAND_SECONDARY.
 * Each variable falls back to Tailwind's original value, so with no brand
 * colour set the site looks exactly like upstream.
 *
 * Keep this file dependency-free: tailwind.config.ts imports it.
 */

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;
type Shade = (typeof SHADES)[number];

/** Tailwind v3 defaults (RGB channels) for the remapped palettes. */
const ORIGINAL: Record<"primary" | "secondary", Record<Shade, string>> = {
  // cyan
  primary: {
    50: "236 254 255", 100: "207 250 254", 200: "165 243 252", 300: "103 232 249",
    400: "34 211 238", 500: "6 182 212", 600: "8 145 178", 700: "14 116 144",
    800: "21 94 117", 900: "22 78 99", 950: "8 51 68",
  },
  // blue
  secondary: {
    50: "239 246 255", 100: "219 234 254", 200: "191 219 254", 300: "147 197 253",
    400: "96 165 250", 500: "59 130 246", 600: "37 99 235", 700: "29 78 216",
    800: "30 64 175", 900: "30 58 138", 950: "23 37 84",
  },
};

/** Lightness (%) per shade; the brand colour itself is used as-is for 500. */
const LIGHTNESS: Record<Shade, number> = {
  50: 97, 100: 93, 200: 86, 300: 76, 400: 64, 500: 52, 600: 43, 700: 36, 800: 30, 900: 25, 950: 16,
};

/** Tailwind `colors` entries: `cyan` → primary vars, `blue` → secondary vars. */
export function brandTailwindColors() {
  const palette = (kind: "primary" | "secondary") =>
    Object.fromEntries(
      SHADES.map((s) => [s, `rgb(var(--brand-${kind}-${s}, ${ORIGINAL[kind][s]}) / <alpha-value>)`]),
    );
  return { cyan: palette("primary"), blue: palette("secondary") };
}

type HSL = { h: number; s: number; l: number };

function hexToHsl(hex: string): HSL | null {
  const m = hex.trim().replace(/^#/, "");
  const full = m.length === 3 ? m.split("").map((c) => c + c).join("") : m;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  return { h: (h * 60 + 360) % 360, s: s * 100, l: l * 100 };
}

function hslToRgb({ h, s, l }: HSL): string {
  const sat = s / 100;
  const lig = l / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = sat * Math.min(lig, 1 - lig);
  const f = (n: number) => lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)].map((v) => Math.round(v * 255)).join(" ");
}

function scaleVars(kind: "primary" | "secondary", base: HSL): string[] {
  return SHADES.map((shade) => {
    const hsl = shade === 500 ? base : { ...base, l: LIGHTNESS[shade] };
    return `--brand-${kind}-${shade}: ${hslToRgb(hsl)};`;
  });
}

/** Hue offset between Tailwind cyan-500 and blue-600, used to derive the secondary. */
const SECONDARY_HUE_SHIFT = 28;

/** CSS for :root, or "" when no (valid) brand colour is configured. */
export function brandColorCss(primaryHex: string, secondaryHex: string): string {
  const primary = primaryHex ? hexToHsl(primaryHex) : null;
  if (!primary) return "";
  const secondary =
    (secondaryHex && hexToHsl(secondaryHex)) ||
    { ...primary, h: (primary.h + SECONDARY_HUE_SHIFT) % 360 };

  const shadcn = `${primary.h.toFixed(0)} ${primary.s.toFixed(0)}% ${primary.l.toFixed(0)}%`;
  return `:root,.dark{${[
    ...scaleVars("primary", primary),
    ...scaleVars("secondary", secondary),
    `--primary: ${shadcn};`,
    `--ring: ${shadcn};`,
  ].join("")}}`;
}
