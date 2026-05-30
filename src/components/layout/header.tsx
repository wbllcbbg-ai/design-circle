"use client"

import Link from "next/link"

export function Header() {
  return (
    <header className="sticky top-0 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border-b border-zinc-100 dark:border-zinc-800 z-40 transition-shadow">
      <div className="max-w-lg mx-auto px-4 h-12 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-zinc-900 dark:bg-white flex items-center justify-center">
            <span className="text-white dark:text-zinc-900 text-xs font-bold">设</span>
          </div>
          <span className="text-base font-bold tracking-tight">设计圈</span>
        </Link>

        <div className="flex items-center gap-3">
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
