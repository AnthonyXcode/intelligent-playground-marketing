"""Polite cached HTTP fetcher (stdlib only).

- Generic User-Agent, no personal info.
- At most 2 requests/second overall.
- Responses cached (gzip) under CACHE_DIR; reruns read from cache (resume).
"""
import gzip
import hashlib
import os
import time
import urllib.error
import urllib.request

DEFAULT_CACHE = os.environ.get(
    "SCHOOLDATA_DIR",
    "/private/tmp/claude-501/-Users-anthonycyy-DocumentsLocal-IntelligentPlayground/"
    "ec00b895-caf8-4787-965f-3e738cdcd64e/scratchpad/schooldata",
)
CACHE_DIR = os.path.join(DEFAULT_CACHE, "cache")
UA = "Mozilla/5.0 (compatible; hk-school-directory-builder/1.0)"
MIN_INTERVAL = 0.5
_last = [0.0]


def _path(url):
    h = hashlib.sha1(url.encode("utf-8")).hexdigest()
    return os.path.join(CACHE_DIR, h[:2], h + ".gz")


def cached(url):
    return os.path.exists(_path(url))


def get(url, timeout=30, max_bytes=8_000_000, refresh=False):
    """Return decoded text ('' on failure; failures cached as empty too)."""
    p = _path(url)
    if not refresh and os.path.exists(p):
        with gzip.open(p, "rb") as f:
            return f.read().decode("utf-8", errors="replace")
    wait = MIN_INTERVAL - (time.time() - _last[0])
    if wait > 0:
        time.sleep(wait)
    _last[0] = time.time()
    body = b""
    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": UA, "Accept-Encoding": "gzip",
                     "Accept-Language": "zh-HK,zh;q=0.9,en;q=0.8"},
        )
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = r.read(max_bytes)
            if r.headers.get("Content-Encoding") == "gzip":
                raw = gzip.decompress(raw)
            body = raw
    except (urllib.error.URLError, OSError, ValueError, gzip.BadGzipFile) as e:
        print("  fetch failed:", url, type(e).__name__, str(e)[:80])
        body = b""
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with gzip.open(p, "wb") as f:
        f.write(body)
    for enc in ("utf-8", "big5hkscs"):
        try:
            return body.decode(enc)
        except UnicodeDecodeError:
            pass
    return body.decode("utf-8", errors="replace")
