"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

type Designer = {
  id: string
  name: string
  type: string
  description: string
  specialties: string[]
  avg_rating: number
  case_count: number
  is_verified: boolean
}

const TABS = ["全部", "设计师", "装修公司", "工长"]

const TYPE_MAP: Record<string, string> = {
  designer: "设计师",
  company: "公司",
  worker: "工长",
}

const TYPE_EN_MAP: Record<string, string> = {
  全部: "",
  设计师: "designer",
  装修公司: "company",
  工长: "worker",
}

export default function DesignersPage() {
  const [designers, setDesigners] = useState<Designer[]>([])
  const [loading, setLoading] = useState(true)
  const [active, setActive] = useState("全部")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 20

  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(page), q: search, type: TYPE_EN_MAP[active] })
    fetch(`/api/designers?${params}`)
      .then((r) => r.json())
      .then((res) => {
        setDesigners(res.designers ?? [])
        setTotal(res.total ?? 0)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [active, search, page])

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="bg-white dark:bg-zinc-900 min-h-screen">
      {/* 搜索栏 + Tab */}
      <div className="border-b border-zinc-100 dark:border-zinc-800">
        <div className="px-3 pt-2.5">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              placeholder="搜索设计师..."
              className="w-full pl-9 pr-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 rounded-xl border-0 outline-none focus:ring-1 focus:ring-zinc-300 dark:focus:ring-zinc-600 placeholder:text-zinc-400"
            />
          </div>
        </div>
        <div className="px-3 py-2 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => { setActive(tab); setPage(1) }}
                className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-medium ${
                  tab === active ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin w-6 h-6 border-2 border-zinc-300 border-t-zinc-600 rounded-full" />
        </div>
      )}

      {!loading && designers.length === 0 && (
        <div className="px-4 py-16 text-center text-sm text-zinc-400">
          {search ? "没有找到匹配的设计师" : "暂无设计师"}
        </div>
      )}

      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {!loading && designers.map((d, i) => {
          const typeLabel = TYPE_MAP[d.type] || d.type
          const hue = (i * 37 + 280) % 360
          return (
            <Link key={d.id} href={`/designers/${d.id}`} className="block px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="w-14 h-14 rounded-full shrink-0 flex items-center justify-center text-white text-sm font-medium" style={{ background: `linear-gradient(135deg, hsl(${hue}, 40%, 60%), hsl(${(hue + 50) % 360}, 35%, 50%))` }}>
                  {d.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{d.name}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">{typeLabel}</span>
                    {d.is_verified && <span className="text-[10px] text-green-600 dark:text-green-400">✓ 已认证</span>}
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">{d.description}</p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {(d.specialties ?? []).map((t) => <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500">{t}</span>)}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-400">
                    <span className="text-amber-500">{d.avg_rating}</span>
                    <span>{d.case_count}个案例</span>
                  </div>
                </div>
                <svg className="w-4 h-4 text-zinc-300 mt-1 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </div>
            </Link>
          )
        })}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 px-4 py-4 border-t border-zinc-100 dark:border-zinc-800">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="px-3 py-1.5 text-xs rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 disabled:opacity-40"
          >
            上一页
          </button>
          <span className="text-xs text-zinc-400">{page}/{totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="px-3 py-1.5 text-xs rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 disabled:opacity-40"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  )
}
