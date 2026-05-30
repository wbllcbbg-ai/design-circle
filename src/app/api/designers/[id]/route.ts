import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createDirectClient()

  const { data: designer } = await supabase.from("designers").select("*").eq("id", id).single()
  const { data: cases } = await supabase.from("cases").select("*").eq("designer_id", id).limit(20)
  const { data: reviews } = await supabase.from("reviews").select("*").eq("designer_id", id).order("created_at", { ascending: false }).limit(10)

  return NextResponse.json({ designer, cases: cases ?? [], reviews: reviews ?? [] })
}
