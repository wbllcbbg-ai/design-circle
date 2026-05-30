import { getCurrentUserId } from "@/lib/supabase/server"
import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

async function requireAdmin() {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const supabase = createDirectClient()
  const { data: user } = await supabase.from("users").select("role").eq("id", userId).single()
  if (user?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 })
  return null
}

// GET — 获取所有 AI 配置
export async function GET() {
  const guard = await requireAdmin()
  if (guard) return guard

  const supabase = createDirectClient()
  const { data } = await supabase.from("ai_config").select("key, value, updated_at")
  const config: Record<string, string> = {}
  for (const row of data || []) {
    config[row.key] = row.value
  }
  return NextResponse.json({ config })
}

// PUT — 更新 AI 配置
export async function PUT(req: Request) {
  const guard = await requireAdmin()
  if (guard) return guard

  const body = await req.json()
  const { updates } = body // { "ai_api_key": "sk-xxx", "unsplash_key": "xxx" }

  if (!updates || typeof updates !== "object") {
    return NextResponse.json({ error: "updates object required" }, { status: 400 })
  }

  const supabase = createDirectClient()

  for (const [key, value] of Object.entries(updates)) {
    await supabase.from("ai_config").upsert(
      { key, value: String(value), updated_at: new Date().toISOString() },
      { onConflict: "key" },
    )
  }

  return NextResponse.json({ success: true })
}
