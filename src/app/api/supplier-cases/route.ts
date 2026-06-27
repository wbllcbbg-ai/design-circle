import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

// 取当前用户材料商身份（支持 Bearer token）
async function getSupplierIdentity(req?: Request) {
  const { getCurrentUserId } = await import("@/lib/supabase/server")
  const userId = await getCurrentUserId(req)
  if (!userId) return null
  const supabase = createDirectClient()
  const { data } = await supabase
    .from("suppliers")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle()
  return data?.id ?? null
}

// GET /api/supplier-cases?as=supplier 我的关联申请
//         ?case_id=xxx    该案例关联的材料商
//         ?designer_id=xxx 待我确认的关联申请
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const asSupplier = searchParams.get("as") === "supplier"
  const caseId = searchParams.get("case_id")
  const designerId = searchParams.get("designer_id")

  const supabase = createDirectClient()

  if (asSupplier) {
    const supplierId = await getSupplierIdentity(req)
    if (!supplierId) return NextResponse.json({ error: "非材料商身份" }, { status: 403 })
    const { data } = await supabase
      .from("supplier_cases")
      .select("*, case:cases(id, title, cover_url)")
      .eq("supplier_id", supplierId)
      .order("created_at", { ascending: false })
      .limit(50)
    return NextResponse.json({ applications: data ?? [] })
  }

  if (designerId) {
    // 设计师查待确认的关联申请
    const { data } = await supabase
      .from("supplier_cases")
      .select("*, supplier:suppliers(id, name, logo_url, category), case:cases(id, title)")
      .eq("designer_id", designerId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
    return NextResponse.json({ applications: data ?? [] })
  }

  if (caseId) {
    // 查案例关联的材料商
    const { data } = await supabase
      .from("supplier_cases")
      .select("*, supplier:suppliers(id, name, logo_url, category, brand)")
      .eq("case_id", caseId)
      .in("status", ["approved", "auto_approved"])
    return NextResponse.json({ suppliers: data ?? [] })
  }

  return NextResponse.json({ error: "参数缺失" }, { status: 400 })
}

// POST /api/supplier-cases — 材料商申请关联案例
export async function POST(req: Request) {
  const supplierId = await getSupplierIdentity(req)
  if (!supplierId) return NextResponse.json({ error: "非材料商身份" }, { status: 403 })

  const body = await req.json()
  const { case_id, product_info, product_photos } = body
  if (!case_id) return NextResponse.json({ error: "case_id 必填" }, { status: 400 })

  const supabase = createDirectClient()

  // 校验案例存在，并取 designer_id 用于后续确认
  const { data: caseRow } = await supabase
    .from("cases")
    .select("id, designer_id, title")
    .eq("id", case_id)
    .maybeSingle()
  if (!caseRow) return NextResponse.json({ error: "案例不存在" }, { status: 404 })

  const { data, error } = await supabase.from("supplier_cases").insert({
    supplier_id: supplierId,
    case_id,
    designer_id: caseRow.designer_id,
    product_info: product_info || null,
    product_photos: product_photos || [],
    status: "pending",
  }).select().single()

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "已申请关联该案例" }, { status: 400 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 通知设计师有待确认的关联申请
  if (caseRow.designer_id) {
    const { data: designer } = await supabase
      .from("designers")
      .select("user_id")
      .eq("id", caseRow.designer_id)
      .single()
    if (designer) {
      await supabase.from("notifications").insert({
        user_id: designer.user_id,
        type: "contract",
        actor_id: null,
        target_type: "designer",
        target_id: caseRow.designer_id,
        content: `材料商申请关联你的案例《${caseRow.title}》，请确认`,
      })
    }
  }

  return NextResponse.json({ success: true, application: data })
}

// PUT /api/supplier-cases — 设计师确认/拒绝关联
export async function PUT(req: Request) {
  const auth = await requireAuth(req)
  if (typeof auth !== "string") return auth
  const userId = auth

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  const body = await req.json()
  const { status } = body
  if (!["approved", "rejected"].includes(status)) {
    return NextResponse.json({ error: "status 非法" }, { status: 400 })
  }

  const supabase = createDirectClient()

  // 校验：当前用户是该申请关联案例的设计师
  const { data: app } = await supabase
    .from("supplier_cases")
    .select("designer_id, case:cases(designer_id)")
    .eq("id", id)
    .maybeSingle()
  if (!app) return NextResponse.json({ error: "申请不存在" }, { status: 404 })

  const { data: designer } = await supabase
    .from("designers")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle()
  if (!designer || designer.id !== app.designer_id) {
    return NextResponse.json({ error: "只有该案例设计师可确认" }, { status: 403 })
  }

  const { data, error } = await supabase
    .from("supplier_cases")
    .update({ status, decided_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, application: data })
}
