// Shared helpers for the link-visit endpoints (files under api/_lib are not deployed as functions).
// Storage: Upstash Redis via its REST API (no npm dependency). Visits are kept in one Redis
// stream so the outreach pipeline can read them with a stable cursor (the stream id).
import { timingSafeEqual } from 'node:crypto'

export const STREAM = 'ip:visits'
export const MAX_LEN = 200000
export const TOKEN_RE = /^[A-Za-z0-9]{10}$/
export const EVENTS = new Set(['visit', 'contact'])
// Link scanners, crawlers and preview fetchers: never counted.
export const BOT_RE = /bot|crawl|spider|slurp|preview|scan|fetch|python|curl|wget|httpclient|java\/|go-http|headless|phantom|lighthouse|safelinks|proofpoint|mimecast|barracuda|facebookexternalhit|whatsapp|telegram/i

export function redisConfig() {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  return url && token ? { url: url.replace(/\/+$/, ''), token } : null
}

export async function redis(cmd) {
  const cfg = redisConfig()
  if (!cfg) throw Object.assign(new Error('storage not configured'), { status: 503 })
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok || data.error) throw Object.assign(new Error(data.error || `redis ${res.status}`), { status: 502 })
  return data.result
}

export function deviceClass(ua) {
  if (/ipad|tablet/i.test(ua)) return 'tablet'
  if (/mobi|iphone|android/i.test(ua)) return 'mobile'
  return 'desktop'
}

export function checkKey(header, key) {
  if (!key || key.length < 32) return false
  const got = Buffer.from(String(header || '').replace(/^Bearer\s+/i, ''))
  const want = Buffer.from(key)
  return got.length === want.length && timingSafeEqual(got, want)
}

export const json = (status, body) =>
  new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
