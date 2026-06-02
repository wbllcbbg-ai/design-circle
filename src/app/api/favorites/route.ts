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

  // 收藏列表需要关联目标实体获取标题和封面
  const { data } = await supabase
    .from("favorites")
    .select("target_id, created_at")
    .eq("user_id", userId)
    .eq("target_type", target_type)
    .order("created_at", { ascending: false })

  if (!data || data.length === 0) {
    return NextResponse.json({ favorites: [] })
  }

  // 根据 target_type 查询对应的表获取标题和封面
  let items: any[] = []
  if (target_type === "case") {
    const ids = data.map((f: any) => f.target_id)
    const { data: cases } = await supabase
      .from("cases")
      .select("id, title, cover_url, style, area")
      .in("id", ids)
    const caseMap = new Map((cases || []).map((c: any) => [c.id, c]))
    items = data.map((f: any) => ({
      ...f,
      target: caseMap.get(f.target_id) || null,
    }))
  } else if (target_type === "article") {
    const ids = data.map((f: any) => f.target_id)
    const { data: articles } = await supabase
      .from("articles")
      .select("id, title, cover_url, category")
      .in("id", ids)
    const articleMap = new Map((articles || []).map((a: any) => [a.id, a]))
    items = data.map((f: any) => ({
      ...f,
      target: articleMap.get(f.target_id) || null,
    }))
  }

  return NextResponse.json({ favorites: items })
}
