import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// 获取所有高频标签
export async function GET() {
  const supabase = createDirectClient()

  // 从文章 tags 数组取标签（最多50个）
  const { data: articles } = await supabase
    .from("articles")
    .select("tags")
    .eq("is_published", true)
    .limit(100)

  const tagCount = new Map<string, number>()
  for (const article of articles ?? []) {
    for (const tag of article.tags ?? []) {
      tagCount.set(tag, (tagCount.get(tag) || 0) + 1)
    }
  }

  // 同时取案例 style 作为标签
  const { data: cases } = await supabase
    .from("cases")
    .select("style")
    .eq("is_published", true)
    .limit(100)

  for (const c of cases ?? []) {
    if (c.style) {
      tagCount.set(c.style, (tagCount.get(c.style) || 0) + 1)
    }
  }

  const tags = Array.from(tagCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
    .map(([name, count]) => ({ name, count }))

  return NextResponse.json({ tags })
}
