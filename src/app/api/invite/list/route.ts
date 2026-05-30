import { getCurrentUserId } from "@/lib/supabase/server"
import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const supabase = createDirectClient()

  const { data } = await supabase
    .from("invites")
    .select("id, code, channel, status, created_at, registered_at, rewarded_at, invitee_id")
    .eq("inviter_id", userId)
    .order("created_at", { ascending: false })
    .limit(50)

  const list = (data ?? []).map(async (item: any) => {
    if (item.invitee_id) {
      const { data: u } = await supabase.from("users").select("nickname").eq("id", item.invitee_id).single()
      return { ...item, invitee_nickname: u?.nickname || null }
    }
    return { ...item, invitee_nickname: null }
  })

  const result = await Promise.all(list)
  return NextResponse.json({ invites: result })
}
