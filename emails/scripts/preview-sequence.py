"""Dry-run preview: first email + 9 AI follow-ups for one sample school. Sends nothing.

Usage:
  python3 emails/scripts/preview-sequence.py [content_dir] [output.md] [LEVEL]
Defaults: emails/content, emails/content/prompts/examples/dryrun-<LEVEL>-10-emails.md, PRI.
LEVEL is one of KG, PRI, SEC, SPE. Needs the Claude CLI (`claude`) logged in.
"""
import json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
CONTENT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", "content")
LEVEL = sys.argv[3] if len(sys.argv) > 3 else "PRI"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(CONTENT, "prompts", "examples", f"dryrun-{LEVEL}-10-emails.md")
SCHOOL = {"KG": "示例幼稚園", "PRI": "示例小學", "SEC": "示例中學", "SPE": "示例學校"}[LEVEL]
NAME = "陳校長"

def read(p):
    return open(f"{CONTENT}/{p}", encoding="utf-8").read()

def fill(t, d):
    for k, v in d.items():
        t = t.replace("{{" + k + "}}", v)
    return t

topics = [t for t in json.loads(read("topics.json")) if LEVEL in t["levels"]]
regular = [t for t in topics if not t.get("final")]
final = next(t for t in topics if t.get("final"))
facts = "\n".join(l for l in read("facts.md").splitlines() if re.search(rf"\[[A-Z,]*{LEVEL}[A-Z,]*\]", l))
signature = read("signature.md").strip()
prompt_t = read("prompts/followup.md")

first = fill(read(f"templates/first-{LEVEL}.md"), {"recipient_name": NAME, "school_name": SCHOOL}).strip()
first_subject = first.splitlines()[0].replace("主旨：", "").strip()
emails = [{"n": 1, "topic": "首次介紹", "subject": first_subject, "body": "\n".join(first.splitlines()[2:]).strip()}]

def ask(prompt):
    r = subprocess.run(["claude", "-p", "--output-format", "json", "--tools", "", "--strict-mcp-config", "--no-session-persistence", "--setting-sources="],
                       input=prompt, capture_output=True, text=True, timeout=180)
    res = json.loads(r.stdout)["result"].strip()
    res = re.sub(r"^```(?:json)?\s*|\s*```$", "", res)
    return json.loads(res)

for n in range(1, 10):
    topic = final if n == 9 else regular[n - 1]
    history = "\n\n".join(f"第 {e['n']} 封（主題：{e['topic']}）\n主旨：{e['subject']}\n{e['body']}" for e in emails)
    p = fill(prompt_t, {"school_name": SCHOOL, "recipient_name": NAME, "level": LEVEL, "followup_number": str(n),
                        "topic_json": json.dumps(topic, ensure_ascii=False, indent=1), "facts": facts, "history": history})
    for attempt in (1, 2):
        try:
            d = ask(p); break
        except Exception as e:
            if attempt == 2: raise
    emails.append({"n": n + 1, "topic": topic["title"], "subject": d["subject"], "body": d["body"].strip()})
    print(f"#{n+1} done: {topic['id']}", flush=True)

with open(OUT, "w", encoding="utf-8") as f:
    f.write(f"# 試行（dry run）：{SCHOOL}（{LEVEL}）10 封電郵\n\n")
    f.write("> 沒有寄出任何電郵。第 2–10 封由 AI 按主題即時撰寫，實際寄出時字眼會不同。跟進電郵以「Re: 原主旨」在同一個電郵串寄出。每封結尾都會自動加上簽名、公司圖示、取消訂閱說明及 NOTICE（只在第 1 封完整列出）。\n\n")
    for e in emails:
        days = (e["n"] - 1) * 3.5
        f.write(f"---\n\n## 第 {e['n']} 封：{e['topic']}\n\n")
        f.write(f"約第 {days:g} 天｜主旨：{'Re: ' + first_subject if e['n'] > 1 else first_subject}" + (f"（AI 建議主旨：{e['subject']}）" if e["n"] > 1 else "") + "\n\n")
        f.write(e["body"] + "\n\n")
        if e["n"] == 1:
            f.write(signature + "\n\n")
print("wrote", OUT)
