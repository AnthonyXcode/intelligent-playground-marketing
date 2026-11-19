// Status summary (text) and self-contained state/report.html.
import fs from "node:fs";
import { localDate, zonedParts, WEEKDAYS, addDaysDate } from "./time.mjs";
import { STATUSES, LEVELS } from "./db.mjs";
import { visitStats } from "./tracking.mjs";

/** Next scheduled run (HK time) from config.schedule. */
export const STATUS_LABEL = {
  pending: "未寄出", active: "跟進中", replied: "已回覆", unsubscribed: "取消訂閱", bounced: "退回",
  no_response: "已達上限", skipped_no_email: "沒有電郵", skipped_flagged: "略過（個人／免費郵箱）", error: "錯誤",
};
const lbl = (s) => `${s}（${STATUS_LABEL[s] || s}）`;

export function nextScheduled(cfg, now = new Date()) {
  const tz = cfg.timezone;
  const p = zonedParts(now, tz);
  const mins = (s) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };
  const cur = p.hour * 60 + p.minute;
  for (let d = 0; d < 8; d++) {
    const date = addDaysDate(p.date, d);
    const wd = WEEKDAYS[(p.weekdayIndex + d) % 7];
    const slots = [];
    if (cfg.schedule.sendDays.includes(wd)) slots.push([mins(cfg.schedule.sendTime), "send"]);
    slots.push([mins(cfg.schedule.checkTime), "check-only"]);
    for (const [t, kind] of slots.sort((a, b) => a[0] - b[0])) {
      if (d === 0 && t <= cur) continue;
      return { when: `${date} (${wd}) ${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")} ${tz}`, kind };
    }
  }
  return null;
}

export function buildSummary(ctx) {
  const { db, cfg } = ctx;
  const now = ctx.now();
  const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  const byLevel = {};
  for (const lv of LEVELS) byLevel[lv] = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const r of db.prepare("SELECT s.level, st.status, COUNT(*) c FROM schools s JOIN school_state st ON st.school_id = s.id GROUP BY 1,2").all()) {
    byStatus[r.status] = (byStatus[r.status] || 0) + r.c;
    if (byLevel[r.level]) byLevel[r.level][r.status] = r.c;
  }
  const today = localDate(now, cfg.timezone);
  const sentToday = db.prepare("SELECT sent_at FROM messages WHERE dry_run = 0").all().filter((m) => localDate(new Date(m.sent_at), cfg.timezone) === today).length;
  const totalSent = db.prepare("SELECT COUNT(*) c FROM messages WHERE dry_run = 0").get().c;
  const runs = db.prepare("SELECT * FROM runs ORDER BY id DESC LIMIT 50").all();
  const lastFinished = runs.find((r) => r.finished_at);
  const prev = runs.filter((r) => r.finished_at)[1];
  const since = prev?.started_at || "1970-01-01";
  const newReplies = db.prepare(`SELECT r.*, s.name_zh, s.name_en FROM replies r LEFT JOIN schools s ON s.id = r.school_id WHERE r.detected_at >= ? ORDER BY r.detected_at DESC LIMIT 100`).all(since);
  const newVisits = db.prepare(`SELECT v.*, s.name_zh, s.name_en, s.level FROM visits v LEFT JOIN schools s ON s.id = v.school_id
    WHERE v.counted = 1 AND v.pulled_at >= ? ORDER BY v.ts DESC LIMIT 200`).all(since);
  const visitedSchools = db.prepare("SELECT COUNT(DISTINCT school_id) c FROM visits WHERE counted = 1 AND school_id IS NOT NULL").get().c;
  const errors = db.prepare(`SELECT s.id, s.name_zh, s.level, st.stop_reason, st.updated_at FROM school_state st JOIN schools s ON s.id = st.school_id WHERE st.status = 'error' ORDER BY st.updated_at DESC LIMIT 100`).all();
  return {
    generatedAt: now.toISOString(), enabled: cfg.enabled !== false, testRecipient: cfg.testRecipient || "",
    total: Object.values(byStatus).reduce((a, b) => a + b, 0), byStatus, byLevel, sentToday, totalSent,
    lastRun: lastFinished || null, newReplies, newVisits, visitedSchools, errors, runs, next: nextScheduled(cfg, now),
  };
}

