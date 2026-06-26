import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// GET /api/merchants/[role] — 任意商户角色的公开列表
// role: designer | supplier | contractor | inspector
// 可选 query: city_id, q(名称模糊搜索), page, limit
export async function GET(req: Request, { params }: { params: Promise<{ role: string }> }) {
  const { role } = await params
  const { searchParams } = new URL(req.url)
  const cityId = searchParams.get("city_id")
  const q = searchParams.get("q")
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20")))
  const from = (page - 1) * limit
  const to = from + limit - 1

  // 各角色的表 + 展示字段映射
  const tableConfig: Record<string, { table: string; fields: string; orderField: string }> = {
    designer: {
      table: "designers",
      fields: "id, name, type, logo_url, description, city_id, specialties, is_verified, avg_rating, review_count, case_count, credit_score, years_experience",
      orderField: "credit_score",
    },
    supplier: {
      table: "suppliers",
      fields: "id, name, logo_url, description, brand, category, city_id, is_verified, avg_rating, review_count, case_count, credit_score",
      orderField: "credit_score",
    },
    contractor: {
      table: "contractors",
      fields: "id, name, logo_url, description, city_id, service_areas, specialties, is_verified, avg_rating, review_count, completed_projects, credit_score",
      orderField: "credit_score",
    },
    inspector: {
      table: "inspectors",
      fields: "id, name, logo_url, description, city_id, service_areas, is_verified, avg_rating, review_count, inspection_count, credit_score",
      orderField: "credit_score",
    },
  }

  const config = tableConfig[role]
  if (!config) {
    return NextResponse.json({ error: "不支持的角色" }, { status: 400 })
  }

  const supabase = createDirectClient()
  let query = supabase
    .from(config.table)
    .select(config.fields, { count: "exact" })
    .eq("is_verified", true)
    .order(config.orderField, { ascending: false })
    .range(from, to)

  if (cityId) query = query.eq("city_id", cityId)
  if (q) query = query.ilike("name", `%${q}%`)

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    role,
    merchants: data ?? [],
    total: count ?? 0,
    page,
    limit,
  })
}
