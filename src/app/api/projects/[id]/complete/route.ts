import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireContractParty } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

// POST /api/projects/[id]/complete — 项目竣工收尾
// 由最后一个里程碑(final)确认时自动触发，也可业主手动竣工。
//
// 副作用：项目 status=completed + 合同 status=completed
//         + 完工数+1 + 信用+5 + 触发评价提醒
export async function POST(req, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createDirectClient()

  // 校验项目存在 + 当事人
  const { data: project } = await supabase
    .from("projects")
    .select("id, contract_id, designer_id, user_id, status")
    .eq("id", id)
    .maybeSingle()

  if (!project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 })
  }

  const party = await requireContractParty(project.contract_id, req)
  if (party instanceof Response) return party

  if (project.status === "completed") {
    return NextResponse.json({ error: "项目已竣工" }, { status: 400 })
  }

  const now = new Date().toISOString()

  // 1. 项目竣工
  await supabase
    .from("projects")
    .update({ status: "completed", completed_at: now, progress: 100 })
    .eq("id", id)

  // 2. 合同完成
  await supabase
    .from("contracts")
    .update({ status: "completed", completed_at: now })
    .eq("id", project.contract_id)

  // 3. 完工数 +1（原子）
  await supabase.rpc("increment_completed_projects", { p_designer_id: project.designer_id })

  // 4. 信用 +5（项目竣工）
  await supabase.from("credit_records").insert({
    designer_id: project.designer_id,
    delta: 5,
    metric: "completion",
    reason: "项目竣工",
    related_project_id: id,
  })
  await supabase.rpc("increment_credit_score", {
    p_designer_id: project.designer_id,
    p_delta: 5,
  })

  // 5. 触发双向评价提醒（评价本身由业主在项目页发起，走 /api/reviews source=contract）
  await supabase.from("notifications").insert([
    {
      user_id: project.user_id,
      type: "contract",
      actor_id: project.user_id,
      target_type: "designer",
      target_id: project.designer_id,
      content: "项目已竣工，请对设计师进行评价",
    },
  ])

  return NextResponse.json({
    success: true,
    message: "项目已竣工，可发起评价",
  })
}
