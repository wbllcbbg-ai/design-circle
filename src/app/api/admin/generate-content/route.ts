import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { generateArticle, generateCase, generateQuestion, generateComment, generateReview, setRuntimeAiKey, setWanxiangEnabled } from "@/lib/ai-generator"
import { setUnsplashKey } from "@/lib/unsplash"
import { setWanxiangKey } from "@/lib/wanxiang"
import { requireAdmin } from "@/lib/auth-guard"
import { schedulePublishTime as scheduleV1, type ScheduleConfig } from "@/lib/content-scheduler"

export const dynamic = "force-dynamic"
export const maxDuration = 120

async function loadRuntimeConfig() {
  try {
    const supabase = createDirectClient()
    const { data } = await supabase.from("ai_config").select("key, value")
    for (const row of data || []) {
      if (row.key === "ai_api_key") setRuntimeAiKey(row.value)
      if (row.key === "unsplash_key") setUnsplashKey(row.value)
      if (row.key === "wanxiang_key") setWanxiangKey(row.value)
    }

    // 如果配置了通义万相 key 则启用 AI 生图
    const wanxiangEntry = (data || []).find((r: any) => r.key === "wanxiang_key")
    setWanxiangEnabled(!!wanxiangEntry?.value)
  } catch (err) {
    console.warn("loadRuntimeConfig failed, falling back to env vars:", err)
  }
}

// 获取虚拟人最近的内容作为上下文
async function getVirtualUserHistory(supabase: any, virtualUserId: string, limit = 5) {
  const promises = [
    supabase.from("articles").select("title, content, created_at").eq("virtual_user_id", virtualUserId).order("created_at", { ascending: false }).limit(limit),
    supabase.from("comments").select("content, created_at").eq("virtual_user_id", virtualUserId).order("created_at", { ascending: false }).limit(limit),
    supabase.from("reviews").select("content, created_at").eq("virtual_user_id", virtualUserId).order("created_at", { ascending: false }).limit(limit),
  ]
  // questions 表可能不存在，push 不 catch（push 不会 throw，Promise.allSettled 处理失败）
  promises.push(
    supabase.from("questions").select("title, content, created_at").eq("virtual_user_id", virtualUserId).order("created_at", { ascending: false }).limit(limit),
  )

  const results = await Promise.allSettled(promises)
  const items: any[] = []
  const typeLabels = ["文章", "评论", "评价", "提问"]

  for (let i = 0; i < results.length; i++) {
    const result = results[i]
    const label = typeLabels[i] || "其他"
    if (result.status === "fulfilled") {
      for (const row of result.value.data || []) {
        items.push({
          type: label,
          title: row.title || "",
          content: row.content || "",
          created_at: row.created_at,
        })
      }
    }
  }

  return items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, limit)
}

// 调度时间计算（使用共享模块，兼容旧调用方式）
// strategy 参数保留但不再使用；共享模块使用默认 slots 配置
const defaultScheduleConfig: ScheduleConfig = {
  slots: ["08-12", "14-18", "19-22"],
  slot_max: 4,
  interval_hours: 6,
}

