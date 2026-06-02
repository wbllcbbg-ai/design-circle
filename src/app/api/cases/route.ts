import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

// 获取案例列表（支持风格筛选）
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const style = searchParams.get("style") || ""

  const supabase = createDirectClient()
  let query = supabase.from("cases").select("*", { count: "exact" }).order("created_at", { ascending: false }).limit(50)

  if (style) {
    query = query.eq("style", style)
  }

  const { data } = await query
  const casesList = data ?? []

  // 获取案例的设计师信息
  const designerIds = [...new Set(casesList.map((c) => c.designer_id).filter(Boolean))]
  let designerMap: Record<string, { id: string; name: string; type: string }> = {}
  if (designerIds.length > 0) {
    const { data: designers } = await supabase
      .from("designers")
      .select("id, name, type")
      .in("id", designerIds)
    for (const d of designers ?? []) {
      designerMap[d.id] = { id: d.id, name: d.name, type: d.type }
    }
  }

  const casesWithDesigner = casesList.map((c) => ({
    ...c,
    designer: c.designer_id && designerMap[c.designer_id] ? designerMap[c.designer_id] : null,
  }))

  return NextResponse.json({ cases: casesWithDesigner })
}

export async function POST(req: Request) {
  const auth = await requireAuth()
  if (typeof auth !== "string") return auth
  const userId = auth

  const body = await req.json()
  const { title, description, style, area, budget, duration, cover_url, images } = body

  if (!title) {
    return NextResponse.json({ error: "标题不能为空" }, { status: 400 })
  }

  const supabase = createDirectClient()

  // 查找当前用户关联的设计师身份
  const { data: designer } = await supabase
    .from("designers")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle()

  if (!designer) {
    return NextResponse.json({ error: "只有认证设计师才能发布案例" }, { status: 403 })
  }

  const { data, error } = await supabase.from("cases").insert({
    designer_id: designer.id,
    title,
    description: description || "",
    cover_url: cover_url || "",
    images: images || [],
    style: style || "",
    area: area || null,
    budget: budget || null,
    duration: duration || null,
    is_published: true,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, case: data })
}
