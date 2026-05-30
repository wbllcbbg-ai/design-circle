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

export async function GET(req: Request) {
  const guard = await requireAdmin()
  if (guard) return guard

  const { searchParams } = new URL(req.url)
  const status = searchParams.get("status") || "pending"

  const supabase = createDirectClient()

  const { data } = await supabase
    .from("reviews")
    .select("*, designer:designers(id, name), user:users(id, nickname)")
    .eq("review_status", status)
    .order("created_at", { ascending: false })
    .limit(50)

  return NextResponse.json({ reviews: data ?? [] })
}
