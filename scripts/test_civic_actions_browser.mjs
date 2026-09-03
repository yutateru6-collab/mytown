import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseURL = process.env.VISUAL_QA_URL || "http://127.0.0.1:4173/";
const outputDir = process.env.VISUAL_QA_DIR || "visual-qa-output";
const targetOrigin = new URL(baseURL).origin;
const criticalResourceTypes = new Set(["document", "script", "stylesheet", "fetch", "xhr", "image", "font"]);
const report = {
  baseURL,
  generatedAt: new Date().toISOString(),
  checks: [],
  consoleErrors: [],
  pageErrors: [],
  networkFailures: [],
};

function cacheBustedURL(attempt) {
  const url = new URL(baseURL);
  url.searchParams.set("civicQa", `${Date.now()}-${attempt}`);
  return url.href;
}

function criticalFailures() {
  return report.networkFailures.filter((failure) => failure.sameOrigin && criticalResourceTypes.has(failure.resourceType));
}

async function openStablePage(page) {
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    report.consoleErrors.length = 0;
    report.pageErrors.length = 0;
    report.networkFailures.length = 0;
    try {
      const response = await page.goto(cacheBustedURL(attempt), { waitUntil: "domcontentloaded", timeout: 60_000 });
      if (!response?.ok()) throw new Error(`document returned HTTP ${response?.status() || "unknown"}`);
      await page.waitForLoadState("networkidle", { timeout: 25_000 }).catch(() => undefined);
      await page.locator(".v2-home-page").waitFor({ state: "visible", timeout: 20_000 });
      await page.locator("[data-ca-open-event-tip]").first().waitFor({ state: "visible", timeout: 20_000 });
      if (!criticalFailures().length && !report.pageErrors.length) return;
      lastError = new Error(`critical resources failed: ${JSON.stringify(criticalFailures())}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < 3) await page.waitForTimeout(1_500 * attempt);
  }
  throw lastError || new Error("deployed page did not become stable");
}

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
});
let fatalError = null;
let context = null;

try {
  context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
    reducedMotion: "reduce",
    acceptDownloads: true,
    geolocation: { latitude: 33.7436, longitude: 130.7296, accuracy: 25 },
    permissions: ["geolocation"],
  });
  await context.addInitScript(() => localStorage.clear());
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (!/^Failed to load resource:/.test(text)) report.consoleErrors.push(text);
  });
  page.on("pageerror", (error) => report.pageErrors.push(error.message));
  page.on("response", (response) => {
    if (response.status() < 400) return;
    const request = response.request();
    const url = response.url();
    report.networkFailures.push({
      url,
      status: response.status(),
      resourceType: request.resourceType(),
      sameOrigin: new URL(url).origin === targetOrigin,
    });
  });
  page.on("requestfailed", (request) => {
    const url = request.url();
    report.networkFailures.push({
      url,
      status: 0,
      resourceType: request.resourceType(),
      sameOrigin: new URL(url).origin === targetOrigin,
      failure: request.failure()?.errorText || "request failed",
    });
  });

  await openStablePage(page);
  await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}" });

  const homeText = await page.locator(".v2-home-page").innerText();
  assert.match(homeText, /このイベントも載せて！/);
  assert.match(homeText, /まちの気になる場所/);
  report.checks.push("home entry points");

  await page.locator("[data-ca-open-event-tip]").first().click();
  await page.locator("#ca-dialog-title").waitFor({ state: "visible" });
  assert.equal((await page.locator("#ca-dialog-title").innerText()).trim(), "このイベントも載せて！");
  await page.locator('#ca-event-tip-form input[name="eventUrl"]').fill("https://example.org/nogata-event");
  assert.match(await page.locator("#ca-dialog-body").innerText(), /URLだけで大丈夫です/);
  assert.match(await page.locator("#ca-dialog-body").innerText(), /公開GitHub Issue/);
  await page.screenshot({ path: path.join(outputDir, "civic-event-url-tip.png"), fullPage: false, scale: "css" });
  report.checks.push("URL-only event tip dialog");
  await page.locator(".ca-dialog-close").click();
  await page.locator("#ca-dialog-root").waitFor({ state: "hidden" });

  await page.locator("[data-ca-open-report]").first().click();
  await page.locator("#ca-report-form").waitFor({ state: "visible" });
  await page.locator('#ca-report-form select[name="category"]').selectOption("park");
  await page.locator('#ca-report-form input[name="locationText"]').fill("テスト公園の入口近く");
  await page.locator('#ca-report-form textarea[name="description"]').fill("ベンチの板が外れており、子どもが触ると危ない状態です。");
  await page.locator('#ca-report-form input[name="danger"]').check();
  const pixelPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl1m08AAAAASUVORK5CYII=",
    "base64",
  );
  await page.locator("#ca-report-photo").setInputFiles({
    name: "broken-bench.png",
    mimeType: "image/png",
    buffer: pixelPng,
  });
  await page.locator("[data-ca-get-location]").click();
  await page.locator("#ca-location-status").filter({ hasText: "位置情報を取得しました" }).waitFor({ timeout: 15_000 });
  assert.match(await page.locator("#ca-report-photo-preview").innerText(), /broken-bench\.png/);
  await page.screenshot({ path: path.join(outputDir, "civic-report-form.png"), fullPage: false, scale: "css" });

  await page.locator('#ca-report-form button[type="submit"]').click();
  await page.locator("#ca-report-output").waitFor({ state: "visible" });
  assert.equal((await page.locator("#ca-dialog-title").innerText()).trim(), "届け先と文面を確認");
  assert.match(await page.locator(".ca-route-summary").innerText(), /公園街路係/);
  const reportText = await page.locator("#ca-report-output").inputValue();
  assert.match(reportText, /テスト公園の入口近く/);
  assert.match(reportText, /子どもが触ると危ない/);
  assert.match(reportText, /33\.743600/);
  const councilDetails = page.locator(".ca-council-details");
  assert.match(await councilDetails.locator("summary").innerText(), /市議会へ正式に要望/);
  await councilDetails.locator("summary").click();
  assert.match(await councilDetails.innerText(), /請願・陳情/);
  await page.screenshot({ path: path.join(outputDir, "civic-report-routing.png"), fullPage: false, scale: "css" });
  report.checks.push("photo, geolocation and official civic routing");
  await page.locator(".ca-dialog-close").click();
  await page.locator("#ca-dialog-root").waitFor({ state: "hidden" });

  await page.locator('.v4-primary-cta[data-v2-action="events"]').click();
  await page.locator(".v4-events-page").waitFor({ state: "visible", timeout: 20_000 });
  const lifecycleText = await page.locator(".ca-lifecycle").innerText();
  for (const label of ["見つける", "自分向けか判断", "保存", "締切を忘れない", "カレンダー", "当日の変更確認", "次の場所・活動へ"]) {
    assert.match(lifecycleText, new RegExp(label));
  }
  assert.match(await page.locator(".v4-event-contribute").innerText(), /このイベントも載せて！/);

  const busCard = page.locator(".v4-event-list-card").filter({ hasText: "のおがたを知る一日" }).first();
  await busCard.waitFor({ state: "visible" });
  const busText = await busCard.innerText();
  assert.match(busText, /受付終了/);
  assert.match(busText, /5,000円/);
  assert.doesNotMatch(busText, /申込み受付中/);

  const cinnaCard = page.locator(".v4-event-list-card").filter({ hasText: "シナモロールがあそびにくるよ" }).first();
  await cinnaCard.waitFor({ state: "visible" });
  assert.doesNotMatch(await cinnaCard.innerText(), /費用\s*1,100円/);

  const walkCard = page.locator(".v4-event-list-card").filter({ hasText: "筑豊高校生と巡る直方まち歩き" }).first();
  await walkCard.waitFor({ state: "visible" });
  const walkText = await walkCard.innerText();
  assert.doesNotMatch(walkText, /(?:^|[^0-9])000円/);
  assert.match(walkText, /1,000円/);
  report.checks.push("event status, reviewed price and merchandise-price suppression");

  const firstSave = page.locator("[data-ca-save-event-id]").first();
  await firstSave.click();
  await page.locator(".v4-events-page").waitFor({ state: "visible" });
  await page.locator("[data-ca-save-event-id].is-saved").first().waitFor({ state: "visible" });

  const downloadPromise = page.waitForEvent("download", { timeout: 15_000 });
  await page.locator("[data-ca-calendar-event-id]").first().click();
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /\.ics$/);
  report.checks.push("save and iCalendar download");

  await page.locator("[data-ca-open-saved]").first().click();
  await page.locator(".ca-saved-card").first().waitFor({ state: "visible" });
  assert.match(await page.locator("#ca-dialog-body").innerText(), /当日の変更を確認/);
  assert.match(await page.locator("#ca-dialog-body").innerText(), /参加した/);
  await page.screenshot({ path: path.join(outputDir, "civic-saved-events.png"), fullPage: false, scale: "css" });
  report.checks.push("saved-event follow-through");

  const dialogOverflow = await page.locator(".ca-dialog").evaluate((dialog) => ({
    scrollWidth: dialog.scrollWidth,
    clientWidth: dialog.clientWidth,
  }));
  assert.ok(dialogOverflow.scrollWidth <= dialogOverflow.clientWidth + 1, "saved-events dialog has horizontal overflow");
  assert.deepEqual(report.pageErrors, [], "browser page errors during civic-action flow");
  assert.deepEqual(report.consoleErrors, [], "browser console errors during civic-action flow");
  assert.deepEqual(criticalFailures(), [], "same-origin resource failures during civic-action flow");
} catch (error) {
  fatalError = error;
  report.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
} finally {
  if (context) await context.close();
  await browser.close();
  await writeFile(path.join(outputDir, "civic-actions-e2e.json"), `${JSON.stringify(report, null, 2)}\n`);
}

console.log(JSON.stringify(report, null, 2));
if (fatalError) throw fatalError;
