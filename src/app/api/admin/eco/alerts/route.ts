import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

// POST /api/admin/eco/alerts/snooze — 静音某条告警
export async function POST(req: Request) {
  const guard = await requireAdmin()
  if (guard) return guard

  const body = await req.json()
  const { alert_key, duration_hours = 48 } = body
  if (!alert_key) {
    return NextResponse.json({ error: "alert_key required" }, { status: 400 })
  }

  const supabase = createDirectClient()
  const expiresAt = new Date(Date.now() + duration_hours * 3600000).toISOString()

  // 读取现有静音列表
  const { data: existing } = await supabase
    .from("auto_operate_state")
    .select("value")
    .eq("key", "snoozed_alerts")
    .maybeSingle()

  const snoozed: any[] = existing?.value || []
  snoozed.push({ alert_key, expires_at: expiresAt })

  await supabase.from("auto_operate_state").upsert(
    { key: "snoozed_alerts", value: snoozed, updated_at: new Date().toISOString() },
    { onConflict: "key" },
  )

  return NextResponse.json({ success: true, snoozed_until: expiresAt })
}

// POST /api/admin/eco/alerts/unsnooze-all — 恢复所有静音告警
export async function PUT() {
  const guard = await requireAdmin()
  if (guard) return guard

  const supabase = createDirectClient()
  await supabase.from("auto_operate_state").upsert(
    { key: "snoozed_alerts", value: [], updated_at: new Date().toISOString() },
    { onConflict: "key" },
  )

  return NextResponse.json({ success: true })
}
