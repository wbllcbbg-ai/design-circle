import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"

// 交付物上传 —— 用于过程托管里程碑（设计师提交方案/施工图/效果图）
// 与 /api/upload 区别：支持图片+PDF，上限 20MB，存独立 bucket，返回 path 以便回收

const MAX_SIZE = 20 * 1024 * 1024 // 20MB
const ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
]
const BUCKET = "deliverables"

export async function POST(req: Request) {
  const auth = await requireAuth(req)
  if (typeof auth !== "string") return auth
  // requireAuth 已确认登录，此处 userId 仅作鉴权闸门，不再单独使用

  const formData = await req.formData()
  const file = formData.get("file") as File | null

  if (!file) {
    return NextResponse.json({ error: "没有选择文件" }, { status: 400 })
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: "文件大小不能超过 20MB" }, { status: 400 })
  }

  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json(
      { error: "只支持图片(JPG/PNG/WebP/GIF)或 PDF 文件" },
      { status: 400 },
    )
  }

  const supabase = createDirectClient()
  const ext = file.name.split(".").pop() || "bin"
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { data, error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, file, {
      contentType: file.type,
      upsert: false,
    })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(fileName)

  // 返回 url + path，path 用于将来权限回收/删除交付物
  return NextResponse.json({
    success: true,
    url: publicUrl,
    path: data?.path || fileName,
  })
}
