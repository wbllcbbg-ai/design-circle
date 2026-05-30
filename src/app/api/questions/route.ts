import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

// 先创建 questions 表
export async function POST(req: Request) {
  const body = await req.json()
  const { title, content, category } = body

  if (!title || !content) {
    return NextResponse.json({ error: "标题和内容不能为空" }, { status: 400 })
  }

  const supabase = createDirectClient()
  // 临时用户
  const { data: user } = await supabase.from("users").select("id").limit(1).single()

  const { data, error } = await supabase.from("questions").insert({
    user_id: user?.id || "00000000-0000-0000-0000-000000000001",
    title,
    content,
    category: category || "其他",
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, question: data })
}
