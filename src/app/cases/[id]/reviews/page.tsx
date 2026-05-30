"use client"

import { useEffect, useState } from "react"
import { use } from "react"
import { Stars } from "@/components/ui/stars"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"

type Review = {
  id: string
  rating: number
  design_score: number
  construction_score: number
  service_score: number
  content: string
  images: string[]
  is_real_name: boolean
  is_verified: boolean
  created_at: string
}

export default function ReviewsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/cases/${id}/reviews`)
      .then((r) => r.json())
      .then((res) => {
        setReviews(res.reviews ?? [])
        setLoading(false)
      })
  }, [id])

  const avgRating = reviews.length
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : "0.0"

  const avgDesign = reviews.length
    ? (reviews.reduce((s, r) => s + (r.design_score || 0), 0) / reviews.length).toFixed(1)
    : "0.0"
  const avgConstr = reviews.length
    ? (reviews.reduce((s, r) => s + (r.construction_score || 0), 0) / reviews.length).toFixed(1)
    : "0.0"
  const avgService = reviews.length
    ? (reviews.reduce((s, r) => s + (r.service_score || 0), 0) / reviews.length).toFixed(1)
    : "0.0"

  return (
    <div className="bg-white dark:bg-zinc-900 min-h-screen">
      <div className="sticky top-0 bg-white/90 dark:bg-zinc-900/90 backdrop-blur z-10 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center h-12 px-4">
          <Link href={`/cases/${id}`} className="flex items-center gap-2">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m15 18-6-6 6-6" />
            </svg>
            <span className="text-sm font-medium">返回案例</span>
          </Link>
        </div>
      </div>

      <div className="px-4 pt-4 pb-6">
        {/* 评分概览 */}
        <div className="flex items-start gap-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="text-center">
            <p className="text-4xl font-bold">{avgRating}</p>
            <Stars rating={parseFloat(avgRating)} size="sm" />
            <p className="text-xs text-zinc-400 mt-1">{reviews.length}条点评</p>
          </div>
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center gap-2 text-xs">
              <span className="w-16 text-zinc-500">设计</span>
              <div className="flex-1 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                <div className="h-full bg-zinc-800 dark:bg-zinc-200 rounded-full" style={{ width: `${(parseFloat(avgDesign) / 5) * 100}%` }} />
              </div>
              <span className="w-6 text-right text-zinc-500">{avgDesign}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-16 text-zinc-500">施工</span>
              <div className="flex-1 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                <div className="h-full bg-zinc-800 dark:bg-zinc-200 rounded-full" style={{ width: `${(parseFloat(avgConstr) / 5) * 100}%` }} />
              </div>
              <span className="w-6 text-right text-zinc-500">{avgConstr}</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <span className="w-16 text-zinc-500">服务</span>
              <div className="flex-1 h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
                <div className="h-full bg-zinc-800 dark:bg-zinc-200 rounded-full" style={{ width: `${(parseFloat(avgService) / 5) * 100}%` }} />
              </div>
              <span className="w-6 text-right text-zinc-500">{avgService}</span>
            </div>
          </div>
        </div>

        {/* 评价列表 */}
        <div className="space-y-5 mt-4">
          {reviews.map((review) => (
            <div key={review.id} className="pb-5 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-zinc-300 to-zinc-400 dark:from-zinc-600 dark:to-zinc-700" />
                  <div>
                    <Stars rating={review.rating} size="sm" />
                  </div>
                </div>
                <span className="text-xs text-zinc-400">{new Date(review.created_at).toLocaleDateString()}</span>
              </div>

              <div className="flex items-center gap-3 mt-1.5 text-[11px] text-zinc-400">
                <span>设计 {review.design_score}</span>
                <span>施工 {review.construction_score}</span>
                <span>服务 {review.service_score}</span>
              </div>

              <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-2 leading-relaxed">{review.content}</p>
            </div>
          ))}
          {reviews.length === 0 && !loading && (
            <p className="text-xs text-zinc-400 text-center py-10">暂无点评</p>
          )}
          {loading && <p className="text-xs text-zinc-400 text-center py-10">加载中...</p>}
        </div>
      </div>
    </div>
  )
}