export async function POST(req: Request) {
  const guard = await requireAdmin()
  if (guard) return guard

  // 加载运行�� AI 配置（从数据库读取 key）
  await loadRuntimeConfig()

  const body = await req.json()
  const { strategy = "daily", types = ["article", "comment"], count = 10 } = body

  const supabase = createDirectClient()

  const { data: virtualUsers } = await supabase
    .from("virtual_users")
    .select("*")
    .eq("is_active", true)
    .limit(50)

  if (!virtualUsers?.length) {
    return NextResponse.json({ error: "没有可用的虚拟用户，请先生成虚拟用户" }, { status: 400 })
  }

  const results: any[] = []
  let totalGenerated = 0

  // 文章
  if (types.includes("article")) {
    const designers = virtualUsers.filter(u => u.role === "designer")
    const articleGenCount = Math.min(designers.length, count)
    for (let i = 0; i < articleGenCount; i++) {
      const user = designers[i]
      try {
        const history = await getVirtualUserHistory(supabase, user.id)
        const article = await generateArticle(user, history)
        if (!article.content?.trim() || !article.title?.trim()) {
          results.push({ type: "article", title: article.title, error: "生成内容为空，跳过入库" })
          continue
        }
        const { data: dbResult } = await supabase.from("articles").insert({
          title: article.title,
          summary: article.summary,
          content: article.content,
          category: "装修攻略",
          tags: [article.summary?.slice(0, 8) || "装修攻略", "重庆装修"],
          cover_url: article.cover_url,
          is_published: true,
          author_id: user.user_id,
          virtual_user_id: user.id,
          published_at: await scheduleV1(supabase, defaultScheduleConfig, user.id),
          view_count: Math.floor(Math.random() * 200) + 10,
          like_count: Math.floor(Math.random() * 30),
        }).select().single()
        results.push({ type: "article", title: article.title, id: dbResult?.id })
        totalGenerated++
        await supabase.rpc("increment_vu_content", { p_id: user.id })
      } catch (err: any) {
        results.push({ type: "article", error: err.message })
      }
    }
  }

  // 案例
  if (types.includes("case")) {
    const virtualDesigners = virtualUsers.filter(u => u.role === "designer")
    const caseGenCount = Math.min(virtualDesigners.length, count)
    for (let i = 0; i < caseGenCount; i++) {
      const user = virtualDesigners[i]
      // 查找该虚拟用户对应的 designers 表记录
      const { data: designerRecord } = await supabase
        .from("designers")
        .select("id")
        .eq("user_id", user.user_id)
        .maybeSingle()

      if (!designerRecord) {
        results.push({ type: "case", error: `设计师 ${user.nickname} 没有对应的设计师记录` })
        continue
      }

      try {
        const history = await getVirtualUserHistory(supabase, user.id)
        const caseItem = await generateCase(user, history)
        if (!caseItem.description?.trim() || !caseItem.title?.trim()) {
          results.push({ type: "case", title: caseItem.title, error: "生成内容为空，跳过入库" })
          continue
        }
        const { data: dbResult } = await supabase.from("cases").insert({
          is_published: true,
          title: caseItem.title,
          style: caseItem.style,
          area: caseItem.area,
          budget: caseItem.budget,
          description: caseItem.description,
          images: caseItem.images,
          designer_id: designerRecord.id,
          virtual_user_id: user.id,
          published_at: await scheduleV1(supabase, defaultScheduleConfig, user.id),
          view_count: Math.floor(Math.random() * 500) + 20,
        }).select().single()
        results.push({ type: "case", title: caseItem.title, id: dbResult?.id })
        totalGenerated++
        // 更新设计师案例计数（先查当前值再 +1）
        const { data: cur } = await supabase.from("designers").select("case_count").eq("id", designerRecord.id).single()
        await supabase.from("designers").update({ case_count: (cur?.case_count ?? 0) + 1 }).eq("id", designerRecord.id)
      } catch (err: any) {
        results.push({ type: "case", error: err.message })
      }
    }
  }

  // 提问
  if (types.includes("question")) {
    const owners = virtualUsers.filter(u => u.role === "owner")
    const questionGenCount = Math.min(owners.length, count)
    for (let i = 0; i < questionGenCount; i++) {
      const user = owners[i]
      try {
        const history = await getVirtualUserHistory(supabase, user.id)
        const question = await generateQuestion(user, history)
        const { data: dbResult } = await supabase.from("questions").insert({
          user_id: user.user_id,
          title: question.title,
          content: question.content,
          category: question.category,
          virtual_user_id: user.id,
          created_at: await scheduleV1(supabase, defaultScheduleConfig, user.id),
        }).select().single()
        results.push({ type: "question", title: question.title, id: dbResult?.id })
        totalGenerated++
      } catch (err: any) {
        results.push({ type: "question", error: err.message })
      }
    }
  }

  // 评论
  if (types.includes("comment")) {
    const [articlesRes, casesRes] = await Promise.all([
      supabase.from("articles").select("id, title").is("virtual_user_id", null).limit(10),
      supabase.from("cases").select("id, title").is("virtual_user_id", null).limit(10),
    ])
    const targets = [
      ...(articlesRes.data || []).map(a => ({ type: "article", id: a.id, title: a.title })),
      ...(casesRes.data || []).map(c => ({ type: "case", id: c.id, title: c.title })),
    ]

    if (targets.length === 0) {
      results.push({ type: "comment", error: "无可评论的新内容（所有内容已关联虚拟人）" })
    } else {
      const commentGenCount = Math.min(virtualUsers.length, targets.length, count)
      for (let i = 0; i < commentGenCount; i++) {
      const user = virtualUsers[i]
      const target = targets[i % targets.length]
      try {
        const history = await getVirtualUserHistory(supabase, user.id)
        const comment = await generateComment(user, history, target.title)
        const { data: dbResult } = await supabase.from("comments").insert({
          target_type: target.type,
          target_id: target.id,
          user_id: user.user_id,
          content: comment.content,
          virtual_user_id: user.id,
          created_at: await scheduleV1(supabase, defaultScheduleConfig, user.id),
        }).select().single()
        results.push({ type: "comment", target: target.title, id: dbResult?.id })
        totalGenerated++
      } catch (err: any) {
        results.push({ type: "comment", error: err.message })
      }
    }
    } // else end
  }

  // 评价
  if (types.includes("review")) {
    const { data: designers } = await supabase.from("designers").select("id, name").limit(10)
    const owners = virtualUsers.filter(u => u.role === "owner")
    const reviewGenCount = Math.min(owners.length, designers?.length || 0, count)

    for (let i = 0; i < reviewGenCount; i++) {
      const user = owners[i % owners.length]
      const designer = designers![i % designers!.length]
      try {
        const history = await getVirtualUserHistory(supabase, user.id)
        const review = await generateReview(user, history, designer.name)
        const { data: dbResult } = await supabase.from("reviews").insert({
          user_id: user.user_id,
          designer_id: designer.id,
          rating: review.rating,
          design_score: review.design_score,
          construction_score: review.construction_score,
          service_score: review.service_score,
          content: review.content,
          is_verified: true,
          review_status: "approved",
          review_source: "browse",
          virtual_user_id: user.id,
          created_at: await scheduleV1(supabase, defaultScheduleConfig, user.id),
        }).select().single()
        results.push({ type: "review", designer: designer.name, id: dbResult?.id })
        totalGenerated++
      } catch (err: any) {
        results.push({ type: "review", error: err.message })
      }
    }
  }

  return NextResponse.json({
    success: true,
    total: totalGenerated,
    results,
  })
}
