import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createDirectClient()

  const { data } = await supabase
    .from("reviews")
    .select("*")
    .eq("case_id", id)
    .order("created_at", { ascending: false })
    .limit(50)

  return NextResponse.json({ reviews: data ?? [] })
}
