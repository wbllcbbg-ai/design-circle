import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

export async function GET() {
  const guard = await requireAdmin()
  if (guard) return guard

  const supabase = createDirectClient()

  // 获取当前 admin 的 user ID
  const { data: { user } } = await supabase.auth.getUser()
  const adminUserId = user?.id

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()

  // 并行统计
  const [
    { count: totalConversations },
    { count: todayConversations },
    { data: allConvs },
    { data: users },
    { data: recentConvs },
  ] = await Promise.all([
    supabase.from("conversations").select("id", { count: "exact", head: true }),
    supabase.from("conversations").select("id", { count: "exact", head: true }).gte("created_at", todayStart),
    supabase.from("conversations").select("id, user_id"),
    supabase.from("conversations").select("user_id"),
    supabase
      .from("conversations")
      .select("id, last_message, last_message_at, created_at, designer_id, user_id")
      .order("last_message_at", { ascending: false })
      .limit(12),
  ])

  // 活跃用户数（DISTINCT）
  const userIds = new Set((users || []).map((r: any) => r.user_id))
  const activeUsers = userIds.size

  // 未回复统计
  let unrepliedConversations = 0
  if (adminUserId && allConvs && allConvs.length > 0) {
    const convIds = allConvs.map((c: any) => c.id)
    // 分段查询避免 IN 数组太大
    const chunkSize = 30
    let repliedSet = new Set<string>()
    for (let i = 0; i < convIds.length; i += chunkSize) {
      const chunk = convIds.slice(i, i + chunkSize)
      const { data: repliedMsgs } = await supabase
        .from("messages")
        .select("conversation_id")
        .in("conversation_id", chunk)
        .eq("sender_id", adminUserId)
      ;(repliedMsgs || []).forEach((m: any) => repliedSet.add(m.conversation_id))
    }
    unrepliedConversations = allConvs.length - repliedSet.size
  }

  // 7 天统计
  const dailyMap: Record<string, number> = {}
  const dayLabels = ["日", "一", "二", "三", "四", "五", "六"]
  const dailyConversations: { date: string; label: string; count: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = d.toISOString().slice(0, 10)
    dailyMap[key] = 0
    dailyConversations.push({ date: key, label: `周${dayLabels[d.getDay()]}`, count: 0 })
  }

  // 查 7 天内的对话
  const sevenDaysAgo = new Date(now)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
  sevenDaysAgo.setHours(0, 0, 0, 0)
  const { data: weekConvs } = await supabase
    .from("conversations")
    .select("created_at")
    .gte("created_at", sevenDaysAgo.toISOString())

  ;(weekConvs || []).forEach((c: any) => {
    const key = c.created_at.slice(0, 10)
    if (dailyMap[key] !== undefined) dailyMap[key]++
  })

  dailyConversations.forEach((d) => {
    d.count = dailyMap[d.date]
  })

  // 最近咨询列表 — 批量查设计师和用户
  const recentList: any[] = []
  if (recentConvs && recentConvs.length > 0) {
    const designerIds = [...new Set(recentConvs.map((c: any) => c.designer_id))] as string[]
    const uidSet = [...new Set(recentConvs.map((c: any) => c.user_id))] as string[]

    const [designersRes, usersRes] = await Promise.all([
      supabase.from("designers").select("id, name").in("id", designerIds),
      supabase.from("users").select("id, nickname").in("id", uidSet),
    ])

    const designerMap = new Map((designersRes.data || []).map((d: any) => [d.id, d.name]))
    const userMap = new Map((usersRes.data || []).map((u: any) => [u.id, u.nickname]))

    // 查每个对话的最后一条消息
    for (const c of recentConvs) {
      let lastSender: string | null = null
      let status: "replied" | "pending" = "pending"

      const { data: lastMsg } = await supabase
        .from("messages")
        .select("sender_id, content")
        .eq("conversation_id", c.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()

      if (lastMsg) {
        lastSender = lastMsg.sender_id
        if (adminUserId && lastSender === adminUserId) {
          status = "replied"
        }
      }

      recentList.push({
        id: c.id,
        userNickname: userMap.get(c.user_id) || "匿名用户",
        designerName: designerMap.get(c.designer_id) || "未知设计师",
        time: c.last_message_at || c.created_at,
        status,
        lastMessage: c.last_message || undefined,
      })
    }
  }

  return NextResponse.json({
    totalConversations: totalConversations ?? 0,
    todayConversations: todayConversations ?? 0,
    unrepliedConversations,
    activeUsers,
    dailyConversations,
    recentConversations: recentList,
  })
}
