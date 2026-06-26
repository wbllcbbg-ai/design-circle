import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireContractParty } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

// GET /api/contracts/[id] — 合同详情（含报价快照 + 签约状态）
export async function GET(req, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const party = await requireContractParty(id, req)
  if (party instanceof Response) return party

  const supabase = createDirectClient()
  const { data: contract, error } = await supabase
    .from("contracts")
    .select(`
      *,
      quote:quotes(*),
      project:projects!contracts_project_id_fkey(id, title, status, current_milestone, progress)
    `)
    .eq("id", id)
    .maybeSingle()

  if (error || !contract) {
    return NextResponse.json({ error: "合同不存在" }, { status: 404 })
  }

  return NextResponse.json({ contract })
}
