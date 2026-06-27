"use client"

import Link from "next/link"

interface PageHeaderProps {
  title: string
  // 返回目标：有历史则后退，无历史则跳此路径。默认 "/"
  fallbackHref?: string
  // 是否显示首页快捷按钮（默认显示）
  showHome?: boolean
}

// 统一的页面头部：返回箭头 + 标题 + 首页按钮
// 解决移动端列表页无返回入口的自洽性问题
export function PageHeader({ title, fallbackHref = "/", showHome = true }: PageHeaderProps) {
  const goBack = () => {
    if (typeof window !== "undefined") {
      if (window.history.length > 1) window.history.back()
      else window.location.href = fallbackHref
    }
  }

  return (
    <div className="sticky top-0 bg-white/90 dark:bg-zinc-900/90 backdrop-blur z-10 border-b border-zinc-100 dark:border-zinc-800 lg:hidden">
      <div className="flex items-center h-12 px-4">
        <button onClick={goBack} className="flex items-center gap-2" aria-label="返回">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" />
          </svg>
          <span className="text-sm font-medium">{title}</span>
        </button>
        {showHome && (
          <Link href="/" className="ml-auto flex items-center gap-1 text-xs text-zinc-500" aria-label="回首页">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <path d="M9 22V12h6v10" />
            </svg>
            首页
          </Link>
        )}
      </div>
    </div>
  )
}
