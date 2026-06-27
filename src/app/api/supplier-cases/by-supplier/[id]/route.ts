import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// GET /api/supplier-cases/by-supplier/[id] — 查某材料商已通过的关联案例（公开）
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createDirectClient()

  const { data, error } = await supabase
    .from("supplier_cases")
    .select(`
      id, product_info, product_photos,
      case:cases(id, title, cover_url, style, images)
    `)
    .eq("supplier_id", id)
    .in("status", ["approved", "auto_approved"])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ cases: data ?? [] })
}
