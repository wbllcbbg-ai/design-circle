import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const body = await req.json()
  const { title, description, style, area, budget, duration, cover_url, images } = body

  if (!title) {
    return NextResponse.json({ error: "标题不能为空" }, { status: 400 })
  }

  const supabase = createDirectClient()

  // 临时用一个固定设计师ID（后续接入认证后换成真实的）
  const { data: designer } = await supabase.from("designers").select("id").limit(1).single()

  const { data, error } = await supabase.from("cases").insert({
    designer_id: designer?.id || "00000000-0000-0000-0000-000000000001",
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
