"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { SafeImage } from "@/components/ui/safe-image"

const ROLE_LABEL: Record<string, string> = {
  supplier: "材料商",
  contractor: "施工方",
  inspector: "监理",
}

type Merchant = {
  id: string
  name: string
  logo_url: string | null
  description: string | null
  is_verified: boolean
  avg_rating: number
  review_count: number
  credit_score: number
  [key: string]: unknown
}

type Credit = {
  credit_score: number
  case_count?: number
  delay_count?: number
  completed_projects?: number
  pass_rate?: number
  rework_rate?: number
  dispute_count?: number
  inspection_count?: number
  punctuality_rate?: number
  [key: string]: unknown
}

export default function MerchantDetailPage() {
  const params = useParams<{ role: string; id: string }>()
  const { role, id } = params
  const [merchant, setMerchant] = useState<Merchant | null>(null)
  const [credit, setCredit] = useState<Credit | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`/api/merchants/${role}?limit=50`).then((r) => r.json()), // 列表里找（简化，MVP）
      fetch(`/api/merchants/${role}/${id}/credit`).then((r) => r.json()),
    ]).then(([listData, creditData]) => {
      const m = (listData.merchants || []).find((x: Merchant) => x.id === id)
      setMerchant(m || null)
      setCredit(creditData.credit || null)
      setLoading(false)
    })
  }, [role, id])

  if (loading) return <div className="p-8 text-center text-zinc-400">加载中…</div>
  if (!merchant) return <div className="p-8 text-center text-zinc-400">未找到该{ROLE_LABEL[role] || "商户"}</div>

  // 各角色的特色数据
  const stats: { label: string; value: string | number }[] = []
  if (role === "supplier") {
    stats.push(
      { label: "关联案例", value: credit?.case_count ?? 0 },
      { label: "延迟次数", value: credit?.delay_count ?? 0 },
    )
  } else if (role === "contractor") {
    stats.push(
      { label: "完工数", value: credit?.completed_projects ?? 0 },
      { label: "验收通过率", value: credit?.pass_rate ? `${credit.pass_rate}%` : "—" },
      { label: "整改率", value: credit?.rework_rate ? `${credit.rework_rate}%` : "—" },
      { label: "纠纷数", value: credit?.dispute_count ?? 0 },
    )
  } else if (role === "inspector") {
    stats.push(
      { label: "验收数", value: credit?.inspection_count ?? 0 },
      { label: "准时率", value: credit?.punctuality_rate ? `${credit.punctuality_rate}%` : "—" },
    )
  }

  return (
    <div className="pb-20">
      {/* 头部信息卡 */}
      <div className="bg-gradient-to-r from-zinc-900 to-zinc-700 dark:from-zinc-800 dark:to-zinc-900 p-5 text-white">
        <div className="flex items-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center overflow-hidden shrink-0">
            {merchant.logo_url ? (
              <SafeImage src={merchant.logo_url} alt={merchant.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-2xl">{merchant.name?.[0] || "?"}</span>
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-lg font-semibold truncate">{merchant.name}</h1>
              {merchant.is_verified && <span className="text-xs">✓ 平台认证</span>}
            </div>
            <p className="text-xs text-white/60 mt-0.5">{ROLE_LABEL[role] || "商户"}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 mt-4">
          <div>
            <p className="text-xl font-bold">{credit?.credit_score ?? "—"}</p>
            <p className="text-[10px] text-white/50">🟢 信用分</p>
          </div>
          {merchant.avg_rating > 0 && (
            <div>
              <p className="text-xl font-bold">{merchant.avg_rating}</p>
              <p className="text-[10px] text-white/50">评分</p>
            </div>
          )}
          <div>
            <p className="text-xl font-bold">{merchant.review_count}</p>
            <p className="text-[10px] text-white/50">评价数</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* 简介 */}
        {merchant.description && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-100 dark:border-zinc-800">
            <h2 className="text-sm font-medium mb-2">简介</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed whitespace-pre-line">
              {merchant.description}
            </p>
          </div>
        )}

        {/* 信用数据 */}
        {stats.length > 0 && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-100 dark:border-zinc-800">
            <h2 className="text-sm font-medium mb-3">平台验证数据</h2>
            <div className="grid grid-cols-4 gap-2">
              {stats.map((s) => (
                <div key={s.label} className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-3 text-center">
                  <p className="text-base font-semibold">{s.value}</p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
            <p className="text-[10px] text-zinc-400 mt-2">🟢 以上数据均来自平台见证的真实交易</p>
          </div>
        )}

        {/* 咨询入口 */}
        <Link
          href="/messages"
          className="block p-4 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-xl text-center text-sm font-medium"
        >
          联系咨询
        </Link>
      </div>
    </div>
  )
}
