import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

// 获取对话的消息列表
export async function GET(req, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req)
  if (typeof auth !== "string") return auth
  const userId = auth

  const { id } = await params
  const supabase = createDirectClient()

  // 验证用户是这个对话的参与者
  const { data: conv } = await supabase
    .from("conversations")
    .select("designer_id, user_id, project_id, status")
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

  return NextResponse.json({
    messages: data ?? [],
    conversation: {
      designer_id: conv.designer_id,
      user_id: conv.user_id,
      project_id: (conv as { project_id?: string | null }).project_id ?? null,
      status: (conv as { status?: string }).status ?? "active",
    },
    // 当前用户在该对话中的角色，前端据此显示不同操作（如设计师显示"发起报价"）
    my_role: designer && conv.designer_id === designer.id ? "designer" : "client",
    my_designer_id: designer?.id ?? null,
  })
}

// 发送消息
export async function POST(req, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(req)
  if (typeof auth !== "string") return auth
  const userId = auth

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
