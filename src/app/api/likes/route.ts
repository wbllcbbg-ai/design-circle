import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"

// 点赞后通知内容作者
async function createLikeNotification(supabase: ReturnType<typeof createDirectClient>, actorId: string, targetType: string, targetId: string) {
  let ownerId: string | null = null
  let title = ""

  if (targetType === "case") {
    const { data: c } = await supabase.from("cases").select("designer_id, title").eq("id", targetId).single()
    if (c) {
      const { data: d } = await supabase.from("designers").select("user_id").eq("id", c.designer_id).single()
      if (d) ownerId = d.user_id
      title = c.title
    }
  } else if (targetType === "article") {
    const { data: a } = await supabase.from("articles").select("author_id, title").eq("id", targetId).single()
    if (a) {
      ownerId = a.author_id
      title = a.title
    }
  }

  if (ownerId && ownerId !== actorId) {
    const { data: actor } = await supabase.from("users").select("nickname").eq("id", actorId).single()
    const label = targetType === "case" ? "案例" : "文章"
    await supabase.from("notifications").insert({
      user_id: ownerId,
      type: "like",
      actor_id: actorId,
      target_type: targetType,
      target_id: targetId,
      content: `${actor?.nickname || "某人"} 赞了你的${label}：${title.slice(0, 30)}`,
    })
  }
}

export const dynamic = "force-dynamic"

// 获取用户对某个目标的点赞状态
export async function GET(req: Request) {
  const auth = await requireAuth()
  // 未登录用户返回未点赞状态（公开可读）
  if (typeof auth !== "string") {
    const { searchParams } = new URL(req.url)
    const targetType = searchParams.get("target_type")
    const targetId = searchParams.get("target_id")
    if (!targetType || !targetId) {
      return NextResponse.json({ liked: false, like_count: 0 })
    }
    const supabase = createDirectClient()
    const { count } = await supabase
      .from("likes")
      .select("*", { count: "exact", head: true })
      .eq("target_type", targetType)
      .eq("target_id", targetId)
    return NextResponse.json({ liked: false, like_count: count ?? 0 })
  }
  const userId = auth
  }

  const { searchParams } = new URL(req.url)
  const targetType = searchParams.get("target_type")
  const targetId = searchParams.get("target_id")

  if (!targetType || !targetId) {
    return NextResponse.json({ error: "missing target_type or target_id" }, { status: 400 })
  }

  const supabase = createDirectClient()

  // 查用户是否点赞
  const { data: like } = await supabase
    .from("likes")
    .select("id")
    .eq("user_id", userId)
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .maybeSingle()

  // 查总点赞数
  const { count } = await supabase
    .from("likes")
    .select("*", { count: "exact", head: true })
    .eq("target_type", targetType)
    .eq("target_id", targetId)

  return NextResponse.json({ liked: !!like, like_count: count ?? 0 })
}

// 点赞/取消点赞
export async function POST(req: Request) {
  const auth = await requireAuth()
  if (typeof auth !== "string") return auth
  const userId = auth

  const body = await req.json()
  const { target_type, target_id, action } = body

  if (!target_type || !target_id || !action) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 })
  }

  if (action !== "like" && action !== "unlike") {
    return NextResponse.json({ error: "action must be 'like' or 'unlike'" }, { status: 400 })
  }

  const supabase = createDirectClient()

  if (action === "like") {
    const { error } = await supabase.from("likes").upsert(
      { user_id: userId, target_type, target_id },
      { onConflict: "user_id,target_type,target_id", ignoreDuplicates: true },
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // 发通知给内容作者
    await createLikeNotification(supabase, userId, target_type, target_id)
  } else {
    const { error } = await supabase
      .from("likes")
      .delete()
      .eq("user_id", userId)
      .eq("target_type", target_type)
      .eq("target_id", target_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 查更新后的总点赞数
  const { count } = await supabase
    .from("likes")
    .select("*", { count: "exact", head: true })
    .eq("target_type", target_type)
    .eq("target_id", target_id)

  return NextResponse.json({ success: true, liked: action === "like", like_count: count ?? 0 })
}
