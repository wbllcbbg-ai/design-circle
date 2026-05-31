"use client"

import { useEffect, useState } from "react"

const ROLE_BADGES: Record<string, string> = {
  owner: "🏠 业主",
  designer: "🎨 设计师",
  worker: "🔧 工长",
  company: "🏢 公司",
}

export default function EcoPage() {
  const [data, setData] = useState<any>(null)
  const [scheduled, setScheduled] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [overviewRes, scheduledRes] = await Promise.all([
          fetch("/api/admin/eco/overview"),
          fetch("/api/admin/scheduled?limit=24"),
        ])
        const json = await overviewRes.json()
        const sched = await scheduledRes.json()
        setData(json)
        setScheduled(sched.scheduled ?? [])
      } catch {
        setData({ overview: {}, ratios: {}, virtualUsers: [], alerts: { blocking: [], warning: [] }, recentLogs: [] })
        setScheduled([])
      }
      setLoading(false)
    }
    load()
  }, [])

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-sm text-zinc-400">加载中...</div>
  }

  const { overview, ratios, virtualUsers, alerts, recentLogs } = data || {}
  const totalContents = overview?.totalContents || 0
  const todayTotal = overview?.todayTotal || 0

  return (
    <div className="p-4 space-y-5">
      {/* 概览卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="内容总量" value={totalContents} color="text-blue-600" />
        <StatCard
          label="虚拟人"
          value={`${overview?.activeVirtualUsers || 0}/${overview?.totalVirtualUsers || 0} 活跃`}
          color="text-green-600"
        />
        <StatCard label="今日产出" value={todayTotal} color="text-purple-600" />
        <StatCard label="正在排期" value={`${overview?.pendingScheduled || 0} 条`} color="text-amber-600" />
      </div>

      {/* 🔴 阻塞告警 */}
      {alerts?.blocking?.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wider mb-2">🔴 阻塞告警</p>
          <div className="space-y-2">
            {alerts.blocking.map((a: any) => (
              <AlertCard key={a.id} alert={a} color="red" />
            ))}
          </div>
        </div>
      )}

      {/* 🟡 关注告警 */}
      {alerts?.warning?.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider mb-2">🟡 关注告警</p>
          <div className="space-y-2">
            {alerts.warning.map((a: any) => (
              <AlertCard key={a.id} alert={a} color="amber" />
            ))}
          </div>
        </div>
      )}

      {/* 恢复静音告警 */}
      <div className="text-right">
        <button
          onClick={async () => {
            await fetch("/api/admin/eco/alerts", { method: "PUT" })
            window.location.reload()
          }}
          className="text-[10px] text-zinc-400 underline hover:text-zinc-600"
        >
          ↻ 恢复所有静音告警
        </button>
      </div>

      {/* 最近执行记录 */}
      {recentLogs?.length > 0 && (
        <div>
          <p className="text-xs font-medium text-zinc-500 mb-2">最近执行记录</p>
          <div className="space-y-1">
            {recentLogs.slice(0, 3).map((log: any) => {
              const failedCount = log.summary?.failed?.length || 0
              const succ = log.summary?.succeeded || {}
              const totalSucc = Object.values(succ).reduce((a: any, b: any) => a + (typeof b === "number" ? b : 0), 0) as number
              return (
                <div key={log.id} className="flex items-center justify-between px-3 py-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-xs">
                  <div className="flex items-center gap-2">
                    <span>
                      {log.status === "completed" ? (failedCount > 0 ? "⚠️" : "✅") : log.status === "failed" ? "❌" : "⏳"}
                    </span>
                    <span className="text-zinc-400 font-mono text-[10px]">
                      {log.started_at?.slice(0, 16).replace("T", " ")}
                    </span>
                    <span>{totalSucc} 条成功</span>
                    {failedCount > 0 && <span className="text-red-500">{failedCount} 条失败</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 发布时间线 */}
      {scheduled.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-zinc-500">发布时间线（未来 24 小时）</p>
            {scheduled.length > 5 && (
              <button
                onClick={() => fetch("/api/admin/scheduled/auto-spread", { method: "POST" }).then(() => window.location.reload())}
                className="text-[10px] px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
              >
                ⚠️ {scheduled.length}条排期中 · 自动分散
              </button>
            )}
          </div>
          <div className="space-y-1">
            {scheduled.slice(0, 8).map((item: any) => (
              <div key={item.id} className="flex items-center gap-2 px-3 py-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-xs">
                <span className="text-zinc-400 font-mono w-10 shrink-0">
                  {item.publish_at?.slice(11, 16)}
                </span>
                <span className="shrink-0">
                  {item.target_type === "article" ? "📄" : item.target_type === "case" ? "📷" : item.target_type === "comment" ? "💬" : "💬"}
                </span>
                <span className="flex-1 truncate">{item.display_title || "..."}</span>
                {item.display_virtual_user_name && (
                  <span className="text-zinc-400 truncate max-w-[80px]">👤 {item.display_virtual_user_name}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 内容配比 */}
      {ratios && (
        <div>
          <p className="text-xs font-medium text-zinc-500 mb-2">内容配比</p>
          <div className="space-y-2">
            <RatioBar label="文章" current={ratios.article?.current || 0} target={ratios.article?.target || 30} color="bg-blue-500" />
            <RatioBar label="案例" current={ratios.case?.current || 0} target={ratios.case?.target || 20} color="bg-amber-500" />
          </div>
        </div>
      )}

      {/* 虚拟人活跃 */}
      {virtualUsers?.length > 0 && (
        <div>
          <p className="text-xs font-medium text-zinc-500 mb-2">虚拟人活跃</p>
          <div className="space-y-1">
            {virtualUsers.slice(0, 6).map((vu: any) => (
              <div key={vu.nickname} className="flex items-center justify-between px-3 py-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-xs">
                <div className="flex items-center gap-2 min-w-0">
                  <span>{vu.isActive ? (vu.lastActive !== "从未" && Date.now() - new Date(vu.lastActive).getTime() < 7 * 86400000 ? "🔥" : "⚠️") : "💤"}</span>
                  <span className="font-medium truncate">{vu.nickname}</span>
                  <span className="text-zinc-400">{ROLE_BADGES[vu.role] || vu.role}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-zinc-400">{vu.contentCount} 条</span>
                  <span className="text-zinc-400">{vu.lastActive !== "从未" ? formatTimeAgo(vu.lastActive) : "从未"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
      <p className="text-xs text-zinc-400">{label}</p>
      <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  )
}

function AlertCard({ alert, color }: { alert: any; color: string }) {
  const [snoozed, setSnoozed] = useState(false)
  const [snoozing, setSnoozing] = useState(false)
  const bg = color === "red" ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800" : "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
  const textColor = color === "red" ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-300"
  const btnBg = color === "red" ? "bg-red-200 dark:bg-red-800 hover:bg-red-300" : "bg-amber-200 dark:bg-amber-800 hover:bg-amber-300"
  const btnText = color === "red" ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-300"

  const handleSnooze = async () => {
    setSnoozing(true)
    try {
      await fetch("/api/admin/eco/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alert_key: alert.id, duration_hours: 48 }),
      })
      setSnoozed(true)
    } catch {}
    setSnoozing(false)
  }

  if (snoozed) return null

  return (
    <div className={`p-3 rounded-xl border ${bg}`}>
      <div className="flex items-center justify-between">
        <p className={`text-xs ${textColor}`}>{alert.message}</p>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {alert.actionLabel && color === "red" && (
            <button onClick={() => fetch("/api/admin/eco/strategy/run", { method: "POST" })} className={`text-[10px] px-2 py-1 rounded ${btnBg} ${btnText}`}>
              重试
            </button>
          )}
          {alert.actionLabel && color !== "red" && (
            <button className={`text-[10px] px-2 py-1 rounded ${btnBg} ${btnText}`}>
              {alert.actionLabel}
            </button>
          )}
          <button onClick={handleSnooze} disabled={snoozing} className="text-[10px] px-2 py-1 rounded bg-white/60 dark:bg-zinc-800/60 text-zinc-400 hover:text-zinc-600">
            {snoozing ? "..." : "静音48h"}
          </button>
        </div>
      </div>
    </div>
  )
}

function RatioBar({ label, current, target, color }: { label: string; current: number; target: number; color: string }) {
  const diff = current - target
  const isOff = Math.abs(diff) > 2
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-0.5">
        <span className="text-zinc-600 dark:text-zinc-400">{label}</span>
        <span className={isOff ? "text-amber-500" : "text-green-600"}>
          {current}%{isOff && diff < 0 ? ` ⚠️ ${diff}%` : ""}
        </span>
      </div>
      <div className="h-2 bg-zinc-100 dark:bg-zinc-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(current, 100)}%` }} />
      </div>
    </div>
  )
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return "今天"
  if (days === 1) return "昨天"
  if (days < 7) return `${days}天前`
  return `${Math.floor(days / 7)}周前`
}
