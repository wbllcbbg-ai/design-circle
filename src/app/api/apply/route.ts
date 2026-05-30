import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export async function POST(req: Request) {
  const body = await req.json()
  const { type, name, phone, description, specialties, city_id } = body

  if (!type || !name || !phone) {
    return NextResponse.json({ error: "类型、名称和电话不能为空" }, { status: 400 })
  }

  const supabase = createDirectClient()
  const { data: user } = await supabase.from("users").select("id").limit(1).single()

  const { data, error } = await supabase.from("designer_applications").insert({
    user_id: user?.id || "00000000-0000-0000-0000-000000000001",
    type,
    name,
    phone,
    description: description || "",
    specialties: specialties || [],
    city_id: city_id || null,
    credentials: [],
    status: "pending",
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, application: data })
}

// 审核接口 (管理员)
export async function PUT(req: Request) {
  const body = await req.json()
  const { id, status } = body

  if (!id || !status) {
    return NextResponse.json({ error: "缺少参数" }, { status: 400 })
  }

  const supabase = createDirectClient()
  const { data: app } = await supabase.from("designer_applications").select("*").eq("id", id).single()
  if (!app) return NextResponse.json({ error: "申请不存在" }, { status: 404 })

  // 通过审核 → 创建设计师
  if (status === "approved") {
    const { data: user } = await supabase.from("users").select("id").eq("id", app.user_id).single()
    if (!user) return NextResponse.json({ error: "用户不存在" }, { status: 404 })

    await supabase.from("designers").insert({
      user_id: app.user_id,
      type: app.type,
      name: app.name,
      description: app.description,
      specialties: app.specialties,
      city_id: app.city_id,
      is_verified: true,
    })
  }

  const { data, error } = await supabase.from("designer_applications").update({ status }).eq("id", id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, application: data })
}
