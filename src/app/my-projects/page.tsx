"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

type Project = {
  id: string
  title: string
  status: string
  progress: number
  current_milestone: number
  created_at: string
  designer: { id: string; name: string; logo_url: string | null } | null
  contract: { id: string; total_price: number; status: string } | null
}

const STATUS_LABEL: Record<string, string> = {
  active: "进行中",
  completed: "已竣工",
  cancelled: "已取消",
  disputed: "纠纷中",
}
const STATUS_STYLE: Record<string, string> = {
  active: "bg-blue-100 text-blue-600",
  completed: "bg-green-100 text-green-600",
  cancelled: "bg-zinc-100 text-zinc-500",
  disputed: "bg-red-100 text-red-600",
}

export default function MyProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/projects?as=client")
      .then((r) => r.json())
      .then((data) => setProjects(data.projects ?? []))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-4 pb-20">
      <h1 className="text-lg font-semibold mb-4">我的项目</h1>

      {loading ? (
        <div className="text-center text-zinc-400 py-10">加载中…</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-zinc-400 text-sm">还没有项目</p>
          <Link
            href="/designers"
            className="inline-block mt-4 text-sm px-4 py-2 rounded-full bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
          >
            找设计师
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {projects.map((p) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="block bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-100 dark:border-zinc-800 hover:border-zinc-200"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-sm font-medium">{p.title}</h2>
                  <p className="text-xs text-zinc-500 mt-1">
                    {p.designer?.name} · 设计费 ¥{p.contract?.total_price.toLocaleString()}
                  </p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_STYLE[p.status]}`}>
                  {STATUS_LABEL[p.status]}
                </span>
              </div>
              {/* 进度条 */}
              <div className="mt-3 h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div className="h-full bg-green-500" style={{ width: `${p.progress}%` }} />
              </div>
              <div className="mt-1 text-xs text-zinc-400">{p.progress}% 完成</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
