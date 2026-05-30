"use client"

import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"

const TABS = [
  { key: "", label: "内容管理", icon: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" },
  { key: "/applications", label: "入驻审核", icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" },
  { key: "/reviews", label: "点评审核", icon: "M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" },
  { key: "/virtual-users", label: "虚拟用户", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0 1 12 0v1zm0 0h6v-1a6 6 0 0 0-9-5.197M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" },
  { key: "/rewards", label: "奖励规则", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" },
  { key: "/ai-config", label: "AI 配置", icon: "M12 15v2m-6 4h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2zm10-10V7a4 4 0 0 0-8 0v4h8z" },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const router = useRouter()
  const pathname = usePathname()
  const supabase = createClient()

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

  // 从 pathname 提取当前 Tab key
  // pathname 格式: /admin 或 /admin/applications 或 /admin/reviews
  const suffix = pathname.replace("/admin", "")
  const activeKey = TABS.find((t) => suffix.startsWith(t.key))?.key ?? ""

  return (
    <div className="bg-white dark:bg-zinc-900 min-h-screen flex flex-col">
      {/* 顶部栏 */}
      <div className="flex items-center px-4 h-12 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
        <Link href="/" className="p-1 mr-2">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
        <h1 className="text-sm font-medium">后台管理</h1>
      </div>

      {/* 顶部 Tab 导航 */}
      <div className="border-b border-zinc-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
        <div className="flex">
          {TABS.map((tab) => {
            const tabPath = tab.key ? `/admin${tab.key}` : "/admin"
            const isActive = activeKey === tab.key
            return (
              <Link
                key={tab.key}
                href={tabPath}
                className={`flex-1 flex items-center justify-center gap-1 px-1 py-2.5 text-xs whitespace-nowrap border-b-2 transition-colors ${
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
        {children}
      </div>
    </div>
  )
}
