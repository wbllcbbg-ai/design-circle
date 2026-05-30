import { createServerSupabaseClient, getCurrentUserId } from "@/lib/supabase/server"
import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

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
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { target_type, target_id, content, parent_id } = body

  if (!target_type || !target_id || !content) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 })
  }

  const { data, error } = await supabase.from("comments").insert({
    target_type,
    target_id,
    user_id: user.id,
    content,
    parent_id: parent_id || null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 发通知给内容作者
  const directClient = createDirectClient()
  let ownerId: string | null = null
  let title = ""

  if (target_type === "case") {
    const { data: c } = await directClient.from("cases").select("designer_id, title").eq("id", target_id).single()
    if (c) {
      const { data: d } = await directClient.from("designers").select("user_id").eq("id", c.designer_id).single()
      if (d) ownerId = d.user_id
      title = c.title
    }
  } else if (target_type === "article") {
    const { data: a } = await directClient.from("articles").select("author_id, title").eq("id", target_id).single()
    if (a) {
      ownerId = a.author_id
      title = a.title
    }
  }

  if (ownerId && ownerId !== user.id) {
    const { data: actor } = await directClient.from("users").select("nickname").eq("id", user.id).single()
    const label = target_type === "case" ? "案例" : "文章"
    const snippet = content.slice(0, 40)
    await directClient.from("notifications").insert({
      user_id: ownerId,
      type: "comment",
      actor_id: user.id,
      target_type,
      target_id,
      content: `${actor?.nickname || "某人"} 评论了你的${label}：${snippet}`,
    })
  }

  return NextResponse.json({ comment: data })
}
