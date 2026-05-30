"use client"

import { useState, useCallback } from "react"
import Link from "next/link"

const HOT_TAGS = ["现代简约", "北欧风", "小户型", "老房改造", "预算10万", "厨房设计", "全屋定制", "水电改造"]

type SearchResult = {
  cases: Array<{ id: string; title: string; description: string; cover_url: string; style: string; area: number; budget: number; like_count: number }>
  articles: Array<{ id: string; title: string; summary: string; cover_url: string; category: string; tags: string[]; like_count: number; published_at: string }>
  designers: Array<{ id: string; name: string; logo_url: string; description: string; type: string; specialties: string[]; avg_rating: number; review_count: number }>
}

export default function SearchPage() {
  const [query, setQuery] = useState("")
  const [showResults, setShowResults] = useState(false)
  const [results, setResults] = useState<SearchResult | null>(null)
  const [searching, setSearching] = useState(false)
  const [history, setHistory] = useState<string[]>([])

  const handleSearch = useCallback(async (q: string) => {
    setQuery(q)
    if (!q.trim()) { setShowResults(false); return }

    setSearching(true)
    setHistory((prev) => [q, ...prev.filter((h) => h !== q)].slice(0, 8))

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setResults(data.results)
    } catch {
      setResults({ cases: [], articles: [], designers: [] })
    }
    setShowResults(true)
    setSearching(false)
  }, [])

  const totalCount = (results?.cases.length ?? 0) + (results?.articles.length ?? 0) + (results?.designers.length ?? 0)

  // Header 式的搜索框（自动聚焦效果）
  return (
    <div className="bg-white dark:bg-zinc-900 min-h-screen">
      {/* 搜索框 + 取消 */}
      <div className="sticky top-0 bg-white/90 dark:bg-zinc-900/90 backdrop-blur z-10 border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex items-center gap-2 px-4 h-12">
          <div className="flex-1 flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-full px-3.5 h-9">
            <svg className="w-4 h-4 text-zinc-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                if (!e.target.value) setShowResults(false)
              }}
              onFocus={() => query && setShowResults(true)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch(query)}
              placeholder="搜索案例、设计师、文章..."
              className="flex-1 bg-transparent text-sm outline-none px-2 placeholder:text-zinc-400"
              autoFocus
            />
            {query && (
              <button onClick={() => { setQuery(""); setShowResults(false); setResults(null) }} className="text-zinc-400">
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
          <Link href="/" className="text-sm text-zinc-500 shrink-0">取消</Link>
        </div>
      </div>

      {showResults ? (
        <div>
          {searching ? (
            <div className="px-4 py-8 text-center text-sm text-zinc-400">搜索中...</div>
          ) : (
            <>
              <div className="px-4 py-2 text-xs text-zinc-400">找到 {totalCount} 个结果</div>
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {/* 案例结果 */}
                {(results?.cases ?? []).map((item) => {
                  const hue = (Math.abs(item.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) * 47) % 360
                  return (
                    <Link key={`case-${item.id}`} href={`/cases/${item.id}`} className="block px-4 py-3">
                      <div className="flex gap-3">
                        <div className="w-20 h-20 rounded-lg shrink-0 overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                          {item.cover_url ? (
                            <img src={item.cover_url} alt={item.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full" style={{ background: `linear-gradient(135deg, hsl(${hue}, 35%, 75%), hsl(${(hue + 60) % 360}, 30%, 65%))` }} />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-medium line-clamp-2 leading-snug">{item.title}</h3>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            {item.style && <span className="text-xs text-zinc-400">{item.style}</span>}
                            {item.area && <span className="text-xs text-zinc-400">· {item.area}㎡</span>}
                          </div>
                          <div className="text-xs text-zinc-400 mt-1.5">{item.like_count}赞</div>
                        </div>
                      </div>
                    </Link>
                  )
                })}

                {/* 文章结果 */}
                {(results?.articles ?? []).map((item) => {
                  const hue = (Math.abs(item.id.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) * 47) % 360
                  return (
                    <Link key={`article-${item.id}`} href={`/articles/${item.id}`} className="block px-4 py-3">
                      <div className="flex gap-3">
                        <div
                          className="w-20 h-20 rounded-lg shrink-0 flex items-center justify-center text-white text-[10px]"
                          style={{ background: `linear-gradient(135deg, hsl(${hue}, 35%, 75%), hsl(${(hue + 60) % 360}, 30%, 65%))` }}
                        >
                          {item.category || "文章"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-medium line-clamp-2 leading-snug">{item.title}</h3>
                          {item.summary && <p className="text-xs text-zinc-400 mt-1 line-clamp-1">{item.summary}</p>}
                          <div className="text-xs text-zinc-400 mt-1.5">{item.like_count}赞</div>
                        </div>
                      </div>
                    </Link>
                  )
                })}

                {/* 设计师结果 */}
                {(results?.designers ?? []).map((item) => (
                  <Link key={`designer-${item.id}`} href={`/designers/${item.id}`} className="block px-4 py-3">
                    <div className="flex gap-3 items-center">
                      <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-700 shrink-0 flex items-center justify-center text-sm text-zinc-500 font-medium">
                        {item.name?.charAt(0) || "设"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium">{item.name}</span>
                          <span className="text-[10px] px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-400">{item.type === "designer" ? "设计师" : item.type === "company" ? "公司" : "工长"}</span>
                        </div>
                        <div className="text-xs text-zinc-400 mt-0.5">
                          {item.specialties?.slice(0, 3).join(" · ")}
                        </div>
                      </div>
                      <div className="text-xs text-zinc-400 text-right">
                        <div>{item.avg_rating ? `⭐ ${item.avg_rating}` : "--"}</div>
                        <div>{item.review_count}条评价</div>
                      </div>
                    </div>
                  </Link>
                ))}

                {totalCount === 0 && (
                  <div className="px-4 py-8 text-center text-sm text-zinc-400">
                    没有找到 "{query}" 相关的结果
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="px-4 pt-4">
          {/* 搜索历史 */}
          {history.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium">搜索历史</h2>
                <button onClick={() => setHistory([])} className="text-xs text-zinc-400">清除</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {history.map((h) => (
                  <button key={h} onClick={() => handleSearch(h)} className="px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-600 dark:text-zinc-400">{h}</button>
                ))}
              </div>
            </div>
          )}

          {/* 热门搜索 */}
          <div>
            <h2 className="text-sm font-medium mb-3">热门搜索</h2>
            <div className="flex flex-wrap gap-2">
              {HOT_TAGS.map((tag) => (
                <button key={tag} onClick={() => handleSearch(tag)} className="px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-600 dark:text-zinc-400">{tag}</button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
