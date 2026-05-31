import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-guard"
import { generateArticle, generateCase, generateComment, generateQuestion, generateReview, setRuntimeAiKey, setWanxiangEnabled } from "@/lib/ai-generator"
import { setUnsplashKey } from "@/lib/unsplash"
import { setWanxiangKey } from "@/lib/wanxiang"

export const dynamic = "force-dynamic"
export const maxDuration = 120

// POST /api/admin/eco/strategy/run — 立即执行一次策略（异步）
export async function POST() {
  const guard = await requireAdmin()
  if (guard) return guard

  const supabase = createDirectClient()

  // 1. 创建执行日志记录
  const { data: logEntry } = await supabase
    .from("auto_operate_logs")
    .insert({ status: "running", summary: {} })
    .select()
    .single()

  if (!logEntry) {
    return NextResponse.json({ error: "无法创建执行记录" }, { status: 500 })
  }

  const runId = logEntry.id

  // 2. 同步执行 — 等待完成后再返回结果
  try {
    await executeStrategy(runId)
    const { data: updated } = await supabase
      .from("auto_operate_logs")
      .select("*")
      .eq("id", runId)
      .single()
    return NextResponse.json({ run_id: runId, status: updated?.status || "completed", summary: updated?.summary })
  } catch (err: any) {
    return NextResponse.json({ run_id: runId, status: "failed", error: err.message })
  }
}

async function executeStrategy(runId: string) {
  const supabase = createDirectClient()
  const startedAt = Date.now()

  try {
    // 加载运行时配置
    await loadRuntimeConfig()

    // 读取策略配置
    const { data: configRows } = await supabase.from("auto_operate_config").select("key, value")
    const config: Record<string, any> = {}
    for (const row of configRows || []) {
      config[row.key] = row.value
    }

    const quota = config.daily_quota || { article: 5, case: 3, comment: 10, question: 2 }

    // 获取活跃虚拟人
    const { data: virtualUsers } = await supabase
      .from("virtual_users")
      .select("*")
      .eq("is_active", true)
      .limit(50)

    const designers = (virtualUsers || []).filter((u) => u.role === "designer")
    const owners = (virtualUsers || []).filter((u) => u.role === "owner")

    const planned = { article: 0, case: 0, comment: 0, question: 0 }
    const succeeded = { article: 0, case: 0, comment: 0, question: 0 }
    const failed: any[] = []

    // 生成文章
    const articleCount = Math.min(quota.article || 0, designers.length)
    planned.article = articleCount
    for (let i = 0; i < articleCount; i++) {
      try {
        const user = designers[i % designers.length]
        const article = await generateArticle(user, [])
        const { error } = await supabase.from("articles").insert({
          title: article.title,
          summary: article.summary,
          content: article.content,
          category: "装修攻略",
          tags: [article.title.slice(0, 10)],
          cover_url: article.cover_url,
          is_published: false,
          virtual_user_id: user.id,
          ai_generated_content: article.content,
          published_at: new Date().toISOString(),
          view_count: Math.floor(Math.random() * 200) + 10,
          like_count: Math.floor(Math.random() * 30),
        })
        if (error) {
          failed.push({ type: "article", virtual_user: user.nickname, error: error.message })
        } else {
          succeeded.article++
        }
      } catch (err: any) {
        failed.push({ type: "article", error: err.message })
      }
    }

    // 生成案例
    const caseCount = Math.min(quota.case || 0, designers.length)
    planned.case = caseCount
    for (let i = 0; i < caseCount; i++) {
      try {
        const user = designers[i % designers.length]
        const { data: designerRecord } = await supabase
          .from("designers")
          .select("id")
          .eq("user_id", user.user_id)
          .maybeSingle()

        if (!designerRecord) {
          failed.push({ type: "case", virtual_user: user.nickname, error: "无对应设计师记录" })
          continue
        }

        const caseItem = await generateCase(user, [])
        const { error } = await supabase.from("cases").insert({
          title: caseItem.title,
          style: caseItem.style,
          area: caseItem.area,
          budget: caseItem.budget,
          description: caseItem.description,
          ai_generated_content: caseItem.description,
          images: caseItem.images,
          designer_id: designerRecord.id,
          virtual_user_id: user.id,
          is_published: false,
          published_at: new Date().toISOString(),
          view_count: Math.floor(Math.random() * 500) + 20,
        })
        if (error) {
          failed.push({ type: "case", virtual_user: user.nickname, error: error.message })
        } else {
          succeeded.case++
        }
      } catch (err: any) {
        failed.push({ type: "case", error: err.message })
      }
    }

    // 生成评论（跳过 — 需要建 comments 表）
    planned.comment = 0
    succeeded.comment = 0

    // 生成提问（跳过 — 需要建 questions 表）
    planned.question = 0
    succeeded.question = 0

    // 更新执行日志
    await supabase
      .from("auto_operate_logs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        summary: {
          planned,
          succeeded,
          failed,
          duration_ms: Date.now() - startedAt,
        },
      })
      .eq("id", runId)
  } catch (err: any) {
    await supabase
      .from("auto_operate_logs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        summary: {
          planned: {},
          succeeded: {},
          failed: [{ error: err.message }],
          duration_ms: Date.now() - startedAt,
        },
      })
      .eq("id", runId)
  }
}

async function loadRuntimeConfig() {
  try {
    const supabase = createDirectClient()
    const { data } = await supabase.from("ai_config").select("key, value")
    for (const row of data || []) {
      if (row.key === "ai_api_key") setRuntimeAiKey(row.value)
      if (row.key === "unsplash_key") setUnsplashKey(row.value)
      if (row.key === "wanxiang_key") setWanxiangKey(row.value)
    }
    const wanxiangEntry = (data || []).find((r: any) => r.key === "wanxiang_key")
    setWanxiangEnabled(!!wanxiangEntry?.value || !!process.env.WANXIANG_API_KEY)
  } catch (err) {
    console.warn("loadRuntimeConfig failed:", err)
  }
}
