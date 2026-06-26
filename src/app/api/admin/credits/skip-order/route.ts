import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

// POST /api/admin/credits/skip-order — 人工确认设计师跳单
// 副作用：信用 -20 + skip_order_count +1 + 主页警示
// 承认检测难：靠业主/同行举报 + 人工确认，主武器仍是「不走平台=没信用=没流量」
export async function POST(req: Request) {
  const guard = await requireAdmin(req)
  if (guard) return guard

  const body = await req.json()
  const { designer_id, reason } = body

  if (!designer_id) {
    return NextResponse.json({ error: "designer_id required" }, { status: 400 })
  }

  const supabase = createDirectClient()

  // 写信用流水（跳单 -20）
  const { error: recordErr } = await supabase.from("credit_records").insert({
    designer_id,
    delta: -20,
    metric: "skip_order",
    reason: reason || "人工确认跳单",
  })
  if (recordErr) return NextResponse.json({ error: recordErr.message }, { status: 500 })

  // 原子扣信用分 + 跳单数+1
  await supabase.rpc("increment_credit_score", {
    p_designer_id: designer_id,
    p_delta: -20,
  })
  await supabase.rpc("increment_skip_order_count", { p_designer_id: designer_id })

  return NextResponse.json({
    success: true,
    message: "已标记跳单，信用分 -20",
  })
}
