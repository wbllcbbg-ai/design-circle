import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const body = await req.json()
  const { designer_id, case_id, rating, design_score, construction_score, service_score, content, images, is_real_name } = body

  if (!designer_id || !rating || !content) {
    return NextResponse.json({ error: "设计师、评分和评价内容不能为空" }, { status: 400 })
  }

  const supabase = createDirectClient()
  // 临时用一个固定用户ID
  const { data: user } = await supabase.from("users").select("id").limit(1).single()

  const { data, error } = await supabase.from("reviews").insert({
    user_id: user?.id || "00000000-0000-0000-0000-000000000001",
    designer_id,
    case_id: case_id || null,
    rating,
    design_score: design_score || rating,
    construction_score: construction_score || rating,
    service_score: service_score || rating,
    content,
    images: images || [],
    is_real_name: is_real_name || false,
    is_verified: false,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, review: data })
}
