import { getCurrentUserId } from "@/lib/supabase/server"
import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// 获取用户对某个目标的点赞状态
export async function GET(req: Request) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return NextResponse.json({ liked: false, like_count: 0 })
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
  const userId = await getCurrentUserId()
  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

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
