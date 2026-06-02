import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// GET /api/debug/logs — 查看最近执行日志（无认证，仅用于调试）
export async function GET() {
  const supabase = createDirectClient()
  const { data } = await supabase
    .from("auto_operate_logs")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(5)

  return NextResponse.json({ logs: data ?? [] })
}
