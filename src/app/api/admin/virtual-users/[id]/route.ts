import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (guard) return guard

  const { id } = await params
  const supabase = createDirectClient()

  const { data, error } = await supabase.from("virtual_users").select("*").eq("id", id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ virtual_user: data })
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (guard) return guard

  const { id } = await params
  const body = await req.json()
  const supabase = createDirectClient()

  const { data, error } = await supabase.from("virtual_users").update(body).eq("id", id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ virtual_user: data })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (guard) return guard

  const { id } = await params
  const supabase = createDirectClient()

  // 软删除保护：原子化 DELETE 只删除无内容的虚拟人（避免 TOCTOU）
  const { data: deleted, error } = await supabase.from("virtual_users").delete().eq("id", id).eq("content_count", 0).select()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!deleted?.length) {
    return NextResponse.json({ error: "该虚拟人已有内容，请使用禁用功能代替删除" }, { status: 400 })
  }
  return NextResponse.json({ success: true })
}
