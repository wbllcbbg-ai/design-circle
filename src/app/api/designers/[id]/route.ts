import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createDirectClient()

  const { data: designer } = await supabase.from("designers").select("*").eq("id", id).single()
  if (!designer) return NextResponse.json({ error: "设计师不存在" }, { status: 404 })
  const { data: cases } = await supabase.from("cases").select("*").eq("designer_id", id).limit(20)
  const { data: reviews } = await supabase.from("reviews").select("*").eq("designer_id", id).order("created_at", { ascending: false }).limit(10)

  // 查询该设计师发布的文章
  // 优先按 author_id（designers.user_id → articles.author_id），
  // 查不到时回退到 virtual_user_id（兼容历史 author_id 为空的 AI 文章）
  let articles: any[] = []
  if (designer?.user_id) {
    const { data: a } = await supabase
      .from("articles")
      .select("id, title, cover_url, category, created_at, like_count")
      .eq("author_id", designer.user_id)
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(20)
    articles = a ?? []
  }
  // 兜底：如果 author_id 查不到，按 virtual_user_id 查
  // （designers.user_id → virtual_users.id，再 articles.virtual_user_id）
  if (articles.length === 0 && designer?.user_id) {
    const { data: vu } = await supabase
      .from("virtual_users")
      .select("id")
      .eq("user_id", designer.user_id)
      .maybeSingle()
    if (vu?.id) {
      const { data: a2 } = await supabase
        .from("articles")
        .select("id, title, cover_url, category, created_at, like_count")
        .eq("virtual_user_id", vu.id)
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .limit(20)
      articles = a2 ?? []
    }
  }

  return NextResponse.json({ designer, cases: cases ?? [], articles, reviews: reviews ?? [] })
}
