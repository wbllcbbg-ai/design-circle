import { getCurrentUserId } from "@/lib/supabase/server"
import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// 获取浏览历史
export async function GET() {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const supabase = createDirectClient()
  const { data } = await supabase
    .from("browse_history")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50)

  // 按 target_type 分类补充标题等信息
  const items = (data ?? []).map(async (item: any) => {
    if (item.target_type === "case") {
      const { data: c } = await supabase.from("cases").select("title, cover_url, style, area").eq("id", item.target_id).single()
      return { ...item, case: c }
    }
    if (item.target_type === "article") {
      const { data: a } = await supabase.from("articles").select("title, cover_url, category").eq("id", item.target_id).single()
      return { ...item, article: a }
    }
    return item
  })

  const history = await Promise.all(items)
  return NextResponse.json({ history })
}

// 记录浏览
export async function POST(req: Request) {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const body = await req.json()
  const { target_type, target_id } = body

  if (!target_type || !target_id) {
    return NextResponse.json({ error: "missing fields" }, { status: 400 })
  }

  const supabase = createDirectClient()

  // upsert — 如果已有记录就更新时间
  const { error } = await supabase.from("browse_history").upsert(
    { user_id: userId, target_type, target_id, created_at: new Date().toISOString() },
    { onConflict: "user_id,target_type,target_id" },
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
