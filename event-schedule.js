/* Shared, Japan-local event dates for home, detail and saved events. */
"use strict";
var EventSchedule = (() => {
  function today(value = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
  }
  function day(key) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(key || ""))) return null;
    const value = new Date(`${key}T00:00:00Z`);
    return Number.isNaN(value.getTime()) || value.toISOString().slice(0, 10) !== key ? null : value.getTime() / 86400000;
  }
  function dates(item = {}) {
    if (Array.isArray(item.occurrences) && item.occurrences.length) return [...new Set(item.occurrences.filter((key) => day(key) !== null))].sort();
    return [...new Set([item.startDate, item.endDate].filter((key) => day(key) !== null))].sort();
  }
  function happensOn(item = {}, key = today()) {
    if (day(key) === null || ["cancelled", "postponed"].includes(item.status)) return false;
    const keys = dates(item);
    if (Array.isArray(item.occurrences) && item.occurrences.length) return keys.includes(key);
    return keys.length > 0 && key >= keys[0] && key <= keys.at(-1);
  }
  function nextDate(item = {}, key = today()) {
    if (day(key) === null || ["cancelled", "postponed"].includes(item.status)) return "";
    const keys = dates(item);
    if (Array.isArray(item.occurrences) && item.occurrences.length) return keys.find((value) => value >= key) || "";
    return !keys.length || keys.at(-1) < key ? "" : keys[0] < key ? key : keys[0];
  }
  function status(item = {}, key = today()) {
    if (item.status === "cancelled") return "中止";
    if (item.status === "postponed") return "延期";
    const base = happensOn(item, key) ? "今日開催" : nextDate(item, key) ? "開催予定" : dates(item).length ? "終了" : "日程を確認";
    const deadline = day(item.applicationDeadline);
    if (deadline !== null && base !== "終了") {
      const [, month, date] = item.applicationDeadline.split("-").map(Number);
      const application = deadline < day(key) ? "受付終了" : deadline === day(key) ? "申込期限は今日" : `申込締切 ${month}月${date}日`;
      return `${base}・${application}`;
    }
    if (base !== "終了" && item.applicationStatus === "closed") return `${base}・受付終了`;
    if (base !== "終了" && item.applicationStatus === "unconfirmed") return `${base}・受付状況を掲載元で確認`;
    return base;
  }
  return Object.freeze({ today, day, dates, happensOn, nextDate, status });
})();
