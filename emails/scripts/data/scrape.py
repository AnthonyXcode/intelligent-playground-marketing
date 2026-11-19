"""Download + parse official school profiles into SCHOOLDATA_DIR/parsed/*.json.

Usage: python3 -I scrape.py [edb] [psp] [ssp] [spsp] [kgp] [web]   (default: all but web)
Cached; safe to rerun (resumes from cache).
"""
import html as htmlmod
import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fetch  # noqa: E402

OUT = os.path.join(fetch.DEFAULT_CACHE, "parsed")
EDB_URL = ("https://www.edb.gov.hk/attachment/en/student-parents/sch-info/sch-search/"
           "sch-location-info/SCH_LOC_EDB.json")
PSP = "https://www.chsc.hk/psp2026/"
SSP = "https://www.chsc.hk/ssp2025/"
SPSP = "https://www.chsc.hk/spsp/public/index.php/school/"
KGP = "https://kgp2026.kindergartenprofile.com/"
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+'-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}")


def text_lines(h):
    h = re.sub(r"<!--.*?-->", "", h, flags=re.S)
    h = re.sub(r"<(script|style)\b.*?</\1>", "", h, flags=re.S | re.I)
    t = re.sub(r"<[^>]+>", "\n", h)
    t = htmlmod.unescape(t).replace("\xa0", " ")
    return [ln.strip() for ln in t.split("\n") if ln.strip()]


def after(lines, label, start=0, skip=(":", "：")):
    """Value on the first non-empty line after a line equal to label."""
    for i in range(start, len(lines)):
        if lines[i].rstrip(":： ").strip() == label:
            for j in range(i + 1, min(i + 4, len(lines))):
                if lines[j] in skip:
                    continue
                return lines[j]
            return ""
    return ""


def principal_after(lines, label):
    """PSP splits some names over several lines (e.g. rare chars in <span>); join them."""
    for i, ln in enumerate(lines):
        if ln == label:
            parts = []
            for nx in lines[i + 1:i + 8]:
                if nx in (":", "："):
                    if parts:
                        break
                    continue
                if parts and len(nx) > 6:
                    break
                parts.append(nx)
                if re.search(r"(先生|女士|小姐|博士|修女|神父|牧師|校長|M\.H\.)$", nx):
                    break
            return "".join(parts[:-1] if len(parts) > 1 and lines[i + 1 + len(parts)] == ":" else parts)
    return ""


def emails_in(s):
    s = re.sub(r"(?i)mailto:", " ", s or "")
    return [e.strip(".'").lower() for e in EMAIL_RE.findall(s)]


def save(name, data):
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, name + ".json"), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
    print(name, len(data), "records")


CLOSE_RE = re.compile(r"停辦|停止辦學|結束辦學|不再招收|停止招收|暫停招收|不招收新生|停止收生|暫停收生")


def edb():
    raw = fetch.get(EDB_URL)
    data = json.loads(raw.lstrip("﻿"))
    save("edb", [x for x in data if str(x.get("SCHOOL NO.")) != "0"])


def chsc_detail(lines):
    return {
        "address": after(lines, "地址"),
        "phone": after(lines, "電話"),
        "email_raw": after(lines, "電郵"),
        "website": after(lines, "網址"),
    }


def psp():
    ids = {}
    for d in range(1, 19):
        h = fetch.get(f"{PSP}sch_list.php?district_id={d}&lang_id=2&frmMode=pagebreak")
        for sid, en, zh in re.findall(r"sch_detail\.php\?lang_id=2&sch_id=(\d+)[^']*'>([^<]*)<br>([^<]*)</a>", h):
            ids[sid] = (htmlmod.unescape(en).strip(), htmlmod.unescape(zh).strip())
    out = []
    for n, (sid, (en, zh)) in enumerate(sorted(ids.items(), key=lambda x: int(x[0]))):
        if n % 50 == 0:
            print(" psp", n, "/", len(ids))
        h = fetch.get(f"{PSP}sch_detail.php?lang_id=2&sch_id={sid}")
        L = text_lines(h)
        rec = chsc_detail(L)
        rec.update(src_id=sid, name_zh=zh, name_en=en, principal_raw=principal_after(L, "校長"),
                   closing=" | ".join(sorted(set(CLOSE_RE.findall(" ".join(L))))),
                   emails=emails_in(rec["email_raw"]))
        out.append(rec)
    save("psp", out)


