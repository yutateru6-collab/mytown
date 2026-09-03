import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseURL = process.env.VISUAL_QA_URL || "http://127.0.0.1:4173/";
const outputDir = process.env.VISUAL_QA_DIR || "visual-qa-output";
const targetOrigin = new URL(baseURL).origin;
const criticalResourceTypes = new Set(["document", "script", "stylesheet", "fetch", "xhr", "image", "font"]);
const specs = [
  { name: "mobile-390", width: 390, height: 844, dpr: 3, mobile: true },
  { name: "compact-320", width: 320, height: 568, dpr: 2, mobile: true },
  { name: "desktop-1440", width: 1440, height: 900, dpr: 1, mobile: false },
];

function cacheBustedURL(label, attempt) {
  const url = new URL(baseURL);
  url.searchParams.set("visualQa", `${Date.now()}-${label}-${attempt}`);
  return url.href;
}

function criticalFailures(failures) {
  return failures.filter((failure) => failure.sameOrigin && criticalResourceTypes.has(failure.resourceType));
}

async function openStablePage(page, spec, diagnostics) {
  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    diagnostics.consoleErrors.length = 0;
    diagnostics.pageErrors.length = 0;
    diagnostics.networkFailures.length = 0;
    try {
      const response = await page.goto(cacheBustedURL(spec.name, attempt), {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      if (!response?.ok()) throw new Error(`${spec.name}: document returned HTTP ${response?.status() || "unknown"}`);
      await page.waitForLoadState("networkidle", { timeout: 25_000 }).catch(() => undefined);
      await page.locator(".v2-hero").waitFor({ state: "visible", timeout: 20_000 });
      const failures = criticalFailures(diagnostics.networkFailures);
      if (!failures.length && !diagnostics.pageErrors.length) return;
      lastError = new Error(`${spec.name}: critical resources failed: ${JSON.stringify(failures)}`);
    } catch (error) {
      lastError = error;
    }
    if (attempt < 3) await page.waitForTimeout(1_500 * attempt);
  }
  throw lastError || new Error(`${spec.name}: deployed page did not become stable`);
}

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
});
const report = { baseURL, generatedAt: new Date().toISOString(), captures: [] };
let fatalError = null;

