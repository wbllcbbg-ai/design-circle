import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createDirectClient()

  const { data: article } = await supabase.from("articles").select("*").eq("id", id).single()
  const { data: comments } = await supabase.from("cases") // placeholder
    .select("id")
    .limit(0)

  return NextResponse.json({ article, comments: [] })
}
