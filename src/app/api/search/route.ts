import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q")?.trim() || ""

  try {
    const type = searchParams.get("type") || "all"

    if (!q) {
      return NextResponse.json({ results: { cases: [], articles: [], designers: [] } })
    }

    const supabase = createDirectClient()

    // 使用 textSearch 替代复杂的 or/ilike 链
    const results: { cases: any[]; articles: any[]; designers: any[] } = {
      cases: [],
      articles: [],
      designers: [],
    }

    if (type === "all" || type === "cases") {
      const { data } = await supabase
        .from("cases")
        .select("id, title, description, cover_url, style, area, budget, like_count, created_at")
        .eq("is_published", true)
        .order("like_count", { ascending: false })
        .limit(10)
      // 客户端过滤
      results.cases = (data ?? []).filter((c: any) =>
        [c.title, c.description, c.style].some((f) => f && f.toLowerCase().includes(q.toLowerCase()))
      )
    }

    if (type === "all" || type === "articles") {
      const { data } = await supabase
        .from("articles")
        .select("id, title, summary, cover_url, category, tags, like_count, published_at")
        .eq("is_published", true)
        .order("like_count", { ascending: false })
        .limit(10)
      results.articles = (data ?? []).filter((a: any) =>
        [a.title, a.summary, a.category, a.tags?.join(" ")].some((f) => f && f.toLowerCase().includes(q.toLowerCase()))
      )
    }

    if (type === "all" || type === "designers") {
      const { data } = await supabase
        .from("designers")
        .select("id, name, logo_url, description, type, specialties, avg_rating, review_count, city_id")
        .order("avg_rating", { ascending: false })
        .limit(10)
      results.designers = (data ?? []).filter((d: any) =>
        [d.name, d.description, d.specialties?.join(" ")].some((f) => f && f.toLowerCase().includes(q.toLowerCase()))
      )
    }

    return NextResponse.json({ results, query: q })
  } catch (err: any) {
    return NextResponse.json({ error: "搜索出错", results: { cases: [], articles: [], designers: [] }, query: q }, { status: 500 })
  }
}
