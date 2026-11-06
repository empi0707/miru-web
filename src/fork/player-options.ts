/**
 * Fork-only: ArtPlayer options for the configured language and brand colour.
 * Used as `new Artplayer(withForkPlayerOptions(options))`.
 */
import type { Option } from "artplayer";
import artplayerFr from "artplayer/i18n/fr";
import { LANGUAGE } from "./i18n";
import { BRAND_PRIMARY } from "./config";

const PLAYER_I18N: Record<string, Record<string, string>> = { fr: artplayerFr };

export function withForkPlayerOptions(options: Option): Option {
  const next: Option = { ...options };
  if (PLAYER_I18N[LANGUAGE]) {
    next.lang = LANGUAGE;
    next.i18n = { ...(options.i18n || {}), [LANGUAGE]: PLAYER_I18N[LANGUAGE] } as Option["i18n"];
  }
  const hex = BRAND_PRIMARY.replace(/^#?/, "#");
  if (/^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(hex)) next.theme = hex;
  return next;
}
