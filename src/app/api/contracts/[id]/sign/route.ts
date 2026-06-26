import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireContractParty } from "@/lib/auth-guard"
import { MILESTONE_TEMPLATE } from "@/lib/types"

export const dynamic = "force-dynamic"

// POST /api/contracts/[id]/sign — 双方签约
// 每方调用一次，分别回填 signed_by_designer_at / signed_by_user_at。
// 当两方都签后，触发签约副作用：建项目 + 4 里程碑 + 绑对话 + 信用加分 + 通知。
//
// 首版降级：不接法大大，用「平台生成合同 + 双签」模拟电子签约。
export async function POST(req, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const party = await requireContractParty(id, req)
  if (party instanceof Response) return party
  const { userId, role, contract } = party

  const supabase = createDirectClient()

  if (contract.status !== "draft") {
    return NextResponse.json({ error: "合同状态不支持签约" }, { status: 400 })
  }

  const now = new Date().toISOString()

  // 1. 回填当前方的签约时间
  const updateFields: Record<string, string> = {}
  if (role === "client") {
    updateFields.signed_by_user_at = now
  } else {
    updateFields.signed_by_designer_at = now
  }

  const { data: updated, error: updateErr } = await supabase
    .from("contracts")
    .update(updateFields)
    .eq("id", id)
    .select()
    .single()

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // 2. 判断是否双签完成
  const bothSigned = updated.signed_by_designer_at && updated.signed_by_user_at
  if (!bothSigned) {
    // 只签了一方，等另一方
    return NextResponse.json({
      success: true,
      signed_at: null,
      message: role === "client" ? "业主已签约，等待设计师签约" : "设计师已签约，等待业主签约",
    })
  }

  // ============ 双签完成，触发签约副作用 ============

  // 3. 合同状态 → signed + 回填 signed_at
  const { data: signedContract, error: signErr } = await supabase
    .from("contracts")
    .update({ status: "signed", signed_at: now })
    .eq("id", id)
    .select()
    .single()
  if (signErr) return NextResponse.json({ error: signErr.message }, { status: 500 })

  // 4. 创建项目（参照报价快照里的 conversation_id 建立关联）
  const quoteSnap = (signedContract.quote_snapshot as { conversation_id?: string | null }) || {}
  const conversationId = quoteSnap.conversation_id || null
  const { data: project, error: projectErr } = await supabase
    .from("projects")
    .insert({
      contract_id: id,
      designer_id: contract.designer_id,
      user_id: contract.user_id,
      conversation_id: conversationId,
      title: `设计项目 · ${signedContract.total_price}元`,
      current_milestone: 0,
      progress: 0,
      status: "active",
    })
    .select()
    .single()
  if (projectErr) return NextResponse.json({ error: projectErr.message }, { status: 500 })

  // 5. 回填合同和对话的 project_id
  await supabase.from("contracts").update({ project_id: project.id }).eq("id", id)
  if (conversationId) {
    await supabase
      .from("conversations")
      .update({ project_id: project.id, status: "bound" })
      .eq("id", conversationId)
  }

  // 6. 按固定4节点模板插入里程碑
  const milestoneInserts = MILESTONE_TEMPLATE.map((t) => ({
    project_id: project.id,
    contract_id: id,
    node_index: t.node_index,
    node_code: t.node_code,
    node_name: t.node_name,
    weight: t.weight,
    status: "pending",
  }))
  await supabase.from("milestones").insert(milestoneInserts)

  // 7. 信用加分（签约成功 +3）—— 只来自真实交易
  await supabase.from("credit_records").insert({
    designer_id: contract.designer_id,
    delta: 3,
    metric: "sign_contract",
    reason: "签约成功",
    related_project_id: project.id,
  })
  await supabase.rpc("increment_credit_score", {
    p_designer_id: contract.designer_id,
    p_delta: 3,
  })

  // 8. 双向通知：合同已生效，项目已创建
  await supabase.from("notifications").insert([
    {
      user_id: contract.user_id,
      type: "contract",
      actor_id: userId,
      target_type: "designer",
      target_id: contract.designer_id,
      content: `合同已生效，项目已创建。设计费 ${signedContract.total_price} 元，共 4 个交付节点`,
    },
    {
      user_id: contract.designer_user_id,
      type: "contract",
      actor_id: userId,
      target_type: "designer",
      target_id: contract.designer_id,
      content: `合同已生效，项目已创建。设计费 ${signedContract.total_price} 元，请按节点推进交付`,
    },
  ])

  return NextResponse.json({
    success: true,
    signed_at: now,
    project_id: project.id,
    message: "双方签约完成，项目已创建",
  })
}
