import { getCurrentUserId } from "@/lib/supabase/server"
import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// 获取当前用户资料
export async function GET() {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const supabase = createDirectClient()
  const { data } = await supabase.from("users").select("*").eq("id", userId).single()
  return NextResponse.json({ user: data })
}

// 更新用户资料
export async function PUT(req: Request) {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const body = await req.json()
  const { nickname, avatar_url, phone } = body

  const supabase = createDirectClient()
  const updates: Record<string, any> = {}
  if (nickname !== undefined) updates.nickname = nickname
  if (avatar_url !== undefined) updates.avatar_url = avatar_url
  if (phone !== undefined) updates.phone = phone

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "没有需要更新的字段" }, { status: 400 })
  }

  const { data, error } = await supabase.from("users").update(updates).eq("id", userId).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, user: data })
}
