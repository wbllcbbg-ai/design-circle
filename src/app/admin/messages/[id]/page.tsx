"use client"

import { useEffect, useState, useRef, use } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"

type Message = {
  id: string
  content: string
  sender_id: string
  created_at: string
}

export default function AdminMessageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const [adminUserId, setAdminUserId] = useState<string | null>(null)

  const fetchMessages = () => {
    fetch(`/api/admin/messages/${id}`)
      .then(r => r.json())
      .then(data => {
        setMessages(data.messages ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setAdminUserId(user.id)
    })
    fetchMessages()
    const iv = setInterval(fetchMessages, 5000)
    return () => clearInterval(iv)
  }, [id])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }) }, [messages])

  const handleSend = async () => {
    if (!text.trim() || sending) return
    setSending(true)
    const res = await fetch(`/api/admin/messages/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: text.trim() }),
    })
    if (res.ok) { setText(""); fetchMessages() }
    setSending(false)
  }

  return (
    <div className="bg-white dark:bg-zinc-900 h-[calc(100vh-96px)] flex flex-col">
      {/* 顶栏 */}
      <div className="flex items-center h-12 px-4 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
        <button onClick={() => router.back()} className="p-1 mr-2">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <h1 className="text-sm font-medium">咨询对话</h1>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {loading && <div className="flex items-center justify-center py-8 text-sm text-zinc-400">加载中...</div>}
        {!loading && messages.length === 0 && <div className="flex items-center justify-center py-8 text-sm text-zinc-400">暂无消息</div>}
        {messages.map((msg) => {
          const isAdmin = adminUserId && msg.sender_id === adminUserId
          return (
            <div key={msg.id} className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                isAdmin
                  ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-br-md"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-bl-md"
              }`}>
                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                <p className={`text-[10px] mt-1 ${isAdmin ? "text-white/50 dark:text-zinc-900/50" : "text-zinc-400"}`}>
                  {new Date(msg.created_at).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* 输入区 */}
      <div className="px-4 py-3 border-t border-zinc-100 dark:border-zinc-800 shrink-0">
        <div className="flex gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder="回复用户..."
            rows={2}
            className="flex-1 px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 rounded-xl border-0 outline-none focus:ring-1 focus:ring-zinc-300 dark:focus:ring-zinc-600 resize-none placeholder:text-zinc-400"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sending}
            className="px-4 py-2 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-xl text-sm font-medium shrink-0 disabled:opacity-40 self-end"
          >
            {sending ? "..." : "发送"}
          </button>
        </div>
      </div>
    </div>
  )
}
