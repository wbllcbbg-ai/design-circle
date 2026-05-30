import { getCurrentUserId } from "@/lib/supabase/server"
import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

function generateCode(length = 6): string {
  let code = ""
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  }
  return code
}

// 获取或创建我的邀请码
export async function GET() {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const supabase = createDirectClient()

  const { data: existing } = await supabase
    .from("invites")
    .select("code")
    .eq("inviter_id", userId)
    .limit(1)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ code: existing.code })
  }

  let code = generateCode()
  for (let i = 0; i < 10; i++) {
    const { data: c } = await supabase.from("invites").select("id").eq("code", code).maybeSingle()
    if (!c) break
    code = generateCode()
    if (i === 9) return NextResponse.json({ error: "无法生成邀请码，请重试" }, { status: 500 })
  }

  const { error } = await supabase.from("invites").insert({
    inviter_id: userId,
    code,
    channel: "link",
    status: "pending",
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ code })
}

// 修改邀请码
export async function PUT(req: Request) {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const body = await req.json()
  const { code } = body

  if (!code || code.length < 4 || code.length > 20) {
    return NextResponse.json({ error: "邀请码长度4-20位" }, { status: 400 })
  }
  if (!/^[A-Za-z0-9]+$/.test(code)) {
    return NextResponse.json({ error: "邀请码只能包含字母和数字" }, { status: 400 })
  }

  const supabase = createDirectClient()
  const upperCode = code.toUpperCase()

  const { data: existing } = await supabase
    .from("invites")
    .select("id")
    .eq("code", upperCode)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: "该邀请码已被使用" }, { status: 409 })
  }

  const { error } = await supabase
    .from("invites")
    .update({ code: upperCode })
    .eq("inviter_id", userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ code: upperCode })
}
