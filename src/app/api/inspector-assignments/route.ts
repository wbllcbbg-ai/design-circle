import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAdmin, requireContractParty } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

// 监理派单 inspector_assignments
// 平台派单（admin）或业主自带（client 在项目内指定）

// GET /api/inspector-assignments?project_id=xxx — 查项目的监理派单
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get("project_id")
  const asInspector = searchParams.get("as") === "inspector"

  if (!projectId && !asInspector) {
    return NextResponse.json({ error: "project_id 或 as=inspector 必填" }, { status: 400 })
  }

  const supabase = createDirectClient()

  // 监理查自己的派单列表
  if (asInspector) {
    const auth = await getInspectorIdentity(supabase)
    if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: 401 })
    const { data } = await supabase
      .from("inspector_assignments")
      .select("*, project:projects(id, title, status), inspector:inspectors(name)")
      .eq("inspector_id", auth.inspectorId)
      .order("assigned_at", { ascending: false })
      .limit(50)
    return NextResponse.json({ assignments: data ?? [] })
  }

  // 查某项目的派单（项目当事人或 admin 可查）
  if (projectId) {
    const { data: project } = await supabase
      .from("projects")
      .select("contract_id")
      .eq("id", projectId)
      .maybeSingle()
    if (project) {
      const party = await requireContractParty(project.contract_id)
      // 当事人放行；非当事人需 admin
      if (party instanceof Response) {
        const guard = await requireAdmin()
        if (guard) return guard
      }
    }
    const { data } = await supabase
      .from("inspector_assignments")
      .select("*, inspector:inspectors(id, name, logo_url, punctuality_rate, credit_score)")
      .eq("project_id", projectId)
      .order("assigned_at", { ascending: false })
    return NextResponse.json({ assignments: data ?? [] })
  }

  return NextResponse.json({ assignments: [] })
}

// POST /api/inspector-assignments — 派单
// admin 平台派单，或业主在项目内指定自带监理
export async function POST(req: Request) {
  const body = await req.json()
  const { project_id, inspector_id, assign_mode, fee_per_sqm } = body

  if (!project_id || !inspector_id) {
    return NextResponse.json({ error: "project_id 和 inspector_id 必填" }, { status: 400 })
  }

  const supabase = createDirectClient()
  const { data: project } = await supabase
    .from("projects")
    .select("contract_id")
    .eq("id", project_id)
    .maybeSingle()
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 })

  // 业主可派自带监理，否则需 admin
  const party = await requireContractParty(project.contract_id)
  let canAssign = false
  if (!(party instanceof Response) && party.role === "client") {
    canAssign = true  // 业主自带监理
  } else {
    const guard = await requireAdmin()
    if (!guard) canAssign = true  // admin 平台派单
  }
  if (!canAssign) {
    return NextResponse.json({ error: "无权派单" }, { status: 403 })
  }

  // 校验监理存在且已认证
  const { data: inspector } = await supabase
    .from("inspectors")
    .select("id, is_verified")
    .eq("id", inspector_id)
    .maybeSingle()
  if (!inspector) return NextResponse.json({ error: "监理不存在" }, { status: 404 })

  const { data, error } = await supabase.from("inspector_assignments").insert({
    project_id,
    inspector_id,
    assign_mode: assign_mode || "platform",
    status: "active",
    fee_per_sqm: fee_per_sqm || null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 通知项目双方
  const { data: proj } = await supabase
    .from("projects")
    .select("user_id, designer_id, designer:designers(user_id)")
    .eq("id", project_id)
    .single()
  if (proj) {
    const notifyTargets = [proj.user_id]
    const designerUid = (proj as { designer?: { user_id?: string } })?.designer?.user_id
    if (designerUid) notifyTargets.push(designerUid)
    await supabase.from("notifications").insert(
      notifyTargets.filter(Boolean).map((uid) => ({
        user_id: uid,
        type: "contract",
        actor_id: party instanceof Response ? null : party.userId,
        target_type: "designer",
        target_id: proj.designer_id,
        content: `项目已分配监理（${assign_mode === "client" ? "业主自带" : "平台派单"}）`,
      })),
    )
  }

  return NextResponse.json({ success: true, assignment: data })
}

// 辅助：取当前用户监理身份
async function getInspectorIdentity(supabase: ReturnType<typeof createDirectClient>) {
  const { getCurrentUserId } = await import("@/lib/supabase/server")
  const userId = await getCurrentUserId()
  if (!userId) return { error: "请先登录" }
  const { data } = await supabase
    .from("inspectors")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle()
  if (!data) return { error: "非监理身份" }
  return { inspectorId: data.id }
}
