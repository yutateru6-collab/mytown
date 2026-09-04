import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseURL = process.env.VISUAL_QA_URL || "http://127.0.0.1:4173/";
const outputDir = process.env.VISUAL_QA_DIR || "visual-qa-output";
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  locale: "ja-JP",
  timezoneId: "Asia/Tokyo",
});
const page = await context.newPage();

try {
  const url = new URL(baseURL);
  url.searchParams.set("p0Qa", Date.now().toString());
  const response = await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: 60_000 });
  assert.ok(response?.ok(), `document returned ${response?.status()}`);
  await page.waitForLoadState("networkidle", { timeout: 25_000 }).catch(() => undefined);
  await page.locator(".v2-home-page").waitFor({ state: "visible", timeout: 20_000 });

  // Council timing must never leave a past date labelled as the next meeting.
  const councilState = await page.evaluate(() => ({
    current: state.data?.council?.nextDateLabel || "",
    source: state.data?.council?.p0SourceNextDateLabel || state.data?.council?.nextDateLabel || "",
  }));
  const match = /^(\d{1,2})\/(\d{1,2})/.exec(councilState.source);
  if (match) {
    const today = await page.evaluate(() => {
      const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
      const p = Object.fromEntries(parts.map((part) => [part.type, part.value]));
      return `${p.year}-${p.month}-${p.day}`;
    });
    const dateKey = `${today.slice(0, 4)}-${String(Number(match[1])).padStart(2, "0")}-${String(Number(match[2])).padStart(2, "0")}`;
    if (dateKey < today) assert.equal(councilState.current, "次回日程を確認中");
    if (dateKey === today) assert.match(councilState.current, /^本日/);
  }

  // Event actions must span the card, not fall into the old 56px icon column.
  await page.locator('.v4-primary-cta[data-v2-action="events"]').click();
  await page.locator(".v4-events-page").waitFor({ state: "visible" });
  const firstCard = page.locator(".v4-event-list-card").first();
  const actions = firstCard.locator(".ca-event-actions");
  await actions.waitFor({ state: "visible" });
  const geometry = await firstCard.evaluate((card) => {
    const action = card.querySelector(".ca-event-actions");
    const c = card.getBoundingClientRect();
    const a = action.getBoundingClientRect();
    return { cardWidth: c.width, actionWidth: a.width, actionLeft: a.left, cardLeft: c.left };
  });
  assert.ok(geometry.actionWidth >= geometry.cardWidth * 0.85, `event actions too narrow: ${JSON.stringify(geometry)}`);
  assert.ok(Math.abs(geometry.actionLeft - geometry.cardLeft) < 24, `event actions shifted into icon column: ${JSON.stringify(geometry)}`);
  await page.screenshot({ path: path.join(outputDir, "p0-events-list.png"), fullPage: false, scale: "css" });

  // Dedicated nearby navigation must open the real map surface.
  await page.locator('[data-v2-nav="nearby"]').click();
  await page.locator(".mytown-map-card").waitFor({ state: "visible", timeout: 20_000 });
  assert.match(await page.locator(".mytown-map-card").innerText(), /位置を確認できた情報/);
  await page.screenshot({ path: path.join(outputDir, "p0-nearby.png"), fullPage: false, scale: "css" });

  // Interest preferences must render and survive a save.
  await page.evaluate(() => v2HandleAction("settings"));
  await page.locator("#v2-preferences-form").waitFor({ state: "visible" });
  const interestBoxes = page.locator('.p0-interest-fieldset input[name="interests"]');
  assert.equal(await interestBoxes.count(), 8);
  const childCare = page.locator('.p0-interest-fieldset input[value="子育て"]');
  await childCare.check();
  await page.locator('#v2-preferences-form button[type="submit"]').click();
  const savedInterests = await page.evaluate(() => JSON.parse(localStorage.getItem("mytown-preferences-v1") || "{}").interests || []);
  assert.ok(savedInterests.includes("子育て"), "interest preference was discarded");

  // Search must include a community source outside the city-only base index.
  await page.evaluate(() => v2HandleNav("search"));
  await page.locator("#discover-search").fill("直方川づくり");
  await page.locator("#discover-form button").click();
  assert.match(await page.locator("#main").innerText(), /直方川づくり/);

  // Ask surface must describe its actual capability, not imply free-form document RAG.
  await page.evaluate(() => v2HandleAction("ask"));
  const askText = await page.locator("#main").innerText();
  assert.match(askText, /よくある質問から探す/);
  assert.match(askText, /資料横断の自由質問検索は準備中/);

  console.log("P0 browser regression checks passed");
} finally {
  await context.close();
  await browser.close();
}
