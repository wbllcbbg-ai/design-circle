import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

// GET /api/admin/content — 内容库列表 + 筛选 + 搜索 + 分页
export async function GET(req: Request) {
  const guard = await requireAdmin()
  if (guard) return guard

  const { searchParams } = new URL(req.url)
  const search = searchParams.get("search") || ""
  const type = searchParams.get("type") || ""
  const source = searchParams.get("source") || ""
  const page = parseInt(searchParams.get("page") || "1")
  const pageSize = parseInt(searchParams.get("pageSize") || "15")
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const supabase = createDirectClient()

  // 查文章
  let articleQuery = supabase.from("articles").select("id, title, category, cover_url, virtual_user_id, is_published, created_at, edited_by_human")
  if (search) articleQuery = articleQuery.ilike("title", `%${search}%`)

  // 来源筛选：edited_by_human 字段
  // ai=edited_by_human=false & virtual_user_id!=null
  // edited=edited_by_human=true
  // manual=virtual_user_id is null
  if (source === "ai") {
    articleQuery = articleQuery.eq("edited_by_human", false).not("virtual_user_id", "is", null)
  } else if (source === "edited") {
    articleQuery = articleQuery.eq("edited_by_human", true)
  } else if (source === "manual") {
    articleQuery = articleQuery.is("virtual_user_id", null)
  }

  articleQuery = articleQuery.order("created_at", { ascending: false })

  // 查案例（类似逻辑）
  let caseQuery = supabase.from("cases").select("id, title, style, cover_url, virtual_user_id, is_published, created_at, edited_by_human")
  if (search) caseQuery = caseQuery.ilike("title", `%${search}%`)
  if (source === "ai") {
    caseQuery = caseQuery.eq("edited_by_human", false).not("virtual_user_id", "is", null)
  } else if (source === "edited") {
    caseQuery = caseQuery.eq("edited_by_human", true)
  } else if (source === "manual") {
    caseQuery = caseQuery.is("virtual_user_id", null)
  }
  caseQuery = caseQuery.order("created_at", { ascending: false })

  let articles: any[] = []
  let cases: any[] = []

  if (!type || type === "article") {
    const { data } = await articleQuery
    articles = data ?? []
  }
  if (!type || type === "case") {
    const { data } = await caseQuery
    cases = data ?? []
  }

  // 收集所有 virtual_user_id 查虚拟人昵称
  const vuIds = [
    ...new Set([
      ...articles.map((a) => a.virtual_user_id).filter(Boolean),
      ...cases.map((c) => c.virtual_user_id).filter(Boolean),
    ]),
  ]
  const vuMap: Record<string, string> = {}
  if (vuIds.length > 0) {
    const { data: vus } = await supabase
      .from("virtual_users")
      .select("id, nickname")
      .in("id", vuIds)
    for (const vu of vus ?? []) {
      vuMap[vu.id] = vu.nickname
    }
  }

  // 统一输出
  const allContents = [
    ...articles.map((a) => ({
      id: a.id,
      title: a.title,
      type: "article" as const,
      source: getSource(a),
      virtualUser: vuMap[a.virtual_user_id] || null,
      status: a.is_published ? "published" as const : "draft" as const,
      createdAt: a.created_at?.slice(0, 10) || "",
    })),
    ...cases.map((c) => ({
      id: c.id,
      title: c.title,
      type: "case" as const,
      source: getSource(c),
      virtualUser: vuMap[c.virtual_user_id] || null,
      status: c.is_published ? "published" as const : "draft" as const,
      createdAt: c.created_at?.slice(0, 10) || "",
    })),
  ]

  // 按时间排序+代码层分页（避免各自 LIMIT 后合并排序错位）
  allContents.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const total = allContents.length
  const paged = allContents.slice(from, to + 1)

  return NextResponse.json({ contents: paged, total, page, pageSize })
}

function getSource(row: any): "ai" | "edited" | "manual" {
  if (!row.virtual_user_id) return "manual"
  if (row.edited_by_human) return "edited"
  return "ai"
}
