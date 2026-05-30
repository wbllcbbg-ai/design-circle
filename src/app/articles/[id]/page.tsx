"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { use } from "react"

type Article = {
  id: string
  title: string
  content: string
  summary: string
  category: string
  tags: string[]
  view_count: number
  like_count: number
  published_at: string
}

export default function ArticleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/articles/${id}`)
      .then((r) => r.json())
      .then((res) => {
        setArticle(res.article)
        setLoading(false)
      })
  }, [id])

  if (loading) {
    return <div className="bg-white dark:bg-zinc-900 min-h-screen flex items-center justify-center text-sm text-zinc-400">加载中...</div>
  }

  if (!article) return null

  return (
    <article className="bg-white dark:bg-zinc-900 min-h-screen">
      <div className="w-full aspect-[4/3] relative" style={{ background: "linear-gradient(135deg, hsl(230, 30%, 70%), hsl(180, 25%, 60%))" }}>
        <Link href="/articles" className="absolute top-4 left-4 w-8 h-8 rounded-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur flex items-center justify-center">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
        <div className="absolute top-4 right-4 px-2 py-0.5 bg-white/90 dark:bg-zinc-900/90 backdrop-blur rounded text-[11px] font-medium text-zinc-700 dark:text-zinc-300">{article.category}</div>
      </div>

      <div className="px-4 pt-4 pb-6">
        <h1 className="text-lg font-semibold leading-snug">{article.title}</h1>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-xs text-zinc-400">{article.published_at ? new Date(article.published_at).toLocaleDateString() : ""}</span>
        </div>

        <div className="flex items-center gap-1.5 mt-2">
          {(article.tags ?? []).map((tag) => <span key={tag} className="text-xs text-zinc-400">#{tag}</span>)}
        </div>

        <div className="mt-4 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-line">{article.content}</div>

        <div className="mt-6 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
          <p className="text-xs text-zinc-400">本文由AI基于平台数据生成，仅供参考</p>
        </div>

        <div className="flex items-center gap-6 mt-4 py-3 border-t border-zinc-100 dark:border-zinc-800">
          <button className="flex items-center gap-1.5 text-sm text-zinc-500">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M7 22V4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v18l-4-2.5Z" />
            </svg>
            {article.like_count}
          </button>
          <button className="flex items-center gap-1.5 text-sm text-zinc-500">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 10v4m0 0v4m0-4h4m-4 0H8" />
            </svg>
            收藏
          </button>
        </div>
      </div>
    </article>
  )
}
