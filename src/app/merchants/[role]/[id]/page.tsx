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
  const [cases, setCases] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  // 留言表单
  const [showMsgForm, setShowMsgForm] = useState(false)
  const [msgContent, setMsgContent] = useState("")
  const [msgContact, setMsgContact] = useState("")
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const sendMsg = async () => {
    if (!msgContent.trim()) return
    setSending(true)
    const res = await fetch("/api/merchant-messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        merchant_type: role,
        merchant_id: id,
        content: msgContent,
        contact_info: msgContact || null,
      }),
    })
    setSending(false)
    if (res.ok) {
      setSent(true)
      setMsgContent("")
      setMsgContact("")
    } else {
      const err = await res.json().catch(() => ({}))
      alert(err.error || "发送失败")
    }
  }

  useEffect(() => {
    Promise.all([
      fetch(`/api/merchants/${role}/${id}`).then((r) => r.json()),
      fetch(`/api/merchants/${role}/${id}/credit`).then((r) => r.json()),
      // 材料商加载已通过的关联案例（公开 API）
      role === "supplier"
        ? fetch(`/api/supplier-cases/by-supplier/${id}`).then((r) => r.json()).catch(() => ({ cases: [] }))
        : Promise.resolve({ cases: [] }),
    ]).then(([detailData, creditData, caseData]) => {
      setMerchant(detailData.merchant || null)
      setCredit(creditData.credit || null)
      setCases(caseData.cases || [])
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

        {/* 应用案例（材料商关联的真实案例）—— 产品展示区 */}
        {cases.length > 0 && (
          <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-100 dark:border-zinc-800">
            <h2 className="text-sm font-medium mb-3">🏠 产品应用案例</h2>
            <div className="grid grid-cols-2 gap-2">
              {cases.map((sc: any) => {
                const c = sc.case
                if (!c) return null
                return (
                  <Link
                    key={sc.id}
                    href={`/cases/${c.id}`}
                    className="block rounded-lg overflow-hidden border border-zinc-100 dark:border-zinc-800"
                  >
                    <div className="aspect-[4/3] bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                      {c.cover_url || (c.images && c.images[0]) ? (
                        <SafeImage
                          src={c.cover_url || c.images[0]}
                          alt={c.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-zinc-300 text-xs">无图</div>
                      )}
                    </div>
                    <p className="text-xs p-2 truncate">{c.title}</p>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* 咨询入口 */}
        <button
          onClick={() => { setShowMsgForm(!showMsgForm); setSent(false) }}
          className="block w-full p-4 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-xl text-center text-sm font-medium"
        >
          {showMsgForm ? "收起" : "联系咨询"}
        </button>

        {/* 留言表单 */}
        {showMsgForm && (
          <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 space-y-2">
            {sent ? (
              <p className="text-sm text-green-600 text-center py-4">
                ✓ 留言已发送，{merchant.name} 会在工作台看到你的咨询
              </p>
            ) : (
              <>
                <textarea
                  value={msgContent}
                  onChange={(e) => setMsgContent(e.target.value)}
                  placeholder={`向${merchant.name}描述你的需求，如：我想咨询...`}
                  className="w-full text-sm px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 outline-none resize-none"
                  rows={3}
                />
                <input
                  value={msgContact}
                  onChange={(e) => setMsgContact(e.target.value)}
                  placeholder="联系方式（选填，如手机/微信）"
                  className="w-full text-sm px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 outline-none"
                />
                <button
                  onClick={sendMsg}
                  disabled={!msgContent.trim() || sending}
                  className="w-full text-sm py-2 rounded-lg bg-blue-500 text-white disabled:opacity-50"
                >
                  {sending ? "发送中..." : "发送留言"}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
