import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseURL = process.env.VISUAL_QA_URL || "http://127.0.0.1:4173/";
const outputDir = process.env.FULL_AUDIT_DIR || "full-product-audit";

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const report = {
  baseURL,
  generatedAt: new Date().toISOString(),
  screens: [],
  errors: [],
};

function cacheBustedURL(label) {
  const url = new URL(baseURL);
  url.searchParams.set("fullAudit", `${Date.now()}-${label}`);
  return url.href;
}

async function waitForApp(page) {
  await page.goto(cacheBustedURL("start"), { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForLoadState("networkidle", { timeout: 25_000 }).catch(() => undefined);
  await page.locator(".v2-hero").waitFor({ state: "visible", timeout: 20_000 });
  await page.waitForTimeout(1200);
  await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}" });
}

async function screenMetrics(page) {
  return page.evaluate(() => {
    const visible = (element) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return style.visibility !== "hidden" && style.display !== "none" && box.width > 0 && box.height > 0;
    };
    const labelFor = (element) => {
      const text = (element.innerText || element.value || "").replace(/\s+/g, " ").trim();
      return element.getAttribute("aria-label") || element.getAttribute("title") || text;
    };
    const interactive = [...document.querySelectorAll("button,a[href],input,select,textarea,summary")].filter(visible);
    const smallTargets = interactive.map((element) => {
      const box = element.getBoundingClientRect();
      return {
        tag: element.tagName.toLowerCase(),
        label: labelFor(element).slice(0, 100),
        width: Math.round(box.width * 10) / 10,
        height: Math.round(box.height * 10) / 10,
      };
    }).filter((item) => item.width < 44 || item.height < 44);
    const unnamedControls = interactive.filter((element) => !labelFor(element)).map((element) => element.outerHTML.slice(0, 180));
    const textNodes = [...document.querySelectorAll("body *")].filter((element) => {
      if (!visible(element)) return false;
      if (["SCRIPT", "STYLE", "SVG", "PATH"].includes(element.tagName)) return false;
      return [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
    });
    const fontSizes = textNodes.map((element) => Number.parseFloat(getComputedStyle(element).fontSize)).filter(Number.isFinite);
    const headings = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].filter(visible).map((element) => ({
      level: Number(element.tagName.slice(1)),
      text: (element.innerText || "").replace(/\s+/g, " ").trim().slice(0, 140),
    }));
    const duplicateIds = Object.entries([...document.querySelectorAll("[id]")].reduce((acc, element) => {
      acc[element.id] = (acc[element.id] || 0) + 1;
      return acc;
    }, {})).filter(([, count]) => count > 1);
    const nav = document.querySelector(".bottom-nav");
    const navBox = nav?.getBoundingClientRect();
    const covered = navBox ? [...document.querySelectorAll("main button,main a[href],main input,main select,main textarea")]
      .filter(visible)
      .map((element) => {
        const box = element.getBoundingClientRect();
        return { element, box };
      })
      .filter(({ box }) => box.top < navBox.bottom && box.bottom > navBox.top)
      .map(({ element, box }) => ({ label: labelFor(element).slice(0, 100), top: Math.round(box.top), bottom: Math.round(box.bottom) })) : [];
    return {
      url: location.href,
      title: document.title,
      viewport: { width: innerWidth, height: innerHeight },
      document: {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollHeight: document.documentElement.scrollHeight,
      },
      bodyTextLength: (document.body.innerText || "").length,
      interactiveCount: interactive.length,
      smallTargetCount: smallTargets.length,
      smallTargets: smallTargets.slice(0, 40),
      unnamedControlCount: unnamedControls.length,
      unnamedControls: unnamedControls.slice(0, 20),
      fontUnder14Count: fontSizes.filter((size) => size < 14).length,
      fontUnder16Count: fontSizes.filter((size) => size < 16).length,
      headings,
      duplicateIds,
      bottomNav: navBox ? { top: Math.round(navBox.top), height: Math.round(navBox.height) } : null,
      coveredInteractiveControls: covered,
      mainText: (document.querySelector("main")?.innerText || "").replace(/\n{3,}/g, "\n\n").slice(0, 8000),
    };
  });
}

async function capture(page, name, { fullPage = false } = {}) {
  await page.waitForTimeout(500);
  const file = path.join(outputDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage, scale: "css" });
  const metrics = await screenMetrics(page);
  report.screens.push({ name, file, fullPage, metrics });
  await writeFile(path.join(outputDir, "full-audit.json"), `${JSON.stringify(report, null, 2)}\n`);
}

async function safeStep(name, fn) {
  try {
    await fn();
  } catch (error) {
    report.errors.push({ name, error: error instanceof Error ? `${error.name}: ${error.message}` : String(error) });
  }
}

