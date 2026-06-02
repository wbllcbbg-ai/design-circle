import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"
export const maxDuration = 120

// POST /api/admin/rehost-images — 批量转存历史 OSS 图片到 Supabase Storage
// 一次性路由，跑完后可以删除
export async function POST() {
  const guard = await requireAdmin()
  if (guard) return guard

  const supabase = createDirectClient()

  // 查所有案例的 images 和 cover_url
  const { data: cases } = await supabase.from("cases").select("id, images, cover_url").limit(100)
  // 查所有文章的 cover_url
  const { data: articles } = await supabase.from("articles").select("id, cover_url").limit(100)

  const results: any[] = []

  // 处理案例
  for (const c of cases ?? []) {
    const updates: any = {}
    if (c.cover_url && c.cover_url.includes("aliyuncs.com")) {
      const newUrl = await rehostImage(c.cover_url)
      if (newUrl && newUrl !== c.cover_url && !newUrl.includes("aliyuncs.com")) {
        updates.cover_url = newUrl
        results.push({ type: "case", id: c.id, field: "cover_url", ok: true })
      }
    }
    if (c.images?.length && c.images.some((u: string) => u.includes("aliyuncs.com"))) {
      const newImages = await Promise.all(
        c.images.map((u: string) =>
          u.includes("aliyuncs.com") ? rehostImage(u) : Promise.resolve(u),
        ),
      )
      // 只在新 URL 不是 OSS 且不空时更新
      if (newImages.every((u: string) => u && !u.includes("aliyuncs.com"))) {
        updates.images = newImages
        results.push({ type: "case", id: c.id, field: "images", ok: true })
      }
    }
    if (Object.keys(updates).length) {
      await supabase.from("cases").update(updates).eq("id", c.id)
    }
  }

  // 处理文章
  for (const a of articles ?? []) {
    if (a.cover_url && a.cover_url.includes("aliyuncs.com")) {
      const newUrl = await rehostImage(a.cover_url)
      if (newUrl !== a.cover_url) {
        await supabase.from("articles").update({ cover_url: newUrl }).eq("id", a.id)
        results.push({ type: "article", id: a.id, field: "cover_url", ok: true })
      }
    }
  }

  return NextResponse.json({ total: results.length, results })
}

async function rehostImage(imageUrl: string): Promise<string> {
  try {
    const res = await fetch(imageUrl)
    if (!res.ok) return imageUrl
    const blob = await res.blob()
    const supabase = createDirectClient()
    const ext = imageUrl.includes(".png") ? "png" : "jpg"
    const fileName = `rehosted/batch/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { data, error } = await supabase.storage.from("images").upload(fileName, blob, {
      contentType: blob.type,
      upsert: false,
    })
    if (error || !data) return imageUrl
    const { data: { publicUrl } } = supabase.storage.from("images").getPublicUrl(fileName)
    return publicUrl
  } catch {
    return imageUrl
  }
}
