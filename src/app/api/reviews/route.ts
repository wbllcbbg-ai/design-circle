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

  // 发通知给被评价的设计师
  const { data: designer } = await supabase.from("designers").select("user_id, name").eq("id", designer_id).single()
  if (designer && designer.user_id !== userId) {
    const { data: actor } = await supabase.from("users").select("nickname").eq("id", userId).single()
    const snippet = content.slice(0, 40)
    await supabase.from("notifications").insert({
      user_id: designer.user_id,
      type: "review",
      actor_id: userId,
      target_type: "designer",
      target_id: designer_id,
      content: `${actor?.nickname || "某人"} 评价了你的设计（${rating}分）：${snippet}`,
    })
  }

  return NextResponse.json({ success: true, review: data })
}
