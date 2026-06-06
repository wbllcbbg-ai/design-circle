import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

// GET /api/admin/eco/overview — 生态概览聚合数据
export async function GET() {
  const guard = await requireAdmin()
  if (guard) return guard

  const supabase = createDirectClient()

  // 并发查询
  const [articleCount, caseCount, vuCount, vuActive, todayArticles, todayCases, pendingPosts, recentLogs] = await Promise.all([
    supabase.from("articles").select("id", { count: "exact", head: true }),
    supabase.from("cases").select("id", { count: "exact", head: true }),
    supabase.from("virtual_users").select("id", { count: "exact", head: true }),
    supabase.from("virtual_users").select("id", { count: "exact", head: true }).eq("is_active", true).gte("last_active_at", new Date(Date.now() - 7 * 86400000).toISOString()),
    supabase.from("articles").select("id", { count: "exact", head: true }).gte("created_at", new Date().toISOString().slice(0, 10)),
    supabase.from("cases").select("id", { count: "exact", head: true }).gte("created_at", new Date().toISOString().slice(0, 10)),
    supabase.from("scheduled_posts").select("id", { count: "exact", head: true }).eq("is_published", false),
    supabase.from("auto_operate_logs").select("*").order("started_at", { ascending: false }).limit(5),
  ])

  // 内容配比
  const total = (articleCount.count || 0) + (caseCount.count || 0)
  const articleRatio = total > 0 ? Math.round(((articleCount.count || 0) / total) * 100) : 0
  const caseRatio = total > 0 ? Math.round(((caseCount.count || 0) / total) * 100) : 0

  // 虚拟人活跃状态
  const { data: vuActivities } = await supabase
    .from("virtual_users")
    .select("id, nickname, role, content_count, last_active_at, is_active")
    .order("content_count", { ascending: false })
    .limit(10)

  const logs = (recentLogs.data || []).map((l: any) => ({
    id: l.id,
    status: l.status,
    started_at: l.started_at,
    summary: l.summary,
  }))

  // 检查是否有阻塞告警
  const recentFailures = logs.filter((l: any) => l.status === "failed" || (l.summary?.failed?.length > 0))
  const blockingAlerts: any[] = []
  const warningAlerts: any[] = []

  if (recentFailures.length >= 3) {
    blockingAlerts.push({
      id: "ai-fail",
      level: "blocking",
      message: `AI 生成连续失败 ${recentFailures.length} 次`,
      actionLabel: "查看日志",
    })
  }

  if (caseRatio < 15) {
    warningAlerts.push({
      id: "case-ratio",
      level: "warning",
      message: `案例占比 ${caseRatio}%，建议补充案例内容`,
      actionLabel: "补充案例",
    })
  }

  // 过滤已静音的告警
  const { data: snoozedData } = await supabase
    .from("auto_operate_state")
    .select("value")
    .eq("key", "snoozed_alerts")
    .maybeSingle()

  const snoozedAlerts: { alert_key: string; expires_at: string }[] = snoozedData?.value || []
  const now = new Date().toISOString()
  const activeSnoozedKeys = new Set(
    snoozedAlerts.filter((s) => s.expires_at > now).map((s) => s.alert_key),
  )

  const filterAlerts = (alerts: any[]) =>
    alerts.filter((a) => !activeSnoozedKeys.has(a.id))

  const filteredBlocking = filterAlerts(blockingAlerts)
  const filteredWarning = filterAlerts(warningAlerts)

  return NextResponse.json({
    overview: {
      totalContents: total,
      todayArticles: todayArticles.count || 0,
      todayCases: todayCases.count || 0,
      todayTotal: (todayArticles.count || 0) + (todayCases.count || 0),
      totalVirtualUsers: vuCount.count || 0,
      activeVirtualUsers: vuActive.count || 0,
      pendingScheduled: pendingPosts.count || 0,
    },
    ratios: {
      article: { current: articleRatio, target: 30 },
      case: { current: caseRatio, target: 20 },
    },
    virtualUsers: (vuActivities || []).map((vu: any) => ({
      nickname: vu.nickname,
      role: vu.role,
      contentCount: vu.content_count,
      lastActive: vu.last_active_at || "从未",
      isActive: vu.is_active,
    })),
    alerts: {
      blocking: filteredBlocking,
      warning: filteredWarning,
    },
    recentLogs: logs,
    recommendedSlots: await computeRecommendedSlots(supabase),
  })
}


// 基于近 7 天 analytics 数据推荐最优 slots
async function computeRecommendedSlots(supabase: any) {
  try {
    const { data: snapshots } = await supabase
      .from("content_analytics")
      .select("hourly_distribution")
      .order("snapshot_date", { ascending: false })
      .limit(7)

    if (!snapshots?.length) return null

    // 聚合所有天的时段数据
    const totalByHour: Record<string, number> = {}
    let grandTotal = 0
    for (const snap of snapshots) {
      const dist = snap.hourly_distribution || {}
      for (let h = 0; h < 24; h++) {
        const hh = String(h).padStart(2, "0")
        totalByHour[hh] = (totalByHour[hh] || 0) + (dist[hh] || 0)
      }
    }
    grandTotal = Object.values(totalByHour).reduce((a, b) => a + b, 0)
    if (grandTotal === 0) return null

    // 按产出排序，取前 3 个时段块（连续 2h+ 的区间）
    const sorted = Object.entries(totalByHour)
      .map(([hour, count]) => ({ hour: parseInt(hour), count }))
      .sort((a, b) => b.count - a.count)

    // 找热点时段：产出最高的连续区间
    const topHours = new Set(sorted.slice(0, 6).map(s => s.hour))
    const ranges: { start: number; end: number; count: number }[] = []
    let current: { start: number; end: number; count: number } | null = null

    for (let h = 0; h < 24; h++) {
      if (topHours.has(h)) {
        if (!current) {
          current = { start: h, end: h + 1, count: totalByHour[String(h).padStart(2, "0")] || 0 }
        } else {
          current.end = h + 1
          current.count += totalByHour[String(h).padStart(2, "0")] || 0
        }
      } else {
        if (current && current.end - current.start >= 2) {
          ranges.push(current)
        }
        current = null
      }
    }
    if (current && current.end - current.start >= 2) {
      ranges.push(current)
    }

    // 取最多 3 个时段区间
    const topRanges = ranges.sort((a, b) => b.count - a.count).slice(0, 3)
    const recommendedSlots = topRanges.map(r => {
      const pad = (n: number) => String(n).padStart(2, "0")
      return pad(r.start) + "-" + pad(r.end)
    })

    return {
      slots: recommendedSlots,
      byHour: Object.entries(totalByHour)
        .map(([hour, count]) => ({ hour, count }))
        .sort((a, b) => parseInt(a.hour) - parseInt(b.hour)),
      currentConfig: null, // 前端可自行获取当前配置对比
    }
  } catch {
    return null
  }
}
