"use client"

import { useState } from "react"
import Link from "next/link"

const HOT_TAGS = ["现代简约", "北欧风", "小户型", "老房改造", "预算10万", "厨房设计", "全屋定制", "水电改造"]
const SEARCH_HISTORY = ["现代简约客厅", "小户型收纳", "杭州装修公司", "北欧风配色"]

const SEARCH_RESULTS = [
  { type: "case", id: "c1", title: "130㎡现代简约，三代同堂", author: "张丽娜", role: "设计师", likes: 328, comments: 24 },
  { type: "case", id: "c2", title: "85㎡北欧风，收纳教科书", author: "李明", role: "设计师", likes: 256, comments: 18 },
  { type: "article", id: "a1", title: "2025最受欢迎装修风格TOP10", author: "设计圈", role: null, likes: 1520, comments: 89 },
  { type: "case", id: "c3", title: "95㎡日式原木风，治愈系小家", author: "陈薇", role: "设计师", likes: 289, comments: 21 },
]

export default function SearchPage() {
  const [query, setQuery] = useState("")
  const [showResults, setShowResults] = useState(false)
  const [history, setHistory] = useState(SEARCH_HISTORY)

  const handleSearch = (q: string) => {
    setQuery(q)
    if (q.trim()) {
      setHistory((prev) => [q, ...prev.filter((h) => h !== q)].slice(0, 8))
      setShowResults(true)
    }
  }

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
              <button onClick={() => { setQuery(""); setShowResults(false) }} className="text-zinc-400">
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
        /* 搜索结果 */
        <div>
          <div className="px-4 py-2 text-xs text-zinc-400">找到 {SEARCH_RESULTS.length} 个结果</div>
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {SEARCH_RESULTS.map((item, i) => {
              const hue = (i * 47) % 360
              const href = item.type === "case" ? `/cases/${item.id}` : `/articles/${item.id}`
              return (
                <Link key={`${item.type}-${item.id}`} href={href} className="block px-4 py-3">
                  <div className="flex gap-3">
                    <div
                      className="w-20 h-20 rounded-lg shrink-0"
                      style={{ background: `linear-gradient(135deg, hsl(${hue}, 35%, 75%), hsl(${(hue + 60) % 360}, 30%, 65%))` }}
                    />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium line-clamp-2 leading-snug">{item.title}</h3>
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <span className="text-xs text-zinc-400">{item.author}</span>
                        {item.role && (
                          <span className="text-[10px] px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-400">{item.role}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-zinc-400 mt-1.5">
                        <span>{item.likes}赞</span>
                        <span>{item.comments}评论</span>
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="px-4 pt-4">
          {/* 搜索历史 */}
          {history.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium">搜索历史</h2>
                <button
                  onClick={() => setHistory([])}
                  className="text-xs text-zinc-400"
                >
                  清除
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {history.map((h) => (
                  <button
                    key={h}
                    onClick={() => handleSearch(h)}
                    className="px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-xs text-zinc-600 dark:text-zinc-400"
                  >
                    {h}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 热门搜索 */}
          <div>
            <h2 className="text-sm font-medium mb-3">热门搜索</h2>
            <div className="flex flex-wrap gap-2">
              {HOT_TAGS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleSearch(tag)}
                  className="px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-600 dark:text-zinc-400"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
