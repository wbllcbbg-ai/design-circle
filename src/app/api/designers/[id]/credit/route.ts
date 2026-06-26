import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

// GET /api/designers/[id]/credit — 设计师信用（公开，主页展示用）
// 信用分只来自真实交易（credit_records），AI 内容不计入
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createDirectClient()

  const { data: designer, error } = await supabase
    .from("designers")
    .select(`
      id, name, credit_score, credit_score_updated_at,
      completed_projects, dispute_count, skip_order_count, avg_response_hours
    `)
    .eq("id", id)
    .maybeSingle()

  if (error || !designer) {
    return NextResponse.json({ error: "设计师不存在" }, { status: 404 })
  }

  // 真实交易好评率：只统计 review_source='transaction' 的评价
  const { data: txReviews } = await supabase
    .from("reviews")
    .select("rating")
    .eq("designer_id", id)
    .eq("review_source", "transaction")
    .eq("review_status", "approved")

  const totalTx = txReviews?.length || 0
  const goodTx = (txReviews || []).filter((r: { rating: number }) => r.rating >= 4).length
  const praiseRate = totalTx > 0 ? Math.round((goodTx / totalTx) * 100) : 0

  // 近 20 条信用变动记录（透明展示）
  const { data: records } = await supabase
    .from("credit_records")
    .select("delta, metric, reason, created_at")
    .eq("designer_id", id)
    .order("created_at", { ascending: false })
    .limit(20)

  return NextResponse.json({
    credit: {
      credit_score: designer.credit_score,
      credit_score_updated_at: designer.credit_score_updated_at,
      completed_projects: designer.completed_projects,
      dispute_count: designer.dispute_count,
      skip_order_count: designer.skip_order_count,
      avg_response_hours: designer.avg_response_hours,
      // 真实交易指标
      total_reviews: totalTx,
      praise_rate: praiseRate,
      // 来源标注：信用数据全部来自平台见证的真实交付
      data_source: "platform_verified",
    },
    records: records ?? [],
  })
}
