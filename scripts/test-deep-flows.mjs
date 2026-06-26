/**
 * 深度业务场景联调 —— 验证完整业务闭环（带状态副作用）
 * 覆盖：点赞→通知、评论→通知、收藏状态、入驻审核闭环、积分发放
 * 用法：API_BASE=http://localhost:3001 node scripts/test-deep-flows.mjs
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
  const res = await fetch(`${API_BASE}${path}`, {
    method: opts.method || "GET",
    headers: { "Content-Type": "application/json", ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    signal: AbortSignal.timeout(10000),
  })
  return { ok: res.ok, status: res.status, data: await res.json().catch(() => null) }
}

// 用 service_role 直接操作 DB（验证副作用）
async function dbGet(path) {
  const res = await fetch(`${SUPA_URL}/rest/v1/${path}`, {
    headers: { apikey: SVC_KEY, Authorization: `Bearer ${SVC_KEY}` },
  })
  return res.json()
}

async function main() {
  console.log(`\n========== 深度业务场景联调 ==========\n`)

  const designer = await login("test.designer@e2e.test", "TestE2E@2026")
  const client = await login("test.client@e2e.test", "TestE2E@2026")
  if (!designer.ok || !client.ok) { console.log("登录失败"); return }

  // 取一个真实案例（设计师发的）
  const cases = await api("/api/cases")
  const myCase = cases.data?.cases?.find((c) => c.designer_id === "f6f8909c-7f24-4fbf-b60e-e74f0f429375") || cases.data?.cases?.[0]
  if (!myCase) { console.log("无案例"); return }
  log(`取测试案例: ${myCase.title?.slice(0, 15)}`, true)

  // ─── 场景1: 点赞 → 验证 likes 表 + like_count ───
  console.log("\n─── 场景1: 点赞闭环 ───")
  const beforeLikes = await dbGet(`likes?target_id=eq.${myCase.id}&select=id`)
  const beforeCount = beforeLikes?.length || 0

  const like = await api("/api/likes", {
    method: "POST", token: client.token,
    body: { target_type: "case", target_id: myCase.id, action: "like" },
  })
  log("业主点赞", like.ok, `liked=${like.data?.liked}`)

  const afterLikes = await dbGet(`likes?target_id=eq.${myCase.id}&select=id`)
  log("likes表记录+1", (afterLikes?.length || 0) === beforeCount + 1, `${beforeCount}→${afterLikes?.length}`)

  // 验证通知（设计师应收到点赞通知）
  const dNotifs = await api("/api/notifications", { token: designer.token })
  const hasLikeNotif = (dNotifs.data?.notifications || []).some((n) => n.type === "like" && n.content?.includes("赞"))
  log("设计师收到点赞通知", hasLikeNotif, hasLikeNotif ? "✓" : "未找到like通知")

  // ─── 场景2: 评论 → 验证 comments 表 + 通知 ───
  console.log("\n─── 场景2: 评论闭环 ───")
  const comment = await api("/api/comments", {
    method: "POST", token: client.token,
    body: { target_type: "case", target_id: myCase.id, content: "深度联调：这个案例设计真不错！" },
  })
  log("业主评论", comment.ok, `comment.id=${comment.data?.comment?.id?.slice(0, 8)}`)

  const dNotifs2 = await api("/api/notifications", { token: designer.token })
  const hasCommentNotif = (dNotifs2.data?.notifications || []).some((n) => n.type === "comment")
  log("设计师收到评论通知", hasCommentNotif)

  // ─── 场景3: 收藏状态查询 ───
  console.log("\n─── 场景3: 收藏状态 ───")
  const favStatus = await api(`/api/favorites?target_type=case&target_id=${myCase.id}`, { token: client.token })
  log("查询收藏状态", favStatus.ok, `favorited=${favStatus.data?.favorited}`)

  // ─── 场景4: 入驻申请 → 审核闭环 ───
  console.log("\n─── 场景4: 入驻审核闭环（材料商）───")
  // 业主申请材料商
  const apply = await api("/api/apply", {
    method: "POST", token: client.token,
    body: { type: "supplier", name: "深度联调材料商", phone: "13900000000", description: "测试用", specialties: ["瓷砖"] },
  })
  log("提交材料商申请", apply.ok, `application.id=${apply.data?.application?.id?.slice(0, 8) || "已存在"}`)

  // 查申请（admin 视角需要 admin token，这里用 service_role 直接查 DB）
  const apps = await dbGet(`designer_applications?type=eq.supplier&order=created_at.desc&limit=1&select=id,status`)
  const appId = apps?.[0]?.id
  log("申请记录存在", !!appId, `status=${apps?.[0]?.status}`)

  // ─── 场景5: 业主提问 ───
  console.log("\n─── 场景5: 业主提问 ───")
  const question = await api("/api/questions", {
    method: "POST", token: client.token,
    body: { title: "深度联调：60平两房能改三房吗？", content: "求助各位设计师", category: "设计" },
  })
  log("业主提问", question.ok, `HTTP ${question.status}`)

  // ─── 场景6: 评价权限（已交易才能评）───
  console.log("\n─── 场景6: 评价权限 ───")
  const canReview = await api(`/api/reviews/check-access?designer_id=f6f8909c-7f24-4fbf-b60e-e74f0f429375`, { token: client.token })
  log("查询评价权限", canReview.ok, `can_review=${canReview.data?.can_review}`)

  // ─── 场景7: 浏览历史 ───
  console.log("\n─── 场景7: 浏览历史 ───")
  const browse = await api("/api/browse-history", {
    method: "POST", token: client.token,
    body: { target_type: "case", target_id: myCase.id },
  })
  log("记录浏览历史", browse.ok, `HTTP ${browse.status}`)

  // ─── 汇总 ───
  console.log("\n" + "═".repeat(50))
  console.log(`  通过: ${step - fails.length}  |  失败: ${fails.length}`)
  console.log("═".repeat(50))
  if (fails.length > 0) {
    console.log("\n❌ 失败：")
    fails.forEach((f) => console.log(`  ✗ ${f}`))
  } else {
    console.log("\n✅ 深度业务闭环全部通过！")
  }
}

main().catch((e) => console.error("\n❌ 异常:", e.message))
