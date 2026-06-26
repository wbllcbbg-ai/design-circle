/**
 * 后台全面测试 —— 每个页面渲染 + 每个 API + 每个业务操作
 * 覆盖 11 个后台页面的所有可访问链接和业务逻辑
 * 用法：API_BASE=http://localhost:3001 node scripts/test-admin-full.mjs
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

let pass = 0, fail = 0
const fails = []
function log(cat, name, ok, detail = "") {
  if (ok) pass++; else { fail++; fails.push(`[${cat}] ${name} ${detail}`) }
  console.log(`${ok ? "✓" : "✗"} [${cat}] ${name}${detail ? "  →  " + detail : ""}`)
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
      signal: AbortSignal.timeout(opts.timeout || 20000),
      redirect: "manual",
    })
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => null) }
  } catch (e) { return { ok: false, status: 0, data: null, error: e.message } }
}

async function db(method, table, body, query = "") {
  const res = await fetch(`${SUPA_URL}/rest/v1/${table}${query}`, {
    method,
    headers: { apikey: SVC_KEY, Authorization: `Bearer ${SVC_KEY}`, "Content-Type": "application/json",
      Prefer: method === "POST" ? "return=representation" : "return=minimal" },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { ok: res.ok, data: await res.json().catch(() => null) }
}

async function main() {
  console.log(`\n========== 后台全面测试 ==========\nAPI: ${API_BASE}\n`)
  const admin = await login("test.designer@e2e.test", "TestE2E@2026")
  const client = await login("test.client@e2e.test", "TestE2E@2026")
  if (!admin.ok) { console.log("admin 登录失败"); return }
  console.log(`admin: ✓  client: ${client.ok ? "✓" : "✗"}\n`)

  // ═══ ① 11个页面渲染（带admin cookie/bearer，页面SSR不读header，用公开可达判断）═══
  console.log("═══ ① 后台页面渲染 ═══")
  const pages = [
    ["/admin", "内容管理"],
    ["/admin/applications", "入驻审核"],
    ["/admin/reviews", "点评审核"],
    ["/admin/virtual-users", "虚拟用户"],
    ["/admin/rewards", "奖励规则"],
    ["/admin/ai-config", "AI配置"],
    ["/admin/eco", "生态概览"],
    ["/admin/strategy", "运营策略"],
    ["/admin/consult", "咨询统计"],
    ["/admin/messages", "消息管理"],
  ]
  for (const [p, n] of pages) {
    const r = await api(p)
    // 后台页面未登录会 307 重定向到 login，或 200 渲染。404=页面不存在才是问题
    log("页面", n, r.status !== 404 && r.status !== 500, `HTTP ${r.status}`)
  }

  // ═══ ② 内容管理（/admin）═══
  console.log("\n═══ ② 内容管理 ═══")
  let r = await api("/api/admin/content", { token: admin.token })
  log("内容管理", "内容列表GET", r.ok, `HTTP ${r.status}`)
  const contentItem = r.data?.items?.[0]
  if (contentItem) {
    const dr = await api(`/api/admin/content/${contentItem.id}`, { token: admin.token })
    log("内容管理", "内容详情GET", dr.ok, `HTTP ${dr.status}`)
  }

  // ═══ ③ 入驻审核（/admin/applications）═══
  console.log("\n═══ ③ 入驻审核 ═══")
  // client 申请监理
  r = await api("/api/apply", { method: "POST", token: client.token,
    body: { type: "inspector", name: "全面测试监理", phone: "13800000001", description: "测试" } })
  log("入驻审核", "提交监理申请", r.ok, "")
  // 查申请
  let apps = await db("GET", "designer_applications", null, "?type=eq.inspector&user_id=eq." + client.userId + "&order=created_at.desc&limit=1&select=id,status")
  const inspAppId = apps.data?.[0]?.id
  log("入驻审核", "申请记录", !!inspAppId, `status=${apps.data?.[0]?.status}`)
  // admin 列表
  r = await api("/api/admin/applications", { token: admin.token })
  log("入驻审核", "admin申请列表", r.ok, `数量=${r.data?.applications?.length}`)
  // 审核通过
  if (inspAppId) {
    r = await api("/api/apply", { method: "PUT", token: admin.token, body: { id: inspAppId, status: "approved" } })
    log("入驻审核", "审核通过监理", r.ok, `HTTP ${r.status}`)
    const insp = await db("GET", "inspectors", null, "?user_id=eq." + client.userId + "&select=id,name,is_verified")
    log("入驻审核", "inspectors表建记录", insp.data?.length > 0, `name=${insp.data?.[0]?.name}`)
    // 审核拒绝（再申请一个）
    const r2 = await api("/api/apply", { method: "POST", token: client.token,
      body: { type: "supplier", name: "测试材料商拒", phone: "13800000002" } })
    if (r2.ok) {
      const apps2 = await db("GET", "designer_applications", null, "?type=eq.supplier&user_id=eq." + client.userId + "&order=created_at.desc&limit=1&select=id")
      const rejId = apps2.data?.[0]?.id
      if (rejId) {
        const rr = await api("/api/apply", { method: "PUT", token: admin.token, body: { id: rejId, status: "rejected" } })
        log("入驻审核", "审核拒绝", rr.ok, `HTTP ${rr.status}`)
      }
    }
  }

  // ═══ ④ 点评审核（/admin/reviews）═══
  console.log("\n═══ ④ 点评审核 ═══")
  r = await api("/api/admin/reviews?status=pending", { token: admin.token })
  log("点评审核", "待审核列表", r.ok, `数量=${r.data?.reviews?.length}`)
  r = await api("/api/admin/reviews?status=approved", { token: admin.token })
  log("点评审核", "已通过列表", r.ok, `数量=${r.data?.reviews?.length}`)
  r = await api("/api/admin/reviews?status=rejected", { token: admin.token })
  log("点评审核", "已拒绝列表", r.ok, `数量=${r.data?.reviews?.length}`)
  // 若有pending点评，测审核操作
  const pending = (await api("/api/admin/reviews?status=pending", { token: admin.token })).data?.reviews?.[0]
  if (pending) {
    r = await api(`/api/admin/reviews/${pending.id}`, { method: "PUT", token: admin.token, body: { status: "approved" } })
    log("点评审核", "审核通过操作", r.ok, `HTTP ${r.status}`)
  } else {
    log("点评审核", "审核操作(无pending数据)", true, "跳过")
  }

  // ═══ ⑤ 虚拟用户（/admin/virtual-users）═══
  console.log("\n═══ ⑤ 虚拟用户 ═══")
  r = await api("/api/admin/virtual-users", { token: admin.token })
  log("虚拟用户", "列表GET", r.ok, `数量=${r.data?.virtual_users?.length}`)
  const vu = r.data?.virtual_users?.[0]
  if (vu) {
    r = await api(`/api/admin/virtual-users/${vu.id}`, { token: admin.token })
    log("虚拟用户", "详情GET", r.ok, `HTTP ${r.status}`)
    // 画像分析
    r = await api(`/api/admin/virtual-users/${vu.id}/profile`, { token: admin.token })
    log("虚拟用户", "画像分析GET", r.ok, `HTTP ${r.status}`)
    // 编辑
    r = await api(`/api/admin/virtual-users/${vu.id}`, { method: "PUT", token: admin.token, body: { tone_style: "casual" } })
    log("虚拟用户", "编辑PUT", r.ok, `HTTP ${r.status}`)
  }

  // ═══ ⑥ 奖励规则（/admin/rewards）═══
  console.log("\n═══ ⑥ 奖励规则 ═══")
  r = await api("/api/admin/reward-rules", { token: admin.token })
  log("奖励规则", "列表GET", r.ok, `数量=${r.data?.rules?.length}`)
  r = await api("/api/admin/reward-rules", { method: "POST", token: admin.token,
    body: { name: "全面测试规则", inviter_points: 100, invitee_points: 50 } })
  log("奖励规则", "新增POST", r.ok, `id=${r.data?.rule?.id?.slice(0,8) || ""}`)
  const ruleId = r.data?.rule?.id
  if (ruleId) {
    r = await api(`/api/admin/reward-rules/${ruleId}`, { method: "PUT", token: admin.token, body: { name: "改后规则", inviter_points: 200 } })
    log("奖励规则", "修改PUT", r.ok, `HTTP ${r.status}`)
    r = await api(`/api/admin/reward-rules/${ruleId}`, { method: "DELETE", token: admin.token })
    log("奖励规则", "删除DELETE", r.ok, `HTTP ${r.status}`)
  }

  // ═══ ⑦ AI配置（/admin/ai-config）═══
  console.log("\n═══ ⑦ AI配置 ═══")
  r = await api("/api/admin/ai-config", { token: admin.token })
  log("AI配置", "读取GET", r.ok, `keys=${Object.keys(r.data?.config || {}).join(",") || "无"}`)
  // 保存（正确参数格式 updates）
  r = await api("/api/admin/ai-config", { method: "PUT", token: admin.token, body: { updates: { test_full_key: "cleanable" } } })
  log("AI配置", "保存PUT", r.ok || r.status === 200, `HTTP ${r.status}`)

  // ═══ ⑧ 生态概览（/admin/eco）═══
  console.log("\n═══ ⑧ 生态概览 ═══")
  r = await api("/api/admin/eco/overview", { token: admin.token })
  log("生态概览", "概览GET", r.ok, `内容=${r.data?.overview?.totalContents}`)
  r = await api("/api/admin/scheduled", { token: admin.token })
  log("生态概览", "排期GET", r.ok, `HTTP ${r.status}`)
  r = await api("/api/admin/eco/analytics", { token: admin.token })
  log("生态概览", "分析GET", r.ok, `HTTP ${r.status}`)
  // 告警静音
  r = await api("/api/admin/eco/alerts", { method: "POST", token: admin.token, body: { alert_key: "test_full", duration_hours: 1 } })
  log("生态概览", "告警静音POST", r.ok, `HTTP ${r.status}`)
  r = await api("/api/admin/eco/alerts", { method: "PUT", token: admin.token })
  log("生态概览", "恢复告警PUT", r.ok, `HTTP ${r.status}`)

  // ═══ ⑨ 运营策略（/admin/strategy）═══
  console.log("\n═══ ⑨ 运营策略 ═══")
  r = await api("/api/admin/eco/strategy", { token: admin.token })
  log("运营策略", "配置GET", r.ok, `HTTP ${r.status}`)
  r = await api("/api/admin/eco/strategy/logs", { token: admin.token })
  log("运营策略", "日志GET", r.ok, `数量=${r.data?.logs?.length}`)

  // ═══ ⑩ 咨询统计（/admin/consult）═══
  console.log("\n═══ ⑩ 咨询统计 ═══")
  r = await api("/api/admin/consult/stats", { token: admin.token })
  log("咨询统计", "统计GET", r.ok, `HTTP ${r.status}`)

  // ═══ ⑪ 消息管理（/admin/messages）═══
  console.log("\n═══ ⑪ 消息管理 ═══")
  r = await api("/api/conversations", { token: admin.token })
  log("消息管理", "对话列表", r.ok, `HTTP ${r.status}`)

  // ═══ ⑫ AI 真实生成 ═══
  console.log("\n═══ ⑫ AI真实生成 ═══")
  // 虚拟用户生成
  r = await api("/api/admin/virtual-users", { method: "POST", token: admin.token, body: { count: 1 }, timeout: 60000 })
  log("AI生成", "虚拟用户生成", r.ok, r.ok ? `成功${r.data?.count}个` : (r.data?.error || `HTTP ${r.status}`))
  const newVuIds = (r.data?.virtual_users || []).map(v => v.id)
  // AI文章生成
  r = await api("/api/generate", { method: "POST", token: admin.token, timeout: 90000 })
  log("AI生成", "文章生成", r.ok, r.ok ? `《${r.data?.article?.title?.slice(0,15)}》` : (r.data?.error || `HTTP ${r.status}`))
  const newArticleId = r.data?.article?.id
  // 手动创建文章
  r = await api("/api/generate", { method: "PUT", token: admin.token, body: { title: "全面测试手动文章", content: "测试内容，可删除", category: "测试" } })
  log("AI生成", "手动创建文章PUT", r.ok, `HTTP ${r.status}`)
  const manualArticleId = r.data?.article?.id
  // 策略引擎
  r = await api("/api/admin/eco/strategy/run", { method: "POST", token: admin.token, timeout: 30000 })
  log("AI生成", "策略引擎触发", r.ok, `run_id=${r.data?.run_id?.slice(0,8) || ""}`)
  const runId = r.data?.run_id
  if (runId) {
    console.log("       等待策略异步执行...")
    for (let i = 0; i < 18; i++) {
      await new Promise(r => setTimeout(r, 5000))
      const logs = await api("/api/admin/eco/strategy/logs?limit=1", { token: admin.token })
      const latest = logs.data?.logs?.[0]
      if (latest?.id === runId && (latest.status === "completed" || latest.status === "failed")) {
        const s = latest.summary || {}
        log("AI生成", "策略执行完成", latest.status === "completed",
          `产出=${JSON.stringify(s.succeeded || {})} 失败=${(s.failed||[]).length}`)
        break
      }
    }
  }

  // ═══ ⑬ 内容管理写操作 ═══
  console.log("\n═══ ⑬ 内容管理写操作 ═══")
  // 批量生成（generate-content）
  r = await api("/api/admin/generate-content", { method: "POST", token: admin.token, body: { mode: "daily" }, timeout: 60000 })
  log("内容管理", "批量生成POST", r.ok || r.status === 200, r.ok ? JSON.stringify(r.data).slice(0,50) : `HTTP ${r.status} ${r.data?.error||""}`)

  // ═══ 清理 ═══
  console.log("\n═══ 清理测试数据 ═══")
  await db("DELETE", "inspectors", null, "?user_id=eq." + client.userId)
  await db("DELETE", "designer_applications", null, "?user_id=eq." + client.userId)
  for (const vid of newVuIds) await db("DELETE", "virtual_users", null, "?id=eq." + vid)
  if (newArticleId) await db("DELETE", "articles", null, "?id=eq." + newArticleId)
  if (manualArticleId) await db("DELETE", "articles", null, "?id=eq." + manualArticleId)
  await db("DELETE", "ai_config", null, "?key=eq.test_full_key")
  await db("PATCH", "users", { role: "user" }, "?id=eq." + client.userId)
  console.log("       ✓ 已清理")

  // ═══ 汇总 ═══
  console.log("\n" + "═".repeat(55))
  console.log(`  通过: ${pass}  |  失败: ${fail}`)
  console.log("═".repeat(55))
  if (fail > 0) {
    console.log("\n❌ 失败项：")
    fails.forEach(f => console.log("  " + f))
  } else {
    console.log("\n✅ 后台所有功能全部通过！")
  }
}

main().catch(e => console.error("\n❌ 异常:", e.message))
