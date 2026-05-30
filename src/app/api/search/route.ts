import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q")?.trim() || ""
  const type = searchParams.get("type") || "all" // all | cases | articles | designers

  if (!q) {
    return NextResponse.json({ results: { cases: [], articles: [], designers: [] } })
  }

  const supabase = createDirectClient()
  const searchTerm = `%${q}%`

  const results: { cases: any[]; articles: any[]; designers: any[] } = {
    cases: [],
    articles: [],
    designers: [],
  }

  if (type === "all" || type === "cases") {
    const { data } = await supabase
      .from("cases")
      .select("id, title, description, cover_url, style, area, budget, like_count, created_at")
      .or(`title.ilike.${searchTerm},description.ilike.${searchTerm},style.ilike.${searchTerm}`)
      .eq("is_published", true)
      .order("like_count", { ascending: false })
      .limit(10)
    results.cases = data ?? []
  }

  if (type === "all" || type === "articles") {
    const { data } = await supabase
      .from("articles")
      .select("id, title, summary, cover_url, category, tags, like_count, published_at")
      .or(`title.ilike.${searchTerm},summary.ilike.${searchTerm},content.ilike.${searchTerm}`)
      .eq("is_published", true)
      .order("like_count", { ascending: false })
      .limit(10)
    results.articles = data ?? []
  }

  if (type === "all" || type === "designers") {
    const { data } = await supabase
      .from("designers")
      .select("id, name, logo_url, description, type, specialties, avg_rating, review_count, city_id")
      .or(`name.ilike.${searchTerm},description.ilike.${searchTerm}`)
      .order("avg_rating", { ascending: false })
      .limit(10)
    results.designers = data ?? []
  }

  return NextResponse.json({ results, query: q })
}
