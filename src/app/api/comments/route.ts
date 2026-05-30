import { createServerSupabaseClient } from "@/lib/supabase/server"
import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

// 获取评论
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const targetType = searchParams.get("target_type") || "case"
  const targetId = searchParams.get("target_id")

  if (!targetId) {
    return NextResponse.json({ error: "target_id required" }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from("comments")
    .select("id, content, parent_id, created_at, user_id")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .order("created_at", { ascending: false })
    .limit(50)

  return NextResponse.json({ comments: data ?? [] })
}

// 创建评论
export async function POST(req: Request) {
  const auth = await requireAuth()
  if (typeof auth !== "string") return auth
  const userId = auth

  const body = await req.json()
  const { target_type, target_id, content, parent_id } = body

  if (!target_type || !target_id || !content) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 })
  }

  const supabase = createDirectClient()

  const { data, error } = await supabase.from("comments").insert({
    target_type,
    target_id,
    user_id: userId,
    content,
    parent_id: parent_id || null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 发通知给内容作者
  let ownerId: string | null = null
  let title = ""

  if (target_type === "case") {
    const { data: c } = await supabase.from("cases").select("designer_id, title").eq("id", target_id).single()
    if (c) {
      const { data: d } = await supabase.from("designers").select("user_id").eq("id", c.designer_id).single()
      if (d) ownerId = d.user_id
      title = c.title
    }
  } else if (target_type === "article") {
    const { data: a } = await supabase.from("articles").select("author_id, title").eq("id", target_id).single()
    if (a) {
      ownerId = a.author_id
      title = a.title
    }
  }

  if (ownerId && ownerId !== userId) {
    const { data: actor } = await supabase.from("users").select("nickname").eq("id", userId).single()
    const label = target_type === "case" ? "案例" : "文章"
    const snippet = content.slice(0, 40)
    await supabase.from("notifications").insert({
      user_id: ownerId,
      type: "comment",
      actor_id: userId,
      target_type,
      target_id,
      content: `${actor?.nickname || "某人"} 评论了你的${label}：${snippet}`,
    })
  }

  return NextResponse.json({ comment: data })
}
