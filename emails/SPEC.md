# School outreach pipeline: spec

Shared contract for everyone building `emails/`. Read fully before starting.

## Goal

Email every Hong Kong school (kindergarten, primary, secondary, special) about Intelligent Playground
智能運動場 from `anthonychan@antapp.ai` (Google Workspace). If a school does not reply, send an
AI-written follow-up on a new topic, twice a week, until the school replies, unsubscribes, bounces,
or has received **10 emails in total** (1 first email + up to 9 follow-ups). Then stop for that school.

Runs unattended on **another Mac** via macOS launchd ("cron job"). Claude CLI (`claude -p`) writes the
follow-ups and classifies replies. Replies get the Gmail label **`IP/已回覆`** in the antapp.ai inbox
so the team can answer by hand.

## User-facing commands (run from repo root; all scripts live in `emails/scripts/`)

| Command | Does |
|---|---|
| `./emails/scripts/setup.sh` | One-time setup on the pipeline Mac: check/install deps (Node ≥ 22, npm with **public registry**, Claude CLI logged in), Gmail OAuth login in browser (token saved locally), create Gmail label, init state DB, import schools, run a dry-run. Idempotent. |
| `./emails/scripts/start.sh` | Install + load the launchd job (`~/Library/LaunchAgents/com.antapp.ip-outreach.plist`). Default schedule: **Tue and Fri 10:00 Asia/Hong_Kong**, plus a daily 18:00 reply check. |
| `./emails/scripts/stops.sh` | Unload + remove the launchd job (name exactly `stops.sh`; also provide `stop.sh` as a symlink). |
| `./emails/scripts/status.sh` | Print status summary; regenerate `emails/state/report.html` (open it in a browser). |
| `./emails/scripts/run.sh [--dry-run] [--check-only]` | What launchd calls. Can be run by hand. |

## Layout

```
emails/
  SPEC.md                 this file
  README.md               user guide (Traditional Chinese): Google Cloud OAuth client steps, setup, start/stop, status, safety
  scripts/                all runnable scripts: setup.sh start.sh stops.sh stop.sh status.sh run.sh,
                          data build scripts (scripts/data/), preview-sequence.py
  config.json             schedule, caps, sender, test mode (committed, no secrets)
  data/schools.csv        all schools (committed; public info only)
  content/                written by the content team (committed)
    facts.md              verified fact sheet: the ONLY facts AI may use
    signature.md          signature + icon + unsubscribe + address + NOTICE (appended by code, never by AI)
    templates/first-KG.md first-PRI.md first-SEC.md first-SPE.md
    topics.json           follow-up topic bank
    prompts/followup.md   prompt template for follow-up generation
    prompts/classify.md   prompt template for reply classification
  pipeline/               Node code (ESM JavaScript, no TypeScript build step)
  secrets/                gitignored: client_secret.json, token.json
  state/                  gitignored: outreach.db (SQLite), logs/, report.html, run.lock
```

## Data: `data/schools.csv`

UTF-8 with header. Columns:
`id,level,name_zh,name_en,district,address,email,website,phone,principal,source,notes`

- `id`: stable unique id (EDB school number + session if available, else a slug).
- `level`: one of `KG`, `PRI`, `SEC`, `SPE`.
- `email`: general school email; empty if not found (pipeline skips rows without email).
- `principal`: optional (e.g. 陳大文); used for greeting 「陳校長」 if present, else 「校長」.
- One row per school (merge AM/PM/whole-day sessions of the same school).

## Content formats

**Templates** (`templates/first-*.md`, and AI follow-up output): same markup as `emails/school-outreach.md`:
- line 1 `主旨：<subject>`; then blank line; then body.
- `**bold**` for key info. Plain text otherwise. Bullets with `• `.
- Placeholders: `{{recipient_name}}` (e.g. 陳校長 / 校長), `{{school_name}}`.
- Body ends with `Best Regards` only. **No signature, footer, unsubscribe or NOTICE**: the pipeline appends `content/signature.md`.

**`signature.md`**: exactly the signature, icon and footer block from `emails/school-outreach.md` (from `**Anthony Chan**` to the NOTICE), same markup incl. `![Ant-App](https://www.antapp.ai/img/ant_app_icon.png)`.

**`topics.json`**: `[{ "id": "mvpa60-deadline", "levels": ["PRI","SEC","SPE"], "title": "…", "angle": "what to say and why it matters to this school type", "facts": ["fact ids or short quotes from facts.md"], "cta": "…" }]`. At least 10 topics usable for each level. The pipeline picks the next unused topic for that school, in file order.

**`prompts/followup.md`**: template with `{{school_name}} {{recipient_name}} {{level}} {{topic_json}} {{facts}} {{history}} {{followup_number}}`. Claude must return **only JSON**: `{"subject": "...", "body": "..."}`, where `body` uses the template markup, has no signature or footer, and is at most about 180 Chinese characters plus up to 4 bullets.

