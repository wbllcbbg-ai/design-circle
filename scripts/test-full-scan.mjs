/**
 * 全站场景联调扫描
 * 分三层验证：① 公开页面加载 ② 需登录 API ③ 关键业务流
 * 用法：API_BASE=http://localhost:3001 node scripts/test-full-scan.mjs
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

const results = { pass: 0, fail: 0, warns: 0, details: [] }

function record(category, name, ok, detail = "", isWarn = false) {
  if (isWarn) results.warns++
  else if (ok) results.pass++
  else results.fail++
  const mark = isWarn ? "⚠" : ok ? "✓" : "✗"
  results.details.push({ category, name, mark, detail })
  console.log(`${mark} [${category}] ${name}${detail ? "  →  " + detail : ""}`)
}

// 通用请求
async function probe(url, options = {}) {
  try {
    const res = await fetch(url, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: AbortSignal.timeout(8000),
      redirect: "manual",
    })
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => null) }
  } catch (e) {
    return { ok: false, status: 0, data: null, error: e.message }
  }
}

// 登录拿 token
async function login(email, password) {
  const res = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json()
  return { ok: res.ok, token: data.access_token, userId: data.user?.id }
}

async function main() {
  console.log(`\n========== 全站场景联调扫描 ==========\nAPI: ${API_BASE}\n`)

  // 登录两个账号
  const designer = await login("test.designer@e2e.test", "TestE2E@2026")
  const client = await login("test.client@e2e.test", "TestE2E@2026")
  console.log(`设计师登录: ${designer.ok ? "✓" : "✗"} | 业主登录: ${client.ok ? "✓" : "✗"}\n`)

  // ==================== ① 公开页面加载 ====================
  console.log("─── ① 公开页面加载 ───")
  const pages = [
    ["/", "首页"],
    ["/discover", "发现页(统一列表)"],
    ["/cases", "案例列表"],
    ["/articles", "文章列表"],
    ["/designers", "设计师列表"],
    ["/search", "搜索页"],
    ["/tags", "标签页"],
    ["/city", "城市页"],
    ["/login", "登录页"],
    ["/invite", "邀请页(公开)"],
  ]
  for (const [path, name] of pages) {
    const r = await probe(`${API_BASE}${path}`)
    const ok = r.status === 200
    record("页面", name, ok, `HTTP ${r.status}`)
  }

  // 详情页（取真实 id）
  console.log("")
  const casesList = await probe(`${API_BASE}/api/cases`)
  const firstCase = casesList.data?.cases?.[0]
  if (firstCase) {
    const r = await probe(`${API_BASE}/cases/${firstCase.id}`)
    record("页面", "案例详情页", r.status === 200, `HTTP ${r.status}`)
  } else {
    record("页面", "案例详情页", false, "无案例数据")
  }

  const articlesList = await probe(`${API_BASE}/api/articles`)
  const firstArticle = articlesList.data?.articles?.[0]
  if (firstArticle) {
    const r = await probe(`${API_BASE}/articles/${firstArticle.id}`)
    record("页面", "文章详情页", r.status === 200, `HTTP ${r.status}`)
  }

  const designersList = await probe(`${API_BASE}/api/designers`)
  const firstDesigner = designersList.data?.designers?.[0] || designersList.data?.[0]
  if (firstDesigner) {
    const r = await probe(`${API_BASE}/designers/${firstDesigner.id}`)
    record("页面", "设计师详情页", r.status === 200, `HTTP ${r.status}`)
  }

  // ==================== ② 公开 API ====================
  console.log("\n─── ② 公开 API ───")
  const publicApis = [
    ["/api/feed", "首页 Feed"],
    ["/api/cases", "案例列表 API"],
    ["/api/articles", "文章列表 API"],
    ["/api/designers", "设计师列表 API"],
    ["/api/cities", "城市列表"],
    ["/api/tags", "标签列表"],
    ["/api/search?q=装修", "搜索 API"],
    ["/api/merchants/designer", "材料商列表(设计师角色)"],
    ["/api/merchants/supplier", "材料商列表"],
    ["/api/merchants/contractor", "施工方列表"],
    ["/api/merchants/inspector", "监理列表"],
  ]
  for (const [path, name] of publicApis) {
    const r = await probe(`${API_BASE}${path}`)
    record("公开API", name, r.ok, `HTTP ${r.status}`)
  }

  // ==================== ③ 需登录 API（业主视角）====================
  console.log("\n─── ③ 需登录 API（业主 token）───")
  const authedApis = [
    ["/api/profile", "个人资料"],
    ["/api/notifications", "通知列表"],
    ["/api/notifications/unread-count", "未读数"],
    ["/api/conversations", "对话列表"],
    ["/api/points", "积分"],
    ["/api/invite/code", "邀请码"],
    ["/api/invite/stats", "邀请统计"],
    ["/api/invite/list", "邀请列表"],
    ["/api/favorites", "收藏列表"],
    ["/api/my-identity", "身份查询"],
    ["/api/projects?as=client", "我的项目"],
    ["/api/reviews/check-access?designer_id=f6f8909c-7f24-4fbf-b60e-e74f0f429375", "评价权限"],
  ]
  for (const [path, name] of authedApis) {
    const r = await probe(`${API_BASE}${path}`, { token: client.token })
    record("业主API", name, r.ok, `HTTP ${r.status}`)
  }

  // ==================== ④ 写操作（业主互动）====================
  console.log("\n─── ④ 业主互动写操作 ───")
  if (firstCase) {
    // 点赞
    const like = await probe(`${API_BASE}/api/likes`, {
      method: "POST", token: client.token,
      body: { target_type: "case", target_id: firstCase.id, action: "like" },
    })
    record("互动", "点赞案例", like.ok, `HTTP ${like.status}`)

    // 收藏
    const fav = await probe(`${API_BASE}/api/favorites`, {
      method: "POST", token: client.token,
      body: { target_type: "case", target_id: firstCase.id },
    })
    record("互动", "收藏案例", fav.ok || fav.status === 409, `HTTP ${fav.status}`)

    // 评论
    const comment = await probe(`${API_BASE}/api/comments`, {
      method: "POST", token: client.token,
      body: { target_type: "case", target_id: firstCase.id, content: "全站联调测试评论" },
    })
    record("互动", "评论案例", comment.ok, `HTTP ${comment.status}`)
  }

  // ==================== ⑤ 设计师视角 ====================
  console.log("\n─── ⑤ 设计师视角 ───")
  const dIdentity = await probe(`${API_BASE}/api/my-identity`, { token: designer.token })
  record("设计师", "身份查询", dIdentity.ok && !!dIdentity.data?.identities?.designer, "")

  const dProjects = await probe(`${API_BASE}/api/projects?as=designer`, { token: designer.token })
  record("设计师", "我的项目", dProjects.ok, `HTTP ${dProjects.status}`)

  // 工作台相关（设计师信用）
  const dCredit = await probe(`${API_BASE}/api/designers/f6f8909c-7f24-4fbf-b60e-e74f0f429375/credit`)
  record("设计师", "信用查询", dCredit.ok, `信用=${dCredit.data?.credit?.credit_score}`)

  // ==================== ⑥ 多角色入驻 ====================
  console.log("\n─── ⑥ 多角色入驻 ───")
  // 用业主账号申请材料商
  const applySupplier = await probe(`${API_BASE}/api/apply`, {
    method: "POST", token: client.token,
    body: { type: "supplier", name: "E2E测试材料商", phone: "13800000000", description: "联调用" },
  })
  record("入驻", "材料商申请", applySupplier.ok, `HTTP ${applySupplier.status}`)

  // ==================== ⑦ 错误处理 ====================
  console.log("\n─── ⑦ 错误处理 ───")
  const noAuth = await probe(`${API_BASE}/api/profile`)
  record("错误", "未登录访问受保护API", noAuth.status === 401, `HTTP ${noAuth.status}`)

  const notFound = await probe(`${API_BASE}/api/projects/00000000-0000-0000-0000-000000000001`, { token: client.token })
  record("错误", "不存在的项目", notFound.status === 404 || notFound.status === 403, `HTTP ${notFound.status}`)

  // ==================== 汇总 ====================
  console.log("\n" + "═".repeat(50))
  console.log(`  通过: ${results.pass}  |  失败: ${results.fail}  |  警告: ${results.warns}`)
  console.log("═".repeat(50))

  if (results.fail > 0) {
    console.log("\n❌ 失败项：")
    results.details.filter((d) => d.mark === "✗").forEach((d) => {
      console.log(`  ✗ [${d.category}] ${d.name} ${d.detail}`)
    })
  }
}

main().catch((e) => {
  console.error("\n❌ 扫描异常:", e.message)
  process.exit(1)
})
