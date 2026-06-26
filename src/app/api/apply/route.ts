import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAuth, requireAdmin } from "@/lib/auth-guard"

export async function POST(req: Request) {
  const auth = await requireAuth(req)
  if (typeof auth !== "string") return auth
  const userId = auth

  const body = await req.json()
  const { type, name, phone, description, specialties, city_id } = body

  if (!type || !name || !phone) {
    return NextResponse.json({ error: "类型、名称和电话不能为空" }, { status: 400 })
  }

  const supabase = createDirectClient()

  const { data, error } = await supabase.from("designer_applications").insert({
    user_id: userId,
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
  const adminAuth = await requireAdmin(req)
  if (adminAuth) return adminAuth

  const supabase = createDirectClient()

  const body = await req.json()
  const { id, status } = body

  if (!id || !status) {
    return NextResponse.json({ error: "缺少参数" }, { status: 400 })
  }

  const { data: app } = await supabase.from("designer_applications").select("*").eq("id", id).single()
  if (!app) return NextResponse.json({ error: "申请不存在" }, { status: 404 })

  // 通过审核 → 按角色类型创建对应商户记录
  if (status === "approved") {
    const { data: user } = await supabase.from("users").select("id").eq("id", app.user_id).single()
    if (!user) return NextResponse.json({ error: "用户不存在" }, { status: 404 })

    const appType = app.type as string
    // 设计师族（designer/company/worker）→ designers 表
    if (["designer", "company", "worker"].includes(appType)) {
      await supabase.from("designers").insert({
        user_id: app.user_id,
        type: appType,
        name: app.name,
        description: app.description,
        specialties: app.specialties,
        city_id: app.city_id,
        is_verified: true,
      })
    }
    // 材料商 → suppliers 表
    else if (appType === "supplier") {
      await supabase.from("suppliers").insert({
        user_id: app.user_id,
        name: app.name,
        description: app.description,
        city_id: app.city_id,
        contact_phone: app.phone,
        is_verified: true,
      })
    }
    // 施工方 → contractors 表
    else if (appType === "contractor") {
      await supabase.from("contractors").insert({
        user_id: app.user_id,
        name: app.name,
        description: app.description,
        city_id: app.city_id,
        service_areas: app.specialties,  // 复用 specialties 字段存服务区域（前端填的）
        is_verified: true,
      })
    }
    // 监理 → inspectors 表
    else if (appType === "inspector") {
      await supabase.from("inspectors").insert({
        user_id: app.user_id,
        name: app.name,
        description: app.description,
        city_id: app.city_id,
        is_verified: true,
      })
    }

    // 同步更新 users.role（标记商户身份）
    await supabase.from("users").update({ role: appType }).eq("id", app.user_id)
  }

  const { data, error } = await supabase.from("designer_applications").update({ status }).eq("id", id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, application: data })
}
