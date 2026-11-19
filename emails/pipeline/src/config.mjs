// Loads emails/config.json and fills defaults (SPEC "Limits" and "Modes").
import fs from "node:fs";

export const DEFAULTS = {
  enabled: true,
  timezone: "Asia/Hong_Kong",
  sender: { email: "anthonychan@antapp.ai", name: "Anthony Chan" },
  testRecipient: "",
  testMaxPerRun: 3,
  schedule: { sendDays: ["Tue", "Fri"], sendTime: "10:00", checkTime: "18:00", sendWindowEndHour: 20 },
  maxPerRun: 150,
  maxPerDay: 400,
  delaySeconds: [20, 60],
  maxEmailsPerSchool: 10,
  minDaysBetween: 3,
  levelOrder: ["PRI", "SEC", "SPE", "KG"],
  replySearchDays: 30,
  genericDomains: [],
  labels: { replied: "IP/已回覆", unsubscribed: "IP/取消訂閱" },
  claude: { bin: "claude", model: "", timeoutSeconds: 120, retries: 1 },
  limits: { subjectMaxChars: 80, firstBodyMaxChars: 2500, followupBodyMaxChars: 600, followupMaxBullets: 4 },
  bannedTerms: ["Google", "ML Kit", "MediaPipe", "RK3588", "Android", "Flutter", "Strapi"],
  bannedClaims: [],
  campaigns: {},
};

const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
function merge(base, over) {
  const out = { ...base };
  for (const [k, v] of Object.entries(over || {})) {
    if (k.startsWith("_")) continue; // _comment keys
    out[k] = isObj(v) && isObj(base[k]) ? merge(base[k], v) : v;
  }
  return out;
}

export function loadConfig(file) {
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  return merge(DEFAULTS, raw);
}
