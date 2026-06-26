import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// GET /api/merchants/[role]/[id]/credit — 任意商户角色的信用（公开）
// role: supplier | contractor | inspector
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ role: string; id: string }> },
) {
  const { role, id } = await params

  const supabase = createDirectClient()

  // 各角色的信用字段映射
  const selectByRole: Record<string, { table: string; fields: string }> = {
    supplier: {
      table: "suppliers",
      fields: "id, name, credit_score, case_count, avg_rating, review_count, delay_count",
    },
    contractor: {
      table: "contractors",
      fields: "id, name, credit_score, completed_projects, pass_rate, rework_rate, schedule_deviation, dispute_count, avg_rating, review_count",
    },
    inspector: {
      table: "inspectors",
      fields: "id, name, credit_score, inspection_count, punctuality_rate, report_quality_score, issue_finding_rate, avg_rating, review_count, is_mentor",
    },
  }

  const config = selectByRole[role]
  if (!config) {
    return NextResponse.json({ error: "不支持的角色，可选 supplier/contractor/inspector" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from(config.table)
    .select(config.fields)
    .eq("id", id)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ error: "商户不存在" }, { status: 404 })
  }

  return NextResponse.json({
    credit: data,
    // 来源标注：信用数据全部来自平台见证的真实交付
    data_source: "platform_verified",
  })
}
