"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { getCover, getArticleCover } from "@/lib/images"
import { CaseCardSkeleton } from "@/components/ui/skeleton"

type FeedItem = {
  type: "case" | "article"
  id: string
  title: string
  likes: number
  style: string
  area: number
  category: string
  imgIndex: number
}

export default function HomePage() {
  const [items, setItems] = useState<FeedItem[]>([])
  const [activeTab, setActiveTab] = useState("为你推荐")

  useEffect(() => {
    fetch("/api/feed")
      .then((r) => r.json())
      .then((data) => {
        const feed: FeedItem[] = [
          ...(data.cases ?? []).map((c: any, i: number) => ({
            type: "case" as const,
            id: c.id,
            title: c.title,
            likes: c.like_count,
            style: c.style,
            area: c.area,
            category: "整屋案例",
            imgIndex: i,
          })),
          ...(data.articles ?? []).map((a: any, i: number) => ({
            type: "article" as const,
            id: a.id,
            title: a.title,
            likes: a.like_count,
            style: a.category,
            area: 0,
            category: "装修攻略",
            imgIndex: i + 10,
          })),
        ]
        feed.sort((a, b) => b.likes - a.likes)
        setItems(feed)
      })
  }, [])

  const TABS = ["为你推荐", "整屋案例", "装修攻略", "设计师", "建材测评", "避坑指南"]

  return (
    <div className="max-w-lg mx-auto">
      <div className="px-3 py-2.5 overflow-x-auto scrollbar-hide bg-white dark:bg-zinc-900 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex gap-2">
          {TABS.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTab(tag)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors ${
                tag === activeTab
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y divide-zinc-100 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
        {items.map((item, i) => (
          <FeedCard key={`${item.type}-${item.id}`} item={item} index={i} activeTab={activeTab} />
        ))}
        {items.length === 0 && (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {[1, 2, 3, 4].map((i) => <CaseCardSkeleton key={i} />)}
          </div>
        )}
      </div>
    </div>
  )
}

function FeedCard({ item, index, activeTab }: { item: FeedItem; index: number; activeTab: string }) {
  if (activeTab !== "为你推荐" && item.category !== activeTab) return null

  const href = item.type === "case" ? `/cases/${item.id}` : `/articles/${item.id}`
  const isArticle = item.type === "article"
  const imgSrc = isArticle ? getArticleCover(index) : getCover(index)

  return (
    <Link href={href} className="block">
      <article className="relative bg-white dark:bg-zinc-900">
        <div className="w-full aspect-[4/5] relative overflow-hidden bg-zinc-100 dark:bg-zinc-800">
          <img src={imgSrc} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
          {isArticle ? (
            <div className="absolute top-3 left-3 px-2 py-0.5 bg-white/90 dark:bg-zinc-900/90 backdrop-blur rounded text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
              📖 文章
            </div>
          ) : (
            <div className="absolute top-3 left-3 px-2 py-0.5 bg-white/90 dark:bg-zinc-900/90 backdrop-blur rounded text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
              {item.style} · {item.area}㎡
            </div>
          )}
        </div>

        <div className="px-3 pt-2 pb-3">
          <h2 className="text-sm font-medium leading-snug line-clamp-1">{item.title}</h2>
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {isArticle ? "设计圈" : "设计师"}
            </span>
            <span className="text-xs text-zinc-400">{item.likes}赞</span>
          </div>
        </div>
      </article>
    </Link>
  )
}