try {
  for (const spec of specs) {
    const context = await browser.newContext({
      viewport: { width: spec.width, height: spec.height },
      deviceScaleFactor: spec.dpr,
      isMobile: spec.mobile,
      hasTouch: spec.mobile,
      locale: "ja-JP",
      timezoneId: "Asia/Tokyo",
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    const diagnostics = { consoleErrors: [], pageErrors: [], networkFailures: [] };
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const text = message.text();
      // Chromium's generic resource message has no URL. Response events below
      // retain the failing URL and decide whether the failure is critical.
      if (!/^Failed to load resource:/.test(text)) diagnostics.consoleErrors.push(text);
    });
    page.on("pageerror", (error) => diagnostics.pageErrors.push(error.message));
    page.on("response", (response) => {
      if (response.status() < 400) return;
      const request = response.request();
      const url = response.url();
      diagnostics.networkFailures.push({
        url,
        status: response.status(),
        resourceType: request.resourceType(),
        sameOrigin: new URL(url).origin === targetOrigin,
      });
    });
    page.on("requestfailed", (request) => {
      const url = request.url();
      diagnostics.networkFailures.push({
        url,
        status: 0,
        resourceType: request.resourceType(),
        sameOrigin: new URL(url).origin === targetOrigin,
        failure: request.failure()?.errorText || "request failed",
      });
    });

    try {
      await openStablePage(page, spec, diagnostics);
      await page.evaluate(async () => {
        const images = [...document.images];
        images.forEach((image) => { image.loading = "eager"; });
        await Promise.race([
          Promise.all(images.map((image) => image.decode().catch(() => undefined))),
          new Promise((resolve) => setTimeout(resolve, 10_000)),
        ]);
      });
      await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important;scroll-behavior:auto!important}" });

      const metrics = await page.evaluate(async ({ dpr }) => {
        const loadImage = (src) => new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve({ src, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight });
          image.onerror = reject;
          image.src = src;
        });
        const hero = document.querySelector(".v2-hero");
        const heroBox = hero.getBoundingClientRect();
        const background = getComputedStyle(hero).backgroundImage;
        const urls = [...background.matchAll(/url\(["']?(.*?)["']?\)/g)].map((match) => match[1]);
        const heroImage = await loadImage(urls.at(-1));
        const images = [...document.querySelectorAll('img[src*="assets/"]')].map((image) => {
          const box = image.getBoundingClientRect();
          const src = image.getAttribute("src") || "";
          return {
            src,
            isVector: /\.svg(?:[?#]|$)/i.test(src),
            naturalWidth: image.naturalWidth,
            naturalHeight: image.naturalHeight,
            renderedWidth: box.width,
            renderedHeight: box.height,
            widthDensity: box.width ? image.naturalWidth / box.width : null,
          };
        });
        return {
          dpr,
          viewport: { width: innerWidth, height: innerHeight },
          document: { scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth },
          hero: {
            ...heroImage,
            renderedWidth: heroBox.width,
            renderedHeight: heroBox.height,
            widthDensity: heroImage.naturalWidth / heroBox.width,
          },
          images,
        };
      }, { dpr: spec.dpr });

      const viewportPath = path.join(outputDir, `${spec.name}-viewport.png`);
      const heroPath = path.join(outputDir, `${spec.name}-hero.png`);
      const fullPath = path.join(outputDir, `${spec.name}-full.png`);
      await page.screenshot({ path: viewportPath, fullPage: false, scale: "device" });
      await page.locator(".v2-hero").screenshot({ path: heroPath, scale: "device" });
      await page.screenshot({ path: fullPath, fullPage: true, scale: "css" });

      const failures = criticalFailures(diagnostics.networkFailures);
      report.captures.push({
        ...spec,
        metrics,
        consoleErrors: diagnostics.consoleErrors,
        pageErrors: diagnostics.pageErrors,
        networkFailures: diagnostics.networkFailures,
        criticalFailures: failures,
        files: { viewportPath, heroPath, fullPath },
      });
      await writeFile(path.join(outputDir, "metrics.json"), `${JSON.stringify(report, null, 2)}\n`);

      assert.equal(metrics.document.scrollWidth, metrics.document.clientWidth, `${spec.name}: horizontal overflow`);
      const requiredDensity = spec.mobile ? spec.dpr : 1;
      assert.ok(metrics.hero.widthDensity >= requiredDensity, `${spec.name}: hero density ${metrics.hero.widthDensity.toFixed(2)}x < ${requiredDensity}x`);
      for (const image of metrics.images) {
        assert.ok(image.naturalWidth > 0 && image.naturalHeight > 0, `${spec.name}: undecoded ${image.src}`);
        if (image.renderedWidth > 0 && !image.isVector) {
          assert.ok(image.widthDensity >= requiredDensity, `${spec.name}: ${image.src} density ${image.widthDensity.toFixed(2)}x < ${requiredDensity}x`);
        }
      }
      assert.deepEqual(diagnostics.pageErrors, [], `${spec.name}: browser page errors`);
      assert.deepEqual(diagnostics.consoleErrors, [], `${spec.name}: browser console errors`);
      assert.deepEqual(failures, [], `${spec.name}: same-origin resource failures`);
    } finally {
      await context.close();
    }
  }
} catch (error) {
  fatalError = error;
  report.error = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
} finally {
  await browser.close();
  await writeFile(path.join(outputDir, "metrics.json"), `${JSON.stringify(report, null, 2)}\n`);
}

console.log(JSON.stringify(report, null, 2));
if (fatalError) throw fatalError;
