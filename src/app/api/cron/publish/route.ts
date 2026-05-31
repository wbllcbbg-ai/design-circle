import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const maxDuration = 60

// GET /api/cron/publish — 定时发布轮询任务
// 每分钟扫一次 scheduled_posts 表，发布到期内容
// 鉴权：检查 CRON_SECRET 环境变量（Vercel Cron Jobs 场景）
export async function GET(req: Request) {
  // CRON_SECRET 校验
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = req.headers.get("authorization") || ""
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 })
    }
  }

  const supabase = createDirectClient()

  const now = new Date().toISOString()

  // 1. 查出所有到期的未发布排期
  const { data: duePosts } = await supabase
    .from("scheduled_posts")
    .select("*")
    .eq("is_published", false)
    .lte("publish_at", now)
    .limit(20)

  if (!duePosts?.length) {
    return NextResponse.json({ published: 0 })
  }

  let published = 0
  const errors: string[] = []

  for (const post of duePosts) {
    try {
      if (post.target_type === "article") {
        await supabase.from("articles").update({ is_published: true }).eq("id", post.target_id)
      } else if (post.target_type === "case") {
        await supabase.from("cases").update({ is_published: true }).eq("id", post.target_id)
      }

      await supabase.from("scheduled_posts").update({ is_published: true }).eq("id", post.id)
      published++
    } catch (err: any) {
      errors.push(`post ${post.id}: ${err.message}`)
    }
  }

  return NextResponse.json({ published, errors: errors.length > 0 ? errors : undefined })
}
