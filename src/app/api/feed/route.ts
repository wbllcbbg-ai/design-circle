import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "10", 10)))
  const offset = (page - 1) * limit

  const supabase = createDirectClient()

  // 只 select 列表需要的字段，content 只取前 150 字符作为摘要
  const [casesRes, articlesRes] = await Promise.all([
    supabase
      .from("cases")
      .select("id, title, style, area, cover_url, images, like_count, designer_id, ai_generated_content, created_at")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1),
    supabase
      .from("articles")
      .select("id, title, category, cover_url, like_count, author_id, content, created_at, author:users(id, nickname, avatar_url, role)")
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1),
  ])

  // 获取文章作者的设计师身份（仅拿 designer_id 用于跳转）
  const articles = articlesRes.data ?? []
  const authorIds = [...new Set(articles.map((a) => a.author_id).filter(Boolean))]
  let articleDesignerMap: Record<string, string> = {}
  if (authorIds.length > 0) {
    const { data: designers } = await supabase
      .from("designers")
      .select("id, user_id")
      .in("user_id", authorIds)
    for (const d of designers ?? []) {
      articleDesignerMap[d.user_id] = d.id
    }
  }

  const articlesWithDesigner = articles.map((a) => ({
    id: a.id,
    title: a.title,
    category: a.category,
    cover_url: a.cover_url,
    like_count: a.like_count,
    author_id: a.author_id,
    created_at: a.created_at,
    content: a.content ? a.content.slice(0, 200) + (a.content.length > 200 ? "..." : "") : "",
    author: a.author
      ? {
          ...a.author,
          designer_id: a.author_id && articleDesignerMap[a.author_id] ? articleDesignerMap[a.author_id] : null,
        }
      : null,
  }))

  // 获取案例的设计师信息
  const cases = casesRes.data ?? []
  const designerIds = [...new Set(cases.map((c) => c.designer_id).filter(Boolean))]
  let caseDesignerMap: Record<string, { id: string; name: string; type: string; user_id: string }> = {}
  if (designerIds.length > 0) {
    const { data: designers } = await supabase
      .from("designers")
      .select("id, name, type, user_id")
      .in("id", designerIds)
    for (const d of designers ?? []) {
      caseDesignerMap[d.id] = { id: d.id, name: d.name, type: d.type, user_id: d.user_id }
    }
  }

  const casesWithDesigner = cases.map((c) => ({
    id: c.id,
    title: c.title,
    style: c.style,
    area: c.area,
    cover_url: c.cover_url,
    images: c.images,
    like_count: c.like_count,
    designer_id: c.designer_id,
    created_at: c.created_at,
    description: c.ai_generated_content ? c.ai_generated_content.slice(0, 200) + (c.ai_generated_content.length > 200 ? "..." : "") : "",
    designer: c.designer_id && caseDesignerMap[c.designer_id]
      ? {
          id: caseDesignerMap[c.designer_id].id,
          name: caseDesignerMap[c.designer_id].name,
          type: caseDesignerMap[c.designer_id].type,
          user_id: caseDesignerMap[c.designer_id].user_id,
        }
      : null,
  }))

  return NextResponse.json({
    cases: casesWithDesigner,
    articles: articlesWithDesigner,
    page,
    limit,
  })
}
