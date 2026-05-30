import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (guard) return guard

  const { id } = await params
  const body = await req.json()
  const { status } = body

  if (!status || !["approved", "rejected"].includes(status)) {
    return NextResponse.json({ error: "status must be approved or rejected" }, { status: 400 })
  }

  const supabase = createDirectClient()
  const { data, error } = await supabase
    .from("reviews")
    .update({ review_status: status, reviewed_at: new Date().toISOString() })
    .eq("id", id)
    .select("*, designer:designers(id, name, user_id), user:users(id, nickname)")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 审批通过时发通知
  if (status === "approved" && data.designer) {
    const { data: actor } = await supabase.from("users").select("nickname").eq("id", data.user_id).single()
    await supabase.from("notifications").insert({
      user_id: data.designer.user_id,
      type: "review",
      actor_id: data.user_id,
      target_type: "designer",
      target_id: data.designer_id,
      content: `${actor?.nickname || "某人"} 评价了你的设计（${data.rating}分）`,
    })
  }

  return NextResponse.json({ review: data })
}
