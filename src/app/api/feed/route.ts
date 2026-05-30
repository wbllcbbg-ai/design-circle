import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = createDirectClient()

  const [casesRes, articlesRes] = await Promise.all([
    supabase.from("cases").select("*").eq("is_published", true).order("created_at", { ascending: false }).limit(20),
    supabase.from("articles").select("*, author:users(id, nickname, avatar_url)").eq("is_published", true).order("created_at", { ascending: false }).limit(20),
  ])

  // 获取文章作者的设计师身份
  const articles = articlesRes.data ?? []
  const authorIds = [...new Set(articles.map((a) => a.author_id).filter(Boolean))]
  let designerMap: Record<string, { type: string; is_verified: boolean }> = {}
  if (authorIds.length > 0) {
    const { data: designers } = await supabase
      .from("designers")
      .select("user_id, type, is_verified")
      .in("user_id", authorIds)
    for (const d of designers ?? []) {
      designerMap[d.user_id] = { type: d.type, is_verified: d.is_verified }
    }
  }

  const articlesWithDesigner = articles.map((a) => ({
    ...a,
    author: a.author
      ? { ...a.author, designer_type: a.author_id ? designerMap[a.author_id]?.type ?? null : null, is_verified_designer: a.author_id ? designerMap[a.author_id]?.is_verified ?? false : false }
      : null,
  }))

  return NextResponse.json({
    cases: casesRes.data ?? [],
    articles: articlesWithDesigner,
  })
}
