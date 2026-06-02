import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createDirectClient()

  const { data: article } = await supabase
    .from("articles")
    .select("*, author:users(id, nickname, avatar_url, role)")
    .eq("id", id)
    .single()

  if (!article) return NextResponse.json({ error: "文章不存在" }, { status: 404 })

  // 获取作者的设计师身份
  if (article?.author_id) {
    const { data: designer } = await supabase
      .from("designers")
      .select("id")
      .eq("user_id", article.author_id)
      .maybeSingle()
    article.author = {
      ...article.author,
      designer_id: designer?.id ?? null,
    }
  }

  const { data: comments } = await supabase.from("cases")
    .select("id")
    .limit(0)

  return NextResponse.json({ article, comments: [] })
}
