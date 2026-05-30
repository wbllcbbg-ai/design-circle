import { getCurrentUserId } from "@/lib/supabase/server"
import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

/**
 * 要求用户已登录。
 * 未登录返回 401，已登录返回 userId。
 */
export async function requireAuth(): Promise<string | NextResponse> {
  const userId = await getCurrentUserId()
  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }
  return userId
}

/**
 * 要求用户是 admin。
 * 未登录返回 401，非 admin 返回 403，已授权返回 userId。
 */
export async function requireAdmin(): Promise<string | NextResponse> {
  const userId = await getCurrentUserId()
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const supabase = createDirectClient()
  const { data: user } = await supabase
    .from("users")
    .select("role")
    .eq("id", userId)
    .single()

  if (user?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  return userId
}
