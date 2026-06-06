import { createDirectClient } from "@/lib/supabase/client"

export interface ScheduleConfig {
  slots: string[]       // ["08-12", "14-18", "19-22"]
  slot_max: number      // 4
  interval_hours: number // 6
}

// 根据 slots 配置和当前排期，分配一个合理的 publish_at
export async function schedulePublishTime(
  supabase: ReturnType<typeof createDirectClient>,
  config: ScheduleConfig,
  virtualUserId: string,
): Promise<string> {
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)

  // 1. 读取今天已安排的排期
  const { data: todayPosts } = await supabase
    .from("scheduled_posts")
    .select("publish_at, virtual_user_id")
    .gte("publish_at", `${todayStr}T00:00:00Z`)
    .lte("publish_at", `${todayStr}T23:59:59Z`)
    .order("publish_at", { ascending: true })

  // 2. 统计每个 slot 的人数
  function getSlotHour(slot: string): number {
    return parseInt(slot.split("-")[0])
  }

  function getTimeInSlot(p: { publish_at: string }): string {
    const h = new Date(p.publish_at).getHours()
    for (const slot of config.slots) {
      const [start, end] = slot.split("-").map(Number)
      if (h >= start && h < end) return slot
    }
    return "其他"
  }

  function slotHourRange(slot: string): [number, number] {
    const [s, e] = slot.split("-").map(Number)
    return [s, e]
  }

  // 3. 找出该虚拟人最近一条排期（todayPosts 按 publish_at 升序排列，最后一条才是最近的）
  const lastPost = todayPosts?.length
    ? [...todayPosts].reverse().find(p => p.virtual_user_id === virtualUserId)
    : undefined
  const lastHour = lastPost ? new Date(lastPost.publish_at).getHours() : -1

  // 4. 按 slots 顺序分配
  const slotCounts: Record<string, number> = {}
  for (const p of todayPosts || []) {
    const s = getTimeInSlot(p)
    slotCounts[s] = (slotCounts[s] || 0) + 1
  }

  // 按配置的 slots 顺序遍历
  for (const slot of config.slots) {
    const currentCount = slotCounts[slot] || 0

    // 检查 slot_max
    if (currentCount >= config.slot_max) continue

    const [startHour, endHour] = slotHourRange(slot)

    // 检查 interval_hours
    if (lastHour >= 0 && Math.abs(startHour - lastHour) < config.interval_hours) continue

    // 如果该 slot 的开始时间已过，尝试 slot 内随机时间
    if (startHour <= now.getHours()) {
      // slot 还有时间窗口吗？
      if (now.getHours() >= endHour - 1) continue // 只剩不到 1 小时，跳过

      const minHour = Math.max(now.getHours() + 1, startHour)
      if (minHour >= endHour) continue

      const hour = minHour + Math.floor(Math.random() * (endHour - minHour))
      const minute = Math.floor(Math.random() * 60)
      const d = new Date(now)
      d.setHours(hour, minute, 0, 0)
      return d.toISOString()
    }

    // slot 还没到，安排到 slot 内随机时间
    const hour = startHour + Math.floor(Math.random() * (endHour - startHour))
    const minute = Math.floor(Math.random() * 60)
    const d = new Date(now)
    d.setHours(hour, minute, 0, 0)
    return d.toISOString()
  }

  // 5. 如果所有 slot 都满了或时间已过，推到明天第一个可用 slot
  const firstSlot = config.slots[0]
  if (firstSlot) {
    const startHour = parseInt(firstSlot.split("-")[0])
    const d = new Date(now)
    d.setDate(d.getDate() + 1)
    d.setHours(startHour, Math.floor(Math.random() * 60), 0, 0)
    return d.toISOString()
  }

  // fallback
  return new Date().toISOString()
}
