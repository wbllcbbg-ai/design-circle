import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const guard = await requireAdmin()
  if (guard) return guard

  const body = await req.json()
  const { action, ids } = body // action: "enable" | "disable" | "delete"

  if (!ids?.length) return NextResponse.json({ error: "ids required" }, { status: 400 })

  const supabase = createDirectClient()

  if (action === "delete") {
    const { error } = await supabase.from("virtual_users").delete().in("id", ids)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const isActive = action === "enable"
    const { error } = await supabase.from("virtual_users").update({ is_active: isActive }).in("id", ids)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
