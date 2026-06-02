import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

// GET /api/admin/messages/:id — 管理员查看对话消息
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (guard) return guard

  const { id } = await params
  const supabase = createDirectClient()

  const { data: messages } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true })

  // 标记管理员消息已读
  await supabase
    .from("messages")
    .update({ is_read: true })
    .eq("conversation_id", id)
    .neq("sender_id", "admin")  // placeholder，后续可优化

  return NextResponse.json({ messages: messages ?? [] })
}

// POST /api/admin/messages/:id — 管理员回复消息
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (guard) return guard

  const { id } = await params
  const body = await req.json()
  const { content } = body

  if (!content) return NextResponse.json({ error: "content required" }, { status: 400 })

  const supabase = createDirectClient()

  // 获取当前管理员用户
  const { data: { user } } = await supabase.auth.getUser()

  const { data: msg, error } = await supabase
    .from("messages")
    .insert({ conversation_id: id, sender_id: user?.id ?? "admin", content })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 更新对话最后消息
  await supabase
    .from("conversations")
    .update({ last_message: content, last_message_at: new Date().toISOString() })
    .eq("id", id)

  return NextResponse.json({ message: msg })
}
