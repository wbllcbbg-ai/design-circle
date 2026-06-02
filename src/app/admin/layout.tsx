"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

const TABS = [
  { key: "/eco", label: "生态概览", icon: "M3 12h1m16 0h1m-9-9v1m0 16v1M5.6 5.6l.7.7m12.1-.7l-.7.7M5.6 18.4l.7-.7m12.1.7l-.7-.7M4 7a2 2 0 1 1 4 0 2 2 0 0 1-4 0zm12 0a2 2 0 1 1 4 0 2 2 0 0 1-4 0zM8 12a4 4 0 1 1 8 0 4 4 0 0 1-8 0z" },
  { key: "/consult", label: "咨询数据", icon: "M2 20h20M4 16h4v4H4v-4zm6-8h4v12h-4V8zm6 4h4v8h-4v-8z" },
  { key: "/", label: "内容库", icon: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" },
  { key: "/applications", label: "入驻审核", icon: "M12 2.5a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" },
  { key: "/reviews", label: "点评审核", icon: "M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" },
  { key: "/virtual-users", label: "虚拟人", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0 1 12 0v1zm0 0h6v-1a6 6 0 0 0-9-5.197M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" },
  { key: "/strategy", label: "运营策略", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" },
  { key: "/rewards", label: "奖励规则", icon: "M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" },
  { key: "/ai-config", label: "AI 配置", icon: "M12 15v2m-6 4h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2zm10-10V7a4 4 0 0 0-8 0v4h8z" },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [consultCount, setConsultCount] = useState(0)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

  useEffect(() => {
    fetch("/api/conversations/unread-admin")
      .then(r => r.json())
      .then(d => setConsultCount(d.count ?? 0))
      .catch(() => {})
    const interval = setInterval(() => {
      fetch("/api/conversations/unread-admin")
        .then(r => r.json())
        .then(d => setConsultCount(d.count ?? 0))
        .catch(() => {})
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace("/login")
        return
      }
      const { data: profile } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single()

      if (profile?.role !== "admin") {
        setAuthorized(false)
        return
      }
      setAuthorized(true)
    }
    check()
  }, [])

  if (authorized === null) {
    return <div className="bg-white dark:bg-zinc-900 min-h-screen flex items-center justify-center text-sm text-zinc-400">验证中...</div>
  }

  if (authorized === false) {
    return (
      <div className="bg-white dark:bg-zinc-900 min-h-screen flex flex-col items-center justify-center px-4">
        <div className="w-16 h-16 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" />
            <path d="m15 9-6 6M9 9l6 6" />
          </svg>
        </div>
        <h2 className="text-lg font-medium mb-2">无权访问</h2>
        <p className="text-sm text-zinc-400 text-center">你没有管理员权限，无法访问此页面</p>
      </div>
    )
  }

  // 从 pathname 提取当前 Tab key，按 key 长度降序匹配避免 / 优先于 /eco 等
  const suffix = pathname.replace("/admin", "")
  const sortedTabs = [...TABS].sort((a, b) => b.key.length - a.key.length)
  const activeKey = sortedTabs.find((t) => {
    if (t.key === "/") return suffix === "" || suffix === "/"
    return suffix.startsWith(t.key)
  })?.key ?? "/"

  return (
    <div className="bg-white dark:bg-zinc-900 min-h-screen flex flex-col">
      {/* 顶部栏 */}
      <div className="flex items-center justify-between px-4 h-12 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
        <div className="flex items-center">
          <Link href="/" className="p-1 mr-2">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </Link>
          <h1 className="text-sm font-medium">后台管理</h1>
        </div>
        <Link
          href="/admin/messages"
          className={`relative p-2 transition-colors ${
            pathname === "/admin/messages"
              ? "text-zinc-900 dark:text-white"
              : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          }`}
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {consultCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center font-medium">
              {consultCount > 9 ? "9+" : consultCount}
            </span>
          )}
        </Link>
      </div>

      {/* 顶部 Tab 导航 */}
      <div className="border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0 overflow-x-auto">
        <div className="flex min-w-max">
          {TABS.map((tab) => {
            const tabPath = tab.key ? `/admin${tab.key}` : "/admin"
            const isActive = activeKey === tab.key
            return (
              <Link
                key={tab.key}
                href={tabPath}
                className={`flex-1 flex items-center justify-center gap-1 px-1 py-2.5 text-xs whitespace-nowrap border-b-2 transition-colors max-md:px-3 ${
                  isActive
                    ? "border-zinc-900 dark:border-white text-zinc-900 dark:text-white font-medium"
                    : "border-transparent text-zinc-400 dark:text-zinc-500"
                }`}
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill={isActive ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5">
                  <path d={tab.icon} />
                </svg>
                {tab.label}
              </Link>
            )
          })}
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-y-auto">
        <div className="lg:max-w-5xl lg:mx-auto lg:px-6">
          {children}
        </div>
      </div>
    </div>
  )
}
