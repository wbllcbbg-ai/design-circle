import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

// 获取当前用户的所有点评
export async function GET() {
  const auth = await requireAuth()
  if (typeof auth !== "string") return auth
  const userId = auth

  const supabase = createDirectClient()

  const { data: reviews } = await supabase
    .from("reviews")
    .select(`
      id,
      rating,
      design_score,
      construction_score,
      service_score,
      content,
      images,
      created_at,
      designer_id,
      case_id,
      designers!reviews_designer_id_fkey ( name, avatar_url ),
      cases!reviews_case_id_fkey ( id, title, cover_url )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  return NextResponse.json({ reviews: reviews ?? [] })
}
