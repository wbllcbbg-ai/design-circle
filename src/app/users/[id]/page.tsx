"use client"

import { useEffect, useState } from "react"
import { use } from "react"
import Link from "next/link"

type User = {
  id: string
  nickname: string
  avatar_url: string | null
  created_at: string
}

type Designer = {
  id: string
  type: string
  name: string
  description: string
  specialties: string[]
  avg_rating: number
  case_count: number
  review_count: number
  years_experience: number
  is_verified: boolean
}

const USER_TYPE_MAP: Record<string, string> = { designer: "设计师", company: "公司", worker: "工长" }

type Article = {
  id: string
  title: string
  summary: string
  category: string
  tags: string[]
  view_count: number
  like_count: number
  published_at: string
  author?: {
    id: string
    nickname: string
    avatar_url: string | null
  }
}

export default function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [user, setUser] = useState<User | null>(null)
  const [designer, setDesigner] = useState<Designer | null>(null)
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/users/${id}`)
      .then((r) => r.json())
      .then((res) => {
        if (res.error) {
          setUser(null)
        } else {
          setUser(res.user)
          setDesigner(res.designer ?? null)
          setArticles(res.articles ?? [])
        }
        setLoading(false)
      })
  }, [id])

  if (loading) return <div className="bg-white dark:bg-zinc-900 min-h-screen flex items-center justify-center text-sm text-zinc-400">加载中...</div>
  if (!user) return <div className="bg-white dark:bg-zinc-900 min-h-screen flex items-center justify-center text-sm text-zinc-400">用户不存在</div>

  return (
    <div className="bg-white dark:bg-zinc-900 min-h-screen">
      <div className="sticky top-0 bg-white/90 dark:bg-zinc-900/90 backdrop-blur z-10 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center h-12 px-4">
          <Link href="/articles" className="flex items-center gap-2">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m15 18-6-6 6-6" />
            </svg>
            <span className="text-sm font-medium">文章</span>
          </Link>
        </div>
      </div>

      <div className="px-4 pt-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full shrink-0 flex items-center justify-center text-white text-lg font-medium overflow-hidden" style={{ background: "linear-gradient(135deg, hsl(200, 40%, 60%), hsl(160, 35%, 50%))" }}>
            {user.avatar_url ? (
              <img src={user.avatar_url} alt={user.nickname} className="w-full h-full object-cover" />
            ) : (
              user.nickname[0]
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold">{user.nickname}</h1>
              {designer && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">{USER_TYPE_MAP[designer.type] || designer.type}</span>
              )}
              {!designer && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">业主</span>
              )}
              {designer?.is_verified && <span className="text-[10px] text-green-600 dark:text-green-400">✓ 已认证</span>}
            </div>
            {designer && <p className="text-xs text-zinc-400 mt-0.5">{designer.description}</p>}
            <p className="text-xs text-zinc-500 mt-1">
              {new Date(user.created_at).toLocaleDateString("zh-CN")} 加入 · {articles.length} 篇文章
            </p>
            {designer && (
              <Link href={`/designers/${designer.id}`} className="inline-flex items-center gap-1 text-xs text-zinc-500 mt-2 hover:text-zinc-700 dark:hover:text-zinc-300">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 15v2m-6 4h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2zm10-10V7a4 4 0 0 0-8 0v4h8z" />
                </svg>
                查看案例与评价
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 pb-6">
        <h2 className="text-sm font-medium mb-3">发表的文章</h2>
        {articles.length === 0 ? (
          <p className="text-xs text-zinc-400 text-center py-8">暂无文章</p>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {articles.map((article, i) => {
              const hue = (i * 53 + 180) % 360
              return (
                <Link key={article.id} href={`/articles/${article.id}`} className="block py-3 first:pt-0 last:pb-0">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <h3 className="text-sm font-medium leading-snug line-clamp-2">{article.title}</h3>
                      <p className="text-xs text-zinc-400 mt-1 line-clamp-1">{article.summary}</p>
                      <div className="flex items-center gap-2 mt-1.5 text-[11px] text-zinc-400">
                        <span>{article.category}</span>
                        <span>·</span>
                        <span>{article.view_count}次浏览</span>
                      </div>
                    </div>
                    <div className="w-20 h-20 rounded-lg shrink-0 overflow-hidden" style={{ background: `linear-gradient(135deg, hsl(${hue}, 35%, 75%), hsl(${(hue + 60) % 360}, 30%, 65%))` }} />
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
