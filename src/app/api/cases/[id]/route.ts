import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createDirectClient()

  const { data: caseItem } = await supabase.from("cases").select("*").eq("id", id).single()
  const { data: reviews } = await supabase
    .from("reviews")
    .select("*")
    .eq("case_id", id)
    .order("created_at", { ascending: false })
    .limit(20)

  return NextResponse.json({ case: caseItem, reviews: reviews ?? [] })
}
