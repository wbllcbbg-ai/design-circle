import { createDirectClient } from "@/lib/supabase/client"
import { getCurrentUserId } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const body = await req.json()
  const { designer_id, case_id, rating, design_score, construction_score, service_score, content, images, is_real_name } = body

  if (!designer_id || !rating || !content) {
    return NextResponse.json({ error: "设计师、评分和评价内容不能为空" }, { status: 400 })
  }

  const supabase = createDirectClient()

  const { data, error } = await supabase.from("reviews").insert({
    user_id: userId,
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