def ssp():
    ids = set()
    for d in range(1, 19):
        h = fetch.get(f"{SSP}sch_list.php?lang_id=2&frmMode=pagebreak&district_id={d}")
        ids.update(re.findall(r"sch_detail\.php\?li_id=2&lang_id=2&chg_district_id=\d+&sch_id=(\d+)", h))
    out = []
    for n, sid in enumerate(sorted(ids, key=int)):
        if n % 50 == 0:
            print(" ssp", n, "/", len(ids))
        h = fetch.get(f"{SSP}sch_detail.php?li_id=2&lang_id=2&sch_id={sid}")
        L = text_lines(h)
        rec = chsc_detail(L)
        zh = en = ""
        for i, ln in enumerate(L):
            if ln == "列印學校資料" and i + 2 < len(L):
                zh, en = L[i + 1], L[i + 2]
                break
        pr = after(L, "校長（附學歷 / 資歷）") or after(L, "校長")
        rec.update(src_id=sid, name_zh=zh, name_en=en, principal_raw=pr,
                   closing=" | ".join(sorted(set(CLOSE_RE.findall(" ".join(L))))),
                   emails=emails_in(rec["email_raw"]))
        out.append(rec)
    save("ssp", out)


def spsp():
    ids = set()
    for k in range(1, 11):
        h = fetch.get(f"{SPSP}sch_list.html?sch_kind_id={k}")
        ids.update(re.findall(r"sch_detail\.html\?sch_id=(\d+)", h))
    out = []
    for sid in sorted(ids, key=int):
        L = text_lines(fetch.get(f"{SPSP}sch_detail.html?sch_id={sid}"))
        rec = {
            "src_id": sid,
            "name_zh": after(L, "學校名稱"),
            "name_en": after(L, "School Name"),
            "address": after(L, "中文地址"),
            "phone": after(L, "電話"),
            "email_raw": after(L, "電郵地址"),
            "website": after(L, "學校網址"),
            "principal_raw": after(L, "校長姓名"),
            "closing": " | ".join(sorted(set(CLOSE_RE.findall(" ".join(L))))),
        }
        rec["emails"] = emails_in(rec["email_raw"])
        out.append(rec)
    save("spsp", out)


def kgp():
    edb_rows = json.load(open(os.path.join(OUT, "edb.json"), encoding="utf-8"))
    ids = {str(x["SCHOOL NO."])[:10] for x in edb_rows if x["SCHOOL LEVEL"].startswith("KINDER")}
    ids |= set(re.findall(r"schid=(\d{10})", fetch.get(KGP)))
    out = []
    for n, sid in enumerate(sorted(ids)):
        if n % 50 == 0:
            print(" kgp", n, "/", len(ids))
        h = fetch.get(f"{KGP}school/?schid={sid}")
        L = text_lines(h)
        k = L.index("友善列印") if "友善列印" in L else -1
        dist = L[k - 1] if k > 0 else ""
        L = L[k:] if k >= 0 else []
        if len(L) < 5:
            out.append({"src_id": sid, "missing": True})
            continue
        zh = L[1] if len(L) > 1 else ""
        rec = {
            "src_id": sid,
            "district": dist,
            "name_zh": zh,
            "address": after(L, "地址"),
            "phone": after(L, "電話"),
            "email_raw": after(L, "電郵"),
            "website": after(L, "學校網址"),
            "principal_raw": after(L, "校長姓名"),
            "school_no": after(L, "學校編號"),
            "loc_no": after(L, "校址編號"),
            "closing": " | ".join(sorted(set(CLOSE_RE.findall(" ".join(L[:400]))))),
        }
        rec["emails"] = emails_in(rec["email_raw"])
        out.append(rec)
    save("kgp", out)


def web():
    """Fallback: school homepage (+ one contact-like link) for rows still lacking email."""
    todo = json.load(open(os.path.join(OUT, "web_todo.json"), encoding="utf-8"))
    out = {}
    for n, (rid, site) in enumerate(sorted(todo.items())):
        if n % 25 == 0:
            print(" web", n, "/", len(todo))
        if not re.match(r"https?://", site or ""):
            continue
        found, pages = [], [site]
        h = fetch.get(site, timeout=15, max_bytes=3_000_000)
        found += emails_in(" ".join(re.findall(r"mailto:([^\"'?>\s]+)", h, flags=re.I)))
        found += emails_in(" ".join(text_lines(h)))
        if not found:
            m = re.search(r"href=[\"']([^\"']*(?:contact|聯絡|lianluo|contactus|contact-us)[^\"']*)[\"']", h, re.I)
            if m:
                import urllib.parse
                u = urllib.parse.urljoin(site, htmlmod.unescape(m.group(1)))
                if u.startswith("http"):
                    pages.append(u)
                    h2 = fetch.get(u, timeout=15, max_bytes=3_000_000)
                    found += emails_in(" ".join(re.findall(r"mailto:([^\"'?>\s]+)", h2, flags=re.I)))
                    found += emails_in(" ".join(text_lines(h2)))
        found = [e for e in dict.fromkeys(found)
                 if not re.search(r"\.(png|jpe?g|gif|svg|webp|css|js)$", e)
                 and not re.search(r"example\.|sentry|wixpress|domain\.com|email\.com|yourmail", e)]
        out[rid] = {"emails": found, "pages": pages}
    save("web", out)


if __name__ == "__main__":
    stages = sys.argv[1:] or ["edb", "psp", "ssp", "spsp", "kgp"]
    for s in stages:
        print("==", s)
        globals()[s]()
