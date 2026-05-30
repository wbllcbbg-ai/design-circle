"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace("/login")
        return
      }
      // 检查用户是否有管理员权限（通过 users 表的 is_admin 标记，或用邮箱白名单）
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

  return <>{children}</>
}
