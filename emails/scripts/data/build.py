"""Merge parsed sources into emails/data/schools.csv.

Usage: python3 -I build.py            (writes schools.csv + web_todo.json + stats.json)
Run scrape.py first (and `scrape.py web` for the website fallback, then build.py again).
"""
import collections
import csv
import json
import os
import re
import sys
import urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fetch  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
CSV_PATH = os.path.normpath(os.path.join(HERE, "..", "..", "data", "schools.csv"))
P = os.path.join(fetch.DEFAULT_CACHE, "parsed")
COLS = ["id", "level", "name_zh", "name_en", "district", "address", "email", "website",
        "phone", "principal", "source", "notes"]
EMAIL_OK = re.compile(r"^[a-z0-9][a-z0-9._%+'-]*@[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$")
FREEMAIL = {"gmail.com", "yahoo.com", "yahoo.com.hk", "hotmail.com", "outlook.com",
            "live.com", "icloud.com", "msn.com", "qq.com", "163.com", "126.com"}
# Hand-reviewed exclusions (closed / not admitting); see README.
EXCLUDE = {}


def load(name, default=None):
    p = os.path.join(P, name + ".json")
    if not os.path.exists(p):
        return default if default is not None else []
    return json.load(open(p, encoding="utf-8"))


def norm_name(s):
    s = (s or "").replace("衞", "衛").replace("啓", "啟").replace("邨", "村").replace("峯", "峰")
    s = re.sub(r"[（(](小學部|中學部|小學|中學|幼稚園部)[)）]", "", s)
    return re.sub(r"[\s\-–—‐・·．.,，、()（）﹝﹞〔〕\[\]'’]", "", s).lower()


def norm_phone(s):
    d = re.sub(r"\D", "", re.split(r"[,/;]", s or "")[0])
    return d[-8:] if len(d) >= 8 else ""


TITLES = ["太平紳士", "署理校長", "代校長", "署任校長", "校長", "先生", "女士", "小姐", "博士",
          "教授", "修女", "神父", "牧師", "院長", "姑娘", "太太", "法師", "居士", "Dr.", "Dr", "MH", "JP", "BBS"]


def norm_principal(s):
    for tok in re.split(r"[\s\u3000（(\[［【,，、/;；：:]+", (s or "").strip()):
        for t in TITLES:
            tok = tok.replace(t, "")
        if re.fullmatch(r"[\u3400-\u9fff]{2,4}", tok):
            return tok
        if re.search(r"[\u3400-\u9fff]", tok):
            return ""
    return ""


def clean_emails(lst):
    out = []
    for e in lst or []:
        e = e.strip().lower().removeprefix("mailto:").strip(".;, ")
        if EMAIL_OK.match(e) and e not in out:
            out.append(e)
    return out


def email_note(e):
    local, _, dom = e.partition("@")
    notes = []
    if dom in FREEMAIL:
        notes.append("免費郵箱")
    if re.fullmatch(r"[a-z]{2,}\.[a-z]{2,}", local) and not re.search(
            r"info|office|school|admin|general|enquir|contact|mail|kg|sch|edu|ps|ss|cs", local):
        notes.append("可能為個人電郵")
    if local.startswith("principal"):
        notes.append("校長郵箱")
    return notes


def site_domain(u):
    try:
        h = urllib.parse.urlparse(u).hostname or ""
    except ValueError:
        return ""
    return re.sub(r"^www\d?\.", "", h.lower())


def core(domain):
    d = re.sub(r"\.(edu|org|com|net|gov|idv)?\.?hk$|\.(com|org|net|edu|school|info)$", "", domain)
    return d.split(".")[-1]


def web_email_ok(e, site_dom):
    """Website-scraped email must belong to the school's own domain (or a free-mail box)."""
    dom = e.split("@")[1]
    if dom in FREEMAIL:
        return True
    c = core(dom)
    return bool(site_dom) and len(c) >= 3 and c in site_dom


