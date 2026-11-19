// Build: node build.js  -> ../../IntelligentPlayground_智能運動場.pptx
const path = require("path");
const fs = require("fs");
const pptxgen = require("pptxgenjs");
const sharp = require("sharp");
const React = require("react");
const RDS = require("react-dom/server");
const Fa = require("react-icons/fa6");
const { applyTheme } = require("./apply_theme.js");

const ROOT = path.resolve(__dirname, "../..");
const A = (f) => path.join(ROOT, "assets", f);
const IMG = path.join(__dirname, "img");
fs.mkdirSync(IMG, { recursive: true });
const OUT = path.join(ROOT, "IntelligentPlayground_智能運動場.pptx");

// ---------- palette ----------
const TEAL = "0B6374", TEAL2 = "0D687A", MINT = "8DD8D3", AMBER = "F9A825", CORAL = "FD5B58", BLUE = "0064C6";
const INK = "17323A", MUTED = "5B7279", TINT = "EAF6F5", LINE = "D5E6E8", WHITE = "FFFFFF", DEEP = "08485A";
const FONT = "Microsoft JhengHei";

const THEME = {
  name: "Intelligent Playground",
  headFontFace: FONT, bodyFontFace: FONT,
  colors: { dk1: INK, lt1: WHITE, dk2: TEAL, lt2: TINT, accent1: TEAL2, accent2: MINT, accent3: AMBER, accent4: CORAL, accent5: BLUE, accent6: "599191", hlink: BLUE, folHlink: "27278B" },
};

