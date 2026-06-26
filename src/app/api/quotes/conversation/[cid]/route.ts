import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

// GET /api/quotes/conversation/[cid] — 查询某对话下的报价列表
// 用于在消息对话内嵌入报价卡片展示
export async function GET(req, { params }: { params: Promise<{ cid: string }> }) {
  const auth = await requireAuth(req)
  if (typeof auth !== "string") return auth
  const userId = auth

  const { cid } = await params
  const supabase = createDirectClient()

  // 校验对话当事人（借鉴 conversations/[id]/route.ts 的 isParticipant）
  const { data: conv } = await supabase
    .from("conversations")
    .select("designer_id, user_id, designer:designers(user_id)")
    .eq("id", cid)
    .maybeSingle()

  if (!conv) {
    return NextResponse.json({ error: "对话不存在" }, { status: 404 })
  }
  const designerUserId = (conv as { designer?: { user_id?: string } })?.designer?.user_id
  const isParticipant = conv.user_id === userId || designerUserId === userId
  if (!isParticipant) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const { data, error } = await supabase
    .from("quotes")
    .select(`
      *,
      designer:designers(id, name, logo_url)
    `)
    .eq("conversation_id", cid)
    .order("created_at", { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 关联合同状态（如果已生成）
  const quotes = data ?? []
  const quoteIds = quotes.map((q: { id: string }) => q.id).filter(Boolean)
  const contractMap: Record<string, unknown> = {}
  if (quoteIds.length > 0) {
    const { data: contracts } = await supabase
      .from("contracts")
      .select("id, quote_id, status, project_id, signed_at")
      .in("quote_id", quoteIds)
    for (const c of contracts ?? []) {
      contractMap[(c as { quote_id: string }).quote_id] = c
    }
  }

  return NextResponse.json({
    quotes: quotes.map((q: Record<string, unknown>) => ({
      ...q,
      contract: contractMap[q.id as string] || null,
    })),
  })
}