const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  locale: "ja-JP",
  timezoneId: "Asia/Tokyo",
  reducedMotion: "reduce",
});
const page = await context.newPage();
page.on("pageerror", (error) => report.errors.push({ name: "pageerror", error: error.message }));
page.on("console", (message) => {
  if (message.type() === "error" && !/^Failed to load resource:/.test(message.text())) {
    report.errors.push({ name: "console", error: message.text() });
  }
});

await safeStep("home", async () => {
  await waitForApp(page);
  await capture(page, "01-home-first-fold");
  await capture(page, "02-home-full", { fullPage: true });
});

await safeStep("events", async () => {
  const trigger = page.locator('[data-v2-action="events"]').first();
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  await page.locator(".v4-events-page").waitFor({ state: "visible", timeout: 15_000 });
  await capture(page, "03-events-list");
  await capture(page, "04-events-list-full", { fullPage: true });
});

await safeStep("search", async () => {
  await page.locator('[data-v2-nav="search"]').click();
  await page.locator("#discover-search").waitFor({ state: "visible", timeout: 15_000 });
  await capture(page, "05-search-start");
  await page.locator("#discover-search").fill("バス");
  await page.locator("#discover-form").evaluate((form) => form.requestSubmit());
  await page.waitForTimeout(500);
  await capture(page, "06-search-bus-results");
  await capture(page, "07-search-bus-results-full", { fullPage: true });
});

await safeStep("civic", async () => {
  await page.locator('[data-v2-nav="civic"]').click();
  await page.locator(".civic-menu-grid").waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForTimeout(800);
  await capture(page, "08-civic-home");
  await capture(page, "09-civic-home-full", { fullPage: true });
});

await safeStep("budget", async () => {
  await page.locator('.civic-menu-card[data-v2-action="money"]').click();
  await page.locator(".civic-budget-page").waitFor({ state: "visible", timeout: 15_000 });
  await capture(page, "10-budget");
  await capture(page, "11-budget-full", { fullPage: true });
});

await safeStep("people", async () => {
  await page.locator('[data-v2-nav="civic"]').click();
  await page.locator('[data-politics-section="people"]').first().click();
  await page.locator(".politics-page").waitFor({ state: "visible", timeout: 15_000 });
  await capture(page, "12-city-leaders");
  await capture(page, "13-city-leaders-full", { fullPage: true });
});

await safeStep("notifications", async () => {
  await page.locator('[data-v2-nav="notifications"]').click();
  await page.getByRole("heading", { name: "暮らしと市の動き" }).waitFor({ state: "visible", timeout: 15_000 });
  await capture(page, "14-notifications");
  await capture(page, "15-notifications-full", { fullPage: true });
});

await safeStep("menu", async () => {
  await page.locator('[data-v2-nav="menu"]').click();
  await page.locator(".v2-menu-grid").waitFor({ state: "visible", timeout: 15_000 });
  await capture(page, "16-menu");
});

await safeStep("settings", async () => {
  await page.locator('[data-v2-action="settings"]').first().click();
  await page.locator(".v2-preferences-form").waitFor({ state: "visible", timeout: 15_000 });
  await capture(page, "17-settings");
  await capture(page, "18-settings-full", { fullPage: true });
});

await safeStep("nearby", async () => {
  await page.locator('[data-v2-nav="home"]').click();
  await page.locator(".v2-hero").waitFor({ state: "visible", timeout: 15_000 });
  const trigger = page.locator('[data-v2-action="nearby"]').first();
  await trigger.scrollIntoViewIfNeeded();
  await trigger.click();
  await page.locator("#mytown-nearby-map, .mytown-map-card").first().waitFor({ state: "visible", timeout: 20_000 });
  await page.waitForTimeout(2500);
  await capture(page, "19-nearby-map");
  await capture(page, "20-nearby-map-full", { fullPage: true });
});

await safeStep("ask", async () => {
  await page.locator('[data-v2-nav="menu"]').click();
  await page.locator('[data-v2-action="ask"]').first().click();
  await page.waitForTimeout(1000);
  await capture(page, "21-ask-machinavi");
  await capture(page, "22-ask-machinavi-full", { fullPage: true });
});

await context.close();

const personalized = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  isMobile: true,
  hasTouch: true,
  locale: "ja-JP",
  timezoneId: "Asia/Tokyo",
  reducedMotion: "reduce",
});
await personalized.addInitScript(() => {
  localStorage.setItem("mytown-preferences-v1", JSON.stringify({
    district: "直方駅周辺",
    garbageArea: "east",
    interests: [],
    lifeNotifications: true,
    civicDigest: "weekly",
  }));
});
const personalizedPage = await personalized.newPage();
await safeStep("personalized-home", async () => {
  await waitForApp(personalizedPage);
  await capture(personalizedPage, "23-home-configured");
});
await personalized.close();

await browser.close();
await writeFile(path.join(outputDir, "full-audit.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
