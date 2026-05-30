"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

export function Header() {
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    const fetchUnread = async () => {
      try {
        const res = await fetch("/api/notifications/unread-count")
        const data = await res.json()
        setUnread(data.unread ?? 0)
      } catch {}
    }
    fetchUnread()
    const interval = setInterval(fetchUnread, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <header className="sticky top-0 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border-b border-zinc-100 dark:border-zinc-800 z-40 transition-shadow">
      <div className="max-w-lg mx-auto px-4 h-12 flex items-center justify-between lg:max-w-5xl lg:px-6">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-zinc-900 dark:bg-white flex items-center justify-center">
            <span className="text-white dark:text-zinc-900 text-xs font-bold">设</span>
          </div>
          <span className="text-base font-bold tracking-tight">设计圈</span>
        </Link>

        {/* 桌面导航 */}
        <nav className="hidden lg:flex items-center gap-6">
          <Link href="/cases" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition">装修案例</Link>
          <Link href="/articles" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition">装修攻略</Link>
          <Link href="/designers" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition">找设计师</Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link href="/notifications" className="relative text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center font-medium">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
          <Link href="/search" className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </Link>
          <Link href="/city" className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </Link>
        </div>
      </div>
    </header>
  )
}
