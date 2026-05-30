"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Stars } from "@/components/ui/stars"

type Designer = {
  id: string
  name: string
  type: string
  description: string
  specialties: string[]
  avg_rating: number
  review_count: number
  case_count: number
  logo_url: string | null
  is_verified: boolean
}

type Case = {
  id: string
  title: string
  style: string
  area: number
  budget: number | null
  view_count: number
  like_count: number
  is_published: boolean
  cover_url: string | null
  created_at: string
}

type Review = {
  id: string
  case_id: string | null
  rating: number
  content: string
  created_at: string
}

const TYPE_MAP: Record<string, string> = { designer: "设计师", company: "公司", worker: "工长" }

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [designer, setDesigner] = useState<Designer | null>(null)
  const [cases, setCases] = useState<Case[]>([])
  const [reviews, setReviews] = useState<Review[]>([])
  const [totalViews, setTotalViews] = useState(0)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.replace("/login")
        return
      }

      // 查询设计师身份
      const { data: designerData } = await supabase
        .from("designers")
        .select("*")
        .eq("user_id", user.id)
        .single()

      if (!designerData) {
        setDesigner(null)
        setLoading(false)
        return
      }

      setDesigner(designerData)

      // 查询案例
      const { data: casesData } = await supabase
        .from("cases")
        .select("*")
        .eq("designer_id", designerData.id)
        .order("created_at", { ascending: false })
        .limit(50)

      const caseList = casesData ?? []
      setCases(caseList)

      // 计算总浏览量
      const views = caseList.reduce((sum, c) => sum + (c.view_count || 0), 0)
      setTotalViews(views)

      // 查询最新评价
      const { data: reviewsData } = await supabase
        .from("reviews")
        .select("*")
        .eq("designer_id", designerData.id)
        .order("created_at", { ascending: false })
        .limit(10)

      setReviews(reviewsData ?? [])
      setLoading(false)
    }

    load()
  }, [])

  if (loading) {
    return (
      <div className="bg-white dark:bg-zinc-900 min-h-screen flex items-center justify-center text-sm text-zinc-400">
        加载中...
      </div>
    )
  }

  // 未找到设计师身份
  if (!designer) {
    return (
      <div className="bg-white dark:bg-zinc-900 min-h-screen">
        <div className="flex items-center px-4 h-12 border-b border-zinc-100 dark:border-zinc-800">
          <Link href="/" className="p-1">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>
          <h1 className="text-sm font-medium flex-1 text-center">设计师工作台</h1>
        </div>
        <div className="flex flex-col items-center justify-center px-4 pt-20">
          <div className="w-16 h-16 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <h2 className="text-base font-medium mb-2">你还没有设计师身份</h2>
          <p className="text-sm text-zinc-400 text-center mb-6">去申请入驻，成为认证设计师</p>
          <Link
            href="/apply"
            className="px-6 py-2.5 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-full text-sm font-medium"
          >
            申请入驻
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-zinc-900 min-h-screen">
      {/* 顶部导航 */}
      <div className="sticky top-0 bg-white/90 dark:bg-zinc-900/90 backdrop-blur z-10 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center h-12 px-4">
          <Link href="/" className="p-1">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>
          <h1 className="text-sm font-medium flex-1 text-center">设计师工作台</h1>
          <Link
            href={`/designers/${designer.id}`}
            className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          >
            公开主页
          </Link>
        </div>
      </div>

      {/* 设计师信息 */}
      <div className="px-4 pt-5 pb-4 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-full shrink-0 flex items-center justify-center text-white text-sm font-medium"
            style={{ background: "linear-gradient(135deg, hsl(320, 40%, 60%), hsl(280, 35%, 50%))" }}
          >
            {designer.name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium truncate">{designer.name}</h2>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 shrink-0">
                {TYPE_MAP[designer.type] || designer.type}
              </span>
              {designer.is_verified && (
                <span className="text-[10px] text-green-600 dark:text-green-400 shrink-0">✓ 已认证</span>
              )}
            </div>
            <p className="text-xs text-zinc-400 mt-0.5 truncate">{designer.description}</p>
          </div>
        </div>
      </div>

      {/* 数据概览 */}
      <div className="grid grid-cols-4 gap-2 px-4 pt-4 pb-3">
        <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-3 text-center">
          <p className="text-lg font-semibold">{cases.length}</p>
          <p className="text-[10px] text-zinc-400 mt-0.5">案例数</p>
        </div>
        <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-3 text-center">
          <p className="text-lg font-semibold">{designer.review_count}</p>
          <p className="text-[10px] text-zinc-400 mt-0.5">评价数</p>
        </div>
        <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-3 text-center">
          <p className="text-lg font-semibold">{designer.avg_rating.toFixed(1)}</p>
          <p className="text-[10px] text-zinc-400 mt-0.5">评分</p>
        </div>
        <div className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-3 text-center">
          <p className="text-lg font-semibold">{totalViews}</p>
          <p className="text-[10px] text-zinc-400 mt-0.5">总浏览</p>
        </div>
      </div>

      {/* 我的案例 */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium">我的案例</h2>
          <Link
            href="/publish"
            className="text-xs px-3 py-1.5 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-full font-medium"
          >
            发布新案例
          </Link>
        </div>

        {cases.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-xs text-zinc-400">还没有发布任何案例</p>
          </div>
        ) : (
          <div className="space-y-2">
            {cases.map((item) => (
              <Link
                key={item.id}
                href={`/cases/${item.id}/edit`}
                className="flex items-center gap-3 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50"
              >
                <div
                  className="w-14 h-14 rounded-lg shrink-0 flex items-center justify-center text-zinc-400 text-xs"
                  style={{
                    background: item.cover_url
                      ? undefined
                      : `linear-gradient(135deg, hsl(${(item.title.length * 47) % 360}, 35%, 75%), hsl(${((item.title.length * 47) % 360 + 60) % 360}, 30%, 65%))`,
                  }}
                >
                  {item.cover_url ? (
                    <img src={item.cover_url} alt={item.title} className="w-full h-full object-cover rounded-lg" />
                  ) : (
                    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path d="m21 15-5-5L5 21" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{item.title}</p>
                    {!item.is_published && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 shrink-0">
                        草稿
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-1">
                    <span>{item.style}</span>
                    <span>·</span>
                    <span>{item.area}㎡</span>
                    {item.budget && (
                      <>
                        <span>·</span>
                        <span>¥{item.budget.toLocaleString()}</span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-zinc-400 mt-1">
                    <span className="flex items-center gap-0.5">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                      {item.view_count}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                      {item.like_count}
                    </span>
                  </div>
                </div>
                <svg className="w-4 h-4 text-zinc-300 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* 最近评价 */}
      <div className="px-4 pt-4 pb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium">近期评价</h2>
          <Link
            href={`/designers/${designer.id}/reviews`}
            className="text-xs text-zinc-400"
          >
            查看全部
          </Link>
        </div>

        {reviews.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-xs text-zinc-400">还没有收到评价</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.slice(0, 5).map((review) => (
              <div key={review.id} className="pb-3 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                <div className="flex items-center justify-between">
                  <Stars rating={review.rating} size="sm" />
                  <span className="text-[10px] text-zinc-400">
                    {new Date(review.created_at).toLocaleDateString("zh-CN")}
                  </span>
                </div>
                <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-1.5 line-clamp-2">{review.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
