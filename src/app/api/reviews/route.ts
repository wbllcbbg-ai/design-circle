import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"

// AI 模拟审核
function aiReview(content: string, rating: number): { status: string; confidence: number; flags: string[] } {
  const badWords = ["广告", "加微信", "电话", "假的", "骗子", "垃圾"]
  const hasBad = badWords.some(w => content.includes(w))

  if (hasBad) {
    return { status: "flagged", confidence: 0.2, flags: ["suspicious_content"] }
  }
  if (content.length < 10) {
    return { status: "flagged", confidence: 0.3, flags: ["too_short"] }
  }
  if (rating >= 3 && content.length > 20) {
    return { status: "approved", confidence: 0.9, flags: [] }
  }
  return { status: "pending", confidence: 0.6, flags: [] }
}

export async function POST(req: Request) {
  const auth = await requireAuth(req)
  if (typeof auth !== "string") return auth
  const userId = auth

  const body = await req.json()
  const { designer_id, case_id, rating, design_score, construction_score, service_score, content, images, is_real_name, source, project_id } = body

  if (!designer_id || !rating || !content) {
    return NextResponse.json({ error: "设计师、评分和评价内容不能为空" }, { status: 400 })
  }

  // 真实交易评价（source=transaction）必须有 project_id
  const isTransactionReview = source === "transaction"
  if (isTransactionReview && !project_id) {
    return NextResponse.json({ error: "真实交易评价必须关联项目" }, { status: 400 })
  }

  const supabase = createDirectClient()

  // 真实交易评价：校验项目确实属于该业主且已竣工
  if (isTransactionReview) {
    const { data: project } = await supabase
      .from("projects")
      .select("id, user_id, designer_id, status")
      .eq("id", project_id)
      .maybeSingle()
    if (!project) {
      return NextResponse.json({ error: "项目不存在" }, { status: 400 })
    }
    if (project.user_id !== userId) {
      return NextResponse.json({ error: "只有项目业主能评价" }, { status: 403 })
    }
    if (project.designer_id !== designer_id) {
      return NextResponse.json({ error: "设计师与项目不匹配" }, { status: 400 })
    }
    if (project.status !== "completed") {
      return NextResponse.json({ error: "项目未竣工，不可评价" }, { status: 400 })
    }
  }

  // AI 审核
  const { status: review_status, confidence: ai_confidence, flags } = aiReview(content, rating)

  const { data, error } = await supabase.from("reviews").insert({
    user_id: userId,
    designer_id,
    case_id: case_id || null,
    project_id: project_id || null,            // 关联真实交易项目
    rating,
    design_score: design_score || rating,
    construction_score: construction_score || rating,
    service_score: service_score || rating,
    content,
    images: images || [],
    is_real_name: is_real_name || false,
    is_verified: isTransactionReview,          // 真实交易评价标记已验证
    review_status,
    review_source: source || "browse",
    ai_confidence,
    reviewed_at: review_status === "approved" ? new Date().toISOString() : null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 更新设计师评分统计（avg_rating / review_count），仅在 approved 时
  if (review_status === "approved") {
    const { data: stats } = await supabase
      .from("reviews")
      .select("rating")
      .eq("designer_id", designer_id)
      .eq("review_status", "approved")
    const allRatings = (stats || []).map((r: { rating: number }) => r.rating)
    const avg = allRatings.length > 0 ? allRatings.reduce((a, b) => a + b, 0) / allRatings.length : 0
    await supabase
      .from("designers")
      .update({ avg_rating: Math.round(avg * 10) / 10, review_count: allRatings.length })
      .eq("id", designer_id)
  }

  // 插入审核标记
  if (flags.length > 0) {
    for (const flag_type of flags) {
      await supabase.from("review_flags").insert({
        review_id: data.id,
        flag_type,
        reason: `AI 自动标记：${flag_type}`,
      })
    }
  }

  // 发通知给被评价的设计师（仅审核通过才发）
  if (review_status === "approved") {
    const { data: designer } = await supabase.from("designers").select("user_id, name").eq("id", designer_id).single()
    if (designer && designer.user_id !== userId) {
      const { data: actor } = await supabase.from("users").select("nickname").eq("id", userId).single()
      const snippet = content.slice(0, 40)
      await supabase.from("notifications").insert({
        user_id: designer.user_id,
        type: "review",
        actor_id: userId,
        target_type: "designer",
        target_id: designer_id,
        content: `${actor?.nickname || "某人"} 评价了你的设计（${rating}分）：${snippet}`,
      })
    }

    // 真实交易评价通过 → 加/扣信用分（praise）
    // 好评(≥4)+3，差评(≤2)-5，中评(3)不变
    if (isTransactionReview) {
      let praiseDelta = 0
      if (rating >= 4) praiseDelta = 3
      else if (rating <= 2) praiseDelta = -5
      if (praiseDelta !== 0) {
        await supabase.from("credit_records").insert({
          designer_id,
          delta: praiseDelta,
          metric: "praise",
          reason: praiseDelta > 0 ? "获得好评" : "获得差评",
          related_project_id: project_id,
        })
        await supabase.rpc("increment_credit_score", {
          p_designer_id: designer_id,
          p_delta: praiseDelta,
        })
      }
    }
  }

  return NextResponse.json({
    success: true,
    review: data,
    review_status,
    ai_confidence,
  })
}
