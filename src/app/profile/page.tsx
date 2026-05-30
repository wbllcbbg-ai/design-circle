"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [nickname, setNickname] = useState("")
  const [phone, setPhone] = useState("")
  const [saving, setSaving] = useState(false)
  const [stats, setStats] = useState({ reviews: 0, favorites: 0, likes: 0 })
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const { data: { user: u } } = await supabase.auth.getUser()
      if (!u) { setLoading(false); return }
      setUser(u)

      const [profileRes, reviewRes, favRes, likeRes] = await Promise.all([
        fetch("/api/profile").then(r => r.json()),
        supabase.from("reviews").select("id", { count: "exact", head: true }).eq("user_id", u.id),
        supabase.from("favorites").select("id", { count: "exact", head: true }).eq("user_id", u.id),
        supabase.from("likes").select("id", { count: "exact", head: true }).eq("user_id", u.id),
      ])

      setProfile(profileRes.user)
      setStats({
        reviews: reviewRes.count ?? 0,
        favorites: favRes.count ?? 0,
        likes: likeRes.count ?? 0,
      })
      setLoading(false)
    }
    load()
  }, [])

  const handleSave = async () => {
    setSaving(true)
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nickname, phone }),
    })
    if (res.ok) {
      const data = await res.json()
      setProfile(data.user)
      setEditing(false)
    }
    setSaving(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
  }

  if (loading) return <div className="bg-white dark:bg-zinc-900 min-h-screen flex items-center justify-center text-sm text-zinc-400">加载中...</div>

  return (
    <div className="bg-white dark:bg-zinc-900 min-h-screen">
      <div className="flex items-center justify-between px-4 h-12 border-b border-zinc-100 dark:border-zinc-800">
        <h1 className="text-sm font-medium">我的</h1>
      </div>

      {/* 编辑弹窗 */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditing(false)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-medium mb-4">编辑资料</h2>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-zinc-500 mb-1">昵称</p>
                <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm outline-none" />
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1">手机号</p>
                <input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm outline-none" />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setEditing(false)} className="flex-1 py-2 rounded-full text-sm bg-zinc-100 dark:bg-zinc-800">取消</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2 rounded-full text-sm bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 disabled:opacity-50">{saving ? "保存中..." : "保存"}</button>
            </div>
          </div>
        </div>
      )}

      {user ? (
        <div>
          {/* 用户信息 */}
          <div className="p-4 flex items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-zinc-300 to-zinc-400 dark:from-zinc-600 dark:to-zinc-700 flex items-center justify-center text-zinc-500 text-lg shrink-0">
              {(user.email?.[0] || "U").toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium text-base truncate">{profile?.nickname || user.email?.split("@")[0] || "用户"}</p>
                <button onClick={() => { setNickname(profile?.nickname || ""); setPhone(profile?.phone || ""); setEditing(true) }} className="text-zinc-400">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  </svg>
                </button>
              </div>
              <p className="text-xs text-zinc-400 mt-0.5 truncate">{user.email}</p>
            </div>
            <button onClick={handleLogout} className="text-xs text-zinc-400 underline shrink-0">退出</button>
          </div>

          {/* 统计 */}
          <div className="mx-4 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl flex items-center justify-around">
            {[
              { label: "点评", count: stats.reviews },
              { label: "收藏", count: stats.favorites },
              { label: "赞过", count: stats.likes },
            ].map((item) => (
              <div key={item.label} className="text-center">
                <p className="font-semibold">{item.count}</p>
                <p className="text-xs text-zinc-400">{item.label}</p>
              </div>
            ))}
          </div>

          {/* 菜单 */}
          <div className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
            {[
              { icon: "⭐", label: "我的点评", href: "#" },
              { icon: "❤️", label: "我的收藏", href: "#" },
              { icon: "👁️", label: "浏览历史", href: "/profile/history" },
              { icon: "📢", label: "邀请好友", href: "/invite" },
              { icon: "📊", label: "设计师工作台", href: "/dashboard" },
            ].map((item) => (
              <Link key={item.label} href={item.href} className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <span className="text-sm">{item.icon}</span>
                  <span className="text-sm">{item.label}</span>
                </div>
                <svg className="w-4 h-4 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="p-4">
          <div className="flex flex-col items-center py-10">
            <div className="w-20 h-20 rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
              <svg className="w-10 h-10 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <p className="mt-3 font-medium">登录设计圈</p>
            <p className="text-xs text-zinc-400 mt-1">登录后查看点评、收藏和更多功能</p>
            <Link href="/login" className="mt-6 w-full max-w-xs block bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-full py-2.5 text-sm font-medium text-center">
              登录 / 注册
            </Link>
          </div>

          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {[
              { icon: "📋", label: "设计师入驻申请", href: "/apply" },
              { icon: "📊", label: "设计师工作台", href: "/dashboard" },
              { icon: "🤖", label: "AI 内容管理", href: "/admin" },
              { icon: "📝", label: "入驻审核管理", href: "/admin/applications" },
            ].map((item) => (
              <Link key={item.label} href={item.href} className="flex items-center justify-between px-4 py-3.5">
                <div className="flex items-center gap-3">
                  <span className="text-sm">{item.icon}</span>
                  <span className="text-sm">{item.label}</span>
                </div>
                <svg className="w-4 h-4 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="m9 18 6-6-6-6" />
                </svg>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
