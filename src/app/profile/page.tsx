"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import type { User } from "@supabase/supabase-js"

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      setLoading(false)
    })
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  if (loading) return <div className="bg-white dark:bg-zinc-900 min-h-screen flex items-center justify-center text-sm text-zinc-400">加载中...</div>

  return (
    <div className="bg-white dark:bg-zinc-900 min-h-screen">
      {/* 顶部 */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-zinc-100 dark:border-zinc-800">
        <h1 className="text-sm font-medium">我的</h1>
        <button className="text-zinc-400">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="1" />
            <circle cx="19" cy="12" r="1" />
            <circle cx="5" cy="12" r="1" />
          </svg>
        </button>
      </div>

      {user ? (
        <div>
          <div className="p-4 flex items-center gap-3">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-zinc-300 to-zinc-400 dark:from-zinc-600 dark:to-zinc-700 flex items-center justify-center text-zinc-500 text-lg">
              {(user.email?.[0] || "U").toUpperCase()}
            </div>
            <div>
              <p className="font-medium text-base">{user.email?.split("@")[0] || "用户"}</p>
              <p className="text-xs text-zinc-400 mt-0.5">{user.email}</p>
            </div>
            <button onClick={handleLogout} className="ml-auto text-xs text-zinc-400 underline">退出</button>
          </div>

          <div className="mx-4 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl flex items-center justify-around">
            {["点评", "收藏", "关注", "粉丝"].map((label) => (
              <div key={label} className="text-center">
                <p className="font-semibold">0</p>
                <p className="text-xs text-zinc-400">{label}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
            {[
              { icon: "⭐", label: "我的点评", href: "#" },
              { icon: "❤️", label: "我的收藏", href: "#" },
              { icon: "👁️", label: "浏览历史", href: "#" },
              { icon: "📋", label: "设计师入驻申请", href: "/apply" },
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
              { icon: "👁️", label: "浏览历史", href: "#" },
              { icon: "📋", label: "设计师入驻申请", href: "/apply" },
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
