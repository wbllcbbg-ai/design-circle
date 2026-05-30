import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

// 获取通知列表
export async function GET() {
  const auth = await requireAuth()
  if (typeof auth !== "string") return auth
  const userId = auth

  const supabase = createDirectClient()

  const { data } = await supabase
    .from("notifications")
    .select("id, type, actor_id, target_type, target_id, content, is_read, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50)

  const items = data ?? []

  // 批量查 actor 信息（一次查询替代 N 次查询）
  const actorIds = [...new Set(items.map((n) => n.actor_id))]
  const { data: actors } = await supabase
    .from("users")
    .select("id, nickname, avatar_url")
    .in("id", actorIds)

  const actorMap: Record<string, any> = {}
  for (const a of actors ?? []) {
    actorMap[a.id] = a
  }

  const result = items.map((n) => ({ ...n, actor: actorMap[n.actor_id] || null }))
  return NextResponse.json({ notifications: result })
}

// 标记为已读
export async function PUT(req: Request) {
  const auth = await requireAuth()
  if (typeof auth !== "string") return auth
  const userId = auth

  const body = await req.json()
  const { id } = body // 可选: 指定某条通知，不传则全部标记已读

  const supabase = createDirectClient()

  let query = supabase.from("notifications").update({ is_read: true }).eq("user_id", userId)
  if (id) query = query.eq("id", id)

  const { error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
