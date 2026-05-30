import { getCurrentUserId } from "@/lib/supabase/server"
import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const body = await req.json()
  const { code, channel } = body

  if (!code) return NextResponse.json({ error: "邀请码不能为空" }, { status: 400 })

  const supabase = createDirectClient()
  const upperCode = code.toUpperCase()

  const { data: invite } = await supabase
    .from("invites")
    .select("id, inviter_id, status")
    .eq("code", upperCode)
    .maybeSingle()

  if (!invite) return NextResponse.json({ error: "邀请码无效" }, { status: 400 })

  if (invite.inviter_id === userId) {
    return NextResponse.json({ error: "不能使用自己的邀请码" }, { status: 400 })
  }

  if (invite.status !== "pending") {
    return NextResponse.json({ error: "该邀请码已被使用" }, { status: 400 })
  }

  const { error } = await supabase
    .from("invites")
    .update({
      invitee_id: userId,
      status: "registered",
      registered_at: new Date().toISOString(),
      channel: channel || "code",
    })
    .eq("id", invite.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 给邀请人加积分
  await supabase.from("user_points").upsert(
    { user_id: invite.inviter_id, points: 10, total_earned: 10, total_invites: 1, updated_at: new Date().toISOString() },
    { onConflict: "user_id", ignoreDuplicates: false },
  )

  // 给被邀请人加积分
  await supabase.from("user_points").upsert(
    { user_id: userId, points: 5, total_earned: 5, total_invites: 0, updated_at: new Date().toISOString() },
    { onConflict: "user_id", ignoreDuplicates: false },
  )

  // 标记已奖励
  await supabase.from("invites").update({ status: "rewarded", rewarded_at: new Date().toISOString() }).eq("id", invite.id)

  return NextResponse.json({ success: true })
}
