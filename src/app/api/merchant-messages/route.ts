import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

// GET /api/merchant-messages?as=merchant  → 商家看收到的留言
// GET /api/merchant-messages?as=user      → 业主看自己发的留言
// POST /api/merchant-messages             → 业主给商家发留言
export async function GET(req: Request) {
  const auth = await requireAuth(req)
  if (typeof auth !== "string") return auth
  const userId = auth

  const { searchParams } = new URL(req.url)
  const as = searchParams.get("as") || "user"

  const supabase = createDirectClient()

  if (as === "merchant") {
    // 商家看收到的留言（不 join users，避免双外键歧义）
    const { data: msgs, error } = await supabase
      .from("merchant_messages")
      .select("id, merchant_type, user_id, content, contact_info, status, created_at, replied_at")
      .eq("merchant_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // 单独查业主昵称
    const userIds = [...new Set((msgs || []).map((m: { user_id: string }) => m.user_id))]
    const userMap: Record<string, { nickname: string; avatar_url: string | null }> = {}
    if (userIds.length > 0) {
      const { data: users } = await supabase.from("users").select("id, nickname, avatar_url").in("id", userIds)
      for (const u of users || []) userMap[u.id] = { nickname: u.nickname, avatar_url: u.avatar_url }
    }

    const result = (msgs || []).map((m: Record<string, unknown>) => ({
      ...m,
      user: userMap[m.user_id as string] || { nickname: "业主", avatar_url: null },
    }))

    // 标记已读（首次查看时）
    await supabase
      .from("merchant_messages")
      .update({ status: "read" })
      .eq("merchant_user_id", userId)
      .eq("status", "pending")

    return NextResponse.json({ messages: result })
  } else {
    // 业主看自己发的留言
    const { data } = await supabase
      .from("merchant_messages")
      .select(`
        id, merchant_type, merchant_id, content, status, created_at
      `)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50)
    return NextResponse.json({ messages: data ?? [] })
  }
}

// POST /api/merchant-messages → 业主发留言
export async function POST(req: Request) {
  const auth = await requireAuth(req)
  if (typeof auth !== "string") return auth
  const userId = auth

  const body = await req.json()
  const { merchant_type, merchant_id, content, contact_info } = body

  if (!merchant_type || !merchant_id || !content) {
    return NextResponse.json({ error: "merchant_type/merchant_id/content 必填" }, { status: 400 })
  }
  if (!["supplier", "contractor", "inspector"].includes(merchant_type)) {
    return NextResponse.json({ error: "merchant_type 必须是 supplier/contractor/inspector" }, { status: 400 })
  }

  const supabase = createDirectClient()

  // 查商家背后的 user_id（收件人）+ 商家名
  const tableMap = { supplier: "suppliers", contractor: "contractors", inspector: "inspectors" } as const
  const { data: merchant } = await supabase
    .from(tableMap[merchant_type as keyof typeof tableMap])
    .select("user_id, name")
    .eq("id", merchant_id)
    .maybeSingle()

  if (!merchant || !merchant.user_id) {
    return NextResponse.json({ error: "商家不存在或未关联用户" }, { status: 404 })
  }

  // 防止给自己留言
  if (merchant.user_id === userId) {
    return NextResponse.json({ error: "不能给自己留言" }, { status: 400 })
  }

  const { data, error } = await supabase.from("merchant_messages").insert({
    merchant_type,
    merchant_id,
    merchant_user_id: merchant.user_id,
    user_id: userId,
    content,
    contact_info: contact_info || null,
    status: "pending",
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, message: data })
}
