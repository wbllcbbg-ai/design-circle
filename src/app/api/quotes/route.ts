import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

// POST /api/quotes — 设计师向业主发起结构化报价
// 报价发起在对话内，发出后通知业主，等待 accept/reject
export async function POST(req: Request) {
  const auth = await requireAuth(req)
  if (typeof auth !== "string") return auth
  const userId = auth

  const body = await req.json()
  const {
    conversation_id,
    user_id,                  // 业主 user_id（被报价方）
    design_fee,
    design_fee_breakdown,
    estimated_construction_fee,
    design_period,
    construction_period,
    payment_rhythm,
    exclusions,
    budget_warning,
    notes,
  } = body

  // 基础校验
  if (!conversation_id || !user_id || !design_fee) {
    return NextResponse.json({ error: "对话ID、业主ID、设计费不能为空" }, { status: 400 })
  }
  if (typeof design_fee !== "number" || design_fee <= 0) {
    return NextResponse.json({ error: "设计费必须为正数" }, { status: 400 })
  }

  const supabase = createDirectClient()

  // 校验当前用户是设计师身份（复用 cases/route.ts 的范式）
  const { data: designer } = await supabase
    .from("designers")
    .select("id, name")
    .eq("user_id", userId)
    .maybeSingle()

  if (!designer) {
    return NextResponse.json({ error: "只有认证设计师才能发起报价" }, { status: 403 })
  }

  // 校验对话归属（防越权：设计师必须是该对话的 designer 方）
  const { data: conv } = await supabase
    .from("conversations")
    .select("designer_id, user_id")
    .eq("id", conversation_id)
    .maybeSingle()

  if (!conv || conv.designer_id !== designer.id || conv.user_id !== user_id) {
    return NextResponse.json({ error: "对话不存在或无权操作" }, { status: 403 })
  }

  // 有效期默认 48 小时
  const expiresAt = new Date(Date.now() + 48 * 3600 * 1000).toISOString()

  const { data, error } = await supabase.from("quotes").insert({
    designer_id: designer.id,
    user_id,
    conversation_id,
    design_fee,
    design_fee_breakdown: design_fee_breakdown || {},
    estimated_construction_fee: estimated_construction_fee || null,
    design_period: design_period || null,
    construction_period: construction_period || null,
    payment_rhythm: payment_rhythm || [],
    exclusions: exclusions || [],
    budget_warning: budget_warning || null,
    notes: notes || null,
    status: "pending",
    expires_at: expiresAt,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 发通知给业主（复用 notifications.insert 范式）
  await supabase.from("notifications").insert({
    user_id,
    type: "quote",            // 新增 type，前端按需扩展展示
    actor_id: userId,
    target_type: "designer",
    target_id: designer.id,
    content: `设计师${designer.name}给你发了一份报价（设计费 ${design_fee} 元），请查看`,
  })

  return NextResponse.json({ success: true, quote: data })
}

// GET /api/quotes/mine — 设计师查看自己发出的报价列表
export async function GET(req: Request) {
  const auth = await requireAuth(req)
  if (typeof auth !== "string") return auth
  const userId = auth

  const { searchParams } = new URL(req.url)
  const as = searchParams.get("as") || "designer" // designer=我发出的 | client=发给我的

  const supabase = createDirectClient()

  if (as === "designer") {
    const { data: designer } = await supabase
      .from("designers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle()
    if (!designer) return NextResponse.json({ quotes: [] })
    const { data } = await supabase
      .from("quotes")
      .select("*")
      .eq("designer_id", designer.id)
      .order("created_at", { ascending: false })
      .limit(50)
    return NextResponse.json({ quotes: data ?? [] })
  } else {
    // client：发给我的报价
    const { data } = await supabase
      .from("quotes")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50)
    return NextResponse.json({ quotes: data ?? [] })
  }
}
