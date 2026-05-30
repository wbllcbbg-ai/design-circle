import { getCurrentUserId } from "@/lib/supabase/server"
import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const userId = await getCurrentUserId()
  if (!userId) {
    return NextResponse.json({ can_review: false, reason: "请先登录" })
  }

  const { searchParams } = new URL(req.url)
  const designerId = searchParams.get("designer_id")

  if (!designerId) {
    return NextResponse.json({ error: "missing designer_id" }, { status: 400 })
  }

  const supabase = createDirectClient()

  // 1. 查是否已经点评过
  const { data: existing } = await supabase
    .from("reviews")
    .select("id")
    .eq("user_id", userId)
    .eq("designer_id", designerId)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ can_review: false, reason: "你已经点评过该设计师" })
  }

  // 2. 查是否有咨询记录
  const { data: designer } = await supabase
    .from("designers")
    .select("id")
    .eq("id", designerId)
    .single()

  let source: string | null = null

  if (designer) {
    const { data: conv } = await supabase
      .from("conversations")
      .select("id")
      .eq("designer_id", designerId)
      .eq("user_id", userId)
      .maybeSingle()

    if (conv) source = "consult"
  }

  // 3. 查是否有浏览过该设计师的案例
  if (!source) {
    const { data: cases } = await supabase
      .from("cases")
      .select("id")
      .eq("designer_id", designerId)
      .limit(5)

    if (cases && cases.length > 0) {
      const caseIds = cases.map(c => c.id)
      const { data: history } = await supabase
        .from("browse_history")
        .select("id")
        .eq("user_id", userId)
        .eq("target_type", "case")
        .in("target_id", caseIds)
        .limit(1)

      if (history && history.length > 0) source = "browse"
    }
  }

  if (!source) {
    return NextResponse.json({
      can_review: false,
      reason: "请先咨询设计师或浏览其案例后再评价",
    })
  }

  return NextResponse.json({ can_review: true, source })
}
