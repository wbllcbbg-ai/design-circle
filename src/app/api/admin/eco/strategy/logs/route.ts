import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

// GET /api/admin/eco/strategy/logs — 执行日志列表
export async function GET(req: Request) {
  const guard = await requireAdmin()
  if (guard) return guard

  const { searchParams } = new URL(req.url)
  const limit = parseInt(searchParams.get("limit") || "10")

  const supabase = createDirectClient()
  const { data } = await supabase
    .from("auto_operate_logs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(limit)

  return NextResponse.json({ logs: data ?? [] })
}
