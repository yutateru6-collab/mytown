#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const latest = JSON.parse(fs.readFileSync(path.join(root, "data/latest.json"), "utf8"));
const source = fs.readFileSync(path.join(root, "ui-v2.js"), "utf8");

class FakeElement {
  constructor() {
    this.innerHTML = "";
    this.dataset = {};
    this.attributes = new Map();
    this.listeners = new Map();
    this.adjacent = [];
    this.classList = { add() {}, remove() {}, toggle() {} };
    this.scrollWidth = 900;
    this.clientWidth = 300;
    this.scrollLeft = 0;
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) || null; }
  removeAttribute(name) { this.attributes.delete(name); }
  appendChild() {}
  insertAdjacentElement(_position, element) { this.adjacent.push(element); }
  querySelectorAll() { return []; }
  querySelector(selector) {
    if (this.className !== "v2-filter-continuation") return null;
    if (!this.controls) this.controls = { previous: new FakeElement(), next: new FakeElement(), hint: new FakeElement() };
    if (selector === "span") return this.controls.hint;
    return selector.includes("previous") ? this.controls.previous : this.controls.next;
  }
  addEventListener(name, callback) {
    if (!this.listeners.has(name)) this.listeners.set(name, []);
    this.listeners.get(name).push(callback);
  }
  emit(name, event = {}) { (this.listeners.get(name) || []).forEach((callback) => callback(event)); }
  scrollBy(options) { this.scrollTo({ ...options, left: this.scrollLeft + options.left }); }
  scrollTo(options) {
    this.lastScroll = options;
    this.scrollLeft = Math.max(0, Math.min(this.scrollWidth - this.clientWidth, options.left));
    this.emit("scroll");
  }
}

let filterRows = [];
let reducedMotion = false;
const windowListeners = new Map();
const fixtures = [
  { id: "roadwork", title: "感田道路整備工事", category: "工事・道路", summary: "交通への影響を確認する工事情報です。", location: "感田", published: "2026-10-05" },
  { id: "timetable", title: "路線と時刻表の案内", category: "交通", summary: "公開された時刻表です。", published: "2026-09-01" },
  { id: "bus", title: "コミュニティバスの運行案内", category: "交通", summary: "路線の案内です。", published: "2026-08-01" },
  { id: "garbage", title: "ごみの出し方", category: "ごみ", summary: "資源の分別と収集日です。", published: "2026-10-05" },
];

const context = {
  console,
  Date,
  Intl,
  HTMLElement: FakeElement,
  location: { href: "https://example.org/", hash: "" },
  history: { state: {}, replaceState() {}, pushState() {}, back() {} },
  localStorage: { getItem() { return null; }, setItem() {} },
  window: {
    scrollTo() {},
    addEventListener(name, callback) { windowListeners.set(name, callback); },
    matchMedia() { return { matches: reducedMotion }; },
  },
  document: {
    body: new FakeElement(),
    addEventListener() {},
    createElement() { return new FakeElement(); },
    querySelector() { return null; },
    querySelectorAll(selector) { return selector.startsWith(".filter-row") ? filterRows : []; },
  },
  state: { tab: "today", view: "tab", loading: true, discoverQuery: "", discoverCategory: null, data: { featured: [], latest: [], bulletin: {} } },
  main: new FakeElement(),
  render() {},
  esc(value = "") { return String(value); },
  japaneseDate() { return "10月5日"; },
  normalizeQuery(value = "") { return String(value).trim().replaceAll("ゴミ", "ごみ").toLowerCase(); },
  classifyTitle() { return "その他"; },
  discoverCategories: ["交通", "ごみ", "工事・道路"],
  combinedSearchItems() { return fixtures; },
  realCard(item) { return `<article data-result="${item.id}"><h3>${item.title}</h3></article>`; },
  emptyCard(message) { return `<p>${message}</p>`; },
  syncBanner() { return ""; },
};

vm.createContext(context);
vm.runInContext(source, context, { filename: "ui-v2.js" });
context.state.v2Preferences = { district: "感田", interests: [] };

function resultIds(query, category = null) {
  context.state.discoverQuery = query;
  context.state.discoverCategory = category;
  return [...context.v2SearchHubView().matchAll(/data-result="([^"]+)"/g)].map((match) => match[1]);
}

assert.deepEqual(resultIds("バス"), ["bus", "timetable", "roadwork"], "bus and timetables must outrank newer, nearby roadwork");
assert.deepEqual(resultIds("時刻表"), ["timetable", "bus", "roadwork"]);
assert.deepEqual(resultIds("交通"), ["timetable", "bus", "roadwork"], "equally relevant transport items may use recency as the tie-breaker");
assert.deepEqual(resultIds("バス", "工事・道路"), ["roadwork"], "category restriction must still apply");
assert.deepEqual(resultIds("ごみの出し方"), ["garbage"]);
assert.deepEqual(resultIds(""), [], "an empty query must keep the search intro");
assert.equal(context.v2SearchRelevanceScore({}, "バス"), 0, "missing fields must be safe");
const actualBus = latest.featured.find((item) => /バス/.test(item.title));
assert.ok(actualBus, "the existing official bus item must be present");
assert.ok(context.v2SearchRelevanceScore(actualBus, "バス") > context.v2SearchRelevanceScore(fixtures[0], "バス"));

const row = new FakeElement();
row.setAttribute("aria-label", "カテゴリで絞る");
filterRows = [row];
context.v2EnhanceFilterRows();
const cue = row.adjacent[0];
const { previous, next, hint } = cue.controls;
assert.equal(cue.hidden, false);
assert.equal(row.getAttribute("tabindex"), "0");
assert.equal(row.getAttribute("role"), "group");
assert.equal(row.getAttribute("aria-describedby"), `${row.id}-hint`);
assert.match(cue.innerHTML, /aria-controls="v2-filter-row-1"/);
assert.equal(previous.disabled, true);
assert.equal(next.disabled, false);
assert.equal(hint.textContent, "右に続きがあります");

next.emit("click");
assert.equal(row.scrollLeft, 225);
assert.equal(row.lastScroll.behavior, "smooth");
assert.equal(previous.disabled, false);
assert.equal(hint.textContent, "左右に続きがあります");

let prevented = false;
row.emit("keydown", { target: row, key: "End", preventDefault() { prevented = true; } });
assert.equal(prevented, true);
assert.equal(row.scrollLeft, 600);
assert.equal(next.disabled, true);
assert.equal(hint.textContent, "左に続きがあります");

reducedMotion = true;
previous.emit("click");
assert.equal(row.lastScroll.behavior, "auto");
row.emit("keydown", { target: row, key: "Home", preventDefault() {} });
assert.equal(row.scrollLeft, 0);
context.v2EnhanceFilterRows();
assert.equal(row.adjacent.length, 1, "repeated nav syncs must not duplicate controls");
assert.equal(row.listeners.get("scroll").length, 1);

row.clientWidth = 1200;
windowListeners.get("resize")();
assert.equal(cue.hidden, true, "hide the continuation cue when all filters fit");
assert.equal(row.getAttribute("tabindex"), "-1");
assert.equal(row.getAttribute("aria-describedby"), null, "a nonoverflowing row must not announce hidden continuation text");
row.clientWidth = 300;
windowListeners.get("resize")();
assert.equal(cue.hidden, false, "the cue must return after resizing to a narrow viewport");

console.log("Search ranking and filter-scroll UX checks passed");
