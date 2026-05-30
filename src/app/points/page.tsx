"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

type PointRecord = {
  id: string
  amount: number
  reason: string
  created_at: string
}

export default function PointsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [data, setData] = useState<{ points: number; total_earned: number; total_invites: number; records: PointRecord[] } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }
      const res = await fetch("/api/points")
      setData(await res.json())
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="bg-white dark:bg-zinc-900 min-h-screen flex items-center justify-center text-sm text-zinc-400">加载中...</div>

  return (
    <div className="bg-white dark:bg-zinc-900 min-h-screen">
      <div className="flex items-center gap-2 px-4 h-12 border-b border-zinc-100 dark:border-zinc-800">
        <Link href="/invite" className="p-1">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
        <h1 className="text-sm font-medium">我的积分</h1>
      </div>

      <div className="px-4 pt-8 pb-4 text-center">
        <div className="text-4xl font-bold text-amber-500">{data?.points ?? 0}</div>
        <p className="text-xs text-zinc-400 mt-1">当前积分</p>
      </div>

      <div className="mx-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-zinc-500">累计获得</span>
          <span className="font-medium">{data?.total_earned ?? 0} 积分</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-zinc-500">来自邀请</span>
          <span className="font-medium">{data?.total_invites ?? 0} 人</span>
        </div>
      </div>

      {/* 积分记录 */}
      {data?.records && data.records.length > 0 && (
        <div className="mt-6 px-4 pb-6">
          <h2 className="text-sm font-medium mb-3">积分记录</h2>
          <div className="space-y-2">
            {data.records.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                <div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">{r.reason}</p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">{new Date(r.created_at).toLocaleString()}</p>
                </div>
                <span className="text-sm font-medium text-green-600">+{r.amount}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="px-4 mt-4">
        <h2 className="text-sm font-medium mb-2">如何获取积分</h2>
        <div className="space-y-2 text-xs text-zinc-500">
          <p>• 邀请好友注册：+10 积分</p>
          <p>• 被邀请注册：+5 积分</p>
        </div>
      </div>
    </div>
  )
}
