"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

type Stats = {
  total: number
  registered: number
  rewarded: number
  points: number
  total_invites: number
}

type InviteItem = {
  id: string
  code: string
  channel: string
  status: string
  created_at: string
  registered_at: string | null
  rewarded_at: string | null
  invitee_nickname: string | null
}

const STATUS_MAP: Record<string, string> = {
  pending: "待注册",
  registered: "已注册",
  completed: "已完成",
  rewarded: "已奖励",
}

export default function InvitePage() {
  const router = useRouter()
  const supabase = createClient()
  const [code, setCode] = useState("")
  const [editing, setEditing] = useState(false)
  const [newCode, setNewCode] = useState("")
  const [stats, setStats] = useState<Stats | null>(null)
  const [invites, setInvites] = useState<InviteItem[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<"link" | "code">("link")
  const [copied, setCopied] = useState(false)

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/login"); return }

    const [codeRes, statsRes, listRes] = await Promise.all([
      fetch("/api/invite/code").then(r => r.json()),
      fetch("/api/invite/stats").then(r => r.json()),
      fetch("/api/invite/list").then(r => r.json()),
    ])
    setCode(codeRes.code || "")
    setStats(statsRes)
    setInvites(listRes.invites ?? [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const handleSaveCode = async () => {
    if (!newCode.trim()) return
    const res = await fetch("/api/invite/code", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: newCode }),
    })
    if (res.ok) {
      const data = await res.json()
      setCode(data.code)
      setEditing(false)
    } else {
      const data = await res.json()
      alert(data.error || "修改失败")
    }
  }

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shareUrl = typeof window !== "undefined" ? `${window.location.origin}/?ref=${code}` : ""
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shareUrl)}`

  if (loading) return <div className="bg-white dark:bg-zinc-900 min-h-screen flex items-center justify-center text-sm text-zinc-400">加载中...</div>

  return (
    <div className="bg-white dark:bg-zinc-900 min-h-screen">
      <div className="flex items-center gap-2 px-4 h-12 border-b border-zinc-100 dark:border-zinc-800">
        <Link href="/" className="p-1">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
        <h1 className="text-sm font-medium">邀请好友</h1>
      </div>

      {/* 邀请码 */}
      <div className="px-4 pt-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
        <p className="text-xs text-zinc-500 mb-2">你的邀请码</p>
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value.toUpperCase())}
              placeholder="4-20位字母数字"
              maxLength={20}
              className="flex-1 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm outline-none font-mono"
              autoFocus
            />
            <button onClick={handleSaveCode} className="px-3 py-2 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-lg text-xs font-medium">保存</button>
            <button onClick={() => setEditing(false)} className="px-3 py-2 text-xs text-zinc-400">取消</button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold font-mono tracking-wider">{code}</span>
            <button onClick={() => setEditing(true)} className="text-[10px] text-zinc-400 underline">修改</button>
          </div>
        )}
      </div>

      {/* 分享方式 */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex gap-2">
          {[
            { key: "link" as const, label: "分享链接" },
            { key: "code" as const, label: "邀请码" },
          ].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium ${tab === t.key ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"}`}
            >{t.label}</button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-4">
        {tab === "link" ? (
          <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
            <p className="text-xs text-zinc-500 mb-2">分享链接</p>
            <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 rounded-lg px-3 py-2 border border-zinc-200 dark:border-zinc-700">
              <span className="flex-1 text-xs text-zinc-600 dark:text-zinc-400 truncate font-mono">{shareUrl}</span>
              <button onClick={() => handleCopy(shareUrl)} className="text-xs text-zinc-500 font-medium shrink-0">{copied ? "已复制" : "复制"}</button>
            </div>
            <p className="text-xs text-zinc-400 mt-3">朋友点击链接注册后，系统会自动绑定邀请关系</p>
          </div>
        ) : (
          <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
            <p className="text-xs text-zinc-500 mb-3">邀请码</p>
            <div className="text-center py-4">
              <span className="text-3xl font-bold font-mono tracking-widest">{code}</span>
            </div>
            <button onClick={() => handleCopy(code)} className="w-full py-2 bg-white dark:bg-zinc-900 rounded-lg text-sm border border-zinc-200 dark:border-zinc-700">
              {copied ? "已复制" : "复制邀请码"}
            </button>
            <p className="text-xs text-zinc-400 mt-3 text-center">朋友注册时输入此邀请码即可绑定</p>
          </div>
        )}
      </div>

      {/* 统计 */}
      {stats && (
        <div className="mx-4 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl flex items-center justify-around">
          <div className="text-center">
            <p className="font-semibold text-base">{stats.total}</p>
            <p className="text-[10px] text-zinc-400">总邀请</p>
          </div>
          <div className="text-center">
            <p className="font-semibold text-base">{stats.registered}</p>
            <p className="text-[10px] text-zinc-400">已注册</p>
          </div>
          <div className="text-center">
            <p className="font-semibold text-base">{stats.rewarded}</p>
            <p className="text-[10px] text-zinc-400">已奖励</p>
          </div>
          <div className="text-center">
            <p className="font-semibold text-base text-amber-500">{stats.points}</p>
            <p className="text-[10px] text-zinc-400">积分</p>
          </div>
        </div>
      )}

      {/* 邀请明细 */}
      {invites.length > 0 && (
        <div className="mt-4 px-4 pb-2">
          <h2 className="text-sm font-medium mb-3">邀请明细</h2>
          <div className="space-y-1">
            {invites.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                <div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    {item.invitee_nickname || "等待注册"}
                  </p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">
                    {new Date(item.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                  item.status === "rewarded" ? "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"
                }`}>
                  {STATUS_MAP[item.status] || item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 积分入口 */}
      <div className="px-4 pb-8">
        <Link href="/points" className="block p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl mt-2">
          <div className="flex items-center justify-between">
            <span className="text-sm">查看积分详情</span>
            <svg className="w-4 h-4 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </div>
        </Link>
      </div>
    </div>
  )
}
