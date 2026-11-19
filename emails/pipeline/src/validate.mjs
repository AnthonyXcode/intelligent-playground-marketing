// Validation before every send (SPEC "Validation before every send").
const SIGNATURE_MARKERS = ["NOTICE", "Anthony Chan", "anthonychan@", "General Manager", "Unit 2610", "APEC Plaza", "![", "取消訂閱", "+852 6224"];

const charLen = (s) => [...s.replace(/\s/g, "")].length;

export function validateEmail({ subject, body, full, isFollowup, to }, cfg) {
  const errs = [];
  const L = cfg.limits;
  if (!subject || !subject.trim()) errs.push("empty subject");
  if (subject && [...subject].length > L.subjectMaxChars + 10) errs.push(`subject too long (${[...subject].length})`);
  if (/[\r\n]/.test(subject || "")) errs.push("subject contains newline");
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) errs.push(`invalid recipient: ${to}`);
  for (const [name, text] of [["subject", subject || ""], ["email", full || ""]]) {
    if (text.includes("{{") || text.includes("}}")) errs.push(`unfilled placeholder in ${name}`);
    text.split("\n").forEach((line, i) => {
      if ((line.match(/\*\*/g) || []).length % 2) errs.push(`unbalanced ** in ${name} line ${i + 1}`);
    });
  }
  const all = `${subject}\n${full}`;
  for (const t of cfg.bannedTerms || []) {
    const re = new RegExp(`(^|[^A-Za-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s*")}(?![A-Za-z0-9])`, "i");
    if (re.test(all)) errs.push(`contains banned term: ${t}`);
  }
  for (const t of cfg.bannedClaims || []) {
    if (`${subject}\n${body}`.includes(t)) errs.push(`contains unverified claim: ${t}`);
  }
  const len = charLen(body || "");
  if (!body || len < 20) errs.push("body too short");
  if (isFollowup) {
    if (len > L.followupBodyMaxChars) errs.push(`follow-up body too long (${len} > ${L.followupBodyMaxChars})`);
    const bullets = (body.match(/^\s*•/gm) || []).length;
    if (bullets > L.followupMaxBullets) errs.push(`too many bullets (${bullets} > ${L.followupMaxBullets})`);
    for (const m of SIGNATURE_MARKERS) if (body.includes(m)) errs.push(`AI body contains signature/footer text: ${m}`);
  } else if (len > L.firstBodyMaxChars) errs.push(`body too long (${len})`);
  if (full && !full.includes("取消訂閱")) errs.push("missing unsubscribe line");
  return errs;
}
