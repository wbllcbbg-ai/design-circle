import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireContractParty } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

// GET /api/projects/[id] — 项目详情（里程碑 + 进度 + 合同 + 对话概要）
export async function GET(req, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createDirectClient()

  // 取项目
  // 注意：projects 与 contracts 有双向外键（循环引用），join 必须显式指定用哪个
  const { data: project, error } = await supabase
    .from("projects")
    .select(`
      *,
      designer:designers(id, name, logo_url, user_id, credit_score, completed_projects),
      user:users(id, nickname, avatar_url),
      contract:contracts!fk_projects_contract(id, total_price, service_fee_amount, service_fee_paid, status, signed_at)
    `)
    .eq("id", id)
    .maybeSingle()

  if (error || !project) {
    return NextResponse.json({ error: "项目不存在" }, { status: 404 })
  }

  // 当事人校验（用 requireContractParty 通过 contract_id 校验）
  const party = await requireContractParty(project.contract_id, req)
  if (party instanceof Response) return party
  const { role } = party

  // 取该项目的 4 个里程碑
  const { data: milestones } = await supabase
    .from("milestones")
    .select("*")
    .eq("project_id", id)
    .order("node_index", { ascending: true })

  return NextResponse.json({
    project,
    milestones: milestones ?? [],
    my_role: role, // client / designer，前端据此显示不同操作按钮
  })
}
