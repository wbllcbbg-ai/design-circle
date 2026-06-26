/**
 * 带真实登录态的端到端联调脚本
 * 用真实账号登录拿 access_token，完整走交易链路，验证鉴权层 + 业务逻辑
 *
 * 前提：本地 dev server 在跑（npm run dev -- --webpack）
 * 用法：node scripts/test-trade-flow-e2e.mjs
 */
import { readFileSync } from "fs"

const env = readFileSync(".env.local", "utf8")
const getEnv = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, "m"))
  return m ? m[1].trim() : ""
}

const SUPA_URL = getEnv("NEXT_PUBLIC_SUPABASE_URL")
const ANON_KEY = getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")
// API base：本地 dev server（Next.js API route 需要 cookie session）
const API_BASE = process.env.API_BASE || "http://localhost:3000"

// Supabase SSR cookie 名（基于 project ref）
const REF = SUPA_URL.replace("https://", "").replace(".supabase.co", "")
const COOKIE_NAME = `sb-${REF}-auth-token`

const DESIGNER_EMAIL = "test.designer@e2e.test"
const DESIGNER_PWD = "TestE2E@2026"
const CLIENT_EMAIL = "test.client@e2e.test"
const CLIENT_PWD = "TestE2E@2026"

let step = 0
function log(label, ok, detail = "") {
  step++
  const mark = ok ? "✓" : "✗"
  console.log(`[${String(step).padStart(2, "0")}] ${mark} ${label}${detail ? "  →  " + detail : ""}`)
  if (!ok && detail) console.log("       ", detail)
}

// 用邮箱密码登录，返回 access_token + 完整 session（用于构造 cookie）
async function login(email, password) {
  const res = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json()
  return {
    ok: res.ok,
    token: data.access_token,
    userId: data.user?.id,
    // Supabase SSR cookie 是 base64(session JSON)
    cookie: res.ok ? buildSessionCookie(data) : "",
    error: data.error_description || data.msg,
  }
}

// 构造 Supabase SSR 的 cookie 值（base64 编码的 session 对象）
function buildSessionCookie(tokenData) {
  const session = {
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
    expires_in: tokenData.expires_in,
    expires_at: tokenData.expires_at,
    token_type: tokenData.token_type,
    user: tokenData.user,
  }
  return Buffer.from(JSON.stringify(session)).toString("base64")
}

// 调本地 Next.js API（带 Bearer token 鉴权）
async function apiCall(path, options = {}) {
  const token = options.token
  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  return { ok: res.ok, status: res.status, data }
}

