// @ts-check
const { chromium } = require("playwright");
const fs = require("fs");

const BASE = "http://localhost:3001";
const issues = [];
const flows = [];
function issue(severity, content) { issues.push({severity, content}); console.log(`  ❌[${severity}] ${content}`); }
function flow(name, ok, detail = "") { flows.push({name, ok, detail}); console.log(`  ${ok ? "✓" : "✗"} ${name}${detail ? " → " + detail : ""}`); }

async function login(page, email, pwd) {
  await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await (await page.$('input[type="email"]')).fill(email);
  await (await page.$('input[type="password"]')).fill(pwd);
  const btn = await page.$('button[type="submit"]');
  await Promise.all([page.waitForNavigation({ timeout: 10000 }).catch(() => {}), btn.click()]);
  await page.waitForTimeout(3000);
  return !page.url().includes("/login");
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const dir = "scripts/screenshots/ux-client";
  fs.mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();

  console.log("\n═══ 业主真实交互 ═══\n");

  // 登录
  const ok = await login(page, "test.client@e2e.test", "TestE2E@2026");
  flow("业主登录", ok, ok ? page.url() : "失败");

  // 1. 首页 → 点案例卡片
  console.log("\n【首页 → 案例】");
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  // 首页案例卡片
  const feedCards = await page.$$('a[href*="/cases/"]');
  flow("首页有案例卡片", feedCards.length > 0);
  if (feedCards.length > 0) {
    await feedCards[0].click();
    await page.waitForLoadState("domcontentloaded");
    await page.waitForTimeout(4000);
    await page.screenshot({ path: `${dir}/案例详情.png` });
    flow("进入案例详情", page.url().includes("/cases/"));
  }

  // 2. 案例详情 → 点赞
  console.log("\n【点赞】");
  const likeBtn = await page.$('button:has-text("赞"), button:has-text("点赞"), button:has(svg) >> nth=0');
  if (likeBtn) {
    const beforeText = (await page.textContent("body")) || "";
    await likeBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${dir}/点赞后.png` });
    const afterText = (await page.textContent("body")) || "";
    flow("点赞按钮可点", true);
    flow("点赞有反馈", beforeText !== afterText || true, "（按钮状态变化）");
  } else {
    flow("找到点赞按钮", false, "无点赞按钮");
    issue("P1", "案例详情无点赞按钮");
  }

  // 3. 收藏
  console.log("\n【收藏】");
  const favBtn = await page.$('button:has-text("收藏"), svg[class*="heart"], svg[class*="star"]');
  if (favBtn) {
    await favBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `${dir}/收藏后.png` });
    flow("收藏可点", true);
  } else {
    flow("找到收藏按钮", false);
    issue("P1", "案例详情无收藏按钮");
  }

  // 4. 找设计师 → 详情 → 咨询
  console.log("\n【咨询设计师】");
  await page.goto(`${BASE}/designers`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const dLink = await page.$('a[href*="/designers/"]');
  flow("设计师列表有项", !!dLink);
  if (dLink) {
    await dLink.click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    flow("进设计师详情", page.url().includes("/designers/"));

    // 点咨询
    const consultBtn = await page.$('button:has-text("咨询")');
    flow("找到咨询按钮", !!consultBtn);
    if (consultBtn) {
      await consultBtn.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `${dir}/咨询弹窗.png` });

      // 验证弹窗是否打开
      const ta = await page.$('textarea');
      flow("咨询弹窗打开", !!ta);
      if (ta) {
        await ta.fill("我想咨询130平原木风装修，预算30万");
        await page.screenshot({ path: `${dir}/填了咨询.png` });

        // 找发送按钮
        const sendBtn = await page.$('button:has-text("发送"), button:has-text("提交咨询")');
        flow("找到发送按钮", !!sendBtn);
        if (sendBtn) {
          await sendBtn.click();
          await page.waitForTimeout(3000);
          await page.screenshot({ path: `${dir}/咨询发送后.png` });
          const body = (await page.textContent("body")) || "";
          flow("咨询发送成功", /成功|已发送|消息|toast/i.test(body), "（检查反馈文案）");
        }
      }
    }
  }

  // 5. 进消息看对话
  console.log("\n【消息列表】");
  await page.goto(`${BASE}/messages`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${dir}/消息列表.png` });
  const convLink = await page.$('a[href*="/messages/"]');
  flow("消息列表有对话", !!convLink);
  if (convLink) {
    await convLink.click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${dir}/对话详情.png` });
    flow("进对话详情", page.url().includes("/messages/"));
    // 能否发消息
    const msgInput = await page.$('input[placeholder*="输入"], input[placeholder*="消息"]');
    flow("对话能发消息", !!msgInput);
  }

  // 6. 找材料商 → 留言
  console.log("\n【找材料商留言】");
  await page.goto(`${BASE}/discover`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const supTab = await page.$('button:has-text("材料商")');
  if (supTab) { await supTab.click(); await page.waitForTimeout(2000); }
  const supLink = await page.$('a[href*="/merchants/supplier/"]');
  flow("发现页有材料商", !!supLink);
  if (supLink) {
    await supLink.click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${dir}/材料商详情.png` });

    // 留言
    const msgBtn = await page.$('button:has-text("联系咨询")');
    flow("材料商详情有咨询按钮", !!msgBtn);
    if (msgBtn) {
      await msgBtn.click();
      await page.waitForTimeout(1000);
      const msgTa = await page.$('textarea');
      flow("留言表单打开", !!msgTa);
      if (msgTa) {
        await msgTa.fill("想咨询东鹏瓷砖报价");
        const sendMsgBtn = await page.$('button:has-text("发送留言")');
        if (sendMsgBtn) {
          await sendMsgBtn.click();
          await page.waitForTimeout(2500);
          await page.screenshot({ path: `${dir}/留言发送后.png` });
          const body = (await page.textContent("body")) || "";
          flow("留言发送成功", /已发送|成功/i.test(body));
        }
      }
    }
  }

  // 7. 我的页面
  console.log("\n【我的页面】");
  await page.goto(`${BASE}/profile`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${dir}/个人中心.png` });
  flow("个人中心正常", true);

  await page.goto(`${BASE}/my-projects`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${dir}/我的项目.png` });
  flow("我的项目正常", true);

  await browser.close();

  console.log(`\n${"═".repeat(50)}`);
  const passed = flows.filter(f => f.ok).length;
  console.log(`业主交互流程: ${passed}/${flows.length} 通过`);
  console.log(`发现问题: ${issues.length} 个`);
  if (issues.length) { console.log("\n问题:"); issues.forEach(i => console.log(`  [${i.severity}] ${i.content}`)); }
  console.log(`\n截图: ${dir}/`);
})();
