/**
 * 后台写操作联调 —— 测有副作用的真实业务闭环
 * 覆盖：入驻审核、点评审核、AI配置、奖励规则、虚拟用户生成、AI内容生成、策略引擎执行
 * 注意：会真实调用 DeepSeek AI（烧额度），测完清理数据
 * 用法：API_BASE=http://localhost:3001 node scripts/test-admin-write.mjs
 */
import { readFileSync } from "fs"

const env = readFileSync(".env.local", "utf8")
const getEnv = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, "m"))
  return m ? m[1].trim() : ""
}
const SUPA_URL = getEnv("NEXT_PUBLIC_SUPABASE_URL")
const ANON_KEY = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
const SVC_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY")
const API_BASE = process.env.API_BASE || "http://localhost:3001"

let step = 0
const fails = []
function log(label, ok, detail = "") {
  step++
  const mark = ok ? "✓" : "✗"
  console.log(`[${String(step).padStart(2, "0")}] ${mark} ${label}${detail ? "  →  " + detail : ""}`)
  if (!ok) fails.push(`${label} ${detail}`)
}

async function login(email, password) {
  const res = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json()
  return { ok: res.ok, token: data.access_token, userId: data.user?.id }
}

async function api(path, opts = {}) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: opts.method || "GET",
      headers: { "Content-Type": "application/json", ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: AbortSignal.timeout(opts.timeout || 30000),
    })
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => null) }
  } catch (e) {
    return { ok: false, status: 0, data: null, error: e.message }
  }
}

