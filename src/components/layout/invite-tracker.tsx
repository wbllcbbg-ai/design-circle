"use client"

import { useEffect } from "react"
import { createClient } from "@/lib/supabase/client"

/**
 * 全局邀请跟踪器。
 * 1. 捕获 URL 中的 ?ref=CODE，存到 localStorage
 * 2. 登录后检查 localStorage 中是否有待绑定的邀请码，自动绑定
 */
export function InviteTracker() {
  const supabase = createClient()

  useEffect(() => {
    // 捕获 ?ref= 参数
    const params = new URLSearchParams(window.location.search)
    const ref = params.get("ref")
    if (ref && ref.trim()) {
      localStorage.setItem("pending_invite_code", ref.trim().toUpperCase())
    }

    // 登录后绑定邀请码
    const bindPending = async () => {
      const code = localStorage.getItem("pending_invite_code")
      if (!code) return

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      try {
        await fetch("/api/invite/bind", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code, channel: "link" }),
        })
      } catch {}
      localStorage.removeItem("pending_invite_code")
    }

    bindPending()
  }, [])

  return null
}
