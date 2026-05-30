"use client"

import { useEffect, useState } from "react"
import { use } from "react"
import Link from "next/link"

type TagResult = {
  tag: string
  articles: Array<{ id: string; title: string; summary: string; cover_url: string; category: string; tags: string[]; like_count: number; published_at: string }>
  cases: Array<{ id: string; title: string; cover_url: string; style: string; area: number; like_count: number; created_at: string }>
}

export default function TagPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = use(params)
  const [data, setData] = useState<TagResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<"all" | "articles" | "cases">("all")

  useEffect(() => {
    fetch(`/api/tags/${encodeURIComponent(tag)}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d)
        setLoading(false)
      })
  }, [tag])

  if (loading) return <div className="bg-white dark:bg-zinc-900 min-h-screen flex items-center justify-center text-sm text-zinc-400">加载中...</div>
  if (!data) return null

  const articles = data.articles ?? []
  const cases = data.cases ?? []
  const totalCount = articles.length + cases.length

  return (
    <div className="bg-white dark:bg-zinc-900 min-h-screen">
      <div className="flex items-center gap-2 px-4 h-12 border-b border-zinc-100 dark:border-zinc-800">
        <Link href="/" className="p-1">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
        <h1 className="text-sm font-medium">#{data.tag}</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 px-4 py-2 border-b border-zinc-100 dark:border-zinc-800 text-xs">
        {[
          { key: "all" as const, label: `全部 (${totalCount})` },
          { key: "articles" as const, label: `文章 (${articles.length})` },
          { key: "cases" as const, label: `案例 (${cases.length})` },
        ].map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`pb-2 border-b-2 transition ${tab === t.key ? "border-zinc-900 dark:border-white font-medium" : "border-transparent text-zinc-400"}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {(tab === "all" || tab === "articles") && articles.map((item) => {
          const hue = (Math.abs(item.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) * 47) % 360
          return (
            <Link key={`article-${item.id}`} href={`/articles/${item.id}`} className="block px-4 py-3">
              <div className="flex gap-3">
                <div className="w-20 h-20 rounded-lg shrink-0 flex items-center justify-center text-white text-[10px]" style={{ background: `linear-gradient(135deg, hsl(${hue}, 35%, 75%), hsl(${(hue + 60) % 360}, 30%, 65%))` }}>
                  {item.category || "文章"}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium line-clamp-2 leading-snug">{item.title}</h3>
                  {item.summary && <p className="text-xs text-zinc-400 mt-1 line-clamp-1">{item.summary}</p>}
                  <div className="text-xs text-zinc-400 mt-1">{item.like_count}赞</div>
                </div>
              </div>
            </Link>
          )
        })}

        {(tab === "all" || tab === "cases") && cases.map((item) => (
          <Link key={`case-${item.id}`} href={`/cases/${item.id}`} className="block px-4 py-3">
            <div className="flex gap-3">
              <div className="w-20 h-20 rounded-lg shrink-0 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-xs text-zinc-400">{item.style}</div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-medium line-clamp-2 leading-snug">{item.title}</h3>
                <div className="text-xs text-zinc-400 mt-1">{item.style} · {item.area}㎡</div>
                <div className="text-xs text-zinc-400 mt-1">{item.like_count}赞</div>
              </div>
            </div>
          </Link>
        ))}

        {totalCount === 0 && (
          <div className="px-4 py-10 text-center text-sm text-zinc-400">暂无相关内容</div>
        )}
      </div>
    </div>
  )
}
