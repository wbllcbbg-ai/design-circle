import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

// POST /api/admin/scheduled/auto-spread — 将排期自动分散到当天空闲时段
export async function POST() {
  const guard = await requireAdmin()
  if (guard) return guard

  const supabase = createDirectClient()

  // 1. 获取当前所有未发布的排期（未来24h内）
  const now = new Date()
  const tomorrow = new Date(now.getTime() + 86400000).toISOString()
  const { data: posts } = await supabase
    .from("scheduled_posts")
    .select("*")
    .eq("is_published", false)
    .lte("publish_at", tomorrow)
    .gte("publish_at", now.toISOString())
    .order("publish_at", { ascending: true })

  if (!posts?.length) return NextResponse.json({ spread: 0 })

  // 2. 检查是否密集（同一小时内超过3条）
  const hourBuckets: Record<string, number> = {}
  for (const p of posts) {
    const hour = p.publish_at.slice(11, 13)
    hourBuckets[hour] = (hourBuckets[hour] || 0) + 1
  }

  const crowdedHours = Object.entries(hourBuckets).filter(([, count]) => count >= 4).map(([h]) => h)
  if (!crowdedHours.length) return NextResponse.json({ spread: 0, message: "无需分散" })

  // 3. 重新分配：找出空闲时段
  const availableSlots: string[] = []
  for (let h = 8; h <= 22; h++) {
    const hh = String(h).padStart(2, "0")
    if (!crowdedHours.includes(hh)) {
      availableSlots.push(hh)
    }
  }

  // 把密集时段的排期移到空闲时段
  let spread = 0
  let slotIdx = 0

  for (const p of posts) {
    const hour = p.publish_at.slice(11, 13)
    if (crowdedHours.includes(hour) && availableSlots.length > 0) {
      const newHour = availableSlots[slotIdx % availableSlots.length]
      const minute = Math.floor(Math.random() * 60)
      const date = p.publish_at.slice(0, 10) // 保留原始日期，不强制改为今天
      const newTime = `${date}T${newHour}:${String(minute).padStart(2, "0")}:00Z`
      await supabase.from("scheduled_posts").update({ publish_at: newTime }).eq("id", p.id)
      spread++
      slotIdx++
    }
  }

  return NextResponse.json({ spread, message: `已分散 ${spread} 条到空闲时段` })
}
