import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

export async function GET() {
  const guard = await requireAdmin()
  if (guard) return guard

  const supabase = createDirectClient()
  const { data } = await supabase.from("designer_applications").select("*").order("created_at", { ascending: false })
  return NextResponse.json({ applications: data ?? [] })
}
