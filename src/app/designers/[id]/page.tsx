"use client"

import { useEffect, useState, useCallback } from "react"
import { use } from "react"
import { useRouter } from "next/navigation"
import { Stars } from "@/components/ui/stars"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

type Designer = {
  id: string
  name: string
  type: string
  description: string
  specialties: string[]
  avg_rating: number
  case_count: number
  review_count: number
  years_experience: number
  is_verified: boolean
}

type Case = {
  id: string
  title: string
  style: string
  area: number
}

type Review = {
  id: string
  rating: number
  content: string
  created_at: string
}

const TYPE_MAP: Record<string, string> = { designer: "设计师", company: "公司", worker: "工长" }

// 评价弹窗
function ReviewModal({
  open,
  onClose,
  designerId,
  onSubmitted,
}: {
  open: boolean
  onClose: () => void
  designerId: string
  onSubmitted: () => void
}) {
  const [rating, setRating] = useState(0)
  const [designScore, setDesignScore] = useState(0)
  const [constructionScore, setConstructionScore] = useState(0)
  const [serviceScore, setServiceScore] = useState(0)
  const [content, setContent] = useState("")
  const [isRealName, setIsRealName] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [source, setSource] = useState<string>("browse")

  useEffect(() => {
    if (!open) return
    setRating(0)
    setDesignScore(0)
    setConstructionScore(0)
    setServiceScore(0)
    setContent("")
    setIsRealName(false)
    setSubmitting(false)
    setError("")
    setSource("browse")
    // 检测 source
    fetch(`/api/reviews/check-access?designer_id=${designerId}`).then(r => r.json()).then(res => {
      if (res.source) setSource(res.source)
    }).catch(() => {})
  }, [open, designerId])

  const handleSubmit = async () => {
    if (rating < 1) { setError("请选择综合评分"); return }
    if (!content.trim()) { setError("请输入评价内容"); return }
    setSubmitting(true)
    setError("")
    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        designer_id: designerId,
        rating,
        design_score: designScore || rating,
        construction_score: constructionScore || rating,
        service_score: serviceScore || rating,
        content: content.trim(),
        is_real_name: isRealName,
        source,
      }),
    })
    const data = await res.json()
    if (!res.ok) { setError(data.error || "提交失败"); setSubmitting(false); return }
    onSubmitted()
  }

  const StarSelector = ({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) => (
    <div className="flex items-center gap-2">
      <span className="text-xs text-zinc-500 w-8 shrink-0">{label}</span>
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((s) => (
          <button key={s} type="button" onClick={() => onChange(s)} className="text-lg leading-none transition-colors">
            <span className={s <= value ? "text-amber-400" : "text-zinc-200 dark:text-zinc-600"}>{s <= value ? "★" : "☆"}</span>
          </button>
        ))}
      </div>
    </div>
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white dark:bg-zinc-900 w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5 pb-8 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold">写评价</h3>
          <button onClick={onClose} className="p-1">
            <svg className="w-5 h-5 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4">
          <StarSelector value={rating} onChange={setRating} label="综合" />
          <StarSelector value={designScore} onChange={setDesignScore} label="设计" />
          <StarSelector value={constructionScore} onChange={setConstructionScore} label="施工" />
          <StarSelector value={serviceScore} onChange={setServiceScore} label="服务" />

          <div>
            <label className="text-xs text-zinc-500 block mb-1">评价内容</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="分享你的真实体验..."
              rows={4}
              className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 rounded-xl border-0 outline-none focus:ring-1 focus:ring-zinc-300 dark:focus:ring-zinc-600 resize-none placeholder:text-zinc-400"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-zinc-500">
            <input
              type="checkbox"
              checked={isRealName}
              onChange={(e) => setIsRealName(e.target.checked)}
              className="rounded border-zinc-300 dark:border-zinc-600"
            />
            实名评价
          </label>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-2.5 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-full text-sm font-medium disabled:opacity-50"
          >
            {submitting ? "提交中..." : "提交评价"}
          </button>

          {source === "consult" && (
            <p className="text-[10px] text-zinc-400 text-center">来源：咨询过该设计师</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default function DesignerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()
  const [designer, setDesigner] = useState<Designer | null>(null)
  const [cases, setCases] = useState<Case[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [reviewOpen, setReviewOpen] = useState(false)

  useEffect(() => {
    fetch(`/api/designers/${id}`)
      .then((r) => r.json())
      .then((res) => {
        setDesigner(res.designer)
        setCases(res.cases ?? [])
        setReviews(res.reviews ?? [])
        setLoading(false)
      })
  }, [id])

  if (loading) return <div className="bg-white dark:bg-zinc-900 min-h-screen flex items-center justify-center text-sm text-zinc-400">加载中...</div>
  if (!designer) return null

  return (
    <div className="bg-white dark:bg-zinc-900 min-h-screen">
      <div className="sticky top-0 bg-white/90 dark:bg-zinc-900/90 backdrop-blur z-10 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center h-12 px-4">
          <Link href="/designers" className="flex items-center gap-2">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m15 18-6-6 6-6" />
            </svg>
            <span className="text-sm font-medium">设计师</span>
          </Link>
        </div>
      </div>

      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full shrink-0 flex items-center justify-center text-white text-lg font-medium" style={{ background: "linear-gradient(135deg, hsl(320, 40%, 60%), hsl(280, 35%, 50%))" }}>
            {designer.name[0]}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold">{designer.name}</h1>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">{TYPE_MAP[designer.type] || designer.type}</span>
              {designer.is_verified && <span className="text-[10px] text-green-600 dark:text-green-400">✓ 已认证</span>}
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">{designer.description}</p>
            <div className="flex items-center gap-3 mt-2 text-xs">
              <span className="text-amber-500 font-medium">{designer.avg_rating}</span>
              <span className="text-zinc-400">{designer.case_count}个案例</span>
              <span className="text-zinc-400">{designer.review_count}条点评</span>
              {designer.years_experience && <span className="text-zinc-400">{designer.years_experience}年经验</span>}
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-4 flex-wrap">
          {(designer.specialties ?? []).map((s) => (
            <span key={s} className="text-xs px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">{s}</span>
          ))}
        </div>

        <button
          onClick={async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { router.push('/login'); return }
            const content = prompt('你想咨询什么？')
            if (!content) return
            const res = await fetch('/api/conversations', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ designer_id: id, content })
            })
            const data = await res.json()
            if (data.success) {
              router.push('/messages')
            }
          }}
          className="w-full mt-4 py-2.5 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-full text-sm font-medium"
        >
          咨询{designer.name}
        </button>
        <button
          onClick={async () => {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) { router.push('/login'); return }
            // 检查是否有权限点评
            const accessRes = await fetch(`/api/reviews/check-access?designer_id=${id}`)
            const access = await accessRes.json()
            if (!access.can_review) {
              alert(access.reason || '暂时无法评价该设计师')
              return
            }
            setReviewOpen(true)
          }}
          className="w-full mt-2 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-full text-sm font-medium text-zinc-600 dark:text-zinc-400"
        >
          写评价
        </button>
      </div>

      <ReviewModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        designerId={id}
        onSubmitted={() => {
          setReviewOpen(false)
          window.location.reload()
        }}
      />

      {cases.length > 0 && (
        <div className="px-4 pb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium">案例作品</h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {cases.map((item, i) => {
              const hue = (i * 47 + 200) % 360
              return (
                <Link key={item.id} href={`/cases/${item.id}`} className="block">
                  <div className="w-full aspect-[4/3] rounded-xl mb-1.5" style={{ background: `linear-gradient(135deg, hsl(${hue}, 35%, 75%), hsl(${(hue + 60) % 360}, 30%, 65%))` }} />
                  <p className="text-xs font-medium line-clamp-1">{item.title}</p>
                  <div className="flex items-center gap-1.5 text-[10px] text-zinc-400 mt-0.5">
                    <span>{item.style}</span>
                    <span>·</span>
                    <span>{item.area}㎡</span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {reviews.length > 0 && (
        <div className="px-4 pb-6">
          <h2 className="text-sm font-medium mb-3">用户评价</h2>
          <div className="space-y-3">
            {reviews.map((review) => (
              <div key={review.id} className="pb-3 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                <Stars rating={review.rating} size="sm" />
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1">{review.content}</p>
                <span className="text-xs text-zinc-400 mt-1 block">{new Date(review.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
