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

type QuoteCard = {
  id: string
  design_fee: number
  design_period: string | null
  status: string
  contract: { id: string; status: string; project_id: string | null; signed_at: string | null } | null
  created_at: string
}

export default function ConversationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [messages, setMessages] = useState<Message[]>([])
  const [quotes, setQuotes] = useState<QuoteCard[]>([])
  const [loading, setLoading] = useState(true)
  const [newMsg, setNewMsg] = useState("")
  const [sending, setSending] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [myRole, setMyRole] = useState<"client" | "designer">("client")
  const [showQuoteForm, setShowQuoteForm] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  // 报价表单状态
  const [quoteForm, setQuoteForm] = useState({
    design_fee: "",
    design_period: "",
    construction_period: "",
    notes: "",
  })
  const [submittingQuote, setSubmittingQuote] = useState(false)

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)

    const [msgRes, quoteRes] = await Promise.all([
      fetch(`/api/conversations/${id}`),
      fetch(`/api/quotes/conversation/${id}`),
    ])

    if (msgRes.ok) {
      const data = await msgRes.json()
      setMessages(data.messages ?? [])
      if (data.my_role) setMyRole(data.my_role)
    }
    if (quoteRes.ok) {
      const qData = await quoteRes.json()
      setQuotes(qData.quotes ?? [])
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [id])

  // 10s 轮询新消息
  useEffect(() => {
    const interval = setInterval(() => {
      fetch(`/api/conversations/${id}`)
        .then(r => r.json())
        .then(data => {
          const msgs = data.messages ?? []
          setMessages(prev => {
            const existingIds = new Set(prev.map(m => m.id))
            const newOnes = msgs.filter((m: Message) => !existingIds.has(m.id))
            if (newOnes.length === 0) return prev
            return msgs
          })
        })
        .catch(() => {})
    }, 10000)
    return () => clearInterval(interval)
  }, [id])

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
      await loadData()
    }
    setSending(false)
  }

  // 设计师提交报价
  const handleSubmitQuote = async () => {
    const fee = parseFloat(quoteForm.design_fee)
    if (!fee || fee <= 0) {
      alert("请填写有效的设计费金额")
      return
    }
    setSubmittingQuote(true)
    const res = await fetch(`/api/quotes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversation_id: id,
        design_fee: fee,
        design_period: quoteForm.design_period || null,
        construction_period: quoteForm.construction_period || null,
        notes: quoteForm.notes || null,
      }),
    })
    setSubmittingQuote(false)
    if (res.ok) {
      setShowQuoteForm(false)
      setQuoteForm({ design_fee: "", design_period: "", construction_period: "", notes: "" })
      loadData()
    } else {
      const err = await res.json().catch(() => ({}))
      alert(err.error || "报价发送失败")
    }
  }

  // 业主接受/拒绝报价
  const handleQuoteAction = async (quoteId: string, action: "accept" | "reject") => {
    const res = await fetch(`/api/quotes/${quoteId}`, {
      method: action === "accept" ? "POST" : "DELETE",
    })
    if (res.ok) {
      loadData()
    } else {
      const err = await res.json().catch(() => ({}))
      alert(err.error || "操作失败")
    }
  }

  const QUOTE_STATUS_TEXT: Record<string, string> = {
    pending: "等待业主回复",
    accepted: "已接受",
    rejected: "已拒绝",
    expired: "已过期",
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
        {/* 设计师：发起报价按钮 */}
        {myRole === "designer" && (
          <button
            onClick={() => setShowQuoteForm(!showQuoteForm)}
            className="ml-auto text-xs px-3 py-1 rounded-full bg-blue-500 text-white"
          >
            {showQuoteForm ? "取消" : "发起报价"}
          </button>
        )}
      </div>

      {/* 报价表单（设计师） */}
      {showQuoteForm && myRole === "designer" && (
        <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 bg-blue-50 dark:bg-blue-950/30 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              value={quoteForm.design_fee}
              onChange={(e) => setQuoteForm({ ...quoteForm, design_fee: e.target.value })}
              placeholder="设计费总额（元）"
              className="text-sm px-2 py-1.5 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
            />
            <input
              type="text"
              value={quoteForm.design_period}
              onChange={(e) => setQuoteForm({ ...quoteForm, design_period: e.target.value })}
              placeholder="设计周期（如15工作日）"
              className="text-sm px-2 py-1.5 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
            />
          </div>
          <input
            type="text"
            value={quoteForm.construction_period}
            onChange={(e) => setQuoteForm({ ...quoteForm, construction_period: e.target.value })}
            placeholder="预估施工周期（选填）"
            className="w-full text-sm px-2 py-1.5 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
          />
          <textarea
            value={quoteForm.notes}
            onChange={(e) => setQuoteForm({ ...quoteForm, notes: e.target.value })}
            placeholder="特别说明（不含项、付款节奏等）"
            className="w-full text-sm px-2 py-1.5 rounded border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900"
            rows={2}
          />
          <button
            onClick={handleSubmitQuote}
            disabled={submittingQuote}
            className="w-full text-sm py-1.5 rounded bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 disabled:opacity-50"
          >
            {submittingQuote ? "发送中..." : "发送报价"}
          </button>
        </div>
      )}

      {/* 报价卡片列表（双方可见） */}
      {quotes.length > 0 && (
        <div className="px-4 py-3 space-y-2 border-b border-zinc-100 dark:border-zinc-800">
          {quotes.map((q) => {
            const hasContract = q.contract && q.contract.status !== "draft"
            const contractSigned = q.contract?.signed_at
            return (
              <div key={q.id} className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">报价 · ¥{q.design_fee.toLocaleString()}</div>
                    {q.design_period && <div className="text-xs text-zinc-500 mt-0.5">设计周期：{q.design_period}</div>}
                  </div>
                  <span className={`text-xs ${q.status === "accepted" ? "text-green-500" : q.status === "rejected" ? "text-red-500" : "text-zinc-400"}`}>
                    {QUOTE_STATUS_TEXT[q.status]}
                  </span>
                </div>

                {/* 业主操作按钮 */}
                {myRole === "client" && q.status === "pending" && (
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleQuoteAction(q.id, "accept")}
                      className="flex-1 text-xs py-1.5 rounded bg-green-500 text-white"
                    >
                      接受报价
                    </button>
                    <button
                      onClick={() => handleQuoteAction(q.id, "reject")}
                      className="flex-1 text-xs py-1.5 rounded border border-zinc-300 dark:border-zinc-600"
                    >
                      拒绝
                    </button>
                  </div>
                )}

                {/* 已生成合同 → 跳签约/项目 */}
                {hasContract && q.contract && (
                  <Link
                    href={contractSigned && q.contract.project_id ? `/projects/${q.contract.project_id}` : "#"}
                    className={`block mt-2 text-xs py-1.5 rounded text-center ${
                      contractSigned
                        ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    }`}
                  >
                    {contractSigned ? "查看项目进度 →" : "合同待签约"}
                  </Link>
                )}
              </div>
            )
          })}
        </div>
      )}

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
        {!loading && messages.length === 0 && quotes.length === 0 && (
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
