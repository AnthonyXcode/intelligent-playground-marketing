// Timezone helpers. All timestamps are stored as UTC ISO strings; calendar logic
// (daily cap, days between emails, schedule) uses config.timezone (Asia/Hong_Kong).
const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function zonedParts(date, tz) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short", hourCycle: "h23",
  });
  const p = Object.fromEntries(f.formatToParts(date).map((x) => [x.type, x.value]));
  return {
    year: +p.year, month: +p.month, day: +p.day,
    hour: +p.hour, minute: +p.minute, second: +p.second,
    weekday: p.weekday, weekdayIndex: WD.indexOf(p.weekday),
    date: `${p.year}-${p.month}-${p.day}`,
  };
}

export const localDate = (date, tz) => zonedParts(date, tz).date;

/** Whole calendar days between two instants, counted in tz. */
export function dayDiff(from, to, tz) {
  const a = localDate(new Date(from), tz);
  const b = localDate(new Date(to), tz);
  return Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);
}

export function addDaysDate(dateStr, n) {
  const d = new Date(Date.parse(dateStr + "T00:00:00Z") + n * 86400000);
  return d.toISOString().slice(0, 10);
}

/** Offset of tz from UTC in minutes at a given instant (e.g. +480 for Hong Kong). */
export function tzOffsetMinutes(tz, date = new Date()) {
  const p = zonedParts(date, tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

export const WEEKDAYS = WD;
