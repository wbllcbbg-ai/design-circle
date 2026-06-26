/**
 * 后台(Admin)功能联调
 * 用 admin token 测试 8 大后台模块的 API
 * 用法：API_BASE=http://localhost:3001 node scripts/test-admin.mjs
 */
import { readFileSync } from "fs"

const env = readFileSync(".env.local", "utf8")
const getEnv = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, "m"))
  return m ? m[1].trim() : ""
}
const SUPA_URL = getEnv("NEXT_PUBLIC_SUPABASE_URL")
const ANON_KEY = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
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
  return { ok: res.ok, token: data.access_token }
}

async function api(path, opts = {}) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: opts.method || "GET",
      headers: { "Content-Type": "application/json", ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}) },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: AbortSignal.timeout(15000),
    })
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => null) }
  } catch (e) {
    return { ok: false, status: 0, data: null, error: e.message }
  }
}

async function main() {
  console.log(`\n========== 后台 Admin 功能联调 ==========\nAPI: ${API_BASE}\n`)

  // admin 登录（测试设计师已被临时提权为 admin）
  const admin = await login("test.designer@e2e.test", "TestE2E@2026")
  console.log(`admin 登录: ${admin.ok ? "✓" : "✗"}\n`)
  if (!admin.ok) return

  // ─── 1. 内容管理 ───
  console.log("─── 1. 内容管理 ───")
  const content = await api("/api/admin/content", { token: admin.token })
  log("内容列表", content.ok, `HTTP ${content.status}`)

  // ─── 2. 入驻审核 ───
  console.log("\n─── 2. 入驻审核 ───")
  const appsPending = await api("/api/admin/applications", { token: admin.token })
  log("入驻申请列表", appsPending.ok, `数量=${appsPending.data?.applications?.length ?? 0}`)

  // ─── 3. 点评审核 ───
  console.log("\n─── 3. 点评审核 ───")
  const reviewsPending = await api("/api/admin/reviews?status=pending", { token: admin.token })
  log("待审核点评", reviewsPending.ok, `数量=${reviewsPending.data?.reviews?.length ?? 0}`)

  // ─── 4. 虚拟用户管理 ───
  console.log("\n─── 4. 虚拟用户 ───")
  const virtualUsers = await api("/api/admin/virtual-users", { token: admin.token })
  log("虚拟用户列表", virtualUsers.ok, `数量=${virtualUsers.data?.virtual_users?.length ?? 0}`)

  // ─── 5. 奖励规则 ───
  console.log("\n─── 5. 奖励规则 ───")
  const rewards = await api("/api/admin/reward-rules", { token: admin.token })
  log("奖励规则列表", rewards.ok, `HTTP ${rewards.status}`)

  // ─── 6. AI 配置 ───
  console.log("\n─── 6. AI 配置 ───")
  const aiConfig = await api("/api/admin/ai-config", { token: admin.token })
  log("AI 配置读取", aiConfig.ok, `HTTP ${aiConfig.status}`)

  // ─── 7. 生态概览（运营系统）───
  console.log("\n─── 7. 生态概览（运营系统）───")
  const overview = await api("/api/admin/eco/overview", { token: admin.token })
  log("生态概览", overview.ok, `告警阻塞=${overview.data?.alerts?.blocking?.length ?? "?"}`)

  // ─── 8. 运营策略 ───
  console.log("\n─── 8. 运营策略 ───")
  const strategy = await api("/api/admin/eco/strategy", { token: admin.token })
  log("策略配置读取", strategy.ok, `HTTP ${strategy.status}`)

  const strategyLogs = await api("/api/admin/eco/strategy/logs", { token: admin.token })
  log("策略执行日志", strategyLogs.ok, `日志数=${strategyLogs.data?.logs?.length ?? 0}`)

  // ─── 9. 排期管理 ───
  console.log("\n─── 9. 排期管理 ───")
  const scheduled = await api("/api/admin/scheduled", { token: admin.token })
  log("排期列表", scheduled.ok, `HTTP ${scheduled.status}`)

  // ─── 10. 咨询统计 ───
  console.log("\n─── 10. 咨询统计 ───")
  const consult = await api("/api/admin/consult/stats", { token: admin.token })
  log("咨询统计", consult.ok, `HTTP ${consult.status}`)

  // ─── 11. 新增的过程托管 admin 功能 ───
  console.log("\n─── 11. 过程托管 admin ───")
  const deposits = await api("/api/admin/deposits", { token: admin.token })
  log("保证金记录", deposits.ok, `HTTP ${deposits.status}`)

  // ─── 12. 权限校验（非 admin 应被拒）───
  console.log("\n─── 12. 权限校验 ───")
  const client = await login("test.client@e2e.test", "TestE2E@2026")
  if (client.ok) {
    const noAdmin = await api("/api/admin/eco/overview", { token: client.token })
    log("非admin访问后台被拒", noAdmin.status === 403, `HTTP ${noAdmin.status}`)

    const noAuth = await api("/api/admin/eco/overview")
    log("未登录访问后台被拒", noAuth.status === 401, `HTTP ${noAuth.status}`)
  }

  // ─── 汇总 ───
  console.log("\n" + "═".repeat(50))
  console.log(`  通过: ${step - fails.length}  |  失败: ${fails.length}`)
  console.log("═".repeat(50))
  if (fails.length > 0) {
    console.log("\n❌ 失败：")
    fails.forEach((f) => console.log(`  ✗ ${f}`))
  } else {
    console.log("\n✅ 后台 Admin 功能全部通过！")
  }
}

main().catch((e) => console.error("\n❌ 异常:", e.message))
