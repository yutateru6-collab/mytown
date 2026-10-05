#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const currentData = JSON.parse(fs.readFileSync(path.join(root, "data/bulletin.json"), "utf8"));
const source = fs.readFileSync(path.join(root, "bulletin-reader.js"), "utf8");
const oldPdf = "https://www.city.nogata.fukuoka.jp/library/data/siseijouhou/PDF/shihounoogata/R03/0305/030501_shiho_web_01.pdf";

function reader(data = structuredClone(currentData)) {
  const frame = { src: "", title: "" };
  const fallback = { href: "" };
  const label = { textContent: "" };
  const handlers = new Map();
  const main = { innerHTML: "" };
  const context = {
    console, URL, Date,
    state: { data: { bulletin: data }, view: "tab", tab: "today", v2Page: "bulletin", bulletinReaderUrl: oldPdf },
    main,
    esc(value = "") { return String(value).replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;"); },
    location: { hash: "#bulletin" },
    window: { scrollTo() {} },
    document: {
      addEventListener(type, handler) { handlers.set(type, handler); },
      querySelector(selector) {
        return ({ ".bulletin-reader-frame": frame, "[data-bulletin-fallback]": fallback, "[data-bulletin-current-label]": label, ".bulletin-reader-card": { scrollIntoView() {} } })[selector] || null;
      },
      querySelectorAll() { return []; },
    },
    v2ApplyHashRoute() {}, v2SyncNav() {}, render() {},
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "bulletin-reader.js" });
  return { context, main, frame, fallback, label, handlers };
}

const expectedPages = currentData.pages.length;
const expectedTotal = expectedPages + (currentData.currentIssue.wholePdfUrl ? 1 : 0);
const firstLabel = currentData.pages[0].pageLabel.replace(/\s*[-－]\s*/g, "〜").replace(/\s+ページ/g, "ページ");
const actual = reader();
assert.ok(actual.main.innerHTML.includes(`<span>${expectedTotal}件</span>`), "current verified page groups plus whole issue");
assert.equal((actual.main.innerHTML.match(/data-bulletin-pdf=/g) || []).length, expectedTotal);
assert.doesNotMatch(actual.main.innerHTML, /\/R03\/|\/R04\//);
assert.equal(actual.context.state.bulletinReaderUrl, currentData.currentIssue.wholePdfUrl || currentData.pages[0].pdfUrl, "stale selection resets to a matching document");

const stale = structuredClone(currentData);
stale.pages.unshift({ ...stale.pages[0], pdfUrl: oldPdf, pageLabel: "市報PDF" });
stale.pages.push({ ...stale.pages[0], pdfUrl: currentData.pages[0].pdfUrl + "#page=1" });
stale.pages.push({ ...currentData.pages[0], pdfUrl: currentData.pages[0].pdfUrl + "?download=1" });
stale.pages.push({ ...currentData.pages[0], issueKey: "R0-00" });
stale.pages.push({ ...currentData.pages[0], pdfUrl: currentData.currentIssue.wholePdfUrl });
stale.pages.push({ ...currentData.pages[0], pdfUrl: currentData.pages[0].pdfUrl.replace(/(\/R\d+\/)(\d{2}|\d{4})\//, (_match, prefix, month) => prefix + (month.endsWith("12") ? "01" : "12") + "/") });
stale.pages.push({ ...currentData.pages[0], pdfUrl: currentData.pages[0].pdfUrl.replace(/(\d{4})\d{2}(_shiho_web)/, (_match, prefix, suffix) => prefix + "32" + suffix) });
stale.pages.push({ ...currentData.pages[0], pdfUrl: currentData.pages[0].pdfUrl.replace("www.city.nogata.fukuoka.jp", "example.com") });
const guarded = reader(stale);
assert.equal((guarded.main.innerHTML.match(/data-bulletin-pdf=/g) || []).length, expectedTotal, "cached wrong-issue links and duplicate files are filtered");
assert.doesNotMatch(guarded.main.innerHTML, /example.com|\d{4}32_shiho_web|issueKey/);

function select(result, url, label = "市報PDF") {
  const button = { dataset: { bulletinPdf: url, bulletinLabel: label } };
  result.handlers.get("click")({ target: { closest() { return button; } }, preventDefault() {} });
}
select(guarded, oldPdf);
assert.equal(guarded.frame.src, "", "an unlisted injected selection cannot open an old PDF");
select(guarded, currentData.pages[0].pdfUrl);
assert.equal(guarded.frame.src, currentData.pages[0].pdfUrl);
assert.equal(guarded.fallback.href, currentData.pages[0].pdfUrl);
assert.equal(guarded.label.textContent, firstLabel);
assert.ok(guarded.frame.title.includes(firstLabel));

const invalidWhole = structuredClone(currentData);
invalidWhole.currentIssue.wholePdfUrl = oldPdf;
const pageOnly = reader(invalidWhole);
assert.ok(pageOnly.main.innerHTML.includes(`<span>${expectedPages}件</span>`));
assert.equal(pageOnly.context.state.bulletinReaderUrl, currentData.pages[0].pdfUrl);
const empty = reader({ archiveUrl: currentData.archiveUrl, currentIssue: invalidWhole.currentIssue, pages: [{ ...currentData.pages[0], pdfUrl: oldPdf }] });
assert.match(empty.main.innerHTML, /最新号を表示できませんでした/);
assert.doesNotMatch(empty.main.innerHTML, /<iframe/);

console.log("Bulletin reader scope and duplicate regression checks passed");
