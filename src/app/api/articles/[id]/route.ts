import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createDirectClient()

  const { data: article } = await supabase
    .from("articles")
    .select("*, author:users(id, nickname, avatar_url)")
    .eq("id", id)
    .single()

  // 获取作者的设计师身份
  if (article?.author_id) {
    const { data: designer } = await supabase
      .from("designers")
      .select("type, is_verified")
      .eq("user_id", article.author_id)
      .single()
    article.author = {
      ...article.author,
      designer_type: designer?.type ?? null,
      is_verified_designer: designer?.is_verified ?? false,
    }
  }

  const { data: comments } = await supabase.from("cases")
    .select("id")
    .limit(0)

  return NextResponse.json({ article, comments: [] })
}
