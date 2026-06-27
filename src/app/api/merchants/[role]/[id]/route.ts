import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// GET /api/merchants/[role]/[id] — 单个商户详情（替代列表 find 的脆弱做法）
// role: designer | supplier | contractor | inspector
export async function GET(_req: Request, { params }: { params: Promise<{ role: string; id: string }> }) {
  const { role, id } = await params

  const config: Record<string, { table: string; fields: string }> = {
    designer: {
      table: "designers",
      fields: "id, name, type, logo_url, description, city_id, specialties, is_verified, avg_rating, review_count, case_count, credit_score, years_experience, service_areas",
    },
    supplier: {
      table: "suppliers",
      fields: "id, name, logo_url, description, brand, category, city_id, is_verified, avg_rating, review_count, case_count, delay_count, credit_score",
    },
    contractor: {
      table: "contractors",
      fields: "id, name, logo_url, description, city_id, service_areas, specialties, is_verified, avg_rating, review_count, completed_projects, pass_rate, rework_rate, schedule_deviation, dispute_count, credit_score",
    },
    inspector: {
      table: "inspectors",
      fields: "id, name, logo_url, description, city_id, service_areas, is_verified, avg_rating, review_count, inspection_count, punctuality_rate, report_quality_score, issue_finding_rate, credit_score, is_mentor",
    },
  }

  const c = config[role]
  if (!c) {
    return NextResponse.json({ error: "不支持的角色" }, { status: 400 })
  }

  const supabase = createDirectClient()
  const { data, error } = await supabase
    .from(c.table)
    .select(c.fields)
    .eq("id", id)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ error: "商户不存在" }, { status: 404 })
  }

  return NextResponse.json({ merchant: data })
}
