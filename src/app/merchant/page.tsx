"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

type Identity = {
  id: string
  name: string
  [key: string]: unknown
}

type IdentityMap = {
  designer?: Identity
  supplier?: Identity
  contractor?: Identity
  inspector?: Identity
}

const ROLE_LABEL: Record<string, string> = {
  designer: "设计师工作台",
  supplier: "材料商商家中心",
  contractor: "施工方工作台",
  inspector: "监理工作台",
}

export default function MerchantPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [identities, setIdentities] = useState<IdentityMap>({})
  const [activeRole, setActiveRole] = useState<string | null>(null)
  const [nickname, setNickname] = useState("")

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = "/login"
        return
      }
      const res = await fetch("/api/my-identity")
      if (res.ok) {
        const data = await res.json()
        setIdentities(data.identities || {})
        setNickname(data.nickname || "")
        const roles = Object.keys(data.identities || {})
        if (roles.length > 0) setActiveRole(roles[0])
      }
      setLoading(false)
    }
    load().finally(() => setLoading(false))
  }, [supabase])

  if (loading) {
    return <div className="p-8 text-center text-zinc-400">加载中…</div>
  }

  const roles = Object.keys(identities)

  if (roles.length === 0) {
    return (
      <div className="p-4 pb-20">
        <div className="text-center py-16">
          <p className="text-zinc-500 text-sm mb-2">你还没有商户身份</p>
          <p className="text-zinc-400 text-xs mb-6">申请入驻后即可使用工作台</p>
          <Link
            href="/apply"
            className="inline-block text-sm px-5 py-2 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
          >
            申请入驻
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-20">
      {/* 头部信息卡 */}
      <div className="bg-gradient-to-r from-zinc-900 to-zinc-700 dark:from-zinc-800 dark:to-zinc-900 p-5 text-white">
        <p className="text-xs text-white/60">你好，{nickname}</p>
        <h1 className="text-lg font-semibold mt-1">
          {activeRole ? ROLE_LABEL[activeRole] : "工作台"}
        </h1>

        {/* 多身份切换 */}
        {roles.length > 1 && (
          <div className="flex gap-2 mt-3">
            {roles.map((r) => (
              <button
                key={r}
                onClick={() => setActiveRole(r)}
                className={`text-xs px-3 py-1 rounded-full ${
                  activeRole === r
                    ? "bg-white text-zinc-900"
                    : "bg-white/20 text-white"
                }`}
              >
                {ROLE_LABEL[r]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 按角色渲染对应模块 */}
      {activeRole === "supplier" && identities.supplier && (
        <SupplierDashboard supplierId={identities.supplier.id} name={identities.supplier.name} />
      )}
      {activeRole === "contractor" && identities.contractor && (
        <ContractorDashboard contractorId={identities.contractor.id} name={identities.contractor.name} />
      )}
      {activeRole === "inspector" && identities.inspector && (
        <InspectorDashboard inspectorId={identities.inspector.id} name={identities.inspector.name} />
      )}
      {activeRole === "designer" && (
        <div className="p-4">
          <Link
            href="/dashboard"
            className="block p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800"
          >
            <p className="text-sm font-medium">设计师工作台</p>
            <p className="text-xs text-zinc-400 mt-1">点击进入完整工作台</p>
          </Link>
        </div>
      )}
    </div>
  )
}

// ============ 材料商商家中心 ============
function SupplierDashboard({ supplierId, name }: { supplierId: string; name: string }) {
  const [credit, setCredit] = useState<Record<string, unknown> | null>(null)
  const [deposits, setDeposits] = useState<{ amount: number; status: string }[]>([])

  useEffect(() => {
    fetch(`/api/merchants/supplier/${supplierId}/credit`)
      .then((r) => r.json())
      .then((d) => setCredit(d.credit || null))
      .catch(() => {})
    // 保证金状态（用户自己的，通过 admin 表查自己）
    // 简化：前端展示信用，保证金状态在管理后台维护
  }, [supplierId])

  return (
    <div className="p-4 space-y-4">
      {/* 信用看板 */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-100 dark:border-zinc-800">
        <h2 className="text-sm font-medium mb-3">{name} · 信用概览</h2>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "信用分", value: credit?.credit_score ?? "—" },
            { label: "关联案例", value: credit?.case_count ?? 0 },
            { label: "好评率", value: credit?.review_count ? `${credit.avg_rating}分` : "—" },
            { label: "延迟次数", value: credit?.delay_count ?? 0 },
          ].map((item) => (
            <div key={item.label} className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-3 text-center">
              <p className="text-base font-semibold">{String(item.value)}</p>
              <p className="text-[10px] text-zinc-400 mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 保证金状态提示 */}
      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-100 dark:border-amber-900/30">
        <p className="text-xs text-amber-700 dark:text-amber-400">
          ⚠️ 保证金需线下对公缴纳，缴纳后联系平台开通完整功能。平台不托管资金。
        </p>
      </div>

      {/* 业务入口 */}
      <div className="space-y-2">
        <Link href="/publish" className="block p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800">
          <p className="text-sm font-medium">📦 产品案例关联</p>
          <p className="text-xs text-zinc-400 mt-1">申请关联平台案例，展示产品应用效果</p>
        </Link>
        <Link href="/messages" className="block p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800">
          <p className="text-sm font-medium">💬 客户咨询</p>
          <p className="text-xs text-zinc-400 mt-1">查看业主咨询消息</p>
        </Link>
      </div>
    </div>
  )
}

// ============ 施工方工作台 ============
function ContractorDashboard({ contractorId, name }: { contractorId: string; name: string }) {
  const [credit, setCredit] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    fetch(`/api/merchants/contractor/${contractorId}/credit`)
      .then((r) => r.json())
      .then((d) => setCredit(d.credit || null))
      .catch(() => {})
  }, [contractorId])

  return (
    <div className="p-4 space-y-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-100 dark:border-zinc-800">
        <h2 className="text-sm font-medium mb-3">{name} · 信用概览</h2>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "信用分", value: credit?.credit_score ?? "—" },
            { label: "完工数", value: credit?.completed_projects ?? 0 },
            { label: "验收通过率", value: credit?.pass_rate ? `${credit.pass_rate}%` : "—" },
            { label: "整改率", value: credit?.rework_rate ? `${credit.rework_rate}%` : "—" },
            { label: "纠纷数", value: credit?.dispute_count ?? 0 },
            { label: "评分", value: credit?.avg_rating ? `${credit.avg_rating}分` : "—" },
          ].map((item) => (
            <div key={item.label} className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-3 text-center">
              <p className="text-base font-semibold">{String(item.value)}</p>
              <p className="text-[10px] text-zinc-400 mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-100 dark:border-amber-900/30">
        <p className="text-xs text-amber-700 dark:text-amber-400">
          ⚠️ 保证金需线下对公缴纳。施工款由业主与你直接结算，平台不托管资金。
        </p>
      </div>

      <div className="space-y-2">
        <Link href="/messages" className="block p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800">
          <p className="text-sm font-medium">📋 待办项目</p>
          <p className="text-xs text-zinc-400 mt-1">查看分配到的施工项目</p>
        </Link>
      </div>
    </div>
  )
}

// ============ 监理工作台 ============
function InspectorDashboard({ inspectorId, name }: { inspectorId: string; name: string }) {
  const [credit, setCredit] = useState<Record<string, unknown> | null>(null)
  const [assignments, setAssignments] = useState<{ id: string; project?: { title: string } }[]>([])

  useEffect(() => {
    fetch(`/api/merchants/inspector/${inspectorId}/credit`)
      .then((r) => r.json())
      .then((d) => setCredit(d.credit || null))
      .catch(() => {})
    fetch(`/api/inspector-assignments?as=inspector`)
      .then((r) => r.json())
      .then((d) => setAssignments(d.assignments ?? []))
      .catch(() => {})
  }, [inspectorId])

  const activeAssignments = assignments.filter((a) => a.project)

  return (
    <div className="p-4 space-y-4">
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-100 dark:border-zinc-800">
        <h2 className="text-sm font-medium mb-3">{name} · 信用概览</h2>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "信用分", value: credit?.credit_score ?? "—" },
            { label: "验收数", value: credit?.inspection_count ?? 0 },
            { label: "准时率", value: credit?.punctuality_rate ? `${credit.punctuality_rate}%` : "—" },
          ].map((item) => (
            <div key={item.label} className="bg-zinc-50 dark:bg-zinc-800 rounded-lg p-3 text-center">
              <p className="text-base font-semibold">{String(item.value)}</p>
              <p className="text-[10px] text-zinc-400 mt-0.5">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 待验收项目 */}
      <div>
        <h2 className="text-sm font-medium mb-2">待验收项目（{activeAssignments.length}）</h2>
        {activeAssignments.length === 0 ? (
          <p className="text-xs text-zinc-400 py-6 text-center bg-white dark:bg-zinc-900 rounded-xl">
            暂无派单
          </p>
        ) : (
          <div className="space-y-2">
            {activeAssignments.map((a) => (
              <Link
                key={a.id}
                href={`/projects/${(a as { project_id?: string }).project_id ?? ""}`}
                className="block p-3 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800"
              >
                <p className="text-sm font-medium">{a.project?.title || "项目"}</p>
                <p className="text-xs text-zinc-400 mt-1">点击进入验收</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
