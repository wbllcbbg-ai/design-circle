"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { use } from "react"
import { createClient } from "@/lib/supabase/client"
import { getCover } from "@/lib/images"
import { Skeleton } from "@/components/ui/skeleton"
import { ShareButton } from "@/components/ui/share-button"

type Comment = {
  id: string
  content: string
  parent_id: string | null
  created_at: string
  user_id: string
}

type Review = {
  id: string
  rating: number
  design_score: number
  construction_score: number
  service_score: number
  content: string
  created_at: string
}

type ReviewSummary = {
  avg_rating: number
  design_avg: number
  construction_avg: number
  service_avg: number
  total: number
}

function calcSummary(reviews: Review[]): ReviewSummary {
  if (reviews.length === 0) return { avg_rating: 0, design_avg: 0, construction_avg: 0, service_avg: 0, total: 0 }
  return {
    avg_rating: reviews.reduce((s, r) => s + r.rating, 0) / reviews.length,
    design_avg: reviews.reduce((s, r) => s + (r.design_score || r.rating), 0) / reviews.length,
    construction_avg: reviews.reduce((s, r) => s + (r.construction_score || r.rating), 0) / reviews.length,
    service_avg: reviews.reduce((s, r) => s + (r.service_score || r.rating), 0) / reviews.length,
    total: reviews.length,
  }
}

