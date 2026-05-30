"use client"

import { useEffect, useState, useCallback } from "react"

type Review = {
  id: string
  rating: number
  content: string
  review_status: string
  review_source: string | null
  ai_confidence: number | null
  created_at: string
  designer: { id: string; name: string } | null
  user: { id: string; nickname: string } | null
}

const STATUS_LABELS: Record<string, string> = {
  pending: "待审核",
  approved: "已通过",
  rejected: "已拒绝",
  flagged: "需人工",
}

const SOURCE_LABELS: Record<string, string> = {
  consult: "咨询后",
  browse: "浏览后",
  transaction: "交易后",
}

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("pending")

  const loadReviews = useCallback(async () => {
    const res = await fetch(`/api/admin/reviews?status=${filter}`)
    const data = await res.json()
    setReviews(data.reviews ?? [])
    setLoading(false)
  }, [filter])

  useEffect(() => { loadReviews() }, [loadReviews])

  const handleAction = async (id: string, status: string) => {
    await fetch(`/api/admin/reviews/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    })
    await loadReviews()
  }

  if (loading) return <div className="flex items-center justify-center py-10 text-sm text-zinc-400">加载中...</div>

  return (
    <div>
      {/* 筛选 Tab */}
      <div className="flex gap-2 px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800">
        {["pending", "flagged", "approved", "rejected"].map((s) => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-medium ${filter === s ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"}`}
          >{STATUS_LABELS[s]}</button>
        ))}
      </div>

      {/* 列表 */}
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {reviews.map((review) => (
          <div key={review.id} className="px-4 py-3">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">{review.user?.nickname || "匿名用户"}</span>
                  <span className="text-amber-400 text-[10px]">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
                  <span className="text-[10px] px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-400">
                    {SOURCE_LABELS[review.review_source || ""] || review.review_source}
                  </span>
                  {review.ai_confidence && (
                    <span className="text-[10px] text-zinc-400">AI {(review.ai_confidence * 100).toFixed(0)}%</span>
                  )}
                </div>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-1">{review.content}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-zinc-400">设计师: {review.designer?.name || "未知"}</span>
                  <span className="text-[10px] text-zinc-400">{new Date(review.created_at).toLocaleString()}</span>
                </div>
              </div>
              {review.review_status === "pending" || review.review_status === "flagged" ? (
                <div className="flex gap-1 shrink-0 ml-2">
                  <button onClick={() => handleAction(review.id, "approved")} className="px-2.5 py-1 bg-green-600 text-white rounded text-[10px]">通过</button>
                  <button onClick={() => handleAction(review.id, "rejected")} className="px-2.5 py-1 bg-red-500 text-white rounded text-[10px]">拒绝</button>
                </div>
              ) : (
                <span className={`text-[10px] px-1.5 py-0.5 rounded shrink-0 ${
                  review.review_status === "approved" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"
                }`}>
                  {STATUS_LABELS[review.review_status]}
                </span>
              )}
            </div>
          </div>
        ))}
        {reviews.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-zinc-400">暂无{STATUS_LABELS[filter]}的点评</div>
        )}
      </div>
    </div>
  )
}
