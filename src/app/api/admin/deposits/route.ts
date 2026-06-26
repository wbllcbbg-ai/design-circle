import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

// GET /api/admin/deposits — 查询保证金记录（admin）
// 可选 query: role, status
export async function GET(req: Request) {
  const guard = await requireAdmin()
  if (guard) return guard

  const { searchParams } = new URL(req.url)
  const role = searchParams.get("role")
  const status = searchParams.get("status")

  const supabase = createDirectClient()
  let query = supabase
    .from("deposits")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100)

  if (role) query = query.eq("role", role)
  if (status) query = query.eq("status", status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ deposits: data ?? [] })
}

// POST /api/admin/deposits — admin 录入保证金（线下对公收取后记录状态）
// 平台不碰钱，只记录「已收到」状态
export async function POST(req: Request) {
  const guard = await requireAdmin()
  if (guard) return guard

  const body = await req.json()
  const { role, entity_id, user_id, amount, category, note } = body

  if (!role || !entity_id || !user_id || !amount) {
    return NextResponse.json({ error: "role/entity_id/user_id/amount 必填" }, { status: 400 })
  }
  if (!["supplier", "contractor"].includes(role)) {
    return NextResponse.json({ error: "role 必须是 supplier 或 contractor" }, { status: 400 })
  }

  const supabase = createDirectClient()
  const { data, error } = await supabase.from("deposits").insert({
    role,
    entity_id,
    user_id,
    amount,
    category: category || null,
    status: "received",  // admin 录入即视为已线下收取
    received_at: new Date().toISOString(),
    note: note || null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, deposit: data })
}

// PUT /api/admin/deposits/[id] — 更新保证金状态（用于赔付使用/退还）
export async function PUT(req: Request) {
  const guard = await requireAdmin()
  if (guard) return guard

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  const body = await req.json()
  const { status, used_reason } = body

  if (!["received", "used", "refunded"].includes(status)) {
    return NextResponse.json({ error: "status 非法" }, { status: 400 })
  }

  const updateFields: Record<string, string | null> = { status }
  const now = new Date().toISOString()
  if (status === "used") {
    updateFields.used_at = now
    updateFields.used_reason = used_reason || null
  } else if (status === "refunded") {
    updateFields.refunded_at = now
  }

  const supabase = createDirectClient()
  const { data, error } = await supabase
    .from("deposits")
    .update(updateFields)
    .eq("id", id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, deposit: data })
}
