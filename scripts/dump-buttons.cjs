// @ts-check
const { chromium } = require("playwright");
(async () => {
  const BASE = "http://localhost:3001";
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  // 登录
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await (await page.$('input[type="email"]')).fill("test.client@e2e.test");
  await (await page.$('input[type="password"]')).fill("TestE2E@2026");
  await Promise.all([page.waitForNavigation({ timeout: 10000 }).catch(() => {}), (await page.$('button[type="submit"]')).click()]);
  await page.waitForTimeout(2500);

  // 进案例详情
  await page.goto(`${BASE}/cases`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const cards = await page.$$('a[href*="/cases/"]');
  if (cards.length) { await cards[0].click(); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2500); }

  console.log("=== 案例详情页所有按钮 ===");
  const btns = await page.$$eval("button", els => els.map(e => ({
    text: e.textContent?.trim().slice(0, 30),
    html: e.innerHTML.slice(0, 80),
    cls: e.className.slice(0, 60),
  })));
  btns.forEach((b, i) => console.log(`  [${i}] text="${b.text}" cls="${b.cls}"`));

  console.log("\n=== 设计师详情页所有按钮 ===");
  await page.goto(`${BASE}/designers`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const dLinks = await page.$$('a[href*="/designers/"]');
  if (dLinks.length) { await dLinks[0].click(); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2000); }
  const btns2 = await page.$$eval("button", els => els.map(e => ({
    text: e.textContent?.trim().slice(0, 30),
    cls: e.className.slice(0, 60),
  })));
  btns2.forEach((b, i) => console.log(`  [${i}] text="${b.text}" cls="${b.cls}"`));

  console.log("\n=== 材料商详情页所有按钮 ===");
  await page.goto(`${BASE}/discover`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  const supTab = await page.$('button:has-text("材料商")');
  if (supTab) { await supTab.click(); await page.waitForTimeout(2000); }
  const supLinks = await page.$$('a[href*="/merchants/supplier/"]');
  if (supLinks.length) { await supLinks[0].click(); await page.waitForLoadState("networkidle"); await page.waitForTimeout(2000); }
  const btns3 = await page.$$eval("button", els => els.map(e => ({
    text: e.textContent?.trim().slice(0, 30),
    cls: e.className.slice(0, 60),
  })));
  btns3.forEach((b, i) => console.log(`  [${i}] text="${b.text}" cls="${b.cls}"`));

  await browser.close();
})();
