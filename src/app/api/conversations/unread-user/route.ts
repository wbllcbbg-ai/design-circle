import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// GET /api/conversations/unread-user — 当前登录用户收到的未读消息数
export async function GET() {
  const supabase = createDirectClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ unread: 0 })
  }

  const { count } = await supabase
    .from("messages")
    .select("*", { count: "exact", head: true })
    .neq("sender_id", user.id)
    .eq("is_read", false)

  return NextResponse.json({ unread: count ?? 0 })
}
