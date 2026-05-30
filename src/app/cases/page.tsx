"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"

type CaseItem = {
  id: string
  title: string
  style: string
  area: number
  budget: number
  cover_url: string
}

const STYLES = ["全部", "现代简约", "北欧风", "新中式", "日式", "轻奢", "混搭"]

export default function CasesPage() {
  const [cases, setCases] = useState<CaseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [activeStyle, setActiveStyle] = useState("全部")

  useEffect(() => {
    const params = new URLSearchParams()
    if (activeStyle !== "全部") params.set("style", activeStyle)
    fetch(`/api/cases?${params}`)
      .then(r => r.json())
      .then(data => {
        setCases(data.cases ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [activeStyle])

  return (
    <div className="p-4">
      {/* 筛选栏 */}
      <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
        {STYLES.map((tag) => (
          <button key={tag} onClick={() => setActiveStyle(tag)}>
            <Badge variant={tag === activeStyle ? "default" : "secondary"} className="shrink-0 cursor-pointer">
              {tag}
            </Badge>
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin w-6 h-6 border-2 border-zinc-300 border-t-zinc-600 rounded-full" />
        </div>
      )}

      {!loading && cases.length === 0 && (
        <p className="text-xs text-zinc-400 text-center py-16">暂无案例</p>
      )}

      {!loading && (
        <div className="grid grid-cols-2 gap-3">
          {cases.map((item) => {
            const hue = (parseInt(item.id?.slice(0, 8) || "0", 16) || (Math.random() * 360)) % 360
            return (
              <Link key={item.id} href={`/cases/${item.id}`}>
                <div className="rounded-xl overflow-hidden bg-zinc-50 dark:bg-zinc-800">
                  <div
                    className="w-full aspect-[4/3]"
                    style={item.cover_url ? { background: `url(${item.cover_url}) center/cover` } : { background: `linear-gradient(135deg, hsl(${hue}, 35%, 75%), hsl(${(hue + 60) % 360}, 30%, 65%))` }}
                  />
                  <div className="p-2.5">
                    <h3 className="text-sm font-medium line-clamp-1">{item.title}</h3>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-zinc-400">
                      <span>{item.style}</span>
                      <span>·</span>
                      <span>{item.area}㎡</span>
                      {item.budget && <><span>·</span><span>{item.budget}万</span></>}
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
