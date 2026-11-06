/**
 * Fork-only: proxy manager for Anime-Sama Cloudflare bypass.
 *
 * ProxyVN two-var setup:
 *   EMBED_PROXY_URL  – proxy connection string http://user:pass@host:port
 *                      (the gateway; auth stays fixed, exit IP rotates via the API)
 *   EMBED_PROXY_API  – ProxyVN rotation endpoint, e.g.
 *                      https://api.proxyxoay.org/api/key_xoay_port.php?key=YOUR_KEY
 *                      (without &live=; that is appended from EMBED_PROXY_LIVE)
 *                      Returns JSON {ip, vi_tri, …} to confirm the new exit IP.
 *   EMBED_PROXY_LIVE – exit-IP live time in minutes 1–5 (default: 2)
 *
 * Alternative: set only EMBED_PROXY_API when it returns plain IP:PORT:USER:PASS.
 */

export interface ProxyConfig {
  protocol: string
  host: string
  port: number
  auth?: { username: string; password: string }
}

const LIVE_MIN = Math.max(1, Math.min(5, Number(process.env.EMBED_PROXY_LIVE || "2")))

/** Parse `IP:PORT:USER:PASS` or `IP:PORT` from a plain-text proxy API. */
function parseHostPort(raw: string): ProxyConfig | null {
  const parts = raw.trim().split(":")
  if (parts.length === 4) {
    const [host, portStr, username, password] = parts
    const port = Number(portStr)
    if (!host || Number.isNaN(port)) return null
    return { protocol: "http", host, port, auth: { username, password } }
  }
  if (parts.length === 2) {
    const [host, portStr] = parts
    const port = Number(portStr)
    if (!host || Number.isNaN(port)) return null
    return { protocol: "http", host, port }
  }
  return null
}

function parseStaticUrl(url: string): ProxyConfig | null {
  try {
    const u = new URL(url)
    const config: ProxyConfig = {
      protocol: u.protocol.replace(":", "") || "http",
      host: u.hostname,
      port: Number(u.port) || 80,
    }
    if (u.username) config.auth = { username: decodeURIComponent(u.username), password: decodeURIComponent(u.password) }
    return config
  } catch {
    return null
  }
}

/* ---------- singleton proxy config (connection stays fixed for HTTP proxy) ---------- */

let _config: ProxyConfig | null | undefined = undefined // undefined = not yet initialised

function staticConfig(): ProxyConfig | null {
  if (_config !== undefined) return _config
  const url = process.env.EMBED_PROXY_URL?.trim()
  _config = url ? parseStaticUrl(url) : null
  return _config
}

/* ---------- IP rotation via ProxyVN API ---------- */

let _rotateAt = 0 // timestamp when the next rotation is due
let _rotating: Promise<void> | null = null

async function doRotate(): Promise<void> {
  const api = process.env.EMBED_PROXY_API?.trim()
  if (!api) return
  try {
    const res = await fetch(`${api}&live=${LIVE_MIN}`, {
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    })
    if (!res.ok) throw new Error(`API ${res.status}`)
    const text = (await res.text()).trim()
    // ProxyVN returns JSON {ip, vi_tri, time, …}
    try {
      const json = JSON.parse(text) as { ip?: string; vi_tri?: string; time?: number }
      if (json.ip) {
        const liveSeconds = json.time ?? LIVE_MIN * 60
        _rotateAt = Date.now() + liveSeconds * 1_000
        console.log(`[fork-proxy] exit IP → ${json.ip} (${json.vi_tri ?? "?"}, ${liveSeconds}s)`)
        return
      }
    } catch {}
    // Fallback: plain IP:PORT:USER:PASS — use as the connection string
    const cfg = parseHostPort(text)
    if (cfg) {
      _config = cfg
      _rotateAt = Date.now() + LIVE_MIN * 60 * 1_000
      console.log(`[fork-proxy] proxy → ${cfg.host}:${cfg.port} (${LIVE_MIN}min)`)
    } else {
      throw new Error(`unexpected response: "${text.slice(0, 60)}"`)
    }
  } catch (e) {
    console.warn(`[fork-proxy] rotation failed: ${(e as Error).message}`)
  }
}

/** Trigger a rotation (deduplicated). */
export function rotateProxy(): Promise<void> {
  if (!_rotating) _rotating = doRotate().finally(() => { _rotating = null })
  return _rotating
}

/**
 * Returns the proxy config to use for a request, rotating the exit IP when due.
 * Returns null when no proxy is configured.
 */
export async function getProxyConfig(): Promise<ProxyConfig | null> {
  const cfg = staticConfig()
  const hasApi = Boolean(process.env.EMBED_PROXY_API?.trim())

  if (!cfg && !hasApi) return null

  // Rotate exit IP if due (lazy first rotation, then periodic)
  if (hasApi && Date.now() >= _rotateAt) {
    await rotateProxy()
  }

  return cfg ?? _config ?? null
}
