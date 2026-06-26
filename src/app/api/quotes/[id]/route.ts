import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

// 固定服务费（本版决策：合同写死固定金额）
// TODO: 后续可按设计师分层配置（头部/腰部/新人）
const DEFAULT_SERVICE_FEE = 500

// GET /api/quotes/[id] — 报价详情
export async function GET(req, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req)
  if (typeof auth !== "string") return auth
  const userId = auth

  const { id } = await params
  const supabase = createDirectClient()

  const { data: quote, error } = await supabase
    .from("quotes")
    .select(`
      *,
      designer:designers(id, name, logo_url, user_id)
    `)
    .eq("id", id)
    .maybeSingle()

  if (error || !quote) {
    return NextResponse.json({ error: "报价不存在" }, { status: 404 })
  }

  // 当事人校验：只有业主或设计师本人能看
  const designerUserId = (quote.designer as { user_id?: string } | null)?.user_id
  if (quote.user_id !== userId && designerUserId !== userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  return NextResponse.json({ quote })
}

// POST /api/quotes/[id]/accept — 业主接受报价 → 自动创建合同(draft)
export async function POST(req, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req)
  if (typeof auth !== "string") return auth
  const userId = auth

  const { id } = await params
  const supabase = createDirectClient()

  const { data: quote, error } = await supabase
    .from("quotes")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (error || !quote) {
    return NextResponse.json({ error: "报价不存在" }, { status: 404 })
  }

  // 只有被报价的业主本人能接受
  if (quote.user_id !== userId) {
    return NextResponse.json({ error: "只有业主本人能接受报价" }, { status: 403 })
  }

  if (quote.status !== "pending") {
    return NextResponse.json({ error: "该报价已处理" }, { status: 400 })
  }

  // 检查有效期
  if (new Date(quote.expires_at) < new Date()) {
    await supabase.from("quotes").update({ status: "expired" }).eq("id", id)
    return NextResponse.json({ error: "报价已过期" }, { status: 400 })
  }

  // 防重复：同一报价不能重复建合同
  const { data: existingContract } = await supabase
    .from("contracts")
    .select("id")
    .eq("quote_id", id)
    .maybeSingle()
  if (existingContract) {
    return NextResponse.json({ error: "该报价已生成合同" }, { status: 400 })
  }

  // 1. 更新报价为 accepted
  await supabase.from("quotes").update({
    status: "accepted",
    accepted_at: new Date().toISOString(),
  }).eq("id", id)

  // 2. 抓取双方身份快照（合同存证用）
  const { data: designer } = await supabase
    .from("designers")
    .select("id, name, type, is_verified, specialties, user_id")
    .eq("id", quote.designer_id)
    .single()
  const { data: user } = await supabase
    .from("users")
    .select("id, nickname, phone, city_id")
    .eq("id", userId)
    .single()

  // 3. 创建合同（draft 待签约，带入报价快照 + 固定服务费）
  const { data: contract, error: contractErr } = await supabase
    .from("contracts")
    .insert({
      quote_id: id,
      designer_id: quote.designer_id,
      user_id: userId,
      service_fee_amount: DEFAULT_SERVICE_FEE,
      service_fee_paid: false,
      total_price: quote.design_fee,
      quote_snapshot: quote as Record<string, unknown>,
      designer_snapshot: designer || {},
      user_snapshot: user || {},
      warning_threshold: 5.00,
      alert_threshold: 15.00,
      status: "draft",
    })
    .select()
    .single()

  if (contractErr) {
    return NextResponse.json({ error: contractErr.message }, { status: 500 })
  }

  // 4. 通知设计师：业主接受了报价，合同已生成待签约
  if (designer) {
    await supabase.from("notifications").insert({
      user_id: designer.user_id,
      type: "quote",
      actor_id: userId,
      target_type: "designer",
      target_id: designer.id,
      content: `业主${user?.nickname || ""}接受了你的报价，合同已生成，等待双方签约`,
    })
  }

  return NextResponse.json({
    success: true,
    contract_id: contract.id,
    contract,
  })
}

// DELETE /api/quotes/[id] — 业主拒绝报价
export async function DELETE(req, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req)
  if (typeof auth !== "string") return auth
  const userId = auth

  const { id } = await params
  const supabase = createDirectClient()

  const { data: quote } = await supabase
    .from("quotes")
    .select("user_id, designer_id, status")
    .eq("id", id)
    .maybeSingle()

  if (!quote) {
    return NextResponse.json({ error: "报价不存在" }, { status: 404 })
  }
  if (quote.user_id !== userId) {
    return NextResponse.json({ error: "只有业主本人能拒绝报价" }, { status: 403 })
  }
  if (quote.status !== "pending") {
    return NextResponse.json({ error: "该报价已处理" }, { status: 400 })
  }

  await supabase.from("quotes").update({
    status: "rejected",
    rejected_at: new Date().toISOString(),
  }).eq("id", id)

  // 通知设计师
  const { data: designer } = await supabase
    .from("designers")
    .select("user_id")
    .eq("id", quote.designer_id)
    .single()
  if (designer) {
    await supabase.from("notifications").insert({
      user_id: designer.user_id,
      type: "quote",
      actor_id: userId,
      target_type: "designer",
      target_id: quote.designer_id,
      content: "业主拒绝了你的报价",
    })
  }

  return NextResponse.json({ success: true })
}