const StarBar = ({ score, label }: { score: number; label: string }) => (
  <div className="flex items-center gap-2 text-xs">
    <span className="w-8 text-zinc-400 shrink-0">{label}</span>
    <div className="flex-1 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
      <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${(score / 5) * 100}%` }} />
    </div>
    <span className="w-6 text-right text-zinc-500">{score.toFixed(1)}</span>
  </div>
)

export default function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [data, setData] = useState<any>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState("")
  const [posting, setPosting] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [favorited, setFavorited] = useState(false)
  const supabase = createClient()

  const loadData = async () => {
    const [caseRes, commentRes, userRes, likeRes, favRes, reviewRes] = await Promise.all([
      fetch(`/api/cases/${id}`).then((r) => r.json()),
      fetch(`/api/comments?target_type=case&target_id=${id}`).then((r) => r.json()),
      supabase.auth.getUser(),
      fetch(`/api/likes?target_type=case&target_id=${id}`).then((r) => r.json()),
      fetch(`/api/favorites?target_type=case&target_id=${id}`).then((r) => r.json()),
      fetch(`/api/cases/${id}/reviews`).then((r) => r.json()),
    ])
    setData(caseRes.case)
    setComments(commentRes.comments ?? [])
    setReviews(reviewRes.reviews ?? [])
    setUser(userRes.data.user)
    setLiked(likeRes.liked)
    setLikeCount(likeRes.like_count)
    setFavorited(favRes.favorited)
    setLoading(false)

    // 记录浏览历史
    if (userRes.data.user) {
      fetch("/api/browse-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_type: "case", target_id: id }),
      }).catch(() => {})
    }
  }

  useEffect(() => { loadData() }, [id])

  const handlePostComment = async () => {
    if (!newComment.trim() || posting) return
    setPosting(true)
    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_type: "case", target_id: id, content: newComment }),
    })
    if (res.ok) {
      setNewComment("")
      await loadData()
    }
    setPosting(false)
  }

  const handleLike = async () => {
    if (!user) return
    const res = await fetch("/api/likes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_type: "case", target_id: id, action: liked ? "unlike" : "like" }),
    })
    if (res.ok) {
      const data = await res.json()
      setLiked(data.liked)
      setLikeCount(data.like_count)
    }
  }

  const handleFavorite = async () => {
    if (!user) return
    const res = await fetch("/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_type: "case", target_id: id, action: favorited ? "unfavorite" : "favorite" }),
    })
    if (res.ok) {
      const data = await res.json()
      setFavorited(data.favorited)
    }
  }

  const summary = calcSummary(reviews)

  if (loading) {
    return (
      <div className="bg-white dark:bg-zinc-900 min-h-screen">
        <Skeleton className="w-full aspect-[4/5] rounded-none" />
        <div className="px-4 pt-4 space-y-3">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-24 w-full mt-3" />
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="bg-white dark:bg-zinc-900 min-h-screen">
      <div className="w-full aspect-[4/5] relative overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        <img
          src={
            (data.cover_url && !data.cover_url.includes("placehold.co")) ? data.cover_url
            : data.images?.find((u: string) => u && !u.includes("placehold.co"))
            || getCover(0)
          }
          alt={data.title}
          className="w-full h-full object-cover"
          onError={(e) => {
            (e.target as HTMLImageElement).style.display = "none"
          }}
        />
        <Link href="/" className="absolute top-4 left-4 w-8 h-8 rounded-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur flex items-center justify-center">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
      </div>

      <div className="px-4 pt-4 pb-6">
        <h1 className="text-lg font-semibold leading-snug">{data.title}</h1>
        <div className="flex items-center gap-1.5 mt-1.5">
          <div className="w-4 h-4 rounded-full bg-zinc-300 dark:bg-zinc-600" />
          <span className="text-xs text-zinc-400">设计师</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">设计师</span>
          <span className="text-xs text-zinc-300">·</span>
          <span className="text-xs text-zinc-400">{data.style} · {data.area}㎡</span>
        </div>

        <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-3 leading-relaxed whitespace-pre-line">{data.description}</p>

        {/* 评价摘要 */}
        <div className="mt-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
          {summary.total > 0 ? (
            <Link href={`/cases/${id}/reviews`} className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium">用户评价</h3>
              <div className="flex items-center gap-1 text-xs text-zinc-400">
                <span>{summary.total}条评价</span>
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </div>
            </Link>
          ) : (
            <h3 className="text-sm font-medium mb-3">用户评价</h3>
          )}

          {summary.total > 0 && (
            <>
              <div className="flex items-center gap-3 mb-3">
                <div className="text-center">
                  <div className="text-2xl font-bold text-amber-500">{summary.avg_rating.toFixed(1)}</div>
                  <div className="text-[10px] text-zinc-400">综合评分</div>
                </div>
                <div className="flex-1 space-y-1.5">
                  <StarBar score={summary.design_avg} label="设计" />
                  <StarBar score={summary.construction_avg} label="施工" />
                  <StarBar score={summary.service_avg} label="服务" />
                </div>
              </div>

              <div className="space-y-2">
                {reviews.slice(0, 2).map((review) => (
                  <div key={review.id} className="text-xs text-zinc-500 dark:text-zinc-400">
                    <div className="text-amber-400 text-[10px]">{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</div>
                    <p className="line-clamp-2 mt-0.5">{review.content}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          {summary.total === 0 && (
            <p className="text-xs text-zinc-400 mb-3">暂无评价</p>
          )}

          {data?.designer_id && (
            <Link href={`/designers/${data.designer_id}`} className="block mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-700 text-xs text-zinc-500 text-center">
              我也要评价这个设计师
            </Link>
          )}
        </div>

        <div className="flex items-center gap-6 mt-4 py-3 border-t border-zinc-100 dark:border-zinc-800">
          <button onClick={handleLike} className={`flex items-center gap-1.5 text-sm ${liked ? "text-red-500" : "text-zinc-500"}`}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5">
              <path d="M7 22V4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v18l-4-2.5Z" />
            </svg>
            {likeCount}
          </button>
          <button className="flex items-center gap-1.5 text-sm text-zinc-500">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-5 3V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            评论
          </button>
          <button onClick={handleFavorite} className={`flex items-center gap-1.5 text-sm ${favorited ? "text-amber-500" : "text-zinc-500"}`}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill={favorited ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            收藏
          </button>
          <ShareButton url={typeof window !== "undefined" ? `${window.location.origin}/cases/${id}` : ""} title={data?.title} />
        </div>

        {/* 评论区 */}
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-700 shrink-0 flex items-center justify-center text-[10px] text-zinc-500">
              {user?.email?.[0]?.toUpperCase() || "?"}
            </div>
            <div className="flex-1 flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-full px-3 py-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePostComment()}
                placeholder={user ? "说点什么..." : "登录后评论"}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
                disabled={!user}
              />
              <button
                onClick={handlePostComment}
                disabled={!user || !newComment.trim() || posting}
                className="text-xs text-zinc-400 font-medium disabled:opacity-40"
              >
                {posting ? "..." : "发布"}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-zinc-300 to-zinc-400 dark:from-zinc-600 dark:to-zinc-700 shrink-0 flex items-center justify-center text-[10px] text-white" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-zinc-400">{new Date(comment.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">{comment.content}</p>
                </div>
              </div>
            ))}
            {comments.length === 0 && (
              <p className="text-xs text-zinc-400 text-center py-6">暂无评论，来说点什么吧</p>
            )}
          </div>
        </div>

        <div className="h-8" />
      </div>
    </div>
  )
}