def main():
    edb = load("edb")
    groups = collections.OrderedDict()
    for x in sorted(edb, key=lambda r: str(r["SCHOOL NO."])):
        no = str(x["SCHOOL NO."])
        cat, lvl_raw = x["ENGLISH CATEGORY"], x["SCHOOL LEVEL"]
        if "Special" in cat:
            lvl, key = "SPE", "SPE-" + no[:6]
        elif lvl_raw.startswith("KINDER"):
            lvl, key = "KG", "KG-" + no[:10]
        elif lvl_raw == "PRIMARY":
            lvl, key = "PRI", "PRI-" + no[:6]
        else:
            lvl, key = "SEC", "SEC-" + no[:6]
        g = groups.setdefault(key, {"id": key, "level": lvl, "rows": []})
        g["rows"].append(x)

    # index EDB groups for matching
    by_name = collections.defaultdict(list)
    by_phone = collections.defaultdict(list)
    for g in groups.values():
        for x in g["rows"]:
            by_name[(g["level"], norm_name(x["中文名稱"]))].append(g["id"])
            by_phone[(g["level"], norm_phone(x["TELEPHONE"]))].append(g["id"])

    prof = {}  # group id -> list of (tag, record)
    unmatched = collections.Counter()

    def match(level, rec):
        ids = list(dict.fromkeys(by_name.get((level, norm_name(rec.get("name_zh"))), [])))
        if len(ids) > 1:
            ph = norm_phone(rec.get("phone"))
            ids2 = [i for i in ids if i in by_phone.get((level, ph), [])]
            ids = ids2 or ids[:1]
        if not ids:
            ph = norm_phone(rec.get("phone"))
            cand = list(dict.fromkeys(by_phone.get((level, ph), []))) if ph else []
            if len(cand) == 1:
                ids = cand
        return ids[0] if ids else None

    for tag, name, level in [("PSP2026", "psp", "PRI"), ("SSP2025", "ssp", "SEC"),
                             ("SPSP", "spsp", "SPE")]:
        for rec in load(name):
            gid = match(level, rec)
            if gid is None and level == "SPE":
                gid = None
            if gid is None:
                unmatched[tag] += 1
                print("unmatched", tag, rec.get("name_zh"), rec.get("phone"))
                continue
            prof.setdefault(gid, []).append((tag, rec))
    for rec in load("kgp"):
        if rec.get("missing"):
            continue
        gid = "KG-" + rec["src_id"]
        if gid not in groups:
            same = [k for k in groups if k.startswith("KG-" + rec["src_id"][:6])]
            if same:  # e.g. non-local-curriculum section (location 0091) of an EDB-listed KG
                gid = same[0]
            else:  # in KGP 2026/27 but not yet in the EDB location file: add from KGP
                print("KGP-only", rec["src_id"], rec.get("name_zh"))
                unmatched["KGP2026_only_added"] += 1
                d = rec.get("district", "")
                groups[gid] = {"id": gid, "level": "KG", "rows": [{
                    "中文名稱": rec["name_zh"], "ENGLISH NAME": "", "分區": d if d.endswith("區") else d + "區",
                    "中文地址": rec["address"], "WEBSITE": "", "TELEPHONE": rec["phone"],
                    "學校授課時間": "", "_kgp_only": True, "SCHOOL LEVEL": "KINDERGARTEN", "ENGLISH CATEGORY": "Kindergartens"}]}
        prof.setdefault(gid, []).append(("KGP2026", rec))
    web = load("web", {})

    rows = []
    for gid, g in groups.items():
        first = g["rows"][0]
        recs = prof.get(gid, [])
        tags = ([] if first.get("_kgp_only") else ["EDB"]) + [t for t, _ in recs]
        emails, principal, address, site, notes = [], "", "", "", []
        for t, r in recs:
            emails += clean_emails(r.get("emails"))
            principal = principal or norm_principal(r.get("principal_raw"))
            address = address or (r.get("address") or "").strip(" -")
            if re.match(r"https?://", r.get("website") or ""):
                site = site or r["website"].strip()
            if r.get("closing"):
                notes.append("概覽提及:" + r["closing"])
        edb_site = (first.get("WEBSITE") or "").strip()
        if re.match(r"https?://", edb_site, re.I):
            site = edb_site
        emails = list(dict.fromkeys(emails))
        if not emails and gid in web and web[gid]["emails"]:
            dom = site_domain(site)
            cand = [e for e in clean_emails(web[gid]["emails"]) if web_email_ok(e, dom)]
            cand.sort(key=lambda e: not re.search(r"info|office|general|admin|enquir|school|contact", e))
            if cand:
                emails = cand
                tags.append("WEB")
                notes.append("電郵取自學校網站")
        name_zh = first["中文名稱"]
        if g["level"] == "SPE":
            name_zh = re.sub(r"[（(](小學部|中學部)[)）]", "", name_zh)
        sessions = sorted({x["學校授課時間"] for x in g["rows"]})
        if len(sessions) > 1:
            notes.append("時段:" + "/".join(sessions))
        if len({x["中文地址"] for x in g["rows"]}) > 1 and not recs:
            notes.append("多個校址")
        if g["level"] == "SPE":
            lv = sorted({x["SCHOOL LEVEL"] for x in g["rows"]})
            notes.append("特殊學校(" + "/".join("小學" if v == "PRIMARY" else "中學" for v in lv) + ")")
        if g["level"] in ("PRI", "SEC") and first["ENGLISH CATEGORY"].startswith(("International", "English Schools")):
            notes.append("國際/英基學校")
        if len(emails) > 1:
            notes.append("其他電郵:" + " ".join(emails[1:3]))
        email = emails[0] if emails else ""
        if email:
            notes += email_note(email)
        rows.append({
            "id": gid,
            "level": g["level"],
            "name_zh": name_zh,
            "name_en": first["ENGLISH NAME"],
            "district": first["分區"],
            "address": address or first["中文地址"],
            "email": email,
            "website": site,
            "phone": first["TELEPHONE"] if first["TELEPHONE"] not in ("N.A.", "0") else "",
            "principal": principal,
            "source": ";".join(dict.fromkeys(tags)),
            "notes": "; ".join(dict.fromkeys(notes)),
            "_id6": gid.split("-")[1][:6],
        })

    # merge KG campuses of same school number with same (or no distinct) email
    merged, seen = [], {}
    for r in rows:
        if r["level"] == "KG":
            k = (r["_id6"], r["email"])
            if k in seen:
                o = seen[k]
                o["notes"] = "; ".join(x for x in [o["notes"], "另有校舍:" + r["address"]] if x)
                continue
            seen[k] = r
        merged.append(r)
    rows = merged

    # through-train / combined schools: same school no. at PRI+SEC with the same email -> one row
    by_key = {}
    final = []
    for r in rows:
        if r["level"] in ("PRI", "SEC") and r["email"]:
            k = (r["_id6"], r["email"])
            if k in by_key:
                o = by_key[k]
                o["notes"] = "; ".join(x for x in [o["notes"], "同校設小學及中學部"] if x)
                o["source"] = ";".join(dict.fromkeys(o["source"].split(";") + r["source"].split(";")))
                o["principal"] = o["principal"] or r["principal"]
                continue
            by_key[k] = r
        final.append(r)
    rows = final

    # de-dup emails across different schools: keep on the first, blank later ones
    owner = {}
    pref = {"PRI": 0, "SEC": 1, "SPE": 2, "KG": 3}
    for r in sorted(rows, key=lambda r: (pref[r["level"]], r["id"])):
        e = r["email"]
        if not e:
            continue
        if e in owner:
            r["notes"] = "; ".join(x for x in [r["notes"], f"電郵與{owner[e]}相同(已留空:{e})"] if x)
            r["email"] = ""
        else:
            owner[e] = r["id"]

    rows = [r for r in rows if r["id"] not in EXCLUDE]
    order = {"KG": 0, "PRI": 1, "SEC": 2, "SPE": 3}
    rows.sort(key=lambda r: (order[r["level"]], r["id"]))
    with open(CSV_PATH, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=COLS, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)

    todo = {r["id"]: r["website"] for r in rows if not r["email"] and r["website"]
            and "相同" not in r["notes"]}
    json.dump(todo, open(os.path.join(P, "web_todo.json"), "w"), ensure_ascii=False, indent=1)
    st = collections.OrderedDict()
    for lv in order:
        rs = [r for r in rows if r["level"] == lv]
        st[lv] = {"rows": len(rs), "email": sum(1 for r in rs if r["email"]),
                  "principal": sum(1 for r in rs if r["principal"]),
                  "web_email": sum(1 for r in rs if "WEB" in r["source"])}
    st["unmatched"] = dict(unmatched)
    st["web_todo"] = len(todo)
    json.dump(st, open(os.path.join(P, "stats.json"), "w"), ensure_ascii=False, indent=1)
    print(json.dumps(st, ensure_ascii=False))


if __name__ == "__main__":
    main()
