// GET /api/visits?after=<stream id>&count=500   (Authorization: Bearer <TRACKING_READ_KEY>)
// Read by the outreach pipeline. Returns visits after the given cursor, oldest first.
import { redis, json, checkKey, STREAM } from './_lib/track.js'

const ID_RE = /^\d{1,16}-\d{1,8}$/

export async function GET(request) {
  if (!checkKey(request.headers.get('authorization'), process.env.TRACKING_READ_KEY)) return json(401, { error: 'unauthorized' })
  const q = new URL(request.url).searchParams
  const after = q.get('after') || ''
  if (after && !ID_RE.test(after)) return json(400, { error: 'after' })
  const count = Math.min(Math.max(Number(q.get('count')) || 500, 1), 1000)
  let rows
  try {
    rows = await redis(['XRANGE', STREAM, after ? `(${after}` : '-', '+', 'COUNT', String(count)])
  } catch (err) {
    return json(err.status || 500, { error: 'store' })
  }
  const items = (rows || []).map(([id, flat]) => {
    const f = {}
    for (let i = 0; i < flat.length; i += 2) f[flat[i]] = flat[i + 1]
    return { id, token: f.t, event: f.e, ts: f.ts, device: f.d }
  })
  return json(200, { items, last: items.at(-1)?.id || after || null })
}
