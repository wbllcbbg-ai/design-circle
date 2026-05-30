"use client"

import { useEffect, useState } from "react"
import { use } from "react"
import { Stars } from "@/components/ui/stars"
import Link from "next/link"

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

export default function DesignerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [designer, setDesigner] = useState<Designer | null>(null)
  const [cases, setCases] = useState<Case[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)

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

        <button className="w-full mt-4 py-2.5 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-full text-sm font-medium">
          咨询{designer.name}
        </button>
      </div>

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
