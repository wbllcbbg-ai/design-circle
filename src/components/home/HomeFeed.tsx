"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { getCover, getArticleCover } from "@/lib/images"
import { CaseCardSkeleton } from "@/components/ui/skeleton"
import { Heart, Star } from "lucide-react"
import type { FeedItem } from "@/lib/types"

const TABS = ["推荐", "整屋", "攻略", "设计师"]

export function HomeFeed({
  initialItems,
  initialHasMore,
}: {
  initialItems: FeedItem[]
  initialHasMore: boolean
}) {
  const [items, setItems] = useState<FeedItem[]>(initialItems)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [activeTab, setActiveTab] = useState("推荐")
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(initialHasMore)

  const loadFeed = async (pageNum: number, append: boolean) => {
    if (append) setLoadingMore(true)
    else setLoading(true)
    try {
      const res = await fetch(`/api/feed?page=${pageNum}&limit=10`)
      const data = await res.json()
      const feed: FeedItem[] = [
        ...(data.cases ?? []).map((c: any, i: number) => ({
          type: "case" as const,
          id: c.id,
          title: c.title,
          likes: c.like_count,
          style: c.style,
          area: c.area,
          category: "整屋",
          imgIndex: (pageNum - 1) * 10 + i,
          coverUrl: c.cover_url || null,
          firstImage: c.images?.[0] || null,
          designer_id: c.designer_id || null,
          designer: c.designer || null,
        })),
        ...(data.articles ?? []).map((a: any, i: number) => ({
          type: "article" as const,
          id: a.id,
          title: a.title,
          likes: a.like_count,
          style: a.category,
          area: 0,
          category: "攻略",
          imgIndex: (pageNum - 1) * 10 + i + 10,
          coverUrl: a.cover_url || null,
          firstImage: null,
          designer_id: a.author?.designer_id || null,
          designer: a.author?.designer_id
            ? { id: a.author.designer_id, name: a.author.nickname, type: a.author.role || "", user_id: a.author_id }
            : null,
        })),
      ]
      if (append) {
        setItems((prev) => [...prev, ...feed])
      } else {
        setItems(feed)
      }
      setHasMore(data.cases?.length >= 10 || data.articles?.length >= 10)
    } catch {}
    setLoading(false)
    setLoadingMore(false)
  }

  useEffect(() => {
    setPage(1)
    loadFeed(1, false)
  }, [activeTab])

  const filtered = activeTab === "推荐" ? items : items.filter((i) => i.category === activeTab)
  const leftCol: FeedItem[] = []
  const rightCol: FeedItem[] = []
  filtered.forEach((item, i) => {
    if (i % 2 === 0) leftCol.push(item)
    else rightCol.push(item)
  })

  return (
    <>
      {/* Tab 栏 */}
      <div className="flex items-center px-4 py-2.5 border-b border-black/[0.03] gap-0 overflow-x-auto scrollbar-hide">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`text-xs mr-4 pb-1.5 whitespace-nowrap transition-colors shrink-0 ${
              t === activeTab
                ? "text-accent font-semibold text-[13px] border-b-2 border-accent"
                : "text-muted"
            }`}
          >
            {t}
          </button>
        ))}
        <span className="ml-auto text-muted text-base leading-none cursor-pointer">☰</span>
      </div>

      {/* Loading (首次切换 Tab 时) */}
      {loading && (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {[1, 2, 3, 4].map((i) => <CaseCardSkeleton key={i} />)}
        </div>
      )}

      {/* 双列瀑布流 */}
      {!loading && filtered.length === 0 && (
        <div className="flex items-center justify-center py-20 text-xs text-muted">暂无内容</div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="flex gap-3 px-4 pt-3">
          <div className="flex-1 flex flex-col gap-3">
            {leftCol.map((item) => (
              <FeedCard key={`${item.type}-${item.id}`} item={item} />
            ))}
          </div>
          <div className="flex-1 flex flex-col gap-3">
            {rightCol.map((item) => (
              <FeedCard key={`${item.type}-${item.id}`} item={item} />
            ))}
          </div>
        </div>
      )}

      {/* 加载更多 */}
      {!loading && hasMore && (
        <div className="flex justify-center pt-4 pb-2">
          <button
            onClick={() => {
              const nextPage = page + 1
              setPage(nextPage)
              loadFeed(nextPage, true)
            }}
            disabled={loadingMore}
            className="px-6 py-2 text-xs font-medium text-muted bg-wash hover:bg-accent-light rounded-full transition-colors disabled:opacity-50"
          >
            {loadingMore ? "加载中..." : "加载更多"}
          </button>
        </div>
      )}
    </>
  )
}

function FeedCard({ item }: { item: FeedItem }) {
  const href = item.type === "case" ? `/cases/${item.id}` : `/articles/${item.id}`
  const isArticle = item.type === "article"
  const imgSrc = item.coverUrl || item.firstImage || (isArticle ? getArticleCover(item.imgIndex) : getCover(item.imgIndex))

  const heights = [220, 160, 200, 180, 190, 170, 210, 150, 230, 175, 195, 165]
  const h = heights[item.imgIndex % heights.length]

  return (
    <Link href={href} className="block group">
      <article className="bg-card rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04),0_0_0_0.5px_rgba(0,0,0,0.03)] transition-shadow hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)]">
        <div style={{ height: h }} className="relative overflow-hidden bg-wash">
          <Image
            src={imgSrc}
            alt={item.title}
            fill
            sizes="(max-width: 640px) 50vw, 33vw"
            className="object-cover group-hover:scale-[1.03] transition-transform duration-700"
          />
          {isArticle && (
            <div className="absolute top-2.5 left-2.5 px-2 py-0.5 bg-white/90 backdrop-blur rounded text-[10px] font-medium text-zinc-600">
              📖 文章
            </div>
          )}
          {item.designer && (
            <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1 bg-white/90 backdrop-blur rounded-lg px-2 py-1">
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-accent to-accent-light flex items-center justify-center text-white text-[7px] font-bold">
                {item.designer.name[0]}
              </div>
              <span className="text-[11px] font-semibold text-accent">{item.designer.name}</span>
              <Star size={9} className="text-amber-400 fill-amber-400" />
            </div>
          )}
        </div>
        <div className="px-3 pt-2.5 pb-3">
          <h3 className="text-[13px] font-semibold text-accent leading-snug line-clamp-2">{item.title}</h3>
          <div className="flex items-center justify-between mt-2">
            <span className="text-[11px] text-muted">{item.style}{item.area ? ` · ${item.area}㎡` : ""}</span>
            <span className="text-[11px] text-muted flex items-center gap-0.5">
              <Heart size={11} /> {item.likes}
            </span>
          </div>
        </div>
      </article>
    </Link>
  )
}
