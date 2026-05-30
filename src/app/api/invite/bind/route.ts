import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const auth = await requireAuth()
  if (typeof auth !== "string") return auth
  const userId = auth

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

  const now = new Date().toISOString()

  // 给邀请人加积分（原子增量，避免覆盖）
  await supabase.rpc("increment_user_points", {
    p_user_id: invite.inviter_id,
    p_points: 10,
    p_total_invites: 1,
  })
  await supabase.from("point_records").insert({
    user_id: invite.inviter_id,
    amount: 10,
    reason: "邀请好友注册奖励",
    related_invite_id: invite.id,
  })

  // 给被邀请人加积分（原子增量）
  await supabase.rpc("increment_user_points", {
    p_user_id: userId,
    p_points: 5,
    p_total_invites: 0,
  })
  await supabase.from("point_records").insert({
    user_id: userId,
    amount: 5,
    reason: "被邀请注册奖励",
    related_invite_id: invite.id,
  })

  // 标记已奖励
  await supabase.from("invites").update({ status: "rewarded", rewarded_at: now }).eq("id", invite.id)

  return NextResponse.json({ success: true })
}
