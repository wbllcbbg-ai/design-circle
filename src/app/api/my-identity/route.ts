import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

// GET /api/my-identity — 查询当前用户的所有商户身份
// 返回 { role, identities: { designer?, supplier?, contractor?, inspector? } }
// 工作台据此决定展示哪个角色的模块
export async function GET(req: Request) {
  const auth = await requireAuth(req)
  if (typeof auth !== "string") return auth
  const userId = auth

  const supabase = createDirectClient()
  const { data: user } = await supabase
    .from("users")
    .select("role, nickname")
    .eq("id", userId)
    .single()

  if (!user) return NextResponse.json({ error: "用户不存在" }, { status: 404 })

  // 并行查四个商户表
  const [designer, supplier, contractor, inspector] = await Promise.all([
    supabase.from("designers").select("id, name, type").eq("user_id", userId).maybeSingle(),
    supabase.from("suppliers").select("id, name, category").eq("user_id", userId).maybeSingle(),
    supabase.from("contractors").select("id, name").eq("user_id", userId).maybeSingle(),
    supabase.from("inspectors").select("id, name").eq("user_id", userId).maybeSingle(),
  ])

  const identities: Record<string, { id: string; name: string } & Record<string, unknown>> = {}
  if (designer.data) identities.designer = designer.data
  if (supplier.data) identities.supplier = supplier.data
  if (contractor.data) identities.contractor = contractor.data
  if (inspector.data) identities.inspector = inspector.data

  return NextResponse.json({
    userId,
    role: user.role,
    nickname: user.nickname,
    identities,
  })
}
