import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

// GET /api/admin/scheduled — 查询排期列表
export async function GET(req: Request) {
  const guard = await requireAdmin()
  if (guard) return guard

  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get("limit") || "24")

  const supabase = createDirectClient()
  const now = new Date().toISOString()
  const tomorrow = new Date(Date.now() + 86400000).toISOString()

  const { data } = await supabase
    .from("scheduled_posts")
    .select("*")
    .eq("is_published", false)
    .gte("publish_at", now)
    .lte("publish_at", tomorrow)
    .order("publish_at", { ascending: true })
    .limit(limit)

  return NextResponse.json({ scheduled: data ?? [] })
}

// POST /api/admin/scheduled/:id/reschedule — 调整发布时间（query: id, time）
export async function PUT(req: Request) {
  const guard = await requireAdmin()
  if (guard) return guard

  const body = await req.json()
  const { id, publish_at } = body

  if (!id || !publish_at) {
    return NextResponse.json({ error: "id and publish_at required" }, { status: 400 })
  }

  const supabase = createDirectClient()
  const { error } = await supabase
    .from("scheduled_posts")
    .update({ publish_at: new Date(publish_at).toISOString() })
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
