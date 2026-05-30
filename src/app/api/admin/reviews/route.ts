import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

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
