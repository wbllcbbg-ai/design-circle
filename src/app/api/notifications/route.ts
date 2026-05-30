import { getCurrentUserId } from "@/lib/supabase/server"
import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// 获取通知列表
export async function GET() {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const supabase = createDirectClient()

  const { data } = await supabase
    .from("notifications")
    .select("id, type, actor_id, target_type, target_id, content, is_read, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50)

  // 批量查 actor（触发动作的人）的信息
  const notifications = (data ?? []).map(async (n: any) => {
    const { data: actor } = await supabase
      .from("users")
      .select("id, nickname, avatar_url")
      .eq("id", n.actor_id)
      .single()
    return { ...n, actor }
  })

  const result = await Promise.all(notifications)
  return NextResponse.json({ notifications: result })
}

// 标记为已读
export async function PUT(req: Request) {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const body = await req.json()
  const { id } = body // 可选: 指定某条通知，不传则全部标记已读

  const supabase = createDirectClient()

  let query = supabase.from("notifications").update({ is_read: true }).eq("user_id", userId)
  if (id) query = query.eq("id", id)

  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
