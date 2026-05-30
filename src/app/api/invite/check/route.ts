import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get("code")?.trim().toUpperCase()

  if (!code || code.length < 4 || code.length > 20) {
    return NextResponse.json({ valid: false, error: "无效的邀请码" })
  }

  const supabase = createDirectClient()
  const { data } = await supabase
    .from("invites")
    .select("inviter_id, code")
    .eq("code", code)
    .maybeSingle()

  if (!data) {
    return NextResponse.json({ valid: false, error: "邀请码不存在" })
  }

  const { data: inviter } = await supabase
    .from("users")
    .select("nickname")
    .eq("id", data.inviter_id)
    .single()

  return NextResponse.json({
    valid: true,
    code: data.code,
    inviter_nickname: inviter?.nickname || "用户",
  })
}
