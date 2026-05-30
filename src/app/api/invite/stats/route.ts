import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

export async function GET() {
  const auth = await requireAuth()
  if (typeof auth !== "string") return auth
  const userId = auth

  const supabase = createDirectClient()

  const [total, registered, rewarded, points] = await Promise.all([
    supabase.from("invites").select("*", { count: "exact", head: true }).eq("inviter_id", userId),
    supabase.from("invites").select("*", { count: "exact", head: true }).eq("inviter_id", userId).eq("status", "registered"),
    supabase.from("invites").select("*", { count: "exact", head: true }).eq("inviter_id", userId).eq("status", "rewarded"),
    supabase.from("user_points").select("points, total_invites").eq("user_id", userId).maybeSingle(),
  ])

  return NextResponse.json({
    total: total.count ?? 0,
    registered: registered.count ?? 0,
    rewarded: rewarded.count ?? 0,
    points: points.data?.points ?? 0,
    total_invites: points.data?.total_invites ?? 0,
  })
}
