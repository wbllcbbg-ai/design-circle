import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireContractParty } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

// POST /api/projects/[id]/milestones/[mid] — 里程碑流转
// body.action: "submit"(设计师提交) | "confirm"(业主确认) | "reject"(业主退回)
export async function POST(req, { params }: { params: Promise<{ id: string; mid: string }> }) {
  const { id, mid } = await params
  const body = await req.json()
  const { action } = body as { action: "submit" | "confirm" | "reject" }

  if (!["submit", "confirm", "reject"].includes(action)) {
    return NextResponse.json({ error: "action 必须是 submit/confirm/reject" }, { status: 400 })
  }

  const supabase = createDirectClient()

  // 取项目 + 里程碑
  const { data: project } = await supabase
    .from("projects")
    .select("id, contract_id, designer_id, user_id, status, current_milestone")
    .eq("id", id)
    .maybeSingle()
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 })

  const { data: milestone } = await supabase
    .from("milestones")
    .select("*")
    .eq("id", mid)
    .eq("project_id", id)
    .maybeSingle()
  if (!milestone) return NextResponse.json({ error: "里程碑不存在" }, { status: 404 })

  // 当事人校验
  const party = await requireContractParty(project.contract_id, req)
  if (party instanceof Response) return party
  const { userId, role, contract } = party

  if (project.status === "completed") {
    return NextResponse.json({ error: "项目已竣工" }, { status: 400 })
  }

  const now = new Date().toISOString()

  // ============ 动作分发 ============

  if (action === "submit") {
    // 设计师提交交付物
    if (role !== "designer") {
      return NextResponse.json({ error: "只有设计师能提交交付物" }, { status: 403 })
    }
    if (milestone.status === "confirmed") {
      return NextResponse.json({ error: "该节点已确认" }, { status: 400 })
    }

    const { attachments, note } = body
    if (!attachments || !Array.isArray(attachments) || attachments.length === 0) {
      return NextResponse.json({ error: "请至少上传一个交付文件" }, { status: 400 })
    }

    const { data: updated, error } = await supabase
      .from("milestones")
      .update({
        submitted_attachments: attachments,
        submitted_note: note || null,
        designer_submitted_at: now,
        user_confirmed_at: null,
        user_rejected_at: null,
        status: "in_review",
      })
      .eq("id", mid)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // 通知业主：有交付物待确认
    await supabase.from("notifications").insert({
      user_id: project.user_id,
      type: "milestone",
      actor_id: userId,
      target_type: "designer",
      target_id: project.designer_id,
      content: `设计师提交了「${milestone.node_name}」，请确认`,
    })

    return NextResponse.json({ success: true, milestone: updated })
  }

  if (action === "confirm") {
    // 业主确认节点
    if (role !== "client") {
      return NextResponse.json({ error: "只有业主能确认节点" }, { status: 403 })
    }
    if (milestone.status !== "in_review") {
      return NextResponse.json({ error: "当前状态不可确认（需设计师先提交）" }, { status: 400 })
    }

    const { data: updated } = await supabase
      .from("milestones")
      .update({
        status: "confirmed",
        user_confirmed_at: now,
        user_rejected_at: null,
        completed_at: now,
      })
      .eq("id", mid)
      .select()
      .single()

    // 信用 +2（节点确认，completion）
    await supabase.from("credit_records").insert({
      designer_id: project.designer_id,
      delta: 2,
      metric: "completion",
      reason: `节点确认：${milestone.node_name}`,
      related_project_id: id,
      related_milestone_id: mid,
    })
    await supabase.rpc("increment_credit_score", {
      p_designer_id: project.designer_id,
      p_delta: 2,
    })

    // 推进项目进度（按节点权重累加）
    const newMilestoneIdx = milestone.node_index + 1
    const { data: allMilestones } = await supabase
      .from("milestones")
      .select("weight, status")
      .eq("project_id", id)
    const confirmedWeight = (allMilestones || [])
      .filter((m: { weight: number; status: string }) => m.status === "confirmed")
      .reduce((s: number, m: { weight: number }) => s + (m.weight || 0), 0)

    await supabase
      .from("projects")
      .update({
        current_milestone: newMilestoneIdx,
        progress: Math.min(100, confirmedWeight),
      })
      .eq("id", id)

    // 通知设计师：节点已确认
    await supabase.from("notifications").insert({
      user_id: contract.designer_user_id,
      type: "milestone",
      actor_id: userId,
      target_type: "designer",
      target_id: project.designer_id,
      content: `业主确认了「${milestone.node_name}」`,
    })

    // === 关键：如果是最后一个节点(final)，自动触发竣工收尾 ===
    if (milestone.node_code === "final") {
      // 内部调用 complete 逻辑（直接复用，避免 HTTP 自调用）
      await triggerProjectCompletion(supabase, id, project)
    }

    return NextResponse.json({
      success: true,
      milestone: updated,
      auto_completed: milestone.node_code === "final",
    })
  }

  if (action === "reject") {
    // 业主退回，要求设计师重新提交
    if (role !== "client") {
      return NextResponse.json({ error: "只有业主能退回节点" }, { status: 403 })
    }
    if (milestone.status !== "in_review") {
      return NextResponse.json({ error: "当前状态不可退回" }, { status: 400 })
    }

    const { reason } = body
    const { data: updated } = await supabase
      .from("milestones")
      .update({
        status: "rejected",
        user_rejected_at: now,
        reject_reason: reason || null,
      })
      .eq("id", mid)
      .select()
      .single()

    await supabase.from("notifications").insert({
      user_id: contract.designer_user_id,
      type: "milestone",
      actor_id: userId,
      target_type: "designer",
      target_id: project.designer_id,
      content: `业主退回了「${milestone.node_name}」${reason ? "：" + reason.slice(0, 50) : ""}`,
    })

    return NextResponse.json({ success: true, milestone: updated })
  }

  return NextResponse.json({ error: "未知动作" }, { status: 400 })
}

// 竣工收尾逻辑（与 /api/projects/[id]/complete 一致，内部复用避免 HTTP 自调用）
async function triggerProjectCompletion(
  supabase: ReturnType<typeof createDirectClient>,
  projectId: string,
  project: { designer_id: string; user_id: string; contract_id: string },
) {
  const now = new Date().toISOString()
  await supabase
    .from("projects")
    .update({ status: "completed", completed_at: now, progress: 100 })
    .eq("id", projectId)
  await supabase
    .from("contracts")
    .update({ status: "completed", completed_at: now })
    .eq("id", project.contract_id)
  await supabase.rpc("increment_completed_projects", { p_designer_id: project.designer_id })
  await supabase.from("credit_records").insert({
    designer_id: project.designer_id,
    delta: 5,
    metric: "completion",
    reason: "项目竣工",
    related_project_id: projectId,
  })
  await supabase.rpc("increment_credit_score", {
    p_designer_id: project.designer_id,
    p_delta: 5,
  })
  await supabase.from("notifications").insert({
    user_id: project.user_id,
    type: "contract",
    actor_id: project.user_id,
    target_type: "designer",
    target_id: project.designer_id,
    content: "项目已竣工，请对设计师进行评价",
  })
}
