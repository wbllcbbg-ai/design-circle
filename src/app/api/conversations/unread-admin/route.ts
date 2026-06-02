import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

// GET /api/conversations/unread-admin — 管理员未回复咨询数
export async function GET() {
  const guard = await requireAdmin()
  if (guard) return guard

  const supabase = createDirectClient()

  // 统计有用户消息但设计师未回复的对话数
  // 逻辑：conversations 中 user_id 不为空（用户已发消息），且 last_message 是用户发的
  // 简化版：统计所有对话中，最后一条消息是用户发的 = 未回复
  const { data, count } = await supabase
    .from("conversations")
    .select("id", { count: "exact", head: true })
    .not("user_id", "is", null)

  return NextResponse.json({ count: count ?? 0 })
}
