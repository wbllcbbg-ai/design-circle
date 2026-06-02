import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createDirectClient()

  const { data: caseItem } = await supabase.from("cases").select("*").eq("id", id).single()
  if (!caseItem) return NextResponse.json({ error: "案例不存在" }, { status: 404 })

  // 查设计师信息（带上 users.role）
  let designer = null
  if (caseItem.designer_id) {
    const { data: d } = await supabase
      .from("designers")
      .select("id, name, type, logo_url, description, avg_rating, review_count, case_count, specialties, is_verified, user_id")
      .eq("id", caseItem.designer_id)
      .single()
    if (d) {
      const { data: user } = await supabase.from("users").select("role").eq("id", d.user_id).single()
      designer = { ...d, role: user?.role || d.type }
    }
  }

  const { data: reviews } = await supabase
    .from("reviews")
    .select("*")
    .eq("case_id", id)
    .order("created_at", { ascending: false })
    .limit(20)

  return NextResponse.json({ case: caseItem, designer, reviews: reviews ?? [] })
}
