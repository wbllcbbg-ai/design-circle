import { getCurrentUserId } from "@/lib/supabase/server"
import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

async function requireAdmin() {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const supabase = createDirectClient()
  const { data: user } = await supabase.from("users").select("role").eq("id", userId).single()
  if (user?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 })
  return null
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (guard) return guard

  const { id } = await params
  const body = await req.json()

  const supabase = createDirectClient()
  const updates: Record<string, any> = {}
  if (body.name !== undefined) updates.name = body.name
  if (body.trigger_event !== undefined) updates.trigger_event = body.trigger_event
  if (body.inviter_points !== undefined) updates.inviter_points = body.inviter_points
  if (body.invitee_points !== undefined) updates.invitee_points = body.invitee_points
  if (body.inviter_reward_desc !== undefined) updates.inviter_reward_desc = body.inviter_reward_desc
  if (body.invitee_reward_desc !== undefined) updates.invitee_reward_desc = body.invitee_reward_desc
  if (body.is_active !== undefined) updates.is_active = body.is_active

  const { data, error } = await supabase.from("reward_rules").update(updates).eq("id", id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rule: data })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (guard) return guard

  const { id } = await params
  const supabase = createDirectClient()
  const { error } = await supabase.from("reward_rules").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
