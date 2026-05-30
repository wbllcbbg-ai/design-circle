"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { getArticleCover } from "@/lib/images"

type Article = {
  id: string
  title: string
  summary: string
  cover_url: string | null
  category: string
  tags: string[]
  view_count: number
  like_count: number
  author?: {
    id: string
    nickname: string
    avatar_url: string | null
    designer_type: string | null
    is_verified_designer: boolean
  }
}

const USER_TYPE_MAP: Record<string, string> = { designer: "设计师", company: "公司", worker: "工长" }

const CATEGORIES = ["为你推荐", "装修攻略", "预算规划", "避坑指南", "主材选购", "风格灵感"]

export default function ArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [active, setActive] = useState("为你推荐")

  useEffect(() => {
    fetch("/api/articles")
      .then((r) => r.json())
      .then((res) => setArticles(res.articles ?? []))
  }, [])

  return (
    <div className="bg-white dark:bg-zinc-900 min-h-screen">
      <div className="px-3 py-2.5 overflow-x-auto scrollbar-hide border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActive(cat)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium ${
                cat === active ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {articles.map((a, i) => {
          if (active !== "为你推荐" && a.category !== active) return null
          const hue = (i * 53 + 180) % 360
          return (
            <Link key={a.id} href={`/articles/${a.id}`} className="block">
              <article>
                <div className="w-full aspect-[4/3] relative overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                  <img src={a.cover_url || getArticleCover(i)} alt={a.title} className="w-full h-full object-cover" loading="lazy" />
                  <div className="absolute top-3 left-3 px-2 py-0.5 bg-white/90 dark:bg-zinc-900/90 backdrop-blur rounded text-[11px] font-medium text-zinc-700 dark:text-zinc-300">{a.category}</div>
                </div>
                <div className="px-3 pt-2 pb-3">
                  <h2 className="text-sm font-medium leading-snug line-clamp-2">{a.title}</h2>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {a.author && (
                      <>
                        <div className="w-4 h-4 rounded-full bg-zinc-300 dark:bg-zinc-600 overflow-hidden flex-shrink-0">
                          {a.author.avatar_url ? (
                            <img src={a.author.avatar_url} alt={a.author.nickname} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[8px] text-white font-medium">
                              {a.author.nickname?.charAt(0) || "?"}
                            </div>
                          )}
                        </div>
                        <Link href={`/users/${a.author.id}`} className="text-[11px] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">{a.author.nickname}</Link>
                        {a.author.designer_type && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-400">{USER_TYPE_MAP[a.author.designer_type] || a.author.designer_type}</span>
                        )}
                        {!a.author.designer_type && (
                          <span className="text-[9px] px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-400">业主</span>
                        )}
                      </>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 mt-1 line-clamp-1">{a.summary}</p>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2 text-xs text-zinc-400">
                      {(a.tags ?? []).slice(0, 2).map((tag) => <span key={tag}>#{tag}</span>)}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-zinc-400">
                      <span>{a.like_count}赞</span>
                    </div>
                  </div>
                </div>
              </article>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
