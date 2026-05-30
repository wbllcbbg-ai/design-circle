import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(_req: Request, { params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params
  const supabase = createDirectClient()
  const searchTag = decodeURIComponent(tag)

  const [articlesRes, casesRes] = await Promise.all([
    supabase
      .from("articles")
      .select("id, title, summary, cover_url, category, tags, like_count, published_at")
      .contains("tags", [searchTag])
      .eq("is_published", true)
      .order("like_count", { ascending: false })
      .limit(20),
    supabase
      .from("cases")
      .select("id, title, cover_url, style, area, like_count, created_at")
      .eq("style", searchTag)
      .eq("is_published", true)
      .order("like_count", { ascending: false })
      .limit(20),
  ])

  return NextResponse.json({
    tag: searchTag,
    articles: articlesRes.data ?? [],
    cases: casesRes.data ?? [],
  })
}
