import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

// 获取当前用户的对话列表
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const all = searchParams.get("all") === "true"

  const supabase = createDirectClient()

  if (all) {
    // 管理员查看所有对话
    const { data: convs } = await supabase
      .from("conversations")
      .select(`
        id, last_message, last_message_at, created_at,
        designer_id, user_id
      `)
      .order("last_message_at", { ascending: false })
      .limit(50)

    const convList = (convs ?? []).map(async (c: any) => {
      const [designerRes, userRes] = await Promise.all([
        supabase.from("designers").select("id, name, type").eq("id", c.designer_id).single(),
        supabase.from("users").select("id, nickname").eq("id", c.user_id).single(),
      ])
      return { ...c, designer: designerRes.data, user: userRes.data }
    })
    const conversations = await Promise.all(convList)
    return NextResponse.json({ conversations })
  }

  const auth = await requireAuth()
  if (typeof auth !== "string") return auth
  const userId = auth

  // 先查出当前用户的设计师身份（如果有）
  const { data: designer } = await supabase
    .from("designers")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle()

  // 获取对话：用户参与的 + 设计师收到的
  let query = supabase
    .from("conversations")
    .select(`
      id, last_message, last_message_at, created_at,
      designer_id, user_id
    `)

  if (designer) {
    query = query.or(`user_id.eq.${userId},designer_id.eq.${designer.id}`)
  } else {
    query = query.eq("user_id", userId)
  }

  const { data: convs } = await query.order("last_message_at", { ascending: false }).limit(50)

  // 批量查设计师、用户信息和未读数
  const convList = (convs ?? []).map(async (c: any) => {
    const [designerRes, userRes, { count }] = await Promise.all([
      supabase.from("designers").select("id, name, logo_url, type").eq("id", c.designer_id).single(),
      supabase.from("users").select("id, nickname, avatar_url").eq("id", c.user_id).single(),
      supabase.from("messages")
        .select("*", { count: "exact", head: true })
        .eq("conversation_id", c.id)
        .neq("sender_id", userId)
        .eq("is_read", false)
    ])
    return {
      ...c,
      designer: designerRes.data,
      user: userRes.data,
      unread_count: count ?? 0,
    }
  })

  const conversations = await Promise.all(convList)
  return NextResponse.json({ conversations })
}

// 创建或获取对话
export async function POST(req: Request) {
  const auth = await requireAuth()
  if (typeof auth !== "string") return auth
  const userId = auth

  const body = await req.json()
  const { designer_id, case_id, content } = body

  if (!designer_id || !content) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 })
  }

  const supabase = createDirectClient()

  // 查或创建对话
  const { data: existing } = await supabase
    .from("conversations")
    .select("id")
    .eq("designer_id", designer_id)
    .eq("user_id", userId)
    .maybeSingle()

  let conversationId: string

  if (existing) {
    conversationId = existing.id
  } else {
    const { data: conv, error: convErr } = await supabase
      .from("conversations")
      .insert({ designer_id, user_id: userId, case_id: case_id || null })
      .select("id")
      .single()

    if (convErr) return NextResponse.json({ error: convErr.message }, { status: 500 })
    conversationId = conv.id
  }

  // 埋点：记录咨询
  console.log(`[CONSULT] user=${userId} designer=${designer_id} at=${new Date().toISOString()}`)

  // 发消息
  const { data: msg, error: msgErr } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: userId, content })
    .select()
    .single()

  if (msgErr) return NextResponse.json({ error: msgErr.message }, { status: 500 })

  // 更新对话最后消息
  await supabase
    .from("conversations")
    .update({ last_message: content, last_message_at: new Date().toISOString() })
    .eq("id", conversationId)

  return NextResponse.json({ success: true, conversation_id: conversationId, message: msg })
}
