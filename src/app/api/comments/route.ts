import { createServerSupabaseClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// 获取评论
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const targetType = searchParams.get("target_type") || "case"
  const targetId = searchParams.get("target_id")

  if (!targetId) {
    return NextResponse.json({ error: "target_id required" }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()
  const { data } = await supabase
    .from("comments")
    .select("id, content, parent_id, created_at, user_id")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .order("created_at", { ascending: false })
    .limit(50)

  return NextResponse.json({ comments: data ?? [] })
}

// 创建评论
export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { target_type, target_id, content, parent_id } = body

  if (!target_type || !target_id || !content) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 })
  }

  const { data, error } = await supabase.from("comments").insert({
    target_type,
    target_id,
    user_id: user.id,
    content,
    parent_id: parent_id || null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ comment: data })
}
