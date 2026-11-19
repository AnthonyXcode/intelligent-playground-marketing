// Link-visit tracking for outreach emails. Each school's email link carries ?r=<code>.
// The page (not the link) reports the visit, a few seconds after it is actually visible,
// so mail security scanners that only fetch the URL are not counted. The code is then
// removed from the address bar so it is not passed on if the page is shared.

const KEY = 'ip_ref'
const CODE_RE = /^[A-Za-z0-9]{10}$/
const VISIBLE_MS = 3000

function store(): Storage | null {
  try { return window.sessionStorage } catch { return null }
}

export function refCode(): string {
  try { return store()?.getItem(KEY) || '' } catch { return '' }
}

function send(r: string, e: 'visit' | 'contact'): void {
  const body = JSON.stringify({ r, e })
  try {
    if (navigator.sendBeacon?.('/api/visit', new Blob([body], { type: 'text/plain' }))) return
  } catch { /* fall through */ }
  fetch('/api/visit', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'text/plain' } }).catch(() => {})
}

export function trackEvent(e: 'visit' | 'contact'): void {
  const r = refCode()
  if (r) send(r, e)
}

export function initTracking(): void {
  const url = new URL(window.location.href)
  const r = url.searchParams.get('r')
  if (!r || !CODE_RE.test(r)) return
  try { store()?.setItem(KEY, r) } catch { /* private mode: still report this visit below */ }
  url.searchParams.delete('r')
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash)

  let sent = false
  let timer: number | undefined
  const fire = () => {
    if (sent) return
    sent = true
    document.removeEventListener('visibilitychange', arm)
    send(r, 'visit')
  }
  const arm = () => {
    window.clearTimeout(timer)
    if (document.visibilityState === 'visible') timer = window.setTimeout(fire, VISIBLE_MS)
  }
  document.addEventListener('visibilitychange', arm)
  arm()
}
