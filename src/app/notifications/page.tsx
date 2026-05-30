"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

type Notification = {
  id: string
  type: "like" | "comment" | "review"
  target_type: string
  target_id: string
  content: string
  is_read: boolean
  created_at: string
  actor: { id: string; nickname: string; avatar_url: string | null } | null
}

const TYPE_ICONS: Record<string, string> = {
  like: "❤️",
  comment: "💬",
  review: "⭐",
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)

      const res = await fetch("/api/notifications")
      const data = await res.json()
      setNotifications(data.notifications ?? [])

      // 标记已读
      fetch("/api/notifications", { method: "PUT", headers: { "Content-Type": "application/json" } }).catch(() => {})
      setLoading(false)
    }
    load()
  }, [])

  const getTargetUrl = (n: Notification): string => {
    if (n.target_type === "case") return `/cases/${n.target_id}`
    if (n.target_type === "article") return `/articles/${n.target_id}`
    if (n.target_type === "designer") return `/designers/${n.target_id}`
    return "/"
  }

  if (loading) return <div className="bg-white dark:bg-zinc-900 min-h-screen flex items-center justify-center text-sm text-zinc-400">加载中...</div>

  return (
    <div className="bg-white dark:bg-zinc-900 min-h-screen">
      <div className="flex items-center gap-2 px-4 h-12 border-b border-zinc-100 dark:border-zinc-800">
        <Link href="/" className="p-1">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
        <h1 className="text-sm font-medium">通知</h1>
      </div>

      {!userId ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
          <p className="text-sm">登录后查看通知</p>
          <Link href="/login" className="mt-4 text-sm underline">去登录</Link>
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
          <svg className="w-12 h-12 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.73 21a2 2 0 0 1-3.46 0" />
          </svg>
          <p className="text-sm">暂无通知</p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {notifications.map((n) => (
            <Link key={n.id} href={getTargetUrl(n)} className={`flex items-start gap-3 px-4 py-3.5 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50 ${!n.is_read ? "bg-blue-50/50 dark:bg-blue-900/10" : ""}`}>
              <div className="w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 shrink-0 flex items-center justify-center text-sm">
                {TYPE_ICONS[n.type] || "📢"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">{n.content}</p>
                <p className="text-xs text-zinc-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
              </div>
              {!n.is_read && <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
