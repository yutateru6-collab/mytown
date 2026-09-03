import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { chromium } from "playwright";

const require = createRequire(import.meta.url);
const axeSource = await readFile(require.resolve("axe-core/axe.min.js"), "utf8");
const baseURL = process.env.VISUAL_QA_URL || "http://127.0.0.1:4173/";
const outputDir = process.env.FULL_AUDIT_DIR || "full-product-audit";
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  locale: "ja-JP",
  timezoneId: "Asia/Tokyo",
  reducedMotion: "reduce",
  geolocation: { latitude: 33.7436, longitude: 130.7296, accuracy: 25 },
  permissions: ["geolocation"],
});
const page = await context.newPage();
const report = { baseURL, generatedAt: new Date().toISOString(), screens: [], errors: [] };

async function waitForApp(hash = "") {
  const url = new URL(baseURL);
  url.searchParams.set("axeAudit", `${Date.now()}-${hash || "home"}`);
  url.hash = hash;
  await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 25_000 }).catch(() => undefined);
  await page.locator("main .page").first().waitFor({ state: "visible", timeout: 20_000 });
  await page.waitForTimeout(700);
}

async function scan(name) {
  try {
    await page.addScriptTag({ content: axeSource });
    const result = await page.evaluate(async () => window.axe.run(document, {
      runOnly: {
        type: "tag",
        values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
      },
      resultTypes: ["violations", "incomplete"],
    }));
    report.screens.push({
      name,
      url: page.url(),
      violations: result.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        description: violation.description,
        help: violation.help,
        nodes: violation.nodes.map((node) => ({
          target: node.target,
          html: node.html,
          failureSummary: node.failureSummary,
        })),
      })),
      incomplete: result.incomplete.map((item) => ({
        id: item.id,
        impact: item.impact,
        help: item.help,
        nodeCount: item.nodes.length,
      })),
    });
  } catch (error) {
    report.errors.push({ name, error: error instanceof Error ? `${error.name}: ${error.message}` : String(error) });
  }
}

for (const [name, hash] of [
  ["home", ""],
  ["events", "events"],
  ["search", "search"],
  ["civic-home", "politics"],
  ["budget", "money"],
  ["works", "works"],
  ["notifications", "notifications"],
  ["menu", "menu"],
  ["settings", "settings"],
  ["ask", "ask"],
  ["participation", "participate"],
]) {
  await waitForApp(hash);
  await scan(name);
}

await waitForApp("");
await page.locator("[data-ca-open-event-tip]").first().click();
await page.locator("#ca-dialog-title").waitFor({ state: "visible" });
await scan("event-tip-dialog");
await page.locator(".ca-dialog-close").click();

await page.locator("[data-ca-open-report]").first().click();
await page.locator("#ca-report-form").waitFor({ state: "visible" });
await scan("civic-report-dialog");

await context.close();
await browser.close();
await writeFile(path.join(outputDir, "axe-audit.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  screens: report.screens.map((screen) => ({ name: screen.name, violations: screen.violations.length, incomplete: screen.incomplete.length })),
  errors: report.errors,
}, null, 2));
