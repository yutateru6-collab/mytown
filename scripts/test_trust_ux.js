#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const latest = JSON.parse(fs.readFileSync(path.join(root, "data/latest.json"), "utf8"));
const uiSource = fs.readFileSync(path.join(root, "ui-v2.js"), "utf8");
const p0Source = fs.readFileSync(path.join(root, "p0-stability.js"), "utf8");
const fixedNow = "2026-09-04T15:30:00Z"; // 2026-09-05 in Japan.

class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : [fixedNow])); }
  static now() { return new Date(fixedNow).getTime(); }
}

class FakeElement {
  constructor() {
    this.innerHTML = "";
    this.dataset = {};
    this.attributes = new Map();
    this.classList = { add() {}, remove() {}, toggle() {}, contains() { return false; } };
  }
  appendChild() {}
  insertAdjacentElement() {}
  insertAdjacentHTML() {}
  querySelector() { return null; }
  querySelectorAll() { return []; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) || null; }
  remove() {}
  removeAttribute() {}
  focus() {}
}

const store = new Map([["mytown-preferences-v1", JSON.stringify({ interests: ["子育て"], district: "直方駅周辺", civicDigest: "weekly", lifeNotifications: true })]]);
const deadlineFixtures = [
  { id: "open", title: "受付中の講座", summary: "対象は市内在住者です。", sourceUrl: "https://example.org/open", applicationDeadline: "2026-09-30", category: "健康・スポーツ" },
  { id: "closed", title: "終了した講座", summary: "対象は市内在住者です。", sourceUrl: "https://example.org/closed", applicationDeadline: "2026-08-31", category: "健康・スポーツ" },
];

const context = {
  Date: FixedDate,
  Intl,
  console,
  URL,
  HTMLElement: FakeElement,
  FormData: class {},
  requestAnimationFrame(callback) { callback(); },
  localStorage: {
    getItem(key) { return store.get(key) || null; },
    setItem(key, value) { store.set(key, String(value)); },
  },
  navigator: { userAgent: "" },
  location: { href: "https://example.org/", hash: "" },
  history: {
    state: {},
    replaceState(value) { this.state = value; },
    pushState(value) { this.state = value; },
    back() {},
  },
  window: {
    navigator: {},
    addEventListener() {},
    scrollTo() {},
    matchMedia() { return { matches: false }; },
  },
  document: {
    body: new FakeElement(),
    activeElement: null,
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement() { return new FakeElement(); },
  },
  state: {
    tab: "today",
    view: "tab",
    data: { ...latest, communityEvents: { events: [] }, community: { activities: [], organizations: [] }, bulletin: latest.bulletin || {} },
    civicPortal: { works: [] },
    politics: { council: { members: [] } },
    loading: false,
    loadError: false,
    priorVisitAt: null,
    discoverQuery: "",
    discoverCategory: null,
  },
  main: new FakeElement(),
  esc(value = "") { return String(value); },
  sourceLink(url, label = "公式ページ") { return url ? `<a href="${url}">${label}</a>` : ""; },
  syncBanner() { return ""; },
  emptyCard(message) { return `<p>${message}</p>`; },
  realCard(item) { return `<article><h3>${item.title}</h3><p>${item.summary || ""}</p><span>${item.statusLabel || ""}</span></article>`; },
  latestRow() { return ""; },
  japaneseDate() { return "9月5日"; },
  normalizeQuery(value = "") { return String(value).trim().replaceAll("ゴミ", "ごみ").toLowerCase(); },
  classifyTitle() { return "その他"; },
  discoverCategories: ["交通", "学校・教育", "健康・スポーツ", "議会", "ごみ", "観光・イベント", "地域活動", "工事・道路", "防災", "その他"],
  combinedSearchItems() { return [...latest.featured, ...deadlineFixtures]; },
  todayView() { return ""; },
  moneyView() { return ""; },
  showToast() {},
  render() {},
};
context.window.navigator = context.navigator;

vm.createContext(context);
vm.runInContext(uiSource, context, { filename: "ui-v2.js" });
vm.runInContext(p0Source, context, { filename: "p0-stability.js" });

assert.deepEqual(Array.from(context.state.v2Preferences.interests), ["子育て"]);
assert.match(context.v2CollectionView("services"), /就学時健康診断/);

const activeDeadlines = Array.from(context.v2FindDeadlines());
assert.ok(activeDeadlines.some((item) => item.id === "open"));
assert.ok(!activeDeadlines.some((item) => item.id === "closed"));
const deadlinePage = context.v2CollectionView("deadline");
assert.match(deadlinePage, /受付が終了した情報/);
assert.match(deadlinePage, /受付終了（申込期限 8月31日）/);

context.state.discoverQuery = "ごみの出し方";
context.state.discoverCategory = null;
assert.match(context.v2SearchHubView(), /ごみ・資源リサイクルの収集日/);
assert.match(context.v2SearchHubView(), /aria-pressed="true"/);

context.state.v2Page = "services";
context.state.tab = "today";
assert.equal(context.v2ActiveNav(), "search");
context.state.v2Page = "meeting";
assert.equal(context.v2ActiveNav(), "civic");

console.log("Trust UX regression checks passed");
