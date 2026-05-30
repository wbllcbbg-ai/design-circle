import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"

export async function POST(req: Request) {
  const auth = await requireAuth()
  if (typeof auth !== "string") return auth
  const userId = auth

  const body = await req.json()
  const { title, content, category } = body

  if (!title || !content) {
    return NextResponse.json({ error: "标题和内容不能为空" }, { status: 400 })
  }

  const supabase = createDirectClient()

  const { data, error } = await supabase.from("questions").insert({
    user_id: userId,
    title,
    content,
    category: category || "其他",
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, question: data })
}