export function renderText(s) {
  const L = [];
  L.push(`Intelligent Playground 電郵推廣狀態  (${s.generatedAt})`);
  if (!s.enabled) L.push("!! config.enabled = false：已停用（kill switch）");
  if (s.testRecipient) L.push(`!! 測試模式：所有電郵寄往 ${s.testRecipient}`);
  L.push(`學校總數 ${s.total}；累計已寄 ${s.totalSent} 封；今日已寄 ${s.sentToday} 封`);
  L.push("", "按狀態：");
  for (const [k, v] of Object.entries(s.byStatus)) if (v) L.push(`  ${lbl(k).padEnd(22)} ${v}`);
  L.push("", "按級別：  " + ["pending", "active", "replied", "unsubscribed", "bounced", "no_response", "error"].map((x) => x.slice(0, 8).padStart(9)).join(""));
  for (const [lv, c] of Object.entries(s.byLevel)) L.push(`  ${lv.padEnd(7)} ` + ["pending", "active", "replied", "unsubscribed", "bounced", "no_response", "error"].map((x) => String(c[x] || 0).padStart(9)).join(""));
  L.push("", `上次執行：${s.lastRun ? `${s.lastRun.started_at} ${s.lastRun.mode} ${s.lastRun.status}（寄出 ${s.lastRun.sent}，新回覆 ${s.lastRun.replies}，錯誤 ${s.lastRun.errors}）` : "未執行"}`);
  L.push(`下次排程：${s.next ? `${s.next.when}（${s.next.kind}）` : "-"}`);
  L.push("", `上次執行以來的新回覆（${s.newReplies.length}）：`);
  for (const r of s.newReplies.slice(0, 30)) L.push(`  [${r.category}] ${r.name_zh || r.name_en || r.school_id}：${r.summary}`);
  L.push("", `曾瀏覽網站的學校：${s.visitedSchools}；上次執行以來的新瀏覽（${s.newVisits.length}）：`);
  for (const v of s.newVisits.slice(0, 30)) L.push(`  [${v.event === "contact" ? "按預約示範" : "瀏覽"}] ${v.name_zh || v.name_en || v.school_id}（${v.level || ""}）${v.ts}`);
  L.push("", `錯誤學校（${s.errors.length}）：`);
  for (const e of s.errors.slice(0, 30)) L.push(`  ${e.id} ${e.name_zh || ""}：${(e.stop_reason || "").slice(0, 120)}`);
  return L.join("\n");
}

