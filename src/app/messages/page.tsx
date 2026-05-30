"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

type Conversation = {
  id: string
  last_message: string | null
  last_message_at: string | null
  created_at: string
  designer_id: string
  user_id: string
  designer: { id: string; name: string; logo_url: string | null; type: string } | null
  user: { id: string; nickname: string; avatar_url: string | null } | null
}

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setUserId(user.id)

      const res = await fetch("/api/conversations")
      const data = await res.json()
      setConversations(data.conversations ?? [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="bg-white dark:bg-zinc-900 min-h-screen flex items-center justify-center text-sm text-zinc-400">加载中...</div>

  if (!userId) {
    return (
      <div className="bg-white dark:bg-zinc-900 min-h-screen">
        <div className="flex items-center px-4 h-12 border-b border-zinc-100 dark:border-zinc-800">
          <h1 className="text-sm font-medium">消息</h1>
        </div>
        <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
          <svg className="w-12 h-12 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
          <p className="text-sm">登录后查看消息</p>
          <Link href="/login" className="mt-4 text-sm text-zinc-600 dark:text-zinc-300 underline">去登录</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-zinc-900 min-h-screen">
      <div className="flex items-center px-4 h-12 border-b border-zinc-100 dark:border-zinc-800">
        <h1 className="text-sm font-medium">消息</h1>
      </div>

      {conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
          <svg className="w-12 h-12 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
          </svg>
          <p className="text-sm">暂无消息</p>
          <p className="text-xs mt-1">咨询设计师或收到回复时会显示在这里</p>
        </div>
      ) : (
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {conversations.map((conv) => {
            const other = userId === conv.user_id ? conv.designer : conv.user
            const otherName = other ? ('name' in other ? other.name : 'nickname' in other ? other.nickname : '') || '' : '未知用户'
            const otherInitial = otherName.charAt(0) || '?'
            return (
              <Link key={conv.id} href={`/messages/${conv.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-300 to-zinc-400 dark:from-zinc-600 dark:to-zinc-700 shrink-0 flex items-center justify-center text-[12px] text-white font-medium">
                  {otherInitial}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{otherName}</span>
                    {conv.last_message_at && (
                      <span className="text-[10px] text-zinc-400">{new Date(conv.last_message_at).toLocaleDateString()}</span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 truncate mt-0.5">{conv.last_message || "暂无消息"}</p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
