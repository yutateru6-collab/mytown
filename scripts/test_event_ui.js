#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const communityEvents = JSON.parse(fs.readFileSync(path.join(root, "data/community-events.json"), "utf8"));
const source = fs.readFileSync(path.join(root, "ui-home-v4.js"), "utf8");
const fixedNow = "2026-09-03T03:00:00Z";

class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : [fixedNow])); }
  static now() { return new Date(fixedNow).getTime(); }
}

const main = { innerHTML: "" };
const context = {
  Date: FixedDate,
  Intl,
  console,
  history: { state: null, back() {}, pushState() {} },
  state: {
    v4EventFilter: "all",
    data: { featured: [], latest: [], communityEvents, bulletin: {}, changes: { changes: [] } },
    v2Preferences: { district: "", garbageArea: "", civicDigest: "off" },
    loading: false,
    loadError: false,
    priorVisitAt: null,
    view: "tab",
    tab: "today",
    v2Page: null,
  },
  main,
  window: { scrollTo() {} },
  document: { querySelector() { return null; }, addEventListener() {} },
  location: { hash: "" },
  esc(value = "") { return String(value); },
  formatDateTime(value) { return String(value); },
  emptyCard(message) { return `<p>${message}</p>`; },
  combinedSearchItems() { return []; },
  classifyTitle() { return "その他"; },
  v2ChangesSinceLastVisit() { return []; },
  v2FindDeadlines() { return []; },
  v2FindServices() { return []; },
  v2CurrentBulletin() { return null; },
  v2Hero() { return ""; },
  v2LifeAndLatest() { return ""; },
  syncBanner() { return ""; },
  todayV2View() { return ""; },
  v2EnsureActionSheet() {},
  v2HandleAction() {},
  v2ApplyHashRoute() {},
  v2ActiveNav() { return "home"; },
  v2CloseSheet() {},
  v2SetRoute() {},
  v2SyncNav() {},
  render() {},
};

vm.createContext(context);
vm.runInContext(source, context, { filename: "ui-home-v4.js" });

const home = context.todayV2View();
assert.equal((home.match(/class="v4-home-event-card"/g) || []).length, 3, "home must show exactly three event cards");
const homeSources = [...home.matchAll(/class="v4-home-event-source">([^<]+)</g)].map((match) => match[1]);
assert.equal(homeSources.length, 3, "every home event must show its source type");
assert.equal(new Set(homeSources).size, 3, "the three home events must come from different publishers");
assert.ok(homeSources.includes("商業施設"), "home should include a nearby facility event when available");
assert.ok(
  homeSources.some((label) => ["地域団体", "地域団体・NPO", "観光・地域"].includes(label)),
  "home should include a community event when available",
);
assert.match(home, /すべてのイベントを見る/);
assert.match(home, /data-v4-home-event-filter="weekend"/);

context.state.v2Page = "events";
context.render();
assert.match(main.innerHTML, /市、地域団体、NPO、施設など/);
assert.match(main.innerHTML, /親子・子ども/);
assert.match(main.innerHTML, /地域参加/);
assert.match(main.innerHTML, /掲載元で確認/);
assert.doesNotMatch(main.innerHTML, />scheduled</);

console.log("Community event UI checks passed");
