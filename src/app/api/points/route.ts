import { getCurrentUserId } from "@/lib/supabase/server"
import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const supabase = createDirectClient()
  const { data } = await supabase
    .from("user_points")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle()

  // 查积分变动记录
  const { data: records } = await supabase
    .from("point_records")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50)

  return NextResponse.json({
    points: data?.points ?? 0,
    total_earned: data?.total_earned ?? 0,
    total_invites: data?.total_invites ?? 0,
    records: records ?? [],
  })
}
