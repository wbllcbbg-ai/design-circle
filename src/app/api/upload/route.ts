import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"

export async function POST(req: Request) {
  const auth = await requireAuth()
  if (typeof auth !== "string") return auth
  const formData = await req.formData()
  const file = formData.get("file") as File | null

  if (!file) {
    return NextResponse.json({ error: "没有选择文件" }, { status: 400 })
  }

  // 限制 5MB
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "文件大小不能超过 5MB" }, { status: 400 })
  }

  // 只允许图片
  if (!file.type.startsWith("image/")) {
    return NextResponse.json({ error: "只支持图片文件" }, { status: 400 })
  }

  const supabase = createDirectClient()
  const ext = file.name.split(".").pop() || "jpg"
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { data, error } = await supabase.storage
    .from("images")
    .upload(fileName, file, {
      contentType: file.type,
      upsert: false,
    })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage.from("images").getPublicUrl(fileName)

  return NextResponse.json({ success: true, url: publicUrl })
}
