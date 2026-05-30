"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { useRouter } from "next/navigation"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [mode, setMode] = useState<"login" | "register">("login")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message)
      } else {
        router.push("/")
        router.refresh()
      }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      })
      if (error) {
        setError(error.message)
      } else {
        setSent(true)
      }
    }
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="bg-white dark:bg-zinc-900 min-h-screen flex items-center justify-center">
        <div className="text-center px-4">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2 11 13M22 2l-8 20-4-8" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold mb-2">注册成功</h2>
          <p className="text-sm text-zinc-500">请查看你的邮箱，点击验证链接完成注册</p>
          <button onClick={() => setSent(false)} className="mt-6 text-sm text-zinc-400 underline">返回登录</button>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-zinc-900 min-h-screen">
      <div className="flex items-center px-4 h-12 border-b border-zinc-100 dark:border-zinc-800">
        <Link href="/" className="p-1">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
        <h1 className="text-sm font-medium flex-1 text-center">
          {mode === "login" ? "登录" : "注册"}
        </h1>
      </div>

      <div className="px-4 pt-8">
        <form onSubmit={handleSubmit} className="space-y-4 max-w-sm mx-auto">
          <div>
            <label className="text-sm font-medium block mb-1.5">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="w-full px-3 py-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-medium block mb-1.5">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="至少6位"
              required
              minLength={6}
              className="w-full px-3 py-2.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm outline-none"
            />
          </div>

          {error && <p className="text-xs text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-full text-sm font-medium disabled:opacity-50"
          >
            {loading ? "处理中..." : mode === "login" ? "登录" : "注册"}
          </button>

          <p className="text-center text-xs text-zinc-400">
            {mode === "login" ? (
              <>还没有账号？<button type="button" onClick={() => setMode("register")} className="underline">注册</button></>
            ) : (
              <>已有账号？<button type="button" onClick={() => setMode("login")} className="underline">登录</button></>
            )}
          </p>
        </form>
      </div>
    </div>
  )
}
