import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

// PUT /api/admin/contracts/[id]/service-fee — 标记设计师固定服务费已收
// 平台收入入口：设计师对公转账固定金额 → admin 标记 service_fee_paid=true
// 这是平台唯一触碰的钱（非业主资金），合规。
export async function PUT(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (guard) return guard

  const { id } = await params
  const supabase = createDirectClient()

  const { data, error } = await supabase
    .from("contracts")
    .update({
      service_fee_paid: true,
      service_fee_paid_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, service_fee_amount, service_fee_paid, service_fee_paid_at")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, contract: data })
}
