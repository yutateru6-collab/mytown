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

  // A home event card must open the selected event, not drop the user at the top of the list.
  const homeEvent = page.locator(".v4-home-event-card").first();
  const homeEventTitle = (await homeEvent.locator("strong").innerText()).trim();
  await homeEvent.click();
  assert.equal((await page.locator(".detail-hero h1").innerText()).trim(), homeEventTitle);
  assert.match(await page.locator(".ca-event-actions").innerText(), /保存する|保存済み/);
  await page.evaluate(() => v2HandleAction("home"));

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

  // The second bottom navigation item must open the mayor/council overview.
  await page.locator('[data-v2-nav="civic"]').click();
  await page.locator(".politics-page").waitFor({ state: "visible", timeout: 20_000 });
  assert.match(await page.locator(".politics-page").innerText(), /市長・市議会を知る/);
  assert.equal(await page.locator(".mytown-map-card").count(), 0, "civic navigation opened the nearby map");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(".politics-page").waitFor({ state: "visible", timeout: 20_000 });
  assert.match(await page.locator(".politics-page").innerText(), /市長・市議会を知る/);
  const legacyNearbyURL = new URL(baseURL);
  legacyNearbyURL.hash = "#nearby";
  await page.goto(legacyNearbyURL.href, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.locator(".politics-page").waitFor({ state: "visible", timeout: 20_000 });
  assert.match(await page.locator(".politics-page").innerText(), /市長・市議会を知る/);
  assert.equal(await page.locator(".mytown-map-card").count(), 0, "legacy nearby URL opened the nearby map");
  await page.screenshot({ path: path.join(outputDir, "p0-civic-people.png"), fullPage: false, scale: "css" });

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

  // The search example promised in the UI must work with an everyday phrase.
  await page.locator("#discover-search").fill("ごみの出し方");
  await page.locator("#discover-form button").click();
  assert.match(await page.locator("#main").innerText(), /ごみ・資源リサイクルの収集日/);
  assert.equal(await page.locator('.filter-chip[aria-pressed="true"]').count(), 1);

  // Service and deadline child pages keep the discovery tab active and separate closed applications.
  await page.evaluate(() => v2HandleAction("services"));
  assert.match(await page.locator("#main").innerText(), /就学時健康診断/);
  assert.equal(await page.locator('[data-v2-nav="search"]').getAttribute("aria-current"), "page");
  await page.evaluate(() => v2HandleAction("deadline"));
  assert.match(await page.locator("#main").innerText(), /受付前・受付中/);
  assert.match(await page.locator(".v2-closed-deadlines summary").innerText(), /受付が終了した情報/);
  assert.equal(await page.locator('[data-v2-nav="search"]').getAttribute("aria-current"), "page");

  // A 30-second entry opens only the short layer until the user asks for more.
  await page.evaluate(() => v2HandleAction("home"));
  await page.locator('[data-v2-detail-id="community-bus-20261001"]').first().click();
  assert.match(await page.locator("#main").innerText(), /3分で詳しく読む/);
  assert.equal(await page.locator("#main").getByText("背景・費用・決まり方", { exact: true }).count(), 0);
  await page.locator('[data-section="details"]').click();
  assert.match(await page.locator("#main").innerText(), /背景・費用・決まり方/);

  // Ask surface must describe its actual capability, not imply free-form document RAG.
  await page.evaluate(() => v2HandleAction("ask"));
  const askText = await page.locator("#main").innerText();
  assert.match(askText, /よくある質問から探す/);
  assert.match(askText, /資料横断の自由質問検索は準備中/);
  await page.locator("#ask-input").fill("子どもが生まれたら使える制度は？");
  await page.locator("#ask-form button").click();
  const unanswered = await page.locator(".answer-card").innerText();
  assert.match(unanswered, /まだ取り込み途中/);
  assert.match(unanswered, /情報がない、という意味ではありません/);
  assert.doesNotMatch(unanswered, /聞き方を変えて/);

  console.log("P0 browser regression checks passed");
} finally {
  await context.close();
  await browser.close();
}