async function main() {
  console.log("\n========== 带真实登录态的 e2e 联调 ==========")
  console.log(`API: ${API_BASE}\n`)

  // 0. 探测 dev server
  try {
    const probe = await fetch(API_BASE, { signal: AbortSignal.timeout(3000) })
    if (!probe.ok) throw new Error()
    log("dev server 在线", true)
  } catch {
    log("dev server 探测", false, `无法连接 ${API_BASE}，请先跑 npm run dev -- --webpack`)
    process.exit(1)
  }

  // 1. 设计师登录
  const designerAuth = await login(DESIGNER_EMAIL, DESIGNER_PWD)
  log("设计师登录", designerAuth.ok, designerAuth.ok ? `uid=${designerAuth.userId.slice(0, 8)}` : designerAuth.error)
  if (!designerAuth.ok) return

  // 2. 业主登录
  const clientAuth = await login(CLIENT_EMAIL, CLIENT_PWD)
  log("业主登录", clientAuth.ok, clientAuth.ok ? `uid=${clientAuth.userId.slice(0, 8)}` : clientAuth.error)
  if (!clientAuth.ok) return

  // 3. 设计师查自己的身份（/api/my-identity）
  const identity = await apiCall("/api/my-identity", { token: designerAuth.token })
  log("设计师身份查询", identity.ok && identity.data?.identities?.designer, JSON.stringify(identity.data?.identities || identity.data))

  // 4. 业主发起咨询（建 conversation）
  // 需要先知道设计师的 designer_id（从 identity 拿）
  const designerEntityId = identity.data?.identities?.designer?.id
  if (!designerEntityId) {
    log("取设计师 entity id", false, "identity 缺 designer.id")
    return
  }

  const conv = await apiCall("/api/conversations", {
    method: "POST",
    token: clientAuth.token,
    body: { designer_id: designerEntityId, content: "e2e测试：我想装修130平原木风" },
  })
  log("业主发起咨询", conv.ok, conv.ok ? `对话已建立` : JSON.stringify(conv.data))
  // conversations API 不返回 id，需要查
  const myConvs = await apiCall("/api/conversations", { token: clientAuth.token })
  const conversationId = myConvs.data?.conversations?.[0]?.id
  log("取对话id", !!conversationId, conversationId?.slice(0, 8))

  // 5. 设计师在对话内发报价
  const quote = await apiCall("/api/quotes", {
    method: "POST",
    token: designerAuth.token,
    body: {
      conversation_id: conversationId,
      user_id: clientAuth.userId,
      design_fee: 28000,
      design_period: "15工作日",
      notes: "e2e测试报价",
    },
  })
  log("设计师发报价", quote.ok, quote.ok ? `设计费¥28000` : JSON.stringify(quote.data))
  const quoteId = quote.data?.quote?.id

  // 6. 业主接受报价 → 自动建合同
  const accept = await apiCall(`/api/quotes/${quoteId}`, {
    method: "POST",
    token: clientAuth.token,
  })
  log("业主接受报价→建合同", accept.ok, accept.ok ? `合同status=${accept.data?.contract?.status}` : JSON.stringify(accept.data))
  const contractId = accept.data?.contract_id || accept.data?.contract?.id

  // 7. 双方签约
  const signClient = await apiCall(`/api/contracts/${contractId}/sign`, {
    method: "POST",
    token: clientAuth.token,
  })
  log("业主签约", signClient.ok, signClient.data?.message || JSON.stringify(signClient.data))

  const signDesigner = await apiCall(`/api/contracts/${contractId}/sign`, {
    method: "POST",
    token: designerAuth.token,
  })
  log("设计师签约", signDesigner.ok, signDesigner.data?.message || JSON.stringify(signDesigner.data))
  const projectId = signDesigner.data?.project_id

  // 8. 查项目详情（含里程碑）
  const project = await apiCall(`/api/projects/${projectId}`, { token: clientAuth.token })
  log("查项目详情", project.ok && project.data?.milestones?.length === 4, `里程碑数=${project.data?.milestones?.length}`)

  // 9. 设计师提交量房节点
  const milestones = project.data?.milestones || []
  const m0 = milestones[0]
  const submit0 = await apiCall(`/api/projects/${projectId}/milestones/${m0.id}`, {
    method: "POST",
    token: designerAuth.token,
    body: { action: "submit", attachments: [{ type: "image", url: "https://example.com/test.jpg", name: "量房报告.jpg" }], note: "e2e测试提交" },
  })
  log("设计师提交量房", submit0.ok, submit0.data?.milestone?.status || JSON.stringify(submit0.data))

  // 10. 业主确认量房节点
  const confirm0 = await apiCall(`/api/projects/${projectId}/milestones/${m0.id}`, {
    method: "POST",
    token: clientAuth.token,
    body: { action: "confirm" },
  })
  log("业主确认量房", confirm0.ok, `进度=${confirm0.data?.milestone?.status}`)

  // 11. 查设计师信用变化（应 +2 节点 +3 签约 = +5，从50到55）
  const credit = await apiCall(`/api/designers/${designerEntityId}/credit`, { token: clientAuth.token })
  log("查设计师信用", credit.ok, `credit=${credit.data?.credit?.credit_score} 完工数=${credit.data?.credit?.completed_projects}`)

  // 12. 监理派单测试（需要先有监理，这里只验证 API 可达性）
  const assignments = await apiCall(`/api/inspector-assignments?project_id=${projectId}`, { token: clientAuth.token })
  log("查项目监理派单(API可达)", assignments.ok, `assignments=${assignments.data?.assignments?.length ?? 0}`)

  console.log("\n========== e2e 联调完成 ==========")
  console.log(`预期信用：50 + 3(签约) + 2(量房确认) = 55`)
  console.log(`实际信用：${credit.data?.credit?.credit_score}`)
  console.log("\n（联调数据已保留，可去 Dashboard 查看）")
}

main().catch((e) => {
  console.error("\n❌ e2e 异常:", e.message)
  process.exit(1)
})
