import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const auth = await requireAuth()
  if (typeof auth !== "string") {
    return NextResponse.json({ can_review: false, reason: "请先登录" })
  }
  const userId = auth

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

  // 有案例的设计师，登录用户即可评价
  return NextResponse.json({ can_review: true, source: "browse" })
}
