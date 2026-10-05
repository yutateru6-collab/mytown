import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
const base = process.env.VISUAL_QA_URL || 'http://127.0.0.1:4173/';
const output = process.env.VISUAL_QA_DIR || 'visual-qa-output';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined });
try {
 for (const width of [390, 1280]) {
  const context = await browser.newContext({ viewport:{width,height:844}, locale:'ja-JP', serviceWorkers:'block' });
  const page = await context.newPage();
  await page.goto(base, {waitUntil:'networkidle'});
  await page.locator('.v2-home-page .cb-entry').waitFor();
  for (const route of ['city-moves','business','projects']) {
   await page.locator(`[data-cb-route="${route}"]`).first().click();
   await page.locator('.cb-card').first().waitFor();
   assert.match(await page.locator('.cb-page').innerText(), /公式サービスではありません/);
   assert.ok(await page.locator('.cb-card').count() >= 1);
   await page.locator('.cb-card summary').first().click();
   assert.match(await page.locator('.cb-card').first().innerText(), /公式資料で確認した事実/);
   assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false,`${route}: overflow at ${width}`);
   await page.screenshot({path:path.join(output,`business-${route}-${width}.png`),fullPage:true});
  }
  await page.locator('.cb-filters input').fill('存在しない案件');
  await page.locator('.cb-filters button[type="submit"]').click();
  assert.match(await page.locator('.cb-empty').innerText(), /この条件に合う案件はありません/);
  await page.locator('[data-cb-clear]').click();
  await page.locator('.cb-card').first().waitFor();
  await page.reload({waitUntil:'networkidle'});
  await page.locator('.cb-page h1').waitFor();
  await page.locator('[data-v2-nav="civic"]').click();
  await page.locator('.politics-page').waitFor();
  await page.goBack({waitUntil:'domcontentloaded'});
  await page.locator('.cb-page').waitFor();
  await page.goForward({waitUntil:'domcontentloaded'});
  await page.locator('.politics-page').waitFor();
  await context.close();
 }
 const context=await browser.newContext({serviceWorkers:'block'}),page=await context.newPage();
 await page.route('**/data/civic-business.json',route=>route.fulfill({status:503,body:'unavailable'}));
 await page.goto(new URL('#business',base).href,{waitUntil:'networkidle'});
 await page.locator('[data-cb-retry]').waitFor();
 await page.unroute('**/data/civic-business.json');
 await page.locator('[data-cb-retry]').click();
 await page.locator('.cb-card').first().waitFor();
 await context.close();
 console.log('Civic/business mobile/desktop, filters, reload, history and retry passed');
} finally {await browser.close();}
