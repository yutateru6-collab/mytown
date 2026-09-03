#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const community = JSON.parse(fs.readFileSync(path.join(root, "data/community.json"), "utf8"));
const source = fs.readFileSync(path.join(root, "ui-home-v4.js"), "utf8");
const main = { innerHTML: "" };
const context = {
  Date,
  Intl,
  console,
  history: { state: null, back() {}, pushState() {} },
  state: {
    data: { featured: [], latest: [], communityEvents: { events: [] }, community, bulletin: {}, changes: { changes: [] } },
    v2Preferences: { district: "", garbageArea: "", civicDigest: "off" },
    loading: false,
    loadError: false,
    priorVisitAt: null,
    view: "tab",
    tab: "today",
    v2Page: "participate",
  },
  main,
  window: { scrollTo() {} },
  document: { querySelector() { return null; }, addEventListener() {} },
  location: { hash: "#participate" },
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
context.render();

assert.match(main.innerHTML, /地域活動・ボランティアを探す/);
assert.match(main.innerHTML, /直方市のボランティア団体一覧/);
assert.match(main.innerHTML, /こども食堂情報/);
assert.match(main.innerHTML, /のおがたSDGs推進パートナー一覧/);
assert.match(main.innerHTML, /直方市社会福祉協議会ボランティアセンター/);
assert.match(main.innerHTML, /わたしの秘密基地ボランティア募集/);
assert.match(main.innerHTML, /この活動も載せて！/);
assert.doesNotMatch(main.innerHTML, /現在はまだ投稿できません/);

context.state.v4CommunityFilter = "groups";
context.render();
assert.match(main.innerHTML, /直方市立図書館ブックスタートボランティア/);

context.state.v4CommunityFilter = "sdgs";
context.render();
assert.match(main.innerHTML, /登録 016/);
assert.match(main.innerHTML, /NPO法人mixjam/);

console.log("Community directory UI checks passed");
