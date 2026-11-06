/**
 * Fork-only: tiny build-time i18n.
 *
 * The English source text *is* the key: `t("Watch Now")`. Missing
 * translations fall back to English, so upstream strings that are not yet
 * translated keep working. Placeholders use `{name}`: `t("Page {page}", { page })`.
 *
 * Language comes from NEXT_PUBLIC_LANGUAGE (inlined at build time), so `t`
 * is a plain function usable in server and client components alike.
 */
import fr from "./fr";

export type Dictionary = Record<string, string>;

const DICTIONARIES: Record<string, Dictionary> = { fr };

/** BCP 47 locales used for dates/times. */
const LOCALES: Record<string, string> = { en: "en-US", fr: "fr-FR" };

const requested = (process.env.NEXT_PUBLIC_LANGUAGE || "en").trim().toLowerCase();

/** Active language code ("en" when the requested one has no dictionary). */
export const LANGUAGE = requested in DICTIONARIES || requested === "en" ? requested : "en";

/** Locale for toLocaleDateString / toLocaleTimeString. */
export const LOCALE = LOCALES[LANGUAGE] || "en-US";

const dict: Dictionary = DICTIONARIES[LANGUAGE] || {};

const interpolate = (text: string, vars?: Record<string, string | number | null | undefined>) =>
  vars ? text.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m).toString()) : text;

/** Plural forms: a value "singular|plural" picks by `vars.n` (French rule: n <= 1 is singular). */
const pluralize = (text: string, n: unknown) => {
  if (!text.includes("|")) return text;
  const [one, other] = text.split("|");
  return typeof n === "number" && Math.abs(n) <= 1 ? one : other;
};

/** Translate an English UI string. Non-strings (numbers, null) pass through. */
export function t<T>(text: T, vars?: Record<string, string | number | null | undefined>): T | string {
  if (typeof text !== "string") return text;
  return interpolate(pluralize(dict[text] ?? text, vars?.n), vars);
}

/**
 * Translate composed metadata such as "SPRING 2024" or "TV_SHORT":
 * exact match first, otherwise word by word.
 */
export function tMeta<T>(text: T): T | string {
  if (typeof text !== "string") return text;
  if (dict[text]) return dict[text];
  return text
    .split(/(\s+)/)
    .map((part) => dict[part] ?? part)
    .join("");
}
