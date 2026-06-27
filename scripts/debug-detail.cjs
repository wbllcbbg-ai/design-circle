// @ts-check
const { chromium } = require("playwright");
(async () => {
  const BASE = "http://localhost:3001";
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  page.on("pageerror", err => console.log(`[pageerror] ${err.message.slice(0, 200)}`));

  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await (await page.$('input[type="email"]')).fill("test.client@e2e.test");
  await (await page.$('input[type="password"]')).fill("TestE2E@2026");
  await Promise.all([page.waitForNavigation({ timeout: 10000 }).catch(() => {}), (await page.$('button[type="submit"]')).click()]);
  await page.waitForTimeout(2500);

  // 进案例详情
  await page.goto(`${BASE}/cases`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3000);
  const cards = await page.$$('a[href*="/cases/"]');
  console.log("cases列表卡片数:", cards.length);
  if (cards.length) {
    await cards[0].click();
    await page.waitForTimeout(5000); // 多等一会
    await page.screenshot({ path: "scripts/screenshots/ux-client/案例详情-新.png", fullPage: true });
    const text = (await page.textContent("body")) || "";
    console.log("\n案例详情页可见文本（前300字）:");
    console.log(text.slice(0, 300));
    console.log("\n页面URL:", page.url());
    console.log("按钮数:", await page.$$eval("button", e => e.length));
    console.log("链接数:", await page.$$eval("a", e => e.length));
  }
  await browser.close();
})();
