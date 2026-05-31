import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { generateArticle, generateCase, generateQuestion, generateComment, generateReview, setRuntimeAiKey, setWanxiangEnabled } from "@/lib/ai-generator"
import { setUnsplashKey } from "@/lib/unsplash"
import { setWanxiangKey } from "@/lib/wanxiang"
import { requireAdmin } from "@/lib/auth-guard"

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
  try {
    promises.push(supabase.from("questions").select("title, content, created_at").eq("virtual_user_id", virtualUserId).order("created_at", { ascending: false }).limit(limit))
  } catch {}

  const results = await Promise.allSettled(promises)
  const items: any[] = []

  for (const result of results) {
    if (result.status === "fulfilled") {
      for (const row of result.value.data || []) {
        if (row.title) {
          items.push({ type: row.title ? (result.value.data?.find((r: any) => r.title) ? "文章" : "提问") : "评论", title: row.title, content: row.content, created_at: row.created_at })
        } else {
          items.push({ type: "评论", content: row.content, created_at: row.created_at })
        }
      }
    }
  }

  return items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, limit)
}

// 调度时间计算
function schedulePublishTime(strategy: string, user: any): string {
  const now = new Date()

  if (strategy === "init") {
    const daysAgo = Math.floor(Math.random() * 30)
    const hours = Math.floor(Math.random() * 12) + 8
    const date = new Date(now.getTime() - daysAgo * 86400000)
    date.setHours(hours, Math.floor(Math.random() * 60), 0, 0)
    return date.toISOString()
  }

  const hasNight = user.active_periods?.includes("晚上")
  const hasAfternoon = user.active_periods?.includes("下午")
  const hasMorning = user.active_periods?.includes("早上")

  let hour: number
  if (hasNight && Math.random() > 0.5) {
    hour = 19 + Math.floor(Math.random() * 4)
  } else if (hasAfternoon) {
    hour = 13 + Math.floor(Math.random() * 4)
  } else if (hasMorning) {
    hour = 8 + Math.floor(Math.random() * 2)
  } else {
    hour = 10 + Math.floor(Math.random() * 10)
  }

  const d = new Date(now)
  d.setMinutes(d.getMinutes() + 5 + Math.floor(Math.random() * 25))
  return d.toISOString()
}

export async function POST(req: Request) {
  const guard = await requireAdmin()
  if (guard) return guard

  // 加载运行�� AI 配置（从数据库读取 key）
  await loadRuntimeConfig()

  const body = await req.json()
  const { strategy = "daily", types = ["article", "comment"] } = body

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
    const count = Math.min(designers.length, 5)
    for (let i = 0; i < count; i++) {
      const user = designers[i]
      try {
        const history = await getVirtualUserHistory(supabase, user.id)
        const article = await generateArticle(user, history)
        const { data: dbResult } = await supabase.from("articles").insert({
          title: article.title,
          summary: article.summary,
          content: article.content,
          category: "装修攻略",
          tags: [article.title.slice(0, 10), "重庆装修"],
          cover_url: article.cover_url,
          is_published: true,
          author_id: user.user_id,
          virtual_user_id: user.id,
          published_at: schedulePublishTime(strategy, user),
          view_count: Math.floor(Math.random() * 200) + 10,
          like_count: Math.floor(Math.random() * 30),
        }).select().single()
        results.push({ type: "article", title: article.title, id: dbResult?.id })
        totalGenerated++
        await supabase.from("virtual_users").update({ last_active_at: new Date().toISOString() }).eq("id", user.id)
      } catch (err: any) {
        results.push({ type: "article", error: err.message })
      }
    }
  }

  // 案例
  if (types.includes("case")) {
    const virtualDesigners = virtualUsers.filter(u => u.role === "designer")
    const count = Math.min(virtualDesigners.length, 3)
    for (let i = 0; i < count; i++) {
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
        const { data: dbResult } = await supabase.from("cases").insert({
          title: caseItem.title,
          style: caseItem.style,
          area: caseItem.area,
          budget: caseItem.budget,
          description: caseItem.description,
          images: caseItem.images,
          designer_id: designerRecord.id,
          virtual_user_id: user.id,
          published_at: schedulePublishTime(strategy, user),
          view_count: Math.floor(Math.random() * 500) + 20,
        }).select().single()
        results.push({ type: "case", title: caseItem.title, id: dbResult?.id })
        totalGenerated++
      } catch (err: any) {
        results.push({ type: "case", error: err.message })
      }
    }
  }

  // 提问
  if (types.includes("question")) {
    const owners = virtualUsers.filter(u => u.role === "owner")
    const count = Math.min(owners.length, 3)
    for (let i = 0; i < count; i++) {
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
          created_at: schedulePublishTime(strategy, user),
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

    const count = Math.min(virtualUsers.length, targets.length, 8)
    for (let i = 0; i < count; i++) {
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
          created_at: schedulePublishTime(strategy, user),
        }).select().single()
        results.push({ type: "comment", target: target.title, id: dbResult?.id })
        totalGenerated++
      } catch (err: any) {
        results.push({ type: "comment", error: err.message })
      }
    }
  }

  // 评价
  if (types.includes("review")) {
    const { data: designers } = await supabase.from("designers").select("id, name").limit(10)
    const owners = virtualUsers.filter(u => u.role === "owner")
    const count = Math.min(owners.length, designers?.length || 0, 5)

    for (let i = 0; i < count; i++) {
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
          created_at: schedulePublishTime(strategy, user),
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
