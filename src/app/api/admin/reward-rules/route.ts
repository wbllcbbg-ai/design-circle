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

export async function GET() {
  const guard = await requireAdmin()
  if (guard) return guard

  const supabase = createDirectClient()
  const { data } = await supabase.from("reward_rules").select("*").order("created_at", { ascending: false })
  return NextResponse.json({ rules: data ?? [] })
}

export async function POST(req: Request) {
  const guard = await requireAdmin()
  if (guard) return guard

  const body = await req.json()
  const { name, trigger_event, inviter_points, invitee_points, inviter_reward_desc, invitee_reward_desc, is_active } = body

  if (!name) return NextResponse.json({ error: "规则名称不能为空" }, { status: 400 })

  const supabase = createDirectClient()
  const { data, error } = await supabase.from("reward_rules").insert({
    name,
    trigger_event: trigger_event || "register",
    inviter_points: inviter_points || 10,
    invitee_points: invitee_points || 5,
    inviter_reward_desc: inviter_reward_desc || null,
    invitee_reward_desc: invitee_reward_desc || null,
    is_active: is_active !== false,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rule: data })
}
