import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

// 获取用户对某个目标的收藏状态
export async function GET(req: Request) {
  const auth = await requireAuth()
  // 未登录用户返回未收藏状态（公开可读）
  if (typeof auth !== "string") {
    return NextResponse.json({ favorited: false })
  }
  const userId = auth

  const { searchParams } = new URL(req.url)
  const targetType = searchParams.get("target_type")
  const targetId = searchParams.get("target_id")

  if (!targetType || !targetId) {
    return NextResponse.json({ error: "missing target_type or target_id" }, { status: 400 })
  }

  const supabase = createDirectClient()

  const { data: fav } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", userId)
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .maybeSingle()

  return NextResponse.json({ favorited: !!fav })
}

// 收藏/取消收藏
export async function POST(req: Request) {
  const auth = await requireAuth()
  if (typeof auth !== "string") return auth
  const userId = auth

  const body = await req.json()
  const { target_type, target_id, action } = body

  if (!target_type || !target_id || !action) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 })
  }

  if (action !== "favorite" && action !== "unfavorite") {
    return NextResponse.json({ error: "action must be 'favorite' or 'unfavorite'" }, { status: 400 })
  }

  const supabase = createDirectClient()

  if (action === "favorite") {
    const { error } = await supabase.from("favorites").upsert(
      { user_id: userId, target_type, target_id },
      { onConflict: "user_id,target_type,target_id", ignoreDuplicates: true },
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await supabase
      .from("favorites")
      .delete()
      .eq("user_id", userId)
      .eq("target_type", target_type)
      .eq("target_id", target_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true, favorited: action === "favorite" })
}

// 用户收藏列表
export async function PUT(req: Request) {
  const auth = await requireAuth()
  if (typeof auth !== "string") return auth
  const userId = auth

  const body = await req.json()
  const { target_type } = body

  if (!target_type) {
    return NextResponse.json({ error: "missing target_type" }, { status: 400 })
  }

  const supabase = createDirectClient()

  const { data } = await supabase
    .from("favorites")
    .select("target_id, created_at")
    .eq("user_id", userId)
    .eq("target_type", target_type)
    .order("created_at", { ascending: false })

  return NextResponse.json({ favorites: data ?? [] })
}
