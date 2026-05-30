import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = createDirectClient()

  const [casesRes, articlesRes] = await Promise.all([
    supabase.from("cases").select("*").eq("is_published", true).order("created_at", { ascending: false }).limit(20),
    supabase.from("articles").select("*").eq("is_published", true).order("created_at", { ascending: false }).limit(20),
  ])

  return NextResponse.json({
    cases: casesRes.data ?? [],
    articles: articlesRes.data ?? [],
  })
}