**`prompts/classify.md`**: input `{{email_text}}` and `{{original_subject}}`. Output **only JSON**: `{"category": "interested|question|not_interested|unsubscribe|auto_reply|bounce|other", "summary": "<=40 字 Chinese", "stop": true|false}`. `auto_reply` (out-of-office) does **not** count as a reply. A bounce stops.

## Pipeline behaviour (`pipeline/`)

- **Gmail API** via the `googleapis` package, OAuth Desktop client (loopback redirect). Scopes: `gmail.send`, `gmail.modify`. Token in `secrets/token.json` (chmod 600).
- **State**: SQLite at `state/outreach.db`. Use built-in `node:sqlite` if available on the Node version in use, else `better-sqlite3`. Tables: `schools` (imported from CSV), `messages` (school_id, gmail_id, thread_id, rfc822_message_id, n, topic_id, subject, sent_at, dry_run), `replies` (school_id, gmail_id, thread_id, from, received_at, category, summary), `school_state` (school_id, status, emails_sent, last_sent_at, next_due_at, topics_used, stop_reason). Statuses: `pending`, `active`, `replied`, `unsubscribed`, `bounced`, `no_response` (cap reached), `skipped_no_email`, `skipped_flagged` (notes say 免費郵箱 / 可能為個人電郵 / 校長郵箱: possibly a personal mailbox under PDPO; not emailed unless `config.includeFlaggedContacts` is true), `error` (also used to hold a school whose reply could not be classified).
- **Run order** (`scripts/run.sh`): acquire lock → check replies → send due emails → write report → release lock. Log everything to `state/logs/YYYY-MM-DD.log`.
- **Reply detection**: for each active school, look at its threads (stored thread ids) and also search `from:(@<school email domain>) newer_than:30d` (skip generic domains such as gmail.com and yahoo.com.hk) to catch replies sent from a teacher's own address or as a new thread. Classify each new inbound message with Claude (`prompts/classify.md`). Treat Gmail bounces (mailer-daemon / delivery status) as `bounce`. Any human reply (`interested`, `question`, `not_interested`, `other`) → status `replied`, stop, add Gmail label `IP/已回覆` (create if missing) to the thread. `unsubscribe` → status `unsubscribed`, never email again (also add label `IP/取消訂閱`).
- **Sending**: a school is due if status is `pending`/`active`, it has an email, `emails_sent < maxEmailsPerSchool` (10), and the last email was ≥ `minDaysBetween` (3) days ago. First email = `templates/first-<level>.md`. Follow-ups = Claude via `prompts/followup.md` with the next topic, sent **as a reply in the same thread** (`threadId` + `In-Reply-To`/`References` headers, subject `Re: <original>`). Fill placeholders. Append `signature.md`. Convert markup → HTML (`**bold**` → `<b>`, image line → `<img>`, lines after image → small grey, same as `_build/mailer/send.mjs`) and send as `multipart/alternative` (text/plain + text/html).
- **Validation before every send** (refuse and mark `error` if it fails): no `{{`, no `**` left unbalanced, contains no tech or vendor names (Google, ML Kit, MediaPipe, RK3588, Android, Flutter, Strapi), length limits, the subject is not empty, AI body contains no signature or NOTICE (the code adds them).
- **Limits** in `config.json`: `maxPerRun` (default 150), `maxPerDay` (default 400; Workspace limit is 2,000), random delay `delaySeconds: [20, 60]` between sends, `maxEmailsPerSchool: 10`, `minDaysBetween: 3`. New schools are started gradually: each run first sends follow-ups that are due, then fills the remaining `maxPerRun` with first emails (order: PRI, SEC, SPE, KG; then by district).
- **Modes**: `--dry-run` (no Gmail sends or label changes; write the would-be emails to `state/outbox/`), `config.testRecipient` (if set, every email goes to that address instead of the school, and the subject is prefixed with 【測試】). `config.enabled=false` makes `run.sh` exit early (kill switch).
- **Claude CLI**: call `claude -p` non-interactively with JSON output and **no tools** (pure text generation). Detect the right flags from `claude --help` on this machine. Time out after 120s, retry once, then mark `error` for that school and continue. Never let Claude send email or run commands; the Node code does all I/O.
- **Errors**: one school's failure must not stop the run. Gmail auth failure stops the run with a clear log message. Respect Gmail API rate limits (exponential backoff on 429/5xx).

## Status tracking

- `status.sh` prints counts by status and level, today's sends, new replies since the last run (with category + summary), errors, and the next scheduled run.
- `state/report.html`: a self-contained page (no external scripts) with the same summary, a filterable school table (name, level, district, status, emails sent, last sent, reply category or summary) and the run history. Regenerated after each run and by `status.sh`.

## Compliance and safety (must hold)

- Every email carries the unsubscribe line, sender identity and address (from `signature.md`).
- An unsubscribe stops all future emails to that school permanently, even after a re-import.
- Facts only from `facts.md`. Do not claim these unverified website features in automated emails: badges/rewards, social-media sharing, team challenges, parent SMS subscription.
- Never commit `secrets/` or `state/`.
- npm must use `https://registry.npmjs.org/` (`emails/pipeline/.npmrc`), with exact pinned versions at least 2 weeks old.
