import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

export async function GET() {
  const auth = await requireAuth()
  if (typeof auth !== "string") return auth
  const userId = auth

  const supabase = createDirectClient()

  const { data } = await supabase
    .from("invites")
    .select("id, code, channel, status, created_at, registered_at, rewarded_at, invitee_id")
    .eq("inviter_id", userId)
    .order("created_at", { ascending: false })
    .limit(50)

  const items = data ?? []

  // 批量查 invitee 昵称
  const inviteeIds = [...new Set(items.map((i) => i.invitee_id).filter(Boolean))]
  const { data: users } = inviteeIds.length > 0
    ? await supabase.from("users").select("id, nickname").in("id", inviteeIds)
    : { data: [] }

  const nicknameMap: Record<string, string> = {}
  for (const u of users ?? []) {
    nicknameMap[u.id] = u.nickname
  }

  const result = items.map((item) => ({
    ...item,
    invitee_nickname: item.invitee_id ? nicknameMap[item.invitee_id] || null : null,
  }))

  return NextResponse.json({ invites: result })
}
