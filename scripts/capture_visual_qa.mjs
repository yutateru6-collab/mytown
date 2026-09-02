import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const baseURL = process.env.VISUAL_QA_URL || "http://127.0.0.1:4173/";
const outputDir = process.env.VISUAL_QA_DIR || "visual-qa-output";
const specs = [
  { name: "mobile-390", width: 390, height: 844, dpr: 3, mobile: true },
  { name: "compact-320", width: 320, height: 568, dpr: 2, mobile: true },
  { name: "desktop-1440", width: 1440, height: 900, dpr: 1, mobile: false },
];

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
});
const report = { baseURL, generatedAt: new Date().toISOString(), captures: [] };

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
    const consoleErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => consoleErrors.push(error.message));

    await page.goto(baseURL, { waitUntil: "networkidle", timeout: 60_000 });
    await page.locator(".v2-hero").waitFor({ state: "visible", timeout: 20_000 });
    await page.evaluate(async () => {
      await Promise.all([...document.images].map((image) => image.decode().catch(() => undefined)));
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

    assert.equal(metrics.document.scrollWidth, metrics.document.clientWidth, `${spec.name}: horizontal overflow`);
    const requiredDensity = spec.mobile ? spec.dpr : 1;
    assert.ok(metrics.hero.widthDensity >= requiredDensity, `${spec.name}: hero density ${metrics.hero.widthDensity.toFixed(2)}x < ${requiredDensity}x`);
    for (const image of metrics.images) {
      assert.ok(image.naturalWidth > 0 && image.naturalHeight > 0, `${spec.name}: undecoded ${image.src}`);
      // SVG is resolution-independent. Keep raster assets on the DPR density check,
      // while still requiring vectors to decode with valid intrinsic dimensions.
      if (image.renderedWidth > 0 && !image.isVector) {
        assert.ok(image.widthDensity >= requiredDensity, `${spec.name}: ${image.src} density ${image.widthDensity.toFixed(2)}x < ${requiredDensity}x`);
      }
    }
    assert.deepEqual(consoleErrors, [], `${spec.name}: browser console errors`);

    const viewportPath = path.join(outputDir, `${spec.name}-viewport.png`);
    const heroPath = path.join(outputDir, `${spec.name}-hero.png`);
    const fullPath = path.join(outputDir, `${spec.name}-full.png`);
    await page.screenshot({ path: viewportPath, fullPage: false, scale: "device" });
    await page.locator(".v2-hero").screenshot({ path: heroPath, scale: "device" });
    await page.screenshot({ path: fullPath, fullPage: true, scale: "css" });
    report.captures.push({ ...spec, metrics, consoleErrors, files: { viewportPath, heroPath, fullPath } });
    await context.close();
  }
} finally {
  await browser.close();
}

await writeFile(path.join(outputDir, "metrics.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
