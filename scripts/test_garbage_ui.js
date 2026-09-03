#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const data = JSON.parse(fs.readFileSync(path.join(root, "data/latest.json"), "utf8"));
const source = fs.readFileSync(path.join(root, "ui-home-v4.js"), "utf8");
const fixedNow = "2026-09-03T03:00:00Z";

class FixedDate extends Date {
  constructor(...args) {
    super(...(args.length ? args : [fixedNow]));
  }

  static now() {
    return new Date(fixedNow).getTime();
  }
}

const context = {
  Date: FixedDate,
  Intl,
  console,
  state: {
    v4EventFilter: "all",
    data: { ...data, featured: [], latest: [], council: null, bulletin: {} },
    v2Preferences: { district: "", garbageArea: "", civicDigest: "off" },
    loading: false,
    loadError: false,
    priorVisitAt: null,
  },
  main: { innerHTML: "" },
  window: { scrollTo() {} },
  document: { querySelector() { return null; }, addEventListener() {} },
  location: { hash: "" },
  esc(value = "") { return String(value); },
  emptyCard() { return ""; },
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

function renderFor(area, scheduleStatus = "verified") {
  context.state.v2Preferences.garbageArea = area;
  context.state.data.garbage.schedule.status = scheduleStatus;
  return context.todayV2View();
}

assert.match(renderFor(""), /収集エリアを設定/);
assert.match(renderFor("east"), /今日：もやせるごみ/);
assert.match(renderFor("west"), /明日：もやせるごみ/);
assert.match(renderFor("east", "needs_review"), /収集日程を確認中/);
assert.match(renderFor("east"), /<button class="v4-daily-item tone-yellow"/);

console.log("Garbage home UI checks passed");
