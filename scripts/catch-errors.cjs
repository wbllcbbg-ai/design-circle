// @ts-check
const { chromium } = require("playwright");
(async () => {
  const BASE = "http://localhost:3001";
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();

  // 捕获所有错误
  page.on("console", msg => { if (msg.type() === "error") console.log(`[console.error] ${msg.text().slice(0, 200)}`); });
  page.on("pageerror", err => console.log(`[pageerror] ${err.message.slice(0, 300)}`));

  // 登录
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await (await page.$('input[type="email"]')).fill("test.client@e2e.test");
  await (await page.$('input[type="password"]')).fill("TestE2E@2026");
  await Promise.all([page.waitForNavigation({ timeout: 10000 }).catch(() => {}), (await page.$('button[type="submit"]')).click()]);
  await page.waitForTimeout(2500);

  console.log("\n=== 案例详情错误 ===");
  await page.goto(`${BASE}/cases`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const cards = await page.$$('a[href*="/cases/"]');
  if (cards.length) {
    await cards[0].click();
    await page.waitForTimeout(4000);
  }

  console.log("\n=== 设计师详情错误 ===");
  await page.goto(`${BASE}/designers`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const dLinks = await page.$$('a[href*="/designers/"]');
  if (dLinks.length) {
    await dLinks[0].click();
    await page.waitForTimeout(4000);
  }

  console.log("\n=== 材料商详情错误 ===");
  await page.goto(`${BASE}/discover`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  const supTab = await page.$('button:has-text("材料商")');
  if (supTab) { await supTab.click(); await page.waitForTimeout(2000); }
  const supLinks = await page.$$('a[href*="/merchants/supplier/"]');
  if (supLinks.length) {
    await supLinks[0].click();
    await page.waitForTimeout(4000);
  }

  await browser.close();
  console.log("\n=== 完成 ===");
})();
