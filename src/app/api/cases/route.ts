import { createDirectClient } from "@/lib/supabase/client"
import { getCurrentUserId } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const body = await req.json()
  const { title, description, style, area, budget, duration, cover_url, images } = body

  if (!title) {
    return NextResponse.json({ error: "标题不能为空" }, { status: 400 })
  }

  const supabase = createDirectClient()

  // 查找当前用户关联的设计师身份
  const { data: designer } = await supabase
    .from("designers")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle()

  if (!designer) {
    return NextResponse.json({ error: "只有认证设计师才能发布案例" }, { status: 403 })
  }

  const { data, error } = await supabase.from("cases").insert({
    designer_id: designer.id,
    title,
    description: description || "",
    cover_url: cover_url || "",
    images: images || [],
    style: style || "",
    area: area || null,
    budget: budget || null,
    duration: duration || null,
    is_published: true,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, case: data })
}
