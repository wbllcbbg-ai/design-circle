import { createDirectClient } from "@/lib/supabase/client"
import { requireAdmin } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

// GET /api/admin/eco/analytics — 内容分析数据（最近 14 天快照）
export async function GET() {
  const guard = await requireAdmin()
  if (guard) return guard

  const supabase = createDirectClient()

  const { data: snapshots } = await supabase
    .from("content_analytics")
    .select("*")
    .order("snapshot_date", { ascending: false })
    .limit(14)

  // 按日期排序（旧的在前）
  const days = (snapshots || []).reverse()

  return Response.json({ days })
}

// POST /api/admin/eco/analytics — 生成今天的快照
export async function POST() {
  const guard = await requireAdmin()
  if (guard) return guard

  const supabase = createDirectClient()
  const today = new Date().toISOString().slice(0, 10)

  // 并发查询
  const [
    { count: totalArticles },
    { count: totalCases },
    { count: totalComments },
    { count: totalQuestions },
    { count: totalVus },
    { count: totalLikes },
    { count: totalDislikes },
    { count: activeVus },
    { count: todayArticles },
    { count: todayCases },
    { count: todayComments },
    { count: todayQuestions },
  ] = await Promise.all([
    supabase.from("articles").select("id", { count: "exact", head: true }),
    supabase.from("cases").select("id", { count: "exact", head: true }),
    supabase.from("comments").select("id", { count: "exact", head: true }),
    supabase.from("questions").select("id", { count: "exact", head: true }),
    supabase.from("virtual_users").select("id", { count: "exact", head: true }),
    supabase.from("likes").select("id", { count: "exact", head: true }),
    supabase.from("dislikes").select("id", { count: "exact", head: true }),
    supabase.from("virtual_users").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("articles").select("id", { count: "exact", head: true }).gte("created_at", today),
    supabase.from("cases").select("id", { count: "exact", head: true }).gte("created_at", today),
    supabase.from("comments").select("id", { count: "exact", head: true }).gte("created_at", today),
    supabase.from("questions").select("id", { count: "exact", head: true }).gte("created_at", today),
  ])

  // 时段分布：按小时统计今日新增内容
  const todayStart = `${today}T00:00:00Z`
  const todayEnd = `${today}T23:59:59Z`
  const [articlesByHour, casesByHour, commentsByHour, questionsByHour] = await Promise.all([
    supabase.from("articles").select("created_at").gte("created_at", todayStart).lte("created_at", todayEnd),
    supabase.from("cases").select("created_at").gte("created_at", todayStart).lte("created_at", todayEnd),
    supabase.from("comments").select("created_at").gte("created_at", todayStart).lte("created_at", todayEnd),
    supabase.from("questions").select("created_at").gte("created_at", todayStart).lte("created_at", todayEnd),
  ])

  // 统计每小时的产出
  const hourly: Record<string, number> = {}
  for (let h = 0; h < 24; h++) hourly[String(h).padStart(2, "0")] = 0
  const countHour = (items: any[]) => {
    for (const item of items || []) {
      const hh = (item.created_at || "").slice(11, 13)
      if (hourly[hh] !== undefined) hourly[hh]++
    }
  }
  countHour(articlesByHour.data || [])
  countHour(casesByHour.data || [])
  countHour(commentsByHour.data || [])
  countHour(questionsByHour.data || [])

  // 角色产出分布
  const { data: roleData } = await supabase
    .from("virtual_users")
    .select("role, content_count")

  const roleDist: Record<string, number> = {}
  for (const vu of roleData || []) {
    const role = vu.role || "unknown"
    roleDist[role] = (roleDist[role] || 0) + (vu.content_count || 0)
  }

  // 平均阅读量
  const { data: viewData } = await supabase.from("articles").select("view_count").limit(200)
  const avgViews = viewData?.length
    ? viewData.reduce((sum, a) => sum + (a.view_count || 0), 0) / viewData.length
    : 0

  // 当天有产出的虚拟人 ID 集合
  const { data: activeToday } = await supabase
    .from("articles")
    .select("virtual_user_id")
    .gte("created_at", todayStart)
    .not("virtual_user_id", "is", null)

  const uniqueVus = new Set((activeToday || []).map((a: any) => a.virtual_user_id))

  // upsert 快照
  const { error } = await supabase.from("content_analytics").upsert({
    snapshot_date: today,
    total_articles: totalArticles || 0,
    total_cases: totalCases || 0,
    total_comments: totalComments || 0,
    total_questions: totalQuestions || 0,
    new_articles: todayArticles || 0,
    new_cases: todayCases || 0,
    new_comments: todayComments || 0,
    new_questions: todayQuestions || 0,
    active_virtual_users: uniqueVus.size,
    total_virtual_users: totalVus || 0,
    total_likes: totalLikes || 0,
    total_dislikes: totalDislikes || 0,
    avg_view_count: Math.round(avgViews * 100) / 100,
    hourly_distribution: hourly,
    role_distribution: roleDist,
  }, { onConflict: "snapshot_date" })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ success: true, snapshot_date: today, hourly, active_vus_today: uniqueVus.size })
}
