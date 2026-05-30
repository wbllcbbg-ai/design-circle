import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = createDirectClient()
  const { data } = await supabase.from("designer_applications").select("*").order("created_at", { ascending: false })
  return NextResponse.json({ applications: data ?? [] })
}
