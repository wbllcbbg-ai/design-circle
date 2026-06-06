import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"
export const maxDuration = 120

// GET /api/cron/publish — Vercel Cron Job 入口
// 每天 08:00 由 Vercel Cron Jobs 触发：
//   1. 运行策略引擎生成当日内容
//   2. 发布任何到期未发布的排期（兜底，目前走生成即发布）
export async function GET(req: Request) {
  const supabase = createDirectClient()

  // 1. 发布到期排期（兜底）
  const now = new Date().toISOString()
  const { data: duePosts } = await supabase
    .from("scheduled_posts")
    .select("*")
    .eq("is_published", false)
    .lte("publish_at", now)
    .limit(20)

  let published = 0
  const errors: string[] = []

  for (const post of duePosts || []) {
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

  // 2. 触发生成当日内内容
  const cronSecret = process.env.CRON_SECRET
  const origin = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

  if (cronSecret && origin) {
    fetch(`${origin}/api/admin/eco/strategy/run`, {
      method: "POST",
      headers: { Authorization: `Bearer ${cronSecret}` },
    }).catch(() => {})
  }

  return NextResponse.json({
    published,
    strategy_triggered: !!(cronSecret && origin),
    errors: errors.length > 0 ? errors : undefined,
  })
}
