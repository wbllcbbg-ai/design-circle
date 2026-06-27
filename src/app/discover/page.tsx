"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Search } from "lucide-react"
import { SafeImage } from "@/components/ui/safe-image"
import { PageHeader } from "@/components/layout/page-header"

type Merchant = {
  id: string
  name: string
  logo_url: string | null
  description: string | null
  is_verified: boolean
  avg_rating: number
  review_count: number
  credit_score: number
  category?: string
  case_count?: number
  completed_projects?: number
  inspection_count?: number
  [key: string]: unknown
}

const ROLE_TABS = [
  { key: "designer", label: "设计师" },
  { key: "supplier", label: "材料商" },
  { key: "contractor", label: "施工方" },
  { key: "inspector", label: "监理" },
]

const CATEGORY_LABEL: Record<string, string> = {
  tile: "瓷砖", furniture: "定制家具", appliance: "电器", other: "其他",
}

export default function DiscoverPage() {
  const [role, setRole] = useState("designer")
  const [merchants, setMerchants] = useState<Merchant[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState("")

  useEffect(() => {
    setLoading(true)
    const qs = q ? `&q=${encodeURIComponent(q)}` : ""
    fetch(`/api/merchants/${role}?limit=30${qs}`)
      .then((r) => r.json())
      .then((data) => setMerchants(data.merchants ?? []))
      .finally(() => setLoading(false))
  }, [role, q])

  return (
    <div className="pb-20">
      <PageHeader title="发现" />
      {/* 搜索栏 */}
      <div className="px-4 pt-4">
        <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 rounded-full px-3 py-2">
          <Search className="w-4 h-4 text-zinc-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="搜索名称..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
          />
        </div>
      </div>

      {/* 角色切换 Tab */}
      <div className="px-4 pt-3">
        <div className="flex gap-2 overflow-x-auto">
          {ROLE_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setRole(tab.key); setQ("") }}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium ${
                role === tab.key
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                  : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 列表 */}
      <div className="px-4 pt-3 space-y-2">
        {loading ? (
          <div className="text-center text-zinc-400 py-10">加载中…</div>
        ) : merchants.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-zinc-400 text-sm">暂无已认证的{ROLE_TABS.find((t) => t.key === role)?.label}</p>
            <p className="text-zinc-400 text-xs mt-1">注册成为{ROLE_TABS.find((t) => t.key === role)?.label}，展示你的专业服务</p>
          </div>
        ) : (
          merchants.map((m) => (
            <Link
              key={m.id}
              href={
                role === "designer" ? `/designers/${m.id}` :
                `/merchants/${role}/${m.id}`
              }
              className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800"
            >
              {/* 头像 */}
              <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0 overflow-hidden">
                {m.logo_url ? (
                  <SafeImage src={m.logo_url} alt={m.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-zinc-400 text-lg">{m.name?.[0] || "?"}</span>
                )}
              </div>

              {/* 信息 */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="text-sm font-medium truncate">{m.name}</p>
                  {m.is_verified && <span className="text-xs text-green-500">✓</span>}
                </div>
                <p className="text-xs text-zinc-400 truncate mt-0.5">
                  {m.description || (role === "supplier" ? CATEGORY_LABEL[m.category || ""] || "材料商" : "")}
                </p>
                {/* 信用数据 */}
                <div className="flex items-center gap-3 mt-1 text-[10px] text-zinc-400">
                  <span>信用 {m.credit_score}</span>
                  {m.avg_rating > 0 && <span>评分 {m.avg_rating}</span>}
                  {role === "designer" && <span>{m.case_count ?? 0} 案例</span>}
                  {role === "contractor" && <span>{m.completed_projects ?? 0} 完工</span>}
                  {role === "inspector" && <span>{m.inspection_count ?? 0} 验收</span>}
                </div>
              </div>
              <svg className="w-4 h-4 text-zinc-300 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
