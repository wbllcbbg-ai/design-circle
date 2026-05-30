import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createDirectClient()

  const { data: user } = await supabase.from("users").select("*").eq("id", id).single()

  if (!user) {
    return NextResponse.json({ error: "用户不存在" }, { status: 404 })
  }

  // 查设计师信息
  const { data: designer } = await supabase.from("designers").select("*").eq("user_id", id).single()

  const { data: articles } = await supabase
    .from("articles")
    .select("*, author:users(id, nickname, avatar_url)")
    .eq("author_id", id)
    .eq("is_published", true)
    .order("created_at", { ascending: false })

  return NextResponse.json({
    user,
    designer: designer ?? null,
    articles: articles ?? [],
  })
}
