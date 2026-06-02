"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

type Conversation = {
  id: string
  last_message: string | null
  last_message_at: string | null
  created_at: string
  designer_id: string
  user_id: string
  designer: { id: string; name: string; type: string } | null
  user: { id: string; nickname: string } | null
}

export default function AdminMessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/conversations?all=true")
      .then(r => r.json())
      .then(data => {
        setConversations(data.conversations ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex items-center justify-center py-16 text-sm text-zinc-400">加载中...</div>

  return (
    <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
      {conversations.length === 0 && (
        <div className="px-4 py-16 text-center text-sm text-zinc-400">暂无咨询消息</div>
      )}
      {conversations.map((c) => (
        <Link
          key={c.id}
          href={`/admin/messages/${c.id}`}
          className="block px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center text-sm text-zinc-500 shrink-0">
              {c.user?.nickname?.[0] ?? "?"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{c.user?.nickname ?? "匿名用户"}</span>
                {c.designer && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-400">
                    咨询 {c.designer.name}
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{c.last_message || "未发送消息"}</p>
              <p className="text-[10px] text-zinc-400 mt-1">
                {c.last_message_at ? new Date(c.last_message_at).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
              </p>
            </div>
            <svg className="w-4 h-4 text-zinc-300 mt-1 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </div>
        </Link>
      ))}
    </div>
  )
}
