import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

// GET /api/admin/content/:id — 获取单条内容详情
// GET /api/admin/content/:id/diff — AI原始 vs 当前版本对比（通过 URL 判断）
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (guard) return guard

  const { id } = await params
  const supabase = createDirectClient()
  const url = new URL(req.url)

  // ?view=diff 参数：返回版本对比
  if (url.searchParams.get("view") === "diff") {
    const [aRes, cRes] = await Promise.all([
      supabase.from("articles").select("title, content, ai_generated_content, edited_by_human").eq("id", id).maybeSingle(),
      supabase.from("cases").select("title, description, ai_generated_content, edited_by_human").eq("id", id).maybeSingle(),
    ])
    const data = aRes.data || cRes.data
    if (!data) return NextResponse.json({ error: "内容不存在" }, { status: 404 })
    const aiContent = data.ai_generated_content || null
    return NextResponse.json({
      diff: {
        title_edited: aiContent ? data.title !== aiContent?.slice(0, 100) : false,
        content_length_change: (data.content || data.description || "")?.length - ((aiContent)?.length || 0),
        ai_version: aiContent ? aiContent.slice(0, 500) : null,
        current_version: (data.content || data.description || "")?.slice(0, 500) || "",
        edited_by_human: data.edited_by_human || false,
      },
    })
  }

  // 默认路径：返回内容详情
  const [aRes, cRes] = await Promise.all([
    supabase.from("articles").select("*, virtual_user:virtual_users(nickname)").eq("id", id).maybeSingle(),
    supabase.from("cases").select("*, virtual_user:virtual_users(nickname)").eq("id", id).maybeSingle(),
  ])

  const row = aRes.data || cRes.data
  if (!row) return NextResponse.json({ error: "内容不存在" }, { status: 404 })

  const type = aRes.data ? "article" : "case"

  return NextResponse.json({
    content: {
      id: row.id,
      type,
      title: row.title,
      content: row.content || row.description,
      cover_url: row.cover_url || "",
      ai_generated_content: row.ai_generated_content || null,
      edited_by_human: row.edited_by_human || false,
      virtual_user: row.virtual_user?.nickname || null,
    },
  })
}

// PUT /api/admin/content/:id — 编辑内容
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (guard) return guard

  const { id } = await params
  const body = await req.json()
  const supabase = createDirectClient()

  // 判断类型 — 尝试 articles，失败则尝试 cases
  let tableName: string
  const [aRes, cRes] = await Promise.all([
    supabase.from("articles").select("id, title, content, ai_generated_content, edited_by_human, virtual_user_id").eq("id", id).maybeSingle(),
    supabase.from("cases").select("id, title, description, ai_generated_content, edited_by_human, virtual_user_id").eq("id", id).maybeSingle(),
  ])

  const row = aRes.data || cRes.data
  if (!row) return NextResponse.json({ error: "内容不存在" }, { status: 404 })

  tableName = aRes.data ? "articles" : "cases"

  const updates: Record<string, any> = {}
  if (body.title !== undefined) updates.title = body.title
  if (body.content !== undefined) {
    if (tableName === "articles") {
      updates.content = body.content
    } else {
      updates.description = body.content
    }
    if (!row.ai_generated_content) {
      updates.ai_generated_content = body.content
    }
    updates.edited_by_human = true
  }
  if (body.cover_url !== undefined) updates.cover_url = body.cover_url
  if (body.style_reference !== undefined) updates.style_reference = body.style_reference

  if (tableName === "articles") {
    updates.updated_at = new Date().toISOString()
  }

  const { data, error } = await supabase.from(tableName).update(updates).eq("id", id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 版本 diff 特征回传 — 写入该虚拟人的 content_profile
  if (row.virtual_user_id && body.content) {
    const origLen = row.ai_generated_content?.length || row.content?.length || row.description?.length || 0
    const newLen = body.content.length
    const diffMeta: Record<string, any> = {
      last_edit: {
        title_changed: body.title !== (row.title || "")?.slice(0, 100),
        content_length_change: newLen - origLen,
        edited_at: new Date().toISOString(),
      },
    }
    await supabase
      .from("virtual_users")
      .update({ content_profile: diffMeta })
      .eq("id", row.virtual_user_id)
  }

  return NextResponse.json({ success: true, content: data })
}

