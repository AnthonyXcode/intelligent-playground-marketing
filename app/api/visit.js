// POST /api/visit  {"r":"<10-char link code>","e":"visit"|"contact"}
// Sent by the page itself (navigator.sendBeacon), not by the link, so mail scanners that only
// fetch the URL are not counted. Stores only: code, event, server time, device class. No IP.
import { redis, json, STREAM, MAX_LEN, TOKEN_RE, EVENTS, BOT_RE, deviceClass } from './_lib/track.js'

const ALLOWED_HOSTS = /^(www\.)?intelligent-playground\.com$|\.vercel\.app$|^localhost(:\d+)?$/

export async function POST(request) {
  const origin = request.headers.get('origin')
  if (origin) {
    try { if (!ALLOWED_HOSTS.test(new URL(origin).host)) return json(403, { error: 'origin' }) } catch { return json(403, { error: 'origin' }) }
  }
  const ua = request.headers.get('user-agent') || ''
  if (!ua || BOT_RE.test(ua)) return json(204, null)
  let body
  try { body = JSON.parse((await request.text()).slice(0, 512)) } catch { return json(400, { error: 'body' }) }
  const r = String(body?.r || '')
  const e = String(body?.e || 'visit')
  if (!TOKEN_RE.test(r) || !EVENTS.has(e)) return json(400, { error: 'invalid' })
  try {
    await redis(['XADD', STREAM, 'MAXLEN', '~', String(MAX_LEN), '*', 't', r, 'e', e, 'ts', new Date().toISOString(), 'd', deviceClass(ua)])
  } catch (err) {
    return json(err.status || 500, { error: 'store' })
  }
  return json(204, null)
}

export function GET() {
  return json(405, { error: 'method' })
}
