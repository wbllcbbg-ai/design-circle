"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"

/**
 * 分享按钮组件。
 * 分享 URL 会自动带上当前登录用户的邀请码（?ref=CODE）。
 */
export function ShareButton({ url, title }: { url: string; title?: string }) {
  const [copied, setCopied] = useState(false)
  const [shareUrl, setShareUrl] = useState(url)

  useEffect(() => {
    const addRef = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setShareUrl(url); return }

      try {
        const res = await fetch("/api/invite/code")
        const data = await res.json()
        const separator = url.includes("?") ? "&" : "?"
        setShareUrl(`${url}${separator}ref=${data.code || ""}`)
      } catch {
        setShareUrl(url)
      }
    }
    addRef()
  }, [url])

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, url: shareUrl })
        return
      } catch {}
    }

    await navigator.clipboard.writeText(shareUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button onClick={handleShare} className="flex items-center gap-1.5 text-sm text-zinc-500">
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <path d="m8.59 13.51 6.83 3.98" />
        <path d="m15.41 6.51-6.82 3.98" />
      </svg>
      <span>{copied ? "已复制" : "分享"}</span>
    </button>
  )
}
