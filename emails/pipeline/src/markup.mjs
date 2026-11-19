// Template markup -> HTML / plain text.
// toHtml is identical to _build/mailer/send.mjs: **bold** -> <b>, an image line
// ![alt](url) -> <img>, and every line after the image is small grey text.
export function toHtml(md) {
  const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const inline = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
  const out = [];
  let small = false;
  for (const line of md.split("\n")) {
    const img = line.match(/^!\[([^\]]*)\]\((https?:[^)\s]+)\)\s*$/);
    if (img) {
      out.push(`<img src="${esc(img[2])}" alt="${esc(img[1])}" width="64" height="64" style="display:block;margin:12px 0">`);
      small = true;
      continue;
    }
    const text = line ? inline(line) : "";
    out.push(small && text ? `<span style="font-size:11px;color:#777777">${text}</span>` : text);
  }
  return `<div style="font-family:Arial,'Microsoft JhengHei',sans-serif;font-size:14px;line-height:1.6;color:#222222">${out.join("<br>")}</div>`;
}

export function htmlDocument(md) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${toHtml(md)}</body></html>`;
}

/** Plain-text alternative: strip ** and drop the image line. */
export function toText(md) {
  return md
    .split("\n")
    .filter((l) => !/^!\[[^\]]*\]\(https?:[^)\s]+\)\s*$/.test(l))
    .map((l) => l.replace(/\*\*(.+?)\*\*/g, "$1"))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim() + "\n";
}
