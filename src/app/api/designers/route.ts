import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const search = searchParams.get("q") || ""
  const type = searchParams.get("type") || ""
  const page = parseInt(searchParams.get("page") || "1")
  const pageSize = 20
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const supabase = createDirectClient()
  let query = supabase.from("designers").select("*", { count: "exact" })

  if (search) query = query.ilike("name", `%${search}%`)
  if (type) query = query.eq("type", type)

  const { data, count, error } = await query
    .order("avg_rating", { ascending: false })
    .range(from, to)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ designers: data ?? [], total: count ?? 0, page, pageSize })
}
