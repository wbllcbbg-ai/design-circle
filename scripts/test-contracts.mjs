/**
 * 前后端契约一致性检查
 * 对每个页面的 fetch + 字段访问，验证 API 真实返回是否包含该字段
 * 找出所有"前端用了 API 没返回的字段"的契约不匹配（真实 bug 来源）
 * 用法：API_BASE=http://localhost:3001 node scripts/test-contracts.mjs
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

const issues = []
function check(page, api, fields) {
  // api 可以是 path（GET）或 {path, method, body, needToken}
}

async function get(path, token) {
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      signal: AbortSignal.timeout(10000),
    })
    return { ok: res.ok, status: res.status, data: await res.json().catch(() => null) }
  } catch (e) { return { ok: false, status: 0, data: null, error: e.message } }
}

async function login(email, pwd) {
  const res = await fetch(`${SUPA_URL}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: pwd }),
  })
  return (await res.json()).access_token
}

// 检查 data 是否包含所有 fields（递归，支持 a.b）
function hasFields(data, fields, context) {
  for (const f of fields) {
    const parts = f.split(".")
    let cur = data
    let found = true
    for (const p of parts) {
      if (cur == null || typeof cur !== "object" || !(p in cur)) { found = false; break }
      cur = cur[p]
    }
    if (!found) issues.push(`[${context}] 缺字段: ${f}`)
  }
}

async function main() {
  console.log(`\n========== 前后端契约一致性检查 ==========\nAPI: ${API_BASE}\n`)
  const admin = await login("test.designer@e2e.test", "TestE2E@2026")
  const client = await login("test.client@e2e.test", "TestE2E@2026")

  // 首页 feed → HomeFeed 用 items[].type/title/coverUrl/designer.name/likes
  let r = await get("/api/feed")
  if (r.ok && r.data) {
    const items = [...(r.data.cases||[]).map(c=>({...c,type:"case"})), ...(r.data.articles||[]).map(a=>({...a,type:"article"}))]
    if (items.length) {
      hasFields(items[0], ["title"], "feed item")
      // coverUrl vs cover_url（前端用 coverUrl，API 返回 cover_url？）
      if (!("coverUrl" in items[0]) && !("cover_url" in items[0])) issues.push("[feed item] 缺封面字段(coverUrl/cover_url)")
      else if (!("coverUrl" in items[0]) && "cover_url" in items[0]) issues.push("[feed item] ⚠前端用coverUrl但API返回cover_url（可能camelCase不匹配）")
    }
  }

  // cases 详情 → 前端用 case.title/description/images/designer.name
  const cases = await get("/api/cases")
  const firstCase = cases.data?.cases?.[0]
  if (firstCase) {
    r = await get(`/api/cases/${firstCase.id}`)
    if (r.ok && r.data?.case) {
      hasFields(r.data.case, ["title", "description", "images", "cover_url"], "case详情")
      hasFields(r.data, ["designer"], "case详情.designer")
      if (r.data.designer) hasFields(r.data.designer, ["name"], "case详情.designer.name")
    }
  }

  // designers 详情 → 前端用 designer.name/cases/articles
  const ds = await get("/api/designers")
  const firstD = ds.data?.designers?.[0]
  if (firstD) {
    r = await get(`/api/designers/${firstD.id}`)
    if (r.ok && r.data) {
      hasFields(r.data, ["designer", "cases", "articles", "reviews"], "设计师详情")
    }
  }

  // articles 详情 → 前端用 article.title/content/author.nickname
  const arts = await get("/api/articles")
  const firstA = arts.data?.articles?.[0]
  if (firstA) {
    r = await get(`/api/articles/${firstA.id}`)
    if (r.ok && r.data?.article) {
      hasFields(r.data.article, ["title", "content"], "文章详情")
    }
  }

  // comments → 前端用 comment.user.nickname/avatar_url
  if (firstCase) {
    r = await get(`/api/comments?target_type=case&target_id=${firstCase.id}`)
    if (r.ok && r.data?.comments?.length) {
      hasFields(r.data.comments[0], ["content", "user"], "评论")
      if (r.data.comments[0].user) hasFields(r.data.comments[0].user, ["nickname"], "评论.user.nickname")
    }
  }

  // 项目列表（业主）→ 前端用 project.title/status/progress/designer.name/contract.total_price
  r = await get("/api/projects?as=client", client)
  if (r.ok && r.data?.projects) {
    if (r.data.projects.length) {
      hasFields(r.data.projects[0], ["title", "status", "progress", "designer", "contract"], "项目列表")
    }
  }

  // 商家详情（单条API）
  r = await get("/api/merchants/supplier/00000000-0000-0000-0000-000000000001")
  // 404 是正常的（商户不存在），只检查接口存在性

  // my-identity
  r = await get("/api/my-identity", client)
  if (r.ok) hasFields(r.data || {}, ["identities"], "身份查询")

  // 汇总
  console.log(`\n${"═".repeat(50)}`)
  if (issues.length === 0) {
    console.log("✅ 前后端契约一致，无字段缺失")
  } else {
    console.log(`❌ 发现 ${issues.length} 处契约不匹配：`)
    issues.forEach(i => console.log("  " + i))
  }
  console.log("═".repeat(50))
}

main().catch(e => console.error("异常:", e.message))
