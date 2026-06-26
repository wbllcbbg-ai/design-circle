import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

// GET /api/projects — 当前用户的项目列表
// as=designer（我接的）/ as=client（我的，业主方）
// 按角色分别查：设计师身份查 projects.designer_id，业主查 projects.user_id
export async function GET(req: Request) {
  const auth = await requireAuth(req)
  if (typeof auth !== "string") return auth
  const userId = auth

  const { searchParams } = new URL(req.url)
  const as = searchParams.get("as") || "client" // client | designer
  const status = searchParams.get("status") || "" // 可选过滤

  const supabase = createDirectClient()

  let query = supabase
    .from("projects")
    .select(`
      id, title, status, progress, current_milestone, created_at, completed_at,
      designer:designers(id, name, logo_url),
      user:users(id, nickname, avatar_url),
      contract:contracts!fk_projects_contract(id, total_price, status)
    `)
    .order("created_at", { ascending: false })
    .limit(50)

  if (as === "designer") {
    // 设计师身份：先查 designer_id
    const { data: designer } = await supabase
      .from("designers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle()
    if (!designer) return NextResponse.json({ projects: [] })
    query = query.eq("designer_id", designer.id)
  } else {
    // 业主身份
    query = query.eq("user_id", userId)
  }

  if (status) {
    query = query.eq("status", status)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ projects: data ?? [] })
}
