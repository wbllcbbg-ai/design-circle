import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

// 取当前用户监理身份（辅助）
async function getInspectorIdentity() {
  const { getCurrentUserId } = await import("@/lib/supabase/server")
  const userId = await getCurrentUserId()
  if (!userId) return null
  const supabase = createDirectClient()
  const { data } = await supabase
    .from("inspectors")
    .select("id, is_mentor")
    .eq("user_id", userId)
    .maybeSingle()
  return data ? { id: data.id, isMentor: data.is_mentor } : null
}

// GET /api/inspections?project_id=xxx — 查项目的验收报告（项目当事人可查）
// 或 ?as=inspector 查监理自己的报告
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get("project_id")
  const asInspector = searchParams.get("as") === "inspector"

  const supabase = createDirectClient()

  if (asInspector) {
    const inspector = await getInspectorIdentity()
    if (!inspector) return NextResponse.json({ error: "非监理身份" }, { status: 403 })
    const { data } = await supabase
      .from("inspections")
      .select("*, project:projects(id, title)")
      .eq("inspector_id", inspector.id)
      .order("inspected_at", { ascending: false })
      .limit(50)
    return NextResponse.json({ inspections: data ?? [] })
  }

  if (!projectId) {
    return NextResponse.json({ error: "project_id 或 as=inspector 必填" }, { status: 400 })
  }

  const { data, error } = await supabase
    .from("inspections")
    .select("*, inspector:inspectors(id, name, logo_url)")
    .eq("project_id", projectId)
    .order("inspected_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ inspections: data ?? [] })
}

// POST /api/inspections — 监理提交验收报告
export async function POST(req: Request) {
  const inspector = await getInspectorIdentity()
  if (!inspector) return NextResponse.json({ error: "非监理身份" }, { status: 403 })

  const body = await req.json()
  const {
    project_id, milestone_node, photos, checklist, issues,
    conclusion, rework_required, report_note,
  } = body

  if (!project_id || !milestone_node || !conclusion) {
    return NextResponse.json({ error: "project_id/milestone_node/conclusion 必填" }, { status: 400 })
  }
  if (!["pass", "rework", "reinspect"].includes(conclusion)) {
    return NextResponse.json({ error: "conclusion 非法" }, { status: 400 })
  }

  const supabase = createDirectClient()

  // 校验监理确实被分配到该项目
  const { data: assignment } = await supabase
    .from("inspector_assignments")
    .select("id")
    .eq("project_id", project_id)
    .eq("inspector_id", inspector.id)
    .eq("status", "active")
    .maybeSingle()
  if (!assignment) {
    return NextResponse.json({ error: "你未被分配到该项目" }, { status: 403 })
  }

  const { data, error } = await supabase.from("inspections").insert({
    project_id,
    assignment_id: assignment.id,
    inspector_id: inspector.id,
    milestone_node,
    photos: photos || [],
    checklist: checklist || [],
    issues: issues || [],
    conclusion,
    rework_required: conclusion === "rework" ? (rework_required || null) : null,
    report_note: report_note || null,
    // 新监理（非师傅）的报告需师傅复核
    mentor_reviewed: inspector.isMentor,
    status: "completed",
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 监理验收数 +1
  await supabase.rpc("increment_inspector_count", { p_id: inspector.id })

  // 通知项目双方验收结果
  const { data: proj } = await supabase
    .from("projects")
    .select("user_id, designer_id, title, designer:designers(user_id)")
    .eq("id", project_id)
    .single()
  if (proj) {
    const targets = [proj.user_id]
    const dUid = (proj as { designer?: { user_id?: string } })?.designer?.user_id
    if (dUid) targets.push(dUid)
    const conclusionText = { pass: "验收通过", rework: "需要整改", reinspect: "待复验" }[conclusion]
    await supabase.from("notifications").insert(
      targets.filter(Boolean).map((uid) => ({
        user_id: uid,
        type: "contract",
        actor_id: null,
        target_type: "designer",
        target_id: proj.designer_id,
        content: `监理报告：${milestone_node} 节点${conclusionText}${rework_required ? "，" + rework_required.slice(0, 40) : ""}`,
      })),
    )
  }

  return NextResponse.json({ success: true, inspection: data })
}

// PUT /api/inspections/[id]/mentor-review — 师傅复核新监理报告（仅师傅/管理员）
export async function PUT(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 })

  // 权限：师傅级监理 或 admin
  const inspector = await getInspectorIdentity()
  const isAdmin = (await requireAdmin()) === undefined

  if (!inspector?.isMentor && !isAdmin) {
    return NextResponse.json({ error: "仅师傅级监理或管理员可复核" }, { status: 403 })
  }

  const body = await req.json()
  const { mentor_review_note } = body

  const supabase = createDirectClient()
  const { data, error } = await supabase
    .from("inspections")
    .update({
      mentor_reviewed: true,
      mentor_review_note: mentor_review_note || null,
    })
    .eq("id", id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, inspection: data })
}
