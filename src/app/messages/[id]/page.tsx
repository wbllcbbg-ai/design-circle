"use client"

import { useEffect, useState, useRef } from "react"
import { use } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

type Message = {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  is_read: boolean
  created_at: string
}

export default function ConversationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [newMsg, setNewMsg] = useState("")
  const [sending, setSending] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  const loadMessages = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const res = await fetch(`/api/conversations/${id}`)
    if (res.ok) {
      const data = await res.json()
      setMessages(data.messages ?? [])
    }
    setLoading(false)
  }

  useEffect(() => { loadMessages() }, [id])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = async () => {
    if (!newMsg.trim() || sending) return
    setSending(true)
    const res = await fetch(`/api/conversations/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: newMsg }),
    })
    if (res.ok) {
      setNewMsg("")
      await loadMessages()
    }
    setSending(false)
  }

  return (
    <div className="bg-white dark:bg-zinc-900 min-h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 h-12 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
        <Link href="/messages" className="p-1">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
        <h1 className="text-sm font-medium">对话</h1>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin w-6 h-6 border-2 border-zinc-300 border-t-zinc-600 rounded-full" />
          </div>
        )}
        {!loading && messages.map((msg) => {
          const isMe = msg.sender_id === userId
          return (
            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                  isMe
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-br-md"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-bl-md"
                }`}
              >
                <p>{msg.content}</p>
                <p className={`text-[10px] mt-1 ${isMe ? "text-white/50 dark:text-zinc-900/50" : "text-zinc-400"}`}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          )
        })}
        {!loading && messages.length === 0 && (
          <div className="flex items-center justify-center py-10 text-xs text-zinc-400">暂无消息，发送第一条消息吧</div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-zinc-100 dark:border-zinc-800 shrink-0">
        <div className="flex items-center gap-2 bg-zinc-100 dark:bg-zinc-800 rounded-full px-3 py-2">
          <input
            type="text"
            value={newMsg}
            onChange={(e) => setNewMsg(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="输入消息..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
          />
          <button
            onClick={handleSend}
            disabled={!newMsg.trim() || sending}
            className="text-xs text-zinc-500 font-medium disabled:opacity-40"
          >
            {sending ? "..." : "发送"}
          </button>
        </div>
      </div>
    </div>
  )
}
