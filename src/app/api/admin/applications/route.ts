import { createDirectClient } from "@/lib/supabase/client"
import { getCurrentUserId } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

async function requireAdmin() {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const supabase = createDirectClient()
  const { data: user } = await supabase.from("users").select("role").eq("id", userId).single()
  if (user?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 })

  return null // 通过
}

export async function GET() {
  const guard = await requireAdmin()
  if (guard) return guard

  const supabase = createDirectClient()
  const { data } = await supabase.from("designer_applications").select("*").order("created_at", { ascending: false })
  return NextResponse.json({ applications: data ?? [] })
}