// ---------- asset helpers ----------
const PX = 200; // px per inch for prepared images
async function photo(name, file, w, h, { r = 0.18, pos = "centre", extract } = {}) {
  const out = path.join(IMG, name + ".png");
  const W = Math.round(w * PX), H = Math.round(h * PX), R = Math.round(r * PX);
  let img = sharp(A(file));
  if (extract) img = img.extract(extract);
  const buf = await img.resize(W, H, { fit: "cover", position: pos }).toBuffer();
  const mask = Buffer.from(`<svg width="${W}" height="${H}"><rect width="${W}" height="${H}" rx="${R}" ry="${R}" fill="#fff"/></svg>`);
  await sharp(buf).composite([{ input: mask, blend: "dest-in" }]).png().toFile(out);
  return out;
}
async function icon(name, color = "#FFFFFF") {
  const out = path.join(IMG, `ic-${name}-${color.replace("#", "")}.png`);
  const svg = RDS.renderToStaticMarkup(React.createElement(Fa[name], { size: 256, color }));
  await sharp(Buffer.from(svg)).resize(256, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(out);
  return out;
}
// white exercise glyph from assets/icons (optionally cropped)
async function glyph(file, extract) {
  const out = path.join(IMG, "g-" + file.replace(/\.png$/, "") + (extract ? "-crop" : "") + ".png");
  let img = sharp(A("icons/" + file));
  if (extract) img = img.extract(extract);
  await img.resize(256, 256, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(out);
  return out;
}

(async () => {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
  pres.theme = { headFontFace: FONT, bodyFontFace: FONT };
  pres.title = "Intelligent Playground 智能運動場";
  pres.author = "Intelligent Playground";

  // ---------- layouts ----------
  const footer = [
    { text: { text: "Intelligent Playground 智能運動場", options: { x: 0.6, y: 7.0, w: 5, h: 0.3, fontFace: FONT, fontSize: 10, color: "8AA3A8", margin: 0 } } },
  ];
  pres.defineSlideMaster({
    title: "CONTENT",
    background: { color: WHITE },
    objects: [
      ...footer,
      { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.45, w: 12.13, h: 0.75, fontFace: FONT, fontSize: 34, bold: true, color: INK, valign: "middle", align: "left", margin: 0 }, text: "" } },
      { placeholder: { options: { name: "sub", type: "body", x: 0.6, y: 1.22, w: 12.13, h: 0.45, fontFace: FONT, fontSize: 16, color: TEAL, valign: "middle", margin: 0 }, text: "" } },
    ],
    slideNumber: { x: 12.23, y: 7.0, w: 0.5, h: 0.3, fontFace: FONT, fontSize: 10, color: "8AA3A8", align: "right" },
  });
  pres.defineSlideMaster({ title: "DARK", background: { color: TEAL }, objects: [] });

  // ---------- slide helpers ----------
  const T = (s, text, o) => s.addText(text, { fontFace: FONT, margin: 0, isTextBox: true, color: INK, valign: "top", ...o });
  const box = (s, x, y, w, h, fill, o = {}) => s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, fill: { color: fill }, line: { color: fill, width: 0 }, rectRadius: 0.12, ...o });
  const circle = (s, x, y, d, fill) => s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill, width: 0 } });
  const iconDot = async (s, name, x, y, d, fill, color = "#FFFFFF") => {
    circle(s, x, y, d, fill);
    const pad = d * 0.26;
    s.addImage({ path: await icon(name, color), x: x + pad, y: y + pad, w: d - 2 * pad, h: d - 2 * pad });
  };
  const shadow = () => ({ type: "outer", color: "0B3A44", blur: 8, offset: 2, angle: 90, opacity: 0.18 });
  const content = (title, sub, section) => {
    const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: section });
    s.addText(title, { placeholder: "title", fontFace: FONT, align: "left" });
    if (sub) s.addText(sub, { placeholder: "sub", fontFace: FONT, align: "left" });
    return s;
  };

  // =====================================================================
  // 1 — Cover
  pres.addSection({ title: "開場" });
  {
    const s = pres.addSlide({ masterName: "DARK", sectionTitle: "開場" });
    circle(s, 8.9, -1.4, 5.6, "0E7385");
    s.addImage({ path: await photo("cover", "student-raise-hand-outdoor.jpg", 4.5, 6.1, { r: 0.3, pos: "centre" }), x: 7.95, y: 0.7, w: 4.5, h: 6.1 });
    s.addImage({ path: await photo("mascot-c", "mascot-app-icon.png", 1.0, 1.0, { r: 0.22 }), x: 0.8, y: 0.8, w: 1.0, h: 1.0 });
    T(s, "AI 運動站 ＋ 教師數據後台｜為學校及康樂中心而設", { x: 0.8, y: 2.05, w: 6.8, h: 0.4, fontSize: 16, color: MINT });
    T(s, "Intelligent Playground", { x: 0.8, y: 2.55, w: 6.9, h: 0.8, fontSize: 40, bold: true, color: WHITE, fontFace: FONT });
    T(s, "智能運動場", { x: 0.8, y: 3.35, w: 6.9, h: 1.0, fontSize: 54, bold: true, color: MINT });
    T(s, "將運動變成有趣的學習體驗", { x: 0.8, y: 4.75, w: 6.9, h: 0.55, fontSize: 24, bold: true, color: AMBER });
    T(s, "Turning exercise into a fun learning experience. AI-powered exercise kiosk for schools and leisure centres.", { x: 0.8, y: 5.4, w: 6.6, h: 0.7, fontSize: 14, italic: true, color: "CFE9E7" });
    T(s, "Ant-App Limited", { x: 0.8, y: 6.55, w: 4, h: 0.35, fontSize: 12, bold: true, color: MINT });
    s.addNotes("今天介紹的是一部放在學校及康樂中心的 AI 運動站，目標是將運動變成有趣的學習體驗，幫助學生每日郁足 60 分鐘。系統會自動計數及記錄。我們會用十分鐘說明它怎樣幫學校提升學生的活動量，以及可以用哪些資助購買。");
  }

  // 2 — Activity gap
  pres.addSection({ title: "挑戰與政策" });
  {
    const s = content("每天 60 分鐘，學生做到嗎？", "WHO 建議 5–17 歲每天平均累積最少 60 分鐘中等至劇烈強度體能活動（MVPA60）", "挑戰與政策");
    box(s, 0.6, 2.05, 4.4, 4.65, TEAL, { rectRadius: 0.25 });
    T(s, "60", { x: 0.95, y: 2.35, w: 3.8, h: 2.0, fontSize: 130, bold: true, color: AMBER, valign: "middle" });
    T(s, "分鐘／每天", { x: 0.95, y: 4.4, w: 3.8, h: 0.6, fontSize: 28, bold: true, color: WHITE });
    T(s, "中等至劇烈強度體能活動\nMVPA60 目標", { x: 0.95, y: 5.2, w: 3.8, h: 1.1, fontSize: 15, color: MINT });
    const pains = [
      ["FaClock", "體育課時有限", "單靠體育課難以達標"],
      ["FaChair", "小息、午飯多數靜坐", "課餘時間未被善用"],
      ["FaChalkboardUser", "老師難以逐一督導", "人手有限，難以看顧"],
      ["FaChartColumn", "活動量欠缺數據記錄", "難以追蹤及檢討成效"],
    ];
    for (let i = 0; i < 4; i++) {
      const x = 5.4 + (i % 2) * 3.8, y = 2.05 + Math.floor(i / 2) * 2.4;
      box(s, x, y, 3.53, 2.25, TINT, { rectRadius: 0.2 });
      await iconDot(s, pains[i][0], x + 0.35, y + 0.35, 0.75, i === 3 ? CORAL : TEAL2);
      T(s, pains[i][1], { x: x + 0.35, y: y + 1.25, w: 3.0, h: 0.45, fontSize: 18, bold: true });
      T(s, pains[i][2], { x: x + 0.35, y: y + 1.7, w: 3.0, h: 0.4, fontSize: 14, color: MUTED });
    }
    s.addNotes("教育局推動 MVPA60，目標是學生每天累積最少 60 分鐘中等至劇烈強度的體能活動。單靠體育課並不足夠，學校需要善用小息和課餘時間。難處在於老師未必有人手督導，也沒有數據追蹤。");
  }

  // 3 — Policy
  {
    const s = content("體育，正式計分", "中學學位分配「校內成績評估」優化安排", "挑戰與政策");
    box(s, 0.6, 2.05, 7.2, 4.65, TINT, { rectRadius: 0.25 });
    T(s, "體育科在「校內成績評估」的比重", { x: 1.0, y: 2.4, w: 6.4, h: 0.45, fontSize: 18, bold: true, color: TEAL });
    // 0 card
    box(s, 1.0, 3.1, 2.5, 2.1, WHITE, { rectRadius: 0.2, shadow: shadow() });
    T(s, "現行", { x: 1.0, y: 3.25, w: 2.5, h: 0.4, fontSize: 16, color: MUTED, align: "center" });
    T(s, "0", { x: 1.0, y: 3.6, w: 2.5, h: 1.4, fontSize: 80, bold: true, color: "9DB3B8", align: "center", valign: "middle" });
    s.addImage({ path: await icon("FaArrowRight", "#0B6374"), x: 3.85, y: 3.85, w: 0.6, h: 0.6 });
    box(s, 4.8, 3.1, 2.5, 2.1, AMBER, { rectRadius: 0.2, shadow: shadow() });
    T(s, "優化後", { x: 4.8, y: 3.25, w: 2.5, h: 0.4, fontSize: 16, color: INK, align: "center", bold: true });
    T(s, "2", { x: 4.8, y: 3.6, w: 2.5, h: 1.4, fontSize: 80, bold: true, color: INK, align: "center", valign: "middle" });
    box(s, 1.0, 5.6, 6.3, 0.7, TEAL, { rectRadius: 0.35 });
    await iconDot(s, "FaCalendarCheck", 1.12, 5.67, 0.56, TEAL, "#F9A825");
    T(s, "2026/27 學年 小五下學期起實施", { x: 1.8, y: 5.6, w: 5.3, h: 0.7, fontSize: 18, bold: true, color: WHITE, valign: "middle" });
    // right column
    T(s, "教育局重點推動", { x: 8.3, y: 2.1, w: 4.4, h: 0.45, fontSize: 18, bold: true, color: TEAL });
    const items = [
      ["FaPersonRunning", "「躍動校園 活力人生」", "鼓勵學生建立恆常運動習慣"],
      ["FaMedal", "MVPA60 獎勵計劃", "每天累積最少 60 分鐘 MVPA"],
    ];
    for (let i = 0; i < 2; i++) {
      const y = 2.75 + i * 1.95;
      box(s, 8.3, y, 4.43, 1.7, WHITE, { rectRadius: 0.2, line: { color: LINE, width: 1 } });
      await iconDot(s, items[i][0], 8.55, y + 0.45, 0.8, i ? AMBER : TEAL2);
      T(s, items[i][1], { x: 9.6, y: y + 0.35, w: 3.0, h: 0.5, fontSize: 18, bold: true });
      T(s, items[i][2], { x: 9.6, y: y + 0.9, w: 3.0, h: 0.5, fontSize: 14, color: MUTED });
    }
    s.addNotes("教育局已公布，小學生升中派位的校內成績評估會計算體育科，比重由 0 增至 2，2026/27 學年小五下學期開始實施。加上「躍動校園 活力人生」及 MVPA60 獎勵計劃，提升學生體能已經是學校的重點工作。");
  }

  // 4 — Solution
  pres.addSection({ title: "產品" });
  {
    const s = content("一部 AI 運動站，校園隨時郁", "Intelligent Playground ＝ AI 運動站 ＋ 教師數據後台", "產品");
    s.addImage({ path: await photo("sol", "kiosk-wall-mounted-menu.jpg", 6.3, 4.65, { r: 0.25 }), x: 0.6, y: 2.05, w: 6.3, h: 4.65 });
    // equation
    box(s, 7.4, 2.05, 2.35, 0.7, TEAL, { rectRadius: 0.35 });
    T(s, "AI 運動站", { x: 7.4, y: 2.05, w: 2.35, h: 0.7, fontSize: 18, bold: true, color: WHITE, align: "center", valign: "middle" });
    T(s, "＋", { x: 9.8, y: 2.05, w: 0.5, h: 0.7, fontSize: 24, bold: true, color: TEAL, align: "center", valign: "middle" });
    box(s, 10.35, 2.05, 2.38, 0.7, AMBER, { rectRadius: 0.35 });
    T(s, "教師數據後台", { x: 10.35, y: 2.05, w: 2.38, h: 0.7, fontSize: 18, bold: true, color: INK, align: "center", valign: "middle" });
    const pts = [
      ["FaDesktop", "大屏＋鏡頭，放走廊或操場"],
      ["FaRobot", "AI 即時計數及示範"],
      ["FaUsers", "單人練習／多人競賽"],
      ["FaChartLine", "成績自動記錄到後台"],
      ["FaHandPointUp", "毋須穿戴裝置或手機"],
    ];
    for (let i = 0; i < pts.length; i++) {
      const y = 3.15 + i * 0.73;
      await iconDot(s, pts[i][0], 7.4, y, 0.55, i === 4 ? AMBER : TEAL2);
      T(s, pts[i][1], { x: 8.2, y, w: 4.5, h: 0.55, fontSize: 18, valign: "middle" });
    }
    s.addNotes("智能運動場由兩部分組成：放在校園的 AI 運動站，以及給老師用的網上數據後台。學生不需要手機或手環，只要站在鏡頭前面就可以開始。");
  }

  // 5 — How it works
  {
    const s = content("三步開始", "Step in · Raise hand · Move", "產品");
    const steps = [
      ["kiosk-wall-mounted-join-screen.jpg", "站入框內", "鏡頭畫面上有站位框，站進去即可"],
      ["app-raise-hand-to-join.jpg", "加入", "按提示數秒即可加入，最多 3 人"],
      ["app-competition-timer.jpg", "跟示範做", "AI 即時數算次數，自動計分"],
    ];
    for (let i = 0; i < 3; i++) {
      const x = 0.6 + i * 4.165;
      box(s, x, 2.05, 3.8, 3.85, WHITE, { rectRadius: 0.18, line: { color: LINE, width: 1 }, shadow: shadow() });
      s.addImage({ path: await photo("st" + i, steps[i][0], 3.8, 1.95, { r: 0.18 }), x, y: 2.05, w: 3.8, h: 1.95 });
      circle(s, x + 0.3, 3.7, 0.65, AMBER);
      T(s, String(i + 1), { x: x + 0.3, y: 3.7, w: 0.65, h: 0.65, fontSize: 22, bold: true, align: "center", valign: "middle" });
      T(s, steps[i][1], { x: x + 0.3, y: 4.5, w: 3.2, h: 0.5, fontSize: 22, bold: true, color: TEAL });
      T(s, steps[i][2], { x: x + 0.3, y: 5.05, w: 3.2, h: 0.7, fontSize: 15, color: MUTED });
    }
    box(s, 0.6, 6.15, 12.13, 0.6, TINT, { rectRadius: 0.3 });
    s.addImage({ path: await icon("FaSquareCheck", "#0B6374"), x: 0.85, y: 6.28, w: 0.34, h: 0.34 });
    T(s, "完成後輸入年級、班別、學號，成績即時記錄到學校後台", { x: 1.35, y: 6.15, w: 11, h: 0.6, fontSize: 16, bold: true, color: TEAL, valign: "middle" });
    s.addNotes("學生站進畫面上的框，舉手就會加入，最多三人可以同場比賽。運動時 AI 即時數算次數；完成後學生輸入年級、班別和學號，成績就會記錄到學校後台。");
  }

  // 6 — Exercises & modes
  {
    const s = content("12 個項目，3 種玩法", "體適能訓練＋遊戲化挑戰｜每個項目都有卡通示範動畫", "產品");
    // legend
    box(s, 10.05, 1.27, 0.28, 0.28, TEAL2, { rectRadius: 0.06 });
    T(s, "體適能", { x: 10.4, y: 1.22, w: 0.9, h: 0.4, fontSize: 13, color: MUTED, valign: "middle" });
    box(s, 11.4, 1.27, 0.28, 0.28, AMBER, { rectRadius: 0.06 });
    T(s, "遊戲化", { x: 11.75, y: 1.22, w: 0.95, h: 0.4, fontSize: 13, color: MUTED, valign: "middle" });
    const swim = await icon("FaPersonSwimming", "#FFFFFF");
    // plank: same line glyph as the web page (push-up icon was reused before)
    const plank = path.join(IMG, "g-plank.png");
    await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="256" height="256" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="51" cy="30" r="4.5"/><path d="M46 33 14 38"/><path d="M14 38l-3 4"/><path d="M40 34l1 9h5"/></svg>')).png().toFile(plank);
    const ex = [
      ["深蹲", "icon-squat.png"], ["俯臥撐", "icon-push-up.png"], ["仰臥起坐", "icon-sit-up.png"], ["平板支撐", "PLANK"],
      ["開合跳", "icon-jumping-jacks.png"], ["高抬腿", "icon-high-knees.png"], ["臀橋", "icon-glute-bridge.png"], ["仰臥抬腿", "icon-lying-leg-raise.png"],
      ["左右跳", "icon-left-right-jump.png"], ["百米飛人", "icon-run.png"], ["游泳健將", null], ["運球高手", "BALL"],
    ];
    const ball = await icon("FaBasketball", "#FFFFFF");
    for (let i = 0; i < ex.length; i++) {
      const col = i < 6 ? i : i - 6, row = i < 6 ? 0 : 1;
      const x = 0.6 + col * 2.065, y = 1.95 + row * 1.75;
      const game = i >= 9;
      box(s, x, y, 1.86, 1.55, game ? "FFF4DA" : TINT, { rectRadius: 0.18 });
      circle(s, x + 0.55, y + 0.17, 0.76, game ? AMBER : TEAL2);
      s.addImage({ path: ex[i][1] === "PLANK" ? plank : ex[i][1] === "BALL" ? ball : ex[i][1] ? await glyph(ex[i][1]) : swim, x: x + 0.66, y: y + 0.28, w: 0.54, h: 0.54 });
      T(s, ex[i][0], { x, y: y + 1.0, w: 1.86, h: 0.42, fontSize: 16, bold: true, align: "center", valign: "middle" });
      if (ex[i][1] === "BALL") {
        box(s, x + 1.26, y + 0.12, 0.5, 0.26, AMBER, { rectRadius: 0.13 });
        T(s, "Beta", { x: x + 1.26, y: y + 0.12, w: 0.5, h: 0.26, fontSize: 10, bold: true, align: "center", valign: "middle" });
      }
    }
    // mode cards (row 2 remaining slot area)
    const modes = [["FaUser", "單人練習", "自己練，挑戰個人紀錄"], ["FaUsers", "多人競賽", "最多 3 人同場比分"], ["FaShuffle", "隨機練習", "隨機挑戰不同項目"]];
    for (let i = 0; i < 3; i++) {
      const x = 0.6 + i * 4.165, y = 5.6;
      box(s, x, y, 3.8, 1.15, TEAL, { rectRadius: 0.2 });
      await iconDot(s, modes[i][0], x + 0.25, y + 0.22, 0.7, "0E7F93");
      T(s, modes[i][1], { x: x + 1.15, y: y + 0.17, w: 2.5, h: 0.45, fontSize: 18, bold: true, color: WHITE });
      T(s, modes[i][2], { x: x + 1.15, y: y + 0.62, w: 2.55, h: 0.4, fontSize: 14, color: MINT });
    }
    s.addNotes("系統現有九個體適能項目和三個遊戲化項目：「百米飛人」原地跑步，「游泳健將」模仿游泳動作；新加入的「運球高手」（Beta）是單人 60 秒運球挑戰，AI 偵測籃球並分開計算左右手運球，設簡單、中等、困難三個難度，須使用籃球。學生可以單人練習、與同學比賽，或用隨機練習挑戰不同項目。每個項目都有卡通示範動畫，提醒學生正確的動作。\n（內部提示：「百米飛人」及「游泳健將」的玩法描述須與產品團隊確認。）");
  }

  // 7 — On-device AI
  {
    const s = content("AI 在裝置上運算", "姿勢及臉部偵測｜On-device processing", "產品");
    // flow
    const nodes = [
      ["FaVideo", "鏡頭", "拍攝動作", TINT, TEAL2, INK],
      ["FaMicrochip", "運動站 · 本機 AI", "姿勢分析在本機完成", TEAL, AMBER, WHITE],
      ["FaFileLines", "成績紀錄", "項目、次數、時間、班別學號、頭像縮圖", TINT, TEAL2, INK],
      ["FaChartLine", "學校後台", "老師查看及分析", TINT, TEAL2, INK],
    ];
    const nw = 2.55, gap = 0.64;
    for (let i = 0; i < 4; i++) {
      const x = 0.6 + i * (nw + gap), y = 2.05;
      box(s, x, y, nw, 2.35, nodes[i][3], { rectRadius: 0.2 });
      await iconDot(s, nodes[i][0], x + 0.25, y + 0.25, 0.7, nodes[i][4], nodes[i][4] === AMBER ? "#08485A" : "#FFFFFF");
      T(s, nodes[i][1], { x: x + 0.25, y: y + 1.07, w: nw - 0.4, h: 0.45, fontSize: 17, bold: true, color: nodes[i][5] });
      T(s, nodes[i][2], { x: x + 0.25, y: y + 1.52, w: nw - 0.4, h: 0.75, fontSize: 13, color: i === 1 ? MINT : MUTED });
      if (i < 3) s.addImage({ path: await icon("FaArrowRight", "#0B6374"), x: x + nw + 0.17, y: y + 1.0, w: 0.3, h: 0.3 });
    }
    // no-video tag under kiosk->record arrow
    box(s, 3.55, 4.62, 2.5, 0.52, "FFE7E6", { rectRadius: 0.26 });
    s.addImage({ path: await icon("FaVideoSlash", "#FD5B58"), x: 3.72, y: 4.73, w: 0.3, h: 0.3 });
    T(s, "不上載影片", { x: 4.12, y: 4.62, w: 1.85, h: 0.52, fontSize: 15, bold: true, color: "C0392B", valign: "middle" });
    // skeleton close-up
    s.addImage({ path: await photo("skel", "app-squat-pose-tracking.jpg", 4.6, 2.0, { r: 0.18, extract: { left: 676, top: 190, width: 482, height: 210 } }), x: 8.13, y: 4.62, w: 4.6, h: 2.0 });
    const feats = [["FaBolt", "免網絡延遲，即時反應"], ["FaToggleOn", "學校可開關資料傳送"], ["FaLock", "管理員密碼保護設定"]];
    for (let i = 0; i < 3; i++) {
      const y = 5.4 + i * 0.47;
      s.addImage({ path: await icon(feats[i][0], "#0D687A"), x: 0.65, y: y + 0.06, w: 0.3, h: 0.3 });
      T(s, feats[i][1], { x: 1.1, y, w: 7.8, h: 0.42, fontSize: 16, valign: "middle" });
    }
    T(s, "姿勢偵測畫面（骨架關節點）", { x: 8.13, y: 6.68, w: 4.6, h: 0.25, fontSize: 10, color: MUTED, align: "right" });
    s.addNotes("運動站在裝置上進行姿勢和臉部偵測，影片不會上載到雲端。上載到後台的只有成績紀錄，包括項目、次數、時間、班別學號和一張頭像縮圖，學校亦可以在管理員設定中關閉資料傳送。");
  }

  // 8 — Gamified
  {
    const s = content("比賽、排行、再挑戰", "用遊戲吸引學生主動運動", "產品");
    s.addImage({ path: await photo("res", "app-results-celebration.jpg", 6.0, 2.77, { r: 0.18 }), x: 0.6, y: 2.05, w: 6.0, h: 2.77, shadow: shadow() });
    s.addImage({ path: await photo("lb", "app-leaderboard.jpg", 5.2, 2.4, { r: 0.18 }), x: 2.0, y: 4.35, w: 5.2, h: 2.4, shadow: shadow() });
    const pts = [
      ["FaUsers", "多人同場即時比分", "最多 3 人一齊比賽"],
      ["FaRankingStar", "首十名排行榜", "每個項目都有紀錄"],
      ["FaStopwatch", "倒數及成績動畫", "增加緊張感及成就感"],
      ["FaSchool", "可放學校標誌及校名", "屬於自己學校的設施"],
    ];
    for (let i = 0; i < 4; i++) {
      const y = 2.1 + i * 1.17;
      await iconDot(s, pts[i][0], 7.85, y, 0.8, i % 2 ? AMBER : TEAL2);
      T(s, pts[i][1], { x: 8.9, y: y + 0.0, w: 3.8, h: 0.45, fontSize: 18, bold: true });
      T(s, pts[i][2], { x: 8.9, y: y + 0.45, w: 3.8, h: 0.4, fontSize: 14, color: MUTED });
    }
    s.addNotes("我們相信學生要覺得好玩才會主動再來。多人競賽可以即時比分，每個項目都有首十名排行榜。運動站亦可以顯示學校標誌和校名，讓學生覺得這是屬於自己學校的設施。");
  }

  // 8b — More features & benefits (from intelligent-playground.com)
  {
    const s = content("更多功能", "由挑戰設計到家長通知，配合學校推行體育活動", "產品");
    const cards = [
      ["FaTrophy", "有趣的挑戰", "按年齡、能力及目標自訂挑戰，完成可獲徽章及獎勵"],
      ["FaPeopleGroup", "社交互動", "團隊合作挑戰，學生亦可在社交媒體分享成就"],
      ["FaGaugeHigh", "即時反饋", "即時顯示重複次數及持續時間，幫助改善動作"],
      ["FaCommentSms", "家長訂閱資料", "家長以手機短訊接收子女運動進度，毋須下載軟件"],
      ["FaSliders", "定制化支援", "按學校或機構需要設計課程、挑戰模式及活動內容"],
      ["FaWandMagicSparkles", "簡單易用", "介面簡單直觀，設定快捷，只需很少培訓"],
    ];
    for (let i = 0; i < 6; i++) {
      const x = 0.6 + (i % 3) * 4.115, y = 1.95 + Math.floor(i / 3) * 1.62;
      box(s, x, y, 3.9, 1.45, TINT, { rectRadius: 0.18 });
      await iconDot(s, cards[i][0], x + 0.22, y + 0.25, 0.75, i % 2 ? AMBER : TEAL2);
      T(s, cards[i][1], { x: x + 1.15, y: y + 0.2, w: 2.6, h: 0.42, fontSize: 17, bold: true });
      T(s, cards[i][2], { x: x + 1.15, y: y + 0.64, w: 2.6, h: 0.7, fontSize: 12.5, color: MUTED });
    }
    box(s, 0.6, 5.3, 12.13, 1.45, TEAL, { rectRadius: 0.2 });
    T(s, "智能運動場的好處", { x: 0.9, y: 5.45, w: 5, h: 0.42, fontSize: 17, bold: true, color: AMBER });
    const ben = ["以科技吸引學生運動", "應對兒童肥胖及久坐", "培養成長心態", "提升自信心和自尊感"];
    for (let i = 0; i < 4; i++) {
      const x = 0.9 + i * 2.95;
      circle(s, x, 6.12, 0.16, MINT);
      T(s, ben[i], { x: x + 0.28, y: 5.98, w: 2.6, h: 0.45, fontSize: 15, bold: true, color: WHITE, valign: "middle" });
    }
    s.addNotes("除了計數和排行榜，學校可以按學生的年齡、能力和體能目標自訂挑戰，完成後有徽章和獎勵；亦可以舉辦團隊合作挑戰。家長可以訂閱子女的運動進度，以手機短訊接收通知。我們亦會與學校合作設計課程和活動內容。長遠來說，這可以幫助應對兒童肥胖和久坐問題，並提升學生的自信心。");
  }

  // 9 — Dashboard (illustrative mock)
  pres.addSection({ title: "數據與教學" });
  {
    const s = content("誰在郁？郁幾耐？一目了然", "網上數據後台｜電腦、手機都可查看", "數據與教學");
    const pts = [
      ["FaLayerGroup", "各年級、班級參與分析"],
      ["FaStopwatch", "人均運動時間"],
      ["FaCalendarCheck", "使用時段及星期分佈"],
      ["FaRankingStar", "班級排行及最活躍學生"],
      ["FaPrint", "一鍵列印報告"],
    ];
    for (let i = 0; i < pts.length; i++) {
      const y = 2.15 + i * 0.92;
      await iconDot(s, pts[i][0], 0.6, y, 0.6, i === 4 ? AMBER : TEAL2);
      T(s, pts[i][1], { x: 1.35, y, w: 2.75, h: 0.6, fontSize: 16, valign: "middle", bold: true });
    }
    // panel
    const PX0 = 4.4, PY0 = 1.95, PW = 8.33, PH = 4.85;
    box(s, PX0, PY0, PW, PH, "F3F8F9", { rectRadius: 0.2, line: { color: LINE, width: 1 } });
    box(s, PX0 + PW - 1.25, PY0 + 0.15, 1.05, 0.38, AMBER, { rectRadius: 0.19 });
    T(s, "示意圖", { x: PX0 + PW - 1.25, y: PY0 + 0.15, w: 1.05, h: 0.38, fontSize: 13, bold: true, align: "center", valign: "middle" });
    T(s, "總覽　｜　日期範圍：本學期", { x: PX0 + 0.25, y: PY0 + 0.15, w: 5, h: 0.38, fontSize: 13, color: MUTED, valign: "middle" });
    const kpi = [["參與學生", "418", "人"], ["期間總時數", "203", "小時"], ["人均運動時間", "29", "分鐘"]];
    for (let i = 0; i < 3; i++) {
      const x = PX0 + 0.25 + i * 2.66, y = PY0 + 0.68;
      box(s, x, y, 2.5, 0.95, WHITE, { rectRadius: 0.12, line: { color: LINE, width: 0.75 } });
      T(s, kpi[i][0], { x: x + 0.18, y: y + 0.1, w: 2.2, h: 0.3, fontSize: 11, color: MUTED });
      T(s, [{ text: kpi[i][1], options: { fontSize: 24, bold: true, color: i === 2 ? "B7791F" : TEAL } }, { text: " " + kpi[i][2], options: { fontSize: 12, color: MUTED } }], { x: x + 0.18, y: y + 0.4, w: 2.2, h: 0.48, valign: "middle" });
    }
    // bar chart: participation by grade
    const cy = PY0 + 1.8;
    box(s, PX0 + 0.25, cy, 4.0, 2.85, WHITE, { rectRadius: 0.12, line: { color: LINE, width: 0.75 } });
    s.addChart(pres.charts.BAR, [{ name: "參與人數", labels: ["小一", "小二", "小三", "小四", "小五", "小六"], values: [58, 64, 71, 83, 76, 60] }], {
      x: PX0 + 0.3, y: cy + 0.4, w: 3.9, h: 2.4, barDir: "col", chartColors: [TEAL2],
      showTitle: false,
      showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 9, dataLabelFontFace: FONT, dataLabelColor: MUTED,
      catAxisLabelFontFace: FONT, catAxisLabelFontSize: 9, catAxisLabelColor: MUTED, valAxisHidden: true,
      valGridLine: { style: "none" }, catGridLine: { style: "none" }, showLegend: false, barGapWidthPct: 60,
      catAxisLineShow: true, catAxisLineColor: LINE,
    });
    T(s, "各年級參與人數", { x: PX0 + 0.4, y: cy + 0.08, w: 3, h: 0.28, fontSize: 11, bold: true });
    // heatmap: time-of-day x weekday
    const hx = PX0 + 4.45, hw = 3.63;
    box(s, hx, cy, hw, 1.55, WHITE, { rectRadius: 0.12, line: { color: LINE, width: 0.75 } });
    T(s, "使用時段 × 星期", { x: hx + 0.15, y: cy + 0.08, w: 3, h: 0.28, fontSize: 11, bold: true });
    const days = ["一", "二", "三", "四", "五"], slots = ["早會前", "小息", "午飯", "放學後"];
    const heat = [[1, 1, 0, 1, 1], [3, 2, 3, 3, 2], [2, 3, 2, 3, 3], [0, 1, 1, 0, 1]];
    const shades = ["E3F1F2", "B6DEDB", "5FB3B5", "0D687A"];
    const cw = 0.46, ch = 0.22, gx = hx + 0.95, gy = cy + 0.42;
    for (let d = 0; d < 5; d++) T(s, days[d], { x: gx + d * (cw + 0.05), y: cy + 1.33, w: cw, h: 0.18, fontSize: 9, color: MUTED, align: "center" });
    for (let r = 0; r < 4; r++) {
      T(s, slots[r], { x: hx + 0.15, y: gy + r * (ch + 0.0), w: 0.78, h: ch, fontSize: 9, color: MUTED, valign: "middle" });
      for (let d = 0; d < 5; d++) s.addShape(pres.shapes.RECTANGLE, { x: gx + d * (cw + 0.05), y: gy + r * ch + 0.02, w: cw, h: ch - 0.04, fill: { color: shades[heat[r][d]] }, line: { color: WHITE, width: 0 } });
    }
    // most active students
    const ly = cy + 1.7;
    box(s, hx, ly, hw, 1.15, WHITE, { rectRadius: 0.12, line: { color: LINE, width: 0.75 } });
    T(s, "最活躍學生", { x: hx + 0.15, y: ly + 0.08, w: 2, h: 0.26, fontSize: 11, bold: true });
    const top = [["5A · 12 號", 0.95, "312 分鐘"], ["4C · 03 號", 0.8, "268 分鐘"], ["6B · 21 號", 0.68, "231 分鐘"]];
    for (let i = 0; i < 3; i++) {
      const y = ly + 0.4 + i * 0.235;
      T(s, top[i][0], { x: hx + 0.15, y, w: 0.95, h: 0.2, fontSize: 8, color: INK, valign: "middle" });
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: hx + 1.15, y: y + 0.04, w: 1.6 * top[i][1], h: 0.13, fill: { color: i === 0 ? AMBER : MINT }, line: { color: WHITE, width: 0 }, rectRadius: 0.06 });
      T(s, top[i][2], { x: hx + 2.8, y, w: 0.75, h: 0.2, fontSize: 8, color: MUTED, valign: "middle", align: "right" });
    }
    s.addNotes("老師登入後台，可以按日期範圍查看各年級和班級的參與情況、每位學生的總運動時間，以及設施在哪些時段和星期最多人使用。這些數據可以用來安排課堂和活動，亦可以列印成報告。\n（右邊是後台主要面板的示意圖，數字只作說明用途，並非真實學校數據。）");
  }

  // 10 — Curriculum fit
  {
    const s = content("一部機，連結四個範疇", "體育課 · 體適能 · MVPA60 · AI 教育（STEAM）", "數據與教學");
    s.addImage({ path: await photo("cur", "kiosk-floor-standing-menu.jpg", 2.6, 4.65, { r: 0.3, pos: "centre" }), x: 5.37, y: 2.05, w: 2.6, h: 4.65 });
    const q = [
      ["FaPersonRunning", "體育課", "熱身、分組活動、測驗", TEAL2],
      ["FaHeartPulse", "體適能", "小息自行恆常練習", CORAL],
      ["FaClockRotateLeft", "MVPA60", "記錄課餘運動時間", AMBER],
      ["FaRobot", "AI 教育", "認識姿勢辨識原理；「智」啟學教：體育可作 AI 科目之一", BLUE],
    ];
    for (let i = 0; i < 4; i++) {
      const left = i % 2 === 0, x = left ? 0.6 : 8.33, y = 2.05 + Math.floor(i / 2) * 2.4;
      box(s, x, y, 4.4, 2.25, TINT, { rectRadius: 0.2 });
      await iconDot(s, q[i][0], x + 0.3, y + 0.3, 0.75, q[i][3]);
      T(s, q[i][1], { x: x + 1.25, y: y + 0.38, w: 3.0, h: 0.6, fontSize: 22, bold: true, valign: "middle" });
      T(s, q[i][2], { x: x + 0.3, y: y + 1.25, w: 3.85, h: 0.85, fontSize: 15, color: MUTED });
    }
    s.addNotes("運動站可以在體育課用作熱身或分組活動，平日則讓學生在小息自行練習。學校亦可以借此讓學生認識 AI 姿勢辨識的原理。參加「智」啟學教計劃的學校，可以把體育列為推行 AI 輔助教學的三個科目之一。");
  }

  // 11 — Deployment & hardware
  {
    const s = content("安裝簡單，適合各種場地", "Kiosk or iPad", "數據與教學");
    const specs = [
      ["FaMicrochip", "AI 運動站", "大屏顯示，本機 AI 運算"],
      ["FaVideo", "1080p USB 鏡頭", "配合大屏使用"],
      ["FaTabletScreenButton", "iPad 版本", "使用 iPad 內置鏡頭"],
    ];
    for (let i = 0; i < 3; i++) {
      const y = 2.05 + i * 1.18;
      box(s, 0.6, y, 5.3, 1.0, TINT, { rectRadius: 0.18 });
      await iconDot(s, specs[i][0], 0.8, y + 0.17, 0.66, TEAL2);
      T(s, specs[i][1], { x: 1.7, y: y + 0.13, w: 4.0, h: 0.4, fontSize: 18, bold: true });
      T(s, specs[i][2], { x: 1.7, y: y + 0.53, w: 4.0, h: 0.35, fontSize: 14, color: MUTED });
    }
    T(s, "適合場地", { x: 0.6, y: 5.65, w: 2, h: 0.35, fontSize: 14, bold: true, color: TEAL });
    const places = ["走廊", "禮堂", "有蓋操場"];
    for (let i = 0; i < 3; i++) {
      box(s, 0.6 + i * 1.45, 6.05, 1.3, 0.48, AMBER, { rectRadius: 0.24 });
      T(s, places[i], { x: 0.6 + i * 1.45, y: 6.05, w: 1.3, h: 0.48, fontSize: 15, bold: true, align: "center", valign: "middle" });
    }
    s.addImage({ path: await icon("FaSliders", "#0D687A"), x: 5.0, y: 5.65, w: 0.3, h: 0.3 });
    T(s, "年級及班別\n可自行設定", { x: 4.95, y: 6.0, w: 1.3, h: 0.6, fontSize: 12, color: MUTED });
    s.addImage({ path: await photo("hw1", "kiosk-floor-standing-gameplay.jpg", 3.0, 4.65, { r: 0.22 }), x: 6.45, y: 2.05, w: 3.0, h: 4.65 });
    s.addImage({ path: await photo("hw2", "kiosk-joyful-arena-wall.jpg", 3.05, 2.2, { r: 0.22 }), x: 9.68, y: 2.05, w: 3.05, h: 2.2 });
    s.addImage({ path: await photo("hw3", "kiosk-mobile-stand-wide.jpg", 3.05, 2.2, { r: 0.22 }), x: 9.68, y: 4.5, w: 3.05, h: 2.2 });
    s.addNotes("標準配置是大屏 AI 運動站配 1080p USB 鏡頭，也可以使用 iPad 版本。學校可以按場地選擇放在走廊、禮堂或有蓋操場；年級和班別都可以在管理員設定中按學校情況調整。\n（內部提示：戶外使用、屏幕尺寸、所需空間及網絡要求，須與產品團隊確認後才可加入。）");
  }

  // 12 — Funding
  pres.addSection({ title: "資助與推行" });
  {
    const s = content("用好現有資助", "多項教育局及 QEF 資助可涵蓋", "資助與推行");
    const H = (t) => ({ text: t, options: { bold: true, color: WHITE, fill: { color: TEAL }, fontSize: 15 } });
    const c = (t, o = {}) => ({ text: t, options: { fontSize: 14, color: INK, ...o } });
    const rows = [
      [H("資助"), H("金額"), H("期限"), H("適用")],
      [c([{ text: "MVPA60 一筆過津貼", options: { bold: true, breakLine: true } }, { text: "通函 73/2024", options: { fontSize: 11, color: MUTED } }]),
        c("$150,000／校", { bold: true, fontSize: 18, color: TEAL }),
        c([{ text: "倒數中", options: { bold: true, color: "B7791F", breakLine: true, fontSize: 12 } }, { text: "須於 2027-08-31 前用完", options: { bold: true } }], { fill: { color: "FFF4DA" } }),
        c("公營及直資中小學、特殊學校")],
      [c([{ text: "「智」啟學教撥款", options: { bold: true, breakLine: true } }, { text: "通函 221/2025", options: { fontSize: 11, color: MUTED } }]),
        c("$500,000／校", { bold: true, fontSize: 18, color: TEAL }),
        c("可用至 2028-08-31"),
        c("已獲批學校；體育可作 3 個 AI 科目之一")],
      [c([{ text: "QEF 專項撥款", options: { bold: true, breakLine: true } }, { text: "通函 96/2026", options: { fontSize: 11, color: MUTED } }]),
        c([{ text: "累計上限", options: { fontSize: 12, color: MUTED, breakLine: true } }, { text: "$3,000,000", options: { bold: true, fontSize: 18, color: TEAL } }]),
        c("第十七期：2026 年 10 月至 2027 年 1 月"),
        c("公帑資助學校")],
    ];
    s.addTable(rows, {
      x: 0.6, y: 1.95, w: 12.13, colW: [2.75, 2.1, 3.2, 4.08], rowH: [0.5, 0.95, 0.95, 0.95],
      fontFace: FONT, valign: "middle", margin: [0.06, 0.15, 0.06, 0.15],
      border: { type: "solid", pt: 0.75, color: LINE }, fill: { color: WHITE },
    });
    const notes = [["FaSquareCheck", "MVPA60 津貼用途明列體育相關資訊科技服務及軟件"], ["FaSchool", "幼稚園：可用單位資助或 QEF 專項撥款"]];
    for (let i = 0; i < 2; i++) {
      const x = 0.6 + i * 6.165;
      box(s, x, 5.6, 5.97, 0.75, TINT, { rectRadius: 0.2 });
      await iconDot(s, notes[i][0], x + 0.18, 5.71, 0.53, TEAL2);
      T(s, notes[i][1], { x: x + 0.85, y: 5.6, w: 5.0, h: 0.75, fontSize: 15, bold: true, valign: "middle" });
    }
    T(s, "資助的使用以教育局及 QEF 最新通函和學校採購程序為準。", { x: 0.6, y: 6.5, w: 12.13, h: 0.3, fontSize: 10, color: MUTED });
    s.addNotes("教育局的 MVPA60 一筆過津貼，用途明確包括體育相關的資訊科技服務和器材，但必須在 2027 年 8 月底前用完。已獲「智」啟學教撥款的學校可用至 2028 年 8 月。QEF 專項撥款第十七期現正接受申請。我們可以協助學校撰寫計劃書及配合採購程序。\n（注意：MVPA60 津貼不可用於「一般用途」的電子器材，所以要強調運動站是體育專用設備。）");
  }

  // 13 — Timeline
  {
    const s = content("由試用到全校使用", "建議推行步驟", "資助與推行");
    const steps = [
      ["FaSchool", "到校示範", "及場地評估"],
      ["FaFileSignature", "報價", "及配合資助申請"],
      ["FaSliders", "安裝", "及設定年級、班別"],
      ["FaChalkboardUser", "教師簡介", "及學生試玩"],
      ["FaMagnifyingGlassChart", "定期檢視", "數據報告"],
    ];
    const cx0 = 0.6, colw = 12.13 / 5;
    s.addShape(pres.shapes.LINE, { x: cx0 + colw / 2, y: 3.05, w: colw * 4, h: 0, line: { color: MINT, width: 3 } });
    for (let i = 0; i < 5; i++) {
      const cx = cx0 + colw * i + colw / 2;
      await iconDot(s, steps[i][0], cx - 0.55, 2.5, 1.1, i === 4 ? AMBER : TEAL2);
      box(s, cx - 1.05, 4.0, 2.1, 2.1, TINT, { rectRadius: 0.2 });
      T(s, String(i + 1).padStart(2, "0"), { x: cx - 0.85, y: 4.2, w: 1.7, h: 0.55, fontSize: 26, bold: true, color: i === 4 ? "B7791F" : TEAL });
      T(s, steps[i][1], { x: cx - 0.85, y: 4.85, w: 1.7, h: 0.45, fontSize: 19, bold: true });
      T(s, steps[i][2], { x: cx - 0.85, y: 5.35, w: 1.75, h: 0.6, fontSize: 14, color: MUTED });
    }
    s.addNotes("我們會先到校示範，並評估擺放位置，然後按學校需要報價，協助配合資助申請。安裝後會為老師簡介後台的用法，並安排學生試玩。之後學校可以定期檢視數據，調整推行策略。");
  }

  // 14 — CTA
  {
    const s = pres.addSlide({ masterName: "DARK", sectionTitle: "資助與推行" });
    circle(s, -1.6, 4.2, 5.0, "0E7385");
    s.addImage({ path: await photo("mascot", "mascot-app-icon.png", 4.6, 4.6, { r: 0.4 }), x: 7.75, y: 1.45, w: 4.6, h: 4.6 });
    T(s, "預約到校示範", { x: 0.8, y: 1.0, w: 6.6, h: 1.0, fontSize: 48, bold: true, color: WHITE });
    T(s, "讓學生親身試一次", { x: 0.8, y: 2.05, w: 6.6, h: 0.6, fontSize: 26, bold: true, color: AMBER });
    const pts = [["FaSchool", "到校示範，讓學生親身體驗"], ["FaFileSignature", "按學校需要報價"], ["FaHandHoldingDollar", "協助準備資助申請文件"]];
    for (let i = 0; i < 3; i++) {
      const y = 3.05 + i * 0.75;
      await iconDot(s, pts[i][0], 0.8, y, 0.55, MINT, "#08485A");
      T(s, pts[i][1], { x: 1.6, y, w: 5.6, h: 0.55, fontSize: 18, color: WHITE, valign: "middle" });
    }
    s.addNotes("最直接的方法是讓學生親身試一次。歡迎預約到校示範，我們會按學校的場地和資助情況提供報價。\n（內部提示：是否「免費」到校示範須先確認。）");
  }

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT);
})().catch((e) => { console.error(e); process.exit(1); });
