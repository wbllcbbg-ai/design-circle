import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

// GET /api/admin/eco/strategy — 读取全部策略参数
export async function GET() {
  const guard = await requireAdmin()
  if (guard) return guard

  const supabase = createDirectClient()
  const { data } = await supabase.from("auto_operate_config").select("key, value")
  const config: Record<string, any> = {}
  for (const row of data || []) {
    config[row.key] = row.value
  }
  return NextResponse.json({ config })
}

// PUT /api/admin/eco/strategy — 更新策略参数
export async function PUT(req: Request) {
  const guard = await requireAdmin()
  if (guard) return guard

  const body = await req.json()
  const { config } = body

  if (!config || typeof config !== "object") {
    return NextResponse.json({ error: "config object required" }, { status: 400 })
  }

  const supabase = createDirectClient()

  for (const [key, value] of Object.entries(config)) {
    await supabase.from("auto_operate_config").upsert(
      { key, value, updated_at: new Date().toISOString() },
      { onConflict: "key" },
    )
  }

  return NextResponse.json({ success: true })
}