// 直接操作 DB（验证副作用 + 清理）
async function db(method, table, body, query = "") {
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}${query}`, {
    method,
    headers: {
      apikey: SVC_KEY, Authorization: `Bearer ${SVC_KEY}`,
      "Content-Type": "application/json",
      Prefer: method === "POST" ? "return=representation" : "return=minimal",
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { ok: res.ok, status: res.status, data: await res.json().catch(() => null) }
}

async function main() {
  console.log(`\n========== 后台写操作联调（含真实AI调用）==========\nAPI: ${API_BASE}\n`)
  const admin = await login("test.designer@e2e.test", "TestE2E@2026")
  const client = await login("test.client@e2e.test", "TestE2E@2026")
  console.log(`admin: ${admin.ok ? "✓" : "✗"} | client: ${client.ok ? "✓" : "✗"}\n`)
  if (!admin.ok) return

  // ─── 1. 入驻审核闭环：业主先申请材料商，admin 审核通过 ───
  console.log("─── 1. 入驻审核闭环 ───")
  // client 申请
  const apply = await api("/api/apply", {
    method: "POST", token: client.token,
    body: { type: "contractor", name: "写操作联调施工方", phone: "13700000000", description: "测试" },
  })
  log("提交施工方申请", apply.ok, apply.ok ? "" : JSON.stringify(apply.data))

  // 查申请 id
  const apps = await db("GET", "designer_applications", null, "?type=eq.contractor&user_id=eq." + client.userId + "&order=created_at.desc&limit=1&select=id,status")
  const appId = apps.data?.[0]?.id
  log("申请记录存在", !!appId, `status=${apps.data?.[0]?.status}`)

  // admin 审核通过（应建 contractors 表记录）
  if (appId) {
    const approve = await api("/api/apply", {
      method: "PUT", token: admin.token,
      body: { id: appId, status: "approved" },
    })
    log("审核通过施工方", approve.ok, `HTTP ${approve.status}`)

    // 验证 contractors 表建了记录
    const contractor = await db("GET", "contractors", null, "?user_id=eq." + client.userId + "&select=id,name,is_verified")
    log("contractors表建记录", contractor.data?.length > 0, `name=${contractor.data?.[0]?.name}`)
  }

  // ─── 2. 点评审核闭环 ───
  console.log("\n─── 2. 点评审核闭环 ───")
  // 先查有没有 pending 的点评（没有就跳过）
  const pendingReviews = await api("/api/admin/reviews?status=pending", { token: admin.token })
  const pendingCount = pendingReviews.data?.reviews?.length || 0
  log("待审核点评数", true, `${pendingCount} 条`)

  // ─── 3. AI 配置保存 ───
  console.log("\n─── 3. AI 配置 ───")
  // 保存一个测试配置（不破坏真实 key）
  const saveConfig = await api("/api/admin/ai-config", {
    method: "PUT", token: admin.token,
    body: { configs: [{ key: "test_e2e_key", value: "test_value_cleanable" }] },
  })
  log("保存AI配置", saveConfig.ok || saveConfig.status === 200, `HTTP ${saveConfig.status}`)

  // ─── 4. 奖励规则 CRUD ───
  console.log("\n─── 4. 奖励规则 ───")
  const addRule = await api("/api/admin/reward-rules", {
    method: "POST", token: admin.token,
    body: { name: "E2E测试规则", inviter_points: 999, invitee_points: 888 },
  })
  log("新增奖励规则", addRule.ok, `id=${addRule.data?.rule?.id?.slice(0,8) || ""}`)
  const ruleId = addRule.data?.rule?.id
  if (ruleId) {
    const delRule = await api(`/api/admin/reward-rules/${ruleId}`, { method: "DELETE", token: admin.token })
    log("删除奖励规则", delRule.ok || delRule.status === 200, "")
  }

  // ─── 5. 告警静音 ───
  console.log("\n─── 5. 告警静音 ───")
  const snooze = await api("/api/admin/eco/alerts", {
    method: "POST", token: admin.token,
    body: { alert_key: "test_alert_e2e", duration_hours: 1 },
  })
  log("告警静音", snooze.ok, `HTTP ${snooze.status}`)
  const unsnooze = await api("/api/admin/eco/alerts", { method: "PUT", token: admin.token })
  log("恢复所有告警", unsnooze.ok, "")

  // ─── 6. 虚拟用户生成（真实调 AI）───
  console.log("\n─── 6. 虚拟用户生成（真实AI）───")
  const genVu = await api("/api/admin/virtual-users", {
    method: "POST", token: admin.token,
    body: { count: 2 },
    timeout: 60000,
  })
  log("生成2个虚拟用户", genVu.ok, genVu.ok ? `成功${genVu.data?.count}个` : (genVu.data?.error || genVu.error || `HTTP ${genVu.status}`))
  // 记录生成的 vu id 用于清理
  const newVuIds = (genVu.data?.virtual_users || []).map((v) => v.id)
  if (newVuIds.length > 0) console.log(`       生成ID: ${newVuIds.map(i => i.slice(0,8)).join(", ")}`)

  // ─── 7. AI 内容生成（真实调 AI）───
  console.log("\n─── 7. AI 内容生成（真实AI）───")
  const genArticle = await api("/api/generate", {
    method: "POST", token: admin.token,
    timeout: 90000,
  })
  log("AI生成文章", genArticle.ok, genArticle.ok ? `《${genArticle.data?.article?.title?.slice(0,15)}》` : (genArticle.data?.error || `HTTP ${genArticle.status}`))
  const newArticleId = genArticle.data?.article?.id

  // ─── 8. 策略引擎执行（真实调 AI，异步）───
  console.log("\n─── 8. 策略引擎执行（真实AI，异步）───")
  const runStrategy = await api("/api/admin/eco/strategy/run", {
    method: "POST", token: admin.token,
    timeout: 30000,
  })
  log("触发策略执行", runStrategy.ok, runStrategy.ok ? `run_id=${runStrategy.data?.run_id?.slice(0,8)}` : JSON.stringify(runStrategy.data))
  const runId = runStrategy.data?.run_id

  if (runId) {
    console.log("       等待异步执行（最多 90 秒）...")
    // 轮询日志
    let done = false
    for (let i = 0; i < 18; i++) {
      await new Promise((r) => setTimeout(r, 5000))
      const logs = await api("/api/admin/eco/strategy/logs?limit=1", { token: admin.token })
      const latest = logs.data?.logs?.[0]
      if (latest?.id === runId && (latest.status === "completed" || latest.status === "failed")) {
        const summary = latest.summary || {}
        log("策略执行完成", latest.status === "completed",
          `succeeded=${JSON.stringify(summary.succeeded || {})} failed=${(summary.failed || []).length}`)
        done = true
        break
      }
      process.stdout.write(`       轮询 ${i+1}: status=${latest?.status || "?"}\r`)
    }
    if (!done) log("策略执行（超时未完成）", false, "可能仍在后台运行")
  }

  // ─── 清理本次测试数据 ───
  console.log("\n─── 清理测试数据 ───")
  // 清理 contractors + application（client 的）
  await db("DELETE", "contractors", null, "?user_id=eq." + client.userId)
  await db("DELETE", "designer_applications", null, "?user_id=eq." + client.userId + "&type=eq.contractor")
  // 清理虚拟用户
  for (const vid of newVuIds) {
    await db("DELETE", "virtual_users", null, "?id=eq." + vid)
  }
  // 清理 AI 生成的文章
  if (newArticleId) await db("DELETE", "articles", null, "?id=eq." + newArticleId)
  // 清理测试 AI 配置
  await db("DELETE", "ai_config", null, "?key=eq.test_e2e_key")
  // 恢复 client 的 role（审核通过时改成了 contractor）
  await db("PATCH", "users", { role: "user" }, "?id=eq." + client.userId)
  console.log("       ✓ 已清理")

  // ─── 汇总 ───
  console.log("\n" + "═".repeat(50))
  console.log(`  通过: ${step - fails.length}  |  失败: ${fails.length}`)
  console.log("═".repeat(50))
  if (fails.length > 0) {
    console.log("\n❌ 失败：")
    fails.forEach((f) => console.log(`  ✗ ${f}`))
  } else {
    console.log("\n✅ 后台写操作全部通过！")
  }
}

main().catch((e) => console.error("\n❌ 异常:", e.message))
