/** Fork-only: server-side HTTP + in-memory cache for the embed scrapers. */
import axios from "axios";
import { getProxyConfig, rotateProxy } from "./proxy";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export class HttpError extends Error {
  constructor(public status: number, url: string) {
    super(`HTTP ${status} ${url}`);
  }
}

export async function fetchText(
  url: string,
  init: { method?: "GET" | "POST"; form?: Record<string, string>; headers?: Record<string, string>; proxy?: boolean } = {},
): Promise<string> {
  const commonHeaders = {
    "User-Agent": USER_AGENT,
    "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.6",
    ...(init.form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    ...init.headers,
  };

  if (init.proxy) {
    const proxyConfig = await getProxyConfig();
    if (proxyConfig) {
      const attempt = async () => {
        const r = await axios.request<string>({
          url,
          method: init.form ? "post" : "get",
          data: init.form ? new URLSearchParams(init.form).toString() : undefined,
          headers: commonHeaders,
          proxy: proxyConfig,
          timeout: 20_000,
          responseType: "text",
          maxRedirects: 5,
        });
        return r.data;
      };
      try {
        return await attempt();
      } catch (e: unknown) {
        const status = (e as { response?: { status?: number } })?.response?.status;
        // On Cloudflare block: rotate IP and retry once.
        if (status === 403 || status === 503) {
          await rotateProxy();
          try { return await attempt(); } catch (e2: unknown) {
            const s2 = (e2 as { response?: { status?: number } })?.response?.status;
            throw new HttpError(s2 ?? status, url);
          }
        }
        if (status) throw new HttpError(status, url);
        throw e;
      }
    }
  }

  const res = await fetch(url, {
    method: init.method || (init.form ? "POST" : "GET"),
    headers: commonHeaders,
    body: init.form ? new URLSearchParams(init.form).toString() : undefined,
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!res.ok) throw new HttpError(res.status, url);
  return res.text();
}

/** Site base URL from env (domains change often), without trailing slash. */
export const siteBase = (value: string | undefined, fallback: string) =>
  (value && value.trim() ? value.trim() : fallback).replace(/\/+$/, "");

/* ---------- cache ---------- */

const MAX_ENTRIES = 2000;
const store = new Map<string, { at: number; ttl: number; value: Promise<unknown> }>();

/**
 * Memoise `build()` for `ttlMs`. The promise itself is cached, so concurrent
 * requests share one scrape; a rejected promise is dropped at once.
 */
export function cached<T>(key: string, ttlMs: number, build: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < hit.ttl) return hit.value as Promise<T>;
  const value = build();
  store.set(key, { at: Date.now(), ttl: ttlMs, value });
  value.catch(() => store.delete(key));
  if (store.size > MAX_ENTRIES) store.delete(store.keys().next().value as string);
  return value;
}

export const HOUR = 60 * 60 * 1000;

/* ---------- small HTML helpers (no DOM parser on the server) ---------- */

const ENTITIES: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " ", rsquo: "’" };

export const decodeHtml = (s: string) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);

export const stripTags = (s: string) => decodeHtml(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

/** "voe.sx" → "Voe", "my.mail.ru" → "Mail". */
export function hostLabel(url: string): string {
  try {
    const parts = new URL(url).hostname.replace(/^www\./, "").split(".");
    const name = parts.length > 1 ? parts[parts.length - 2] : parts[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return "Lecteur";
  }
}

export const isHttpUrl = (url: unknown): url is string =>
  typeof url === "string" && /^https?:\/\/[^\s"'<>]+\.[^\s"'<>]+$/.test(url);
