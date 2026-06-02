"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

type FavoriteItem = {
  target_id: string
  created_at: string
  target: {
    id: string
    title: string
    cover_url?: string
    style?: string
    area?: number
    category?: string
  } | null
}

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([])
  const [tab, setTab] = useState<"case" | "article">("case")
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)
      await fetchFavorites(user.id, tab)
      setLoading(false)
    }
    load()
  }, [])

  useEffect(() => {
    if (userId) {
      setLoading(true)
      fetchFavorites(userId, tab).then(() => setLoading(false))
    }
  }, [tab])

  const fetchFavorites = async (uid: string, type: "case" | "article") => {
    const res = await fetch("/api/favorites", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_type: type }),
    })
    const data = await res.json()
    setFavorites(data.favorites ?? [])
  }

  if (loading) return <div className="bg-white dark:bg-zinc-900 min-h-screen flex items-center justify-center text-sm text-zinc-400">加载中...</div>

  if (!userId) {
    return (
      <div className="bg-white dark:bg-zinc-900 min-h-screen">
        <Header />
        <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
          <p className="text-sm">登录后查看收藏</p>
          <Link href="/login" className="mt-4 text-sm underline">去登录</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-zinc-900 min-h-screen">
      <Header />

      {/* Tab 切换 */}
      <div className="flex border-b border-zinc-100 dark:border-zinc-800">
        {[
          { key: "case" as const, label: "案例" },
          { key: "article" as const, label: "文章" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-3 text-sm font-medium text-center transition ${
              tab === t.key
                ? "text-zinc-900 dark:text-white border-b-2 border-zinc-900 dark:border-white"
                : "text-zinc-400"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {favorites.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
          <svg className="w-12 h-12 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          <p className="text-sm">暂无收藏</p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {favorites.map((item) => {
            const title = item.target?.title || "未知内容"
            const href = `/cases/${item.target_id}`
            return (
              <Link key={item.target_id} href={href} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition">
                {item.target?.cover_url && (
                  <img src={item.target.cover_url} alt="" className="w-16 h-12 rounded-lg object-cover shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-clamp-1">{title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-400">
                      {tab === "case" ? "案例" : "文章"}
                    </span>
                    <span className="text-xs text-zinc-400">{new Date(item.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <svg className="w-4 h-4 text-zinc-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </Link>
            )
          })}
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
      <h1 className="text-sm font-medium">我的收藏</h1>
    </div>
  )
}
