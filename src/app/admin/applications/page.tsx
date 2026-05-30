"use client"

import { useEffect, useState } from "react"

type Application = {
  id: string
  type: string
  name: string
  phone: string
  description: string
  specialties: string[]
  status: string
  created_at: string
}

const TYPE_LABEL: Record<string, string> = { designer: "设计师", company: "公司", worker: "工长" }

export default function ApplicationsPage() {
  const [apps, setApps] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const res = await fetch("/api/admin/applications")
    const data = await res.json()
    setApps(data.applications ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const handleApprove = async (id: string) => {
    await fetch("/api/apply", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "approved" }),
    })
    load()
  }

  const handleReject = async (id: string) => {
    await fetch("/api/apply", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status: "rejected" }),
    })
    load()
  }

  return (
    <div className="p-4">
      {apps.length === 0 && !loading && (
        <p className="text-xs text-zinc-400 text-center py-10">暂无申请</p>
      )}
      {loading && <p className="text-xs text-zinc-400 text-center py-10">加载中...</p>}

      <div className="space-y-3">
        {apps.map((app) => (
          <div key={app.id} className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">{app.name}</p>
                <p className="text-xs text-zinc-400">{TYPE_LABEL[app.type] || app.type} · {app.phone}</p>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                app.status === "pending" ? "bg-orange-100 text-orange-600 dark:bg-orange-900 dark:text-orange-200" :
                app.status === "approved" ? "bg-green-100 text-green-600 dark:bg-green-900 dark:text-green-200" :
                "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-200"
              }`}>
                {app.status === "pending" ? "待审核" : app.status === "approved" ? "已通过" : "已拒绝"}
              </span>
            </div>
            {app.description && <p className="text-xs text-zinc-500 mt-1">{app.description}</p>}
            {app.specialties?.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {app.specialties.map((s) => <span key={s} className="text-[10px] px-1.5 py-0.5 rounded bg-white dark:bg-zinc-700 text-zinc-500">{s}</span>)}
              </div>
            )}
            <p className="text-[10px] text-zinc-400 mt-1">{new Date(app.created_at).toLocaleDateString()}</p>

            {app.status === "pending" && (
              <div className="flex gap-2 mt-2">
                <button onClick={() => handleApprove(app.id)} className="flex-1 py-1.5 bg-green-600 text-white rounded-full text-xs font-medium">通过</button>
                <button onClick={() => handleReject(app.id)} className="flex-1 py-1.5 bg-red-500 text-white rounded-full text-xs font-medium">拒绝</button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
