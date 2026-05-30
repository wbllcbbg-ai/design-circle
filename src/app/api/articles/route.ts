import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = createDirectClient()
  const { data } = await supabase.from("articles").select("*").eq("is_published", true).order("created_at", { ascending: false })
  return NextResponse.json({ articles: data ?? [] })
}
