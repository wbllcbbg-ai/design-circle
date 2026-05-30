import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

export async function GET() {
  const auth = await requireAuth()
  // 未登录用户返回 0（公开可读，用于 Header 轮询）
  if (typeof auth !== "string") {
    return NextResponse.json({ unread: 0 })
  }
  const userId = auth

  const supabase = createDirectClient()
  const { count } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false)

  return NextResponse.json({ unread: count ?? 0 })
}
