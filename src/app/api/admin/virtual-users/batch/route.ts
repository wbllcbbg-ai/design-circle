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
    // 保护：原子化 DELETE 只删除无内容的虚拟人（避免 TOCTOU）
    const { data: deleted, error } = await supabase.from("virtual_users").delete().in("id", ids).eq("content_count", 0).select()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    const skipped = ids.length - (deleted?.length || 0)
    if (skipped > 0) {
      return NextResponse.json({ error: `以下虚拟人已有内容，无法删除: ${skipped} 个（已删除 ${deleted?.length || 0} 个）` }, { status: 400 })
    }
  } else {
    const isActive = action === "enable"
    const { error } = await supabase.from("virtual_users").update({ is_active: isActive }).in("id", ids)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
