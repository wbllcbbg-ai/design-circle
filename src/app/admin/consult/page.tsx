"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

type StatsData = {
  totalConversations: number
  todayConversations: number
  unrepliedConversations: number
  activeUsers: number
  dailyConversations: { date: string; label: string; count: number }[]
  recentConversations: {
    id: string
    userNickname: string
    designerName: string
    time: string
    status: "replied" | "pending"
    lastMessage: string | undefined
  }[]
}

const defaultStats: StatsData = {
  totalConversations: 0,
  todayConversations: 0,
  unrepliedConversations: 0,
  activeUsers: 0,
  dailyConversations: [],
  recentConversations: [],
}

function StatCard({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
      <p className="text-xs text-zinc-400">{label}</p>
      <p className={`text-xl font-bold mt-1 ${color || "text-zinc-900 dark:text-white"}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
    </div>
  )
}

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return "刚刚"
  if (diffMin < 60) return `${diffMin}分钟前`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour}小时前`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return `${diffDay}天前`
  return d.toLocaleDateString("zh-CN", { month: "short", day: "numeric" })
}

export default function ConsultPage() {
  const [data, setData] = useState<StatsData>(defaultStats)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/consult/stats")
      .then(r => r.json())
      .then(d => {
        setData(d)
        setLoading(false)
      })
      .catch(() => {
        setData(defaultStats)
        setLoading(false)
      })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-zinc-400">
        <div className="animate-spin w-6 h-6 border-2 border-zinc-300 border-t-zinc-600 rounded-full mr-2" />
        加载中...
      </div>
    )
  }

  const maxCount = Math.max(...data.dailyConversations.map(d => d.count), 1)

  return (
    <div className="p-4 space-y-5">
      {/* KPI 卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="总咨询数" value={data.totalConversations} color="text-blue-600 dark:text-blue-400" />
        <StatCard label="今日咨询" value={data.todayConversations} color="text-purple-600 dark:text-purple-400" />
        <StatCard
          label="未回复"
          value={data.unrepliedConversations}
          color={data.unrepliedConversations > 0 ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}
        />
        <StatCard label="咨询用户数" value={data.activeUsers} color="text-amber-600 dark:text-amber-400" />
      </div>

      {/* 7 天趋势 */}
      <div>
        <p className="text-xs font-medium text-zinc-500 mb-2">近 7 天趋势</p>
        <div className="p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
          <div className="flex items-end gap-2 h-24">
            {data.dailyConversations.map((d) => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                <span className="text-[10px] text-zinc-500 font-medium">{d.count}</span>
                <div
                  className="w-full rounded-sm bg-blue-400 dark:bg-blue-500 transition-all"
                  style={{ height: `${(d.count / maxCount) * 100}%`, minHeight: d.count > 0 ? "4px" : "2px" }}
                />
                <span className="text-[10px] text-zinc-400">{d.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 最近咨询 */}
      <div>
        <p className="text-xs font-medium text-zinc-500 mb-2">最近咨询</p>
        {data.recentConversations.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-zinc-400">暂无咨询记录</div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800 bg-zinc-50 dark:bg-zinc-800 rounded-xl overflow-hidden">
            {data.recentConversations.map((c) => (
              <Link
                key={c.id}
                href={`/admin/messages/${c.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-100 dark:hover:bg-zinc-700/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{c.userNickname}</span>
                    <span className="text-[10px] text-zinc-400">→ {c.designerName}</span>
                  </div>
                  {c.lastMessage && (
                    <p className="text-xs text-zinc-400 truncate mt-0.5">{c.lastMessage}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-zinc-400">{formatTime(c.time)}</span>
                  {c.status === "replied" ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
                      ✅ 已回复
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400">
                      ⏳ 待回复
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
