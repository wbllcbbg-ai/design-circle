import { getCurrentUserId } from "@/lib/supabase/server"
import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// 获取对话的消息列表
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { id } = await params
  const supabase = createDirectClient()

  // 验证用户是这个对话的参与者
  const { data: conv } = await supabase
    .from("conversations")
    .select("designer_id, user_id")
    .eq("id", id)
    .single()

  if (!conv) return NextResponse.json({ error: "not found" }, { status: 404 })

  // 查用户的设计师 ID
  const { data: designer } = await supabase
    .from("designers")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle()

  const isParticipant = conv.user_id === userId || (designer && conv.designer_id === designer.id)
  if (!isParticipant) return NextResponse.json({ error: "forbidden" }, { status: 403 })

  const { data } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true })

  // 标记消息为己读
  await supabase
    .from("messages")
    .update({ is_read: true })
    .eq("conversation_id", id)
    .neq("sender_id", userId)
    .eq("is_read", false)

  return NextResponse.json({ messages: data ?? [] })
}

// 发送消息
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const { content } = body

  if (!content) return NextResponse.json({ error: "content required" }, { status: 400 })

  const supabase = createDirectClient()

  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: id, sender_id: userId, content })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 更新对话最后消息
  await supabase
    .from("conversations")
    .update({ last_message: content, last_message_at: new Date().toISOString() })
    .eq("id", id)

  return NextResponse.json({ message: data })
}