const esc = (t) => String(t ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function renderHtml(ctx, s) {
  const schoolRows = ctx.db.prepare(`SELECT s.id, s.name_zh, s.name_en, s.level, s.district, s.email, st.status, st.emails_sent, st.last_sent_at, st.stop_reason,
      (SELECT category || '：' || IFNULL(summary,'') FROM replies r WHERE r.school_id = s.id AND r.category <> 'auto_reply' ORDER BY r.id DESC LIMIT 1) reply
    FROM schools s JOIN school_state st ON st.school_id = s.id ORDER BY s.level, s.district, s.id`).all();
  const vs = visitStats(ctx.db);
  const visitCell = (id) => {
    const v = vs.get(id);
    if (!v) return "";
    return `${v.visits} 次${v.contacts ? `，按預約 ${v.contacts} 次` : ""}（最近 ${localDate(new Date(v.last_ts), ctx.cfg.timezone)}）`;
  };
  const rows = schoolRows.map((r) => [r.id, r.name_zh || r.name_en, r.level, r.district, r.status, r.emails_sent, r.last_sent_at ? localDate(new Date(r.last_sent_at), ctx.cfg.timezone) : "", visitCell(r.id), r.reply || (r.status === "error" ? r.stop_reason : "") || ""]);
  const data = JSON.stringify(rows).replace(/</g, "\\u003c");
  const card = (k, v) => `<div class="card"><div class="v">${esc(v)}</div><div class="k">${esc(k)}</div></div>`;
  return `<!DOCTYPE html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>電郵推廣狀態</title><style>
:root{--bg:#fff;--fg:#1d1d1f;--mut:#666;--line:#e3e3e3;--card:#f6f6f7;--acc:#0a7d52}
@media (prefers-color-scheme:dark){:root{--bg:#161618;--fg:#eee;--mut:#9a9a9a;--line:#333;--card:#222226;--acc:#4cc38a}}
body{background:var(--bg);color:var(--fg);font:14px/1.5 -apple-system,"PingFang HK","Microsoft JhengHei",sans-serif;margin:0;padding:16px;max-width:1200px;margin:auto}
h1{font-size:20px}h2{font-size:16px;margin-top:28px}.mut{color:var(--mut)}
.cards{display:flex;flex-wrap:wrap;gap:8px}.card{background:var(--card);border-radius:8px;padding:10px 14px;min-width:96px}.card .v{font-size:20px;font-weight:600}.card .k{color:var(--mut);font-size:12px}
.warn{background:#fff3cd;color:#664d03;padding:8px 12px;border-radius:6px;margin:8px 0}
table{border-collapse:collapse;width:100%}th,td{border-bottom:1px solid var(--line);padding:5px 6px;text-align:left;vertical-align:top}th{cursor:pointer;user-select:none;position:sticky;top:0;background:var(--bg)}
.tw{overflow-x:auto}input,select{font:inherit;padding:4px 6px;background:var(--bg);color:var(--fg);border:1px solid var(--line);border-radius:4px}
.f{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}.st{font-size:12px;padding:1px 6px;border-radius:9px;background:var(--card)}
</style></head><body>
<h1>Intelligent Playground 電郵推廣狀態</h1>
<div class="mut">更新時間 ${esc(s.generatedAt)} · 下次排程 ${esc(s.next ? `${s.next.when}（${s.next.kind}）` : "-")}</div>
${s.enabled ? "" : '<div class="warn">config.enabled = false：已停用（kill switch）</div>'}
${s.testRecipient ? `<div class="warn">測試模式：所有電郵寄往 ${esc(s.testRecipient)}</div>` : ""}
<h2>摘要</h2><div class="cards">${card("學校", s.total)}${card("累計寄出", s.totalSent)}${card("今日寄出", s.sentToday)}${card("曾瀏覽網站", s.visitedSchools)}${Object.entries(s.byStatus).filter(([, v]) => v).map(([k, v]) => card(lbl(k), v)).join("")}</div>
<h2>按級別</h2><div class="tw"><table><tr><th>級別</th>${Object.keys(s.byStatus).map((k) => `<th>${esc(lbl(k))}</th>`).join("")}</tr>
${Object.entries(s.byLevel).map(([lv, c]) => `<tr><td>${lv}</td>${Object.keys(s.byStatus).map((k) => `<td>${c[k] || 0}</td>`).join("")}</tr>`).join("")}</table></div>
<h2>上次執行以來的新回覆（${s.newReplies.length}）</h2>
<div class="tw"><table><tr><th>學校</th><th>類別</th><th>摘要</th><th>時間</th></tr>${s.newReplies.map((r) => `<tr><td>${esc(r.name_zh || r.name_en || r.school_id)}</td><td>${esc(r.category)}</td><td>${esc(r.summary)}</td><td>${esc(r.received_at)}</td></tr>`).join("") || '<tr><td colspan="4" class="mut">沒有</td></tr>'}</table></div>
<h2>上次執行以來的網站瀏覽（${s.newVisits.length}）</h2>
<div class="mut">按電郵連結的參考編號計算；寄出後 ${esc(ctx.cfg.tracking?.ignoreSecondsAfterSend ?? 120)} 秒內的瀏覽（多為郵件保安掃描）不計。轉寄後由其他老師打開亦會計入同一間學校。</div>
<div class="tw"><table><tr><th>學校</th><th>級別</th><th>動作</th><th>裝置</th><th>時間</th></tr>${s.newVisits.map((v) => `<tr><td>${esc(v.name_zh || v.name_en || v.school_id)}</td><td>${esc(v.level)}</td><td>${v.event === "contact" ? "按預約示範" : "瀏覽"}</td><td>${esc(v.device)}</td><td>${esc(v.ts)}</td></tr>`).join("") || '<tr><td colspan="5" class="mut">沒有</td></tr>'}</table></div>
<h2>學校</h2>
<div class="f"><input id="q" placeholder="搜尋名稱／地區／回覆" size="28"><select id="lv"><option value="">全部級別</option>${LEVELS.map((l) => `<option>${l}</option>`).join("")}</select>
<select id="stt"><option value="">全部狀態</option>${STATUSES.map((x) => `<option value="${x}">${esc(lbl(x))}</option>`).join("")}</select><label><input type="checkbox" id="vis"> 只看曾瀏覽網站</label><span id="cnt" class="mut"></span></div>
<div class="tw"><table id="t"><thead><tr><th>ID</th><th>學校</th><th>級別</th><th>地區</th><th>狀態</th><th>已寄</th><th>最後寄出</th><th>瀏覽網站</th><th>回覆／錯誤</th></tr></thead><tbody></tbody></table></div>
<h2>執行紀錄</h2>
<div class="tw"><table><tr><th>開始</th><th>結束</th><th>模式</th><th>寄出</th><th>回覆</th><th>錯誤</th><th>結果</th><th>備註</th></tr>
${s.runs.map((r) => `<tr><td>${esc(r.started_at)}</td><td>${esc(r.finished_at || "")}</td><td>${esc(r.mode)}</td><td>${r.sent}</td><td>${r.replies}</td><td>${r.errors}</td><td>${esc(r.status || "")}</td><td>${esc(r.note || "")}</td></tr>`).join("") || '<tr><td colspan="8" class="mut">沒有</td></tr>'}</table></div>
<script>
const D=${data};let sk=-1,sd=1;const tb=document.querySelector("#t tbody");
const e=t=>String(t??"").replace(/&/g,"&amp;").replace(/</g,"&lt;");
function draw(){const q=document.getElementById("q").value.toLowerCase(),lv=document.getElementById("lv").value,st=document.getElementById("stt").value,vi=document.getElementById("vis").checked;
let r=D.filter(x=>(!lv||x[2]===lv)&&(!st||x[4]===st)&&(!vi||x[7])&&(!q||x.join(" ").toLowerCase().includes(q)));
if(sk>=0)r=r.slice().sort((a,b)=>(typeof a[sk]==="number"?a[sk]-b[sk]:String(a[sk]).localeCompare(String(b[sk]),"zh-Hant"))*sd);
document.getElementById("cnt").textContent=r.length+" / "+D.length;
tb.innerHTML=r.slice(0,3000).map(x=>"<tr>"+x.map((c,i)=>"<td>"+(i===4?'<span class="st">'+e(c)+"</span>":e(c))+"</td>").join("")+"</tr>").join("");}
document.querySelectorAll("#t th").forEach((th,i)=>th.onclick=()=>{sd=sk===i?-sd:1;sk=i;draw();});
["q","lv","stt","vis"].forEach(id=>document.getElementById(id).addEventListener("input",draw));draw();
</script></body></html>`;
}

export function writeReport(ctx) {
  const s = buildSummary(ctx);
  fs.mkdirSync(ctx.paths.state, { recursive: true });
  fs.writeFileSync(ctx.paths.report, renderHtml(ctx, s));
  return s;
}
