#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const appPath = path.join(root, "app.js");
const meetings = JSON.parse(fs.readFileSync(path.join(root, "data/meetings.json"), "utf8"));
const communityEvents = JSON.parse(fs.readFileSync(path.join(root, "data/community-events.json"), "utf8"));
const community = JSON.parse(fs.readFileSync(path.join(root, "data/community.json"), "utf8"));
const civicPortal = JSON.parse(fs.readFileSync(path.join(root, "data/civic-portal.json"), "utf8"));
const politics = JSON.parse(fs.readFileSync(path.join(root, "data/politics.json"), "utf8"));
let source = fs.readFileSync(appPath, "utf8");
source = source.replace(/\nrender\(\);\nloadOfficialData\(\);\s*$/, "\n");

const main = { innerHTML: "" };
const toast = { textContent: "", classList: { add() {}, remove() {} } };
const context = {
  console,
  Date,
  Intl,
  URL,
  setTimeout,
  clearTimeout,
  location: { protocol: "file:", hash: "" },
  history: { pushState() {} },
  navigator: {},
  localStorage: { getItem() { return null; }, setItem() {} },
  window: { addEventListener() {}, scrollTo() {} },
  document: {
    querySelector(selector) { return selector === "#main" ? main : selector === "#toast" ? toast : null; },
    querySelectorAll() { return []; },
    addEventListener() {},
  },
  __meetings: meetings,
  __communityEvents: communityEvents,
  __community: community,
  __civicPortal: civicPortal,
  __politics: politics,
};
vm.createContext(context);
vm.runInContext(source, context, { filename: "app.js" });

const today = vm.runInContext(`
  state.data = normalizeData({ meetings: __meetings, council: { title: "古い日程", nextDateLabel: "9/3 10:00" } });
  currentCouncilSchedule(new Date("2026-09-04T00:00:00+09:00"));
`, context);
assert.equal(today.nextDateKey, "2026-09-04");
assert.equal(today.nextDateLabel, "今日 10:00");
assert.match(today.nextSummary, /一般質問/);
assert.doesNotMatch(today.nextDateLabel, /9\/3/);

const afterSession = vm.runInContext('currentCouncilSchedule(new Date("2026-09-26T00:00:00+09:00"))', context);
assert.equal(afterSession.nextDateLabel, "次回日程を確認中");
assert.doesNotMatch(afterSession.nextDateLabel, /9\/3/);

const indexFacts = vm.runInContext(`
  state.data = normalizeData({ meetings: __meetings, communityEvents: __communityEvents, community: __community });
  state.civicPortal = __civicPortal;
  state.politics = __politics;
  ({
    titles: combinedSearchItems().map((item) => item.title),
    childSynonym: matchesSearchQuery({ title: "子ども向け講座" }, "こども"),
    roadSynonym: matchesSearchQuery({ title: "道路舗装工事" }, "道"),
  });
`, context);
assert.ok(indexFacts.titles.some((title) => /Freedom Music Park/.test(title)), "community events must be searchable");
assert.ok(indexFacts.titles.includes("Dream Messenger"), "community organizations must be searchable");
assert.ok(indexFacts.titles.some((title) => /直方市の当初予算/.test(title)), "budget must be searchable");
assert.ok(indexFacts.titles.some((title) => /直方市長/.test(title)), "mayor must be searchable");
assert.equal(indexFacts.childSynonym, true);
assert.equal(indexFacts.roadSynonym, true);

console.log("P0 temporal and cross-source search checks passed");
