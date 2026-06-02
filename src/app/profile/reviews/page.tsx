"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

type ReviewItem = {
  id: string
  rating: number
  design_score: number | null
  construction_score: number | null
  service_score: number | null
  content: string
  images: string[]
  created_at: string
  designer_id: string
  case_id: string | null
  designers: { name: string; avatar_url: string | null } | null
  cases: { id: string; title: string; cover_url: string | null } | null
}

export default function MyReviewsPage() {
  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)

      const res = await fetch("/api/profile/reviews")
      const data = await res.json()
      setReviews(data.reviews ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const renderStars = (n: number) =>
    Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={i < n ? "text-amber-400" : "text-zinc-200 dark:text-zinc-600"}>★</span>
    ))

  if (loading) return <div className="bg-white dark:bg-zinc-900 min-h-screen flex items-center justify-center text-sm text-zinc-400">加载中...</div>

  if (!userId) {
    return (
      <div className="bg-white dark:bg-zinc-900 min-h-screen">
        <Header />
        <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
          <p className="text-sm">登录后查看我的点评</p>
          <Link href="/login" className="mt-4 text-sm underline">去登录</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-zinc-900 min-h-screen">
      <Header />

      {reviews.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
          <svg className="w-12 h-12 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          <p className="text-sm">暂无点评</p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {reviews.map((review) => (
            <div key={review.id} className="px-4 py-4">
              {/* 设计师信息 */}
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-xs text-zinc-500 overflow-hidden shrink-0">
                  {review.designers?.avatar_url
                    ? <img src={review.designers.avatar_url} alt="" className="w-full h-full object-cover" />
                    : (review.designers?.name?.[0] || "设")}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{review.designers?.name || "未知设计师"}</p>
                  {review.cases && (
                    <Link href={`/cases/${review.cases.id}`} className="text-xs text-blue-500 hover:underline line-clamp-1">
                      {review.cases.title}
                    </Link>
                  )}
                </div>
                <div className="flex items-center gap-1 text-sm">{renderStars(review.rating)}</div>
              </div>

              {/* 评分详情 */}
              {(review.design_score || review.construction_score || review.service_score) && (
                <div className="flex gap-4 mb-2 text-xs text-zinc-400">
                  {review.design_score != null && <span>设计 {review.design_score}</span>}
                  {review.construction_score != null && <span>施工 {review.construction_score}</span>}
                  {review.service_score != null && <span>服务 {review.service_score}</span>}
                </div>
              )}

              {/* 内容 */}
              <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{review.content}</p>

              {/* 日期 */}
              <p className="text-xs text-zinc-400 mt-2">{new Date(review.created_at).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function Header() {
  return (
    <div className="flex items-center gap-2 px-4 h-12 border-b border-zinc-100 dark:border-zinc-800">
      <Link href="/profile" className="p-1">
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="m15 18-6-6 6-6" />
        </svg>
      </Link>
      <h1 className="text-sm font-medium">我的点评</h1>
    </div>
  )
}
