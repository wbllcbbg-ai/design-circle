"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { CheckCircle2, Clock, XCircle, FileText, ImageIcon, Upload } from "lucide-react"

type Attachment = { type: string; url: string; name: string }
type Milestone = {
  id: string
  node_index: number
  node_code: string
  node_name: string
  weight: number
  submitted_attachments: Attachment[]
  submitted_note: string | null
  designer_submitted_at: string | null
  user_confirmed_at: string | null
  status: string
}
type Project = {
  id: string
  title: string
  status: string
  progress: number
  current_milestone: number
  designer: { id: string; name: string; logo_url: string | null } | null
  user: { id: string; nickname: string } | null
  contract: { id: string; total_price: number; service_fee_amount: number; status: string } | null
}

const STATUS_STYLE: Record<string, string> = {
  pending: "text-zinc-400",
  in_review: "text-blue-500",
  confirmed: "text-green-500",
  rejected: "text-red-500",
}
const STATUS_LABEL: Record<string, string> = {
  pending: "待提交",
  in_review: "待确认",
  confirmed: "已确认",
  rejected: "已退回",
}

export default function ProjectPage() {
  const params = useParams<{ id: string }>()
  const [project, setProject] = useState<Project | null>(null)
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [myRole, setMyRole] = useState<"client" | "designer">("client")
  const [loading, setLoading] = useState(true)
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null)
  const [noteDraft, setNoteDraft] = useState<Record<number, string>>({})

  const load = useCallback(async () => {
    const res = await fetch(`/api/projects/${params.id}`)
    if (!res.ok) return
    const data = await res.json()
    setProject(data.project)
    setMilestones(data.milestones)
    setMyRole(data.my_role)
  }, [params.id])

  useEffect(() => {
    // 首屏加载：fetch 完成后在 then 回调里关闭 loading（避免 effect body 同步 setState）
    load().finally(() => setLoading(false))
  }, [load])

  // 设计师上传交付物
  async function handleUpload(milestone: Milestone) {
    const input = document.createElement("input")
    input.type = "file"
    input.multiple = true
    input.accept = "image/*,application/pdf"
    input.onchange = async () => {
      if (!input.files?.length) return
      setUploadingIdx(milestone.node_index)
      const attachments: Attachment[] = []
      for (const file of Array.from(input.files)) {
        const fd = new FormData()
        fd.append("file", file)
        const res = await fetch("/api/upload-deliverable", { method: "POST", body: fd })
        if (res.ok) {
          const data = await res.json()
          attachments.push({
            type: file.type.startsWith("image/") ? "image" : "pdf",
            url: data.url,
            name: file.name,
          })
        }
      }
      // 提交里程碑
      await fetch(`/api/projects/${params.id}/milestones/${milestone.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "submit",
          attachments,
          note: noteDraft[milestone.node_index] || "",
        }),
      })
      setUploadingIdx(null)
      setNoteDraft({})
      load()
    }
    input.click()
  }

  // 业主确认 / 退回
  async function handleAction(milestone: Milestone, action: "confirm" | "reject") {
    const body: { action: string; reason?: string } = { action }
    if (action === "reject") {
      body.reason = prompt("退回原因（选填）") || ""
    }
    await fetch(`/api/projects/${params.id}/milestones/${milestone.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    load()
  }

  if (loading) {
    return <div className="p-8 text-center text-zinc-400">加载中…</div>
  }
  if (!project) {
    return <div className="p-8 text-center text-zinc-400">项目不存在</div>
  }

  const isCompleted = project.status === "completed"

  return (
    <div className="p-4 space-y-4 pb-20">
      {/* 顶部：项目名 + 状态 */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-100 dark:border-zinc-800">
        <h1 className="text-lg font-semibold">{project.title}</h1>
        <div className="flex items-center gap-3 mt-1 text-sm text-zinc-500">
          <span>
            {project.designer?.name}
            {myRole === "designer" ? "（你）" : ""}
          </span>
          <span>·</span>
          <span>设计费 ¥{project.contract?.total_price.toLocaleString()}</span>
        </div>
        {/* 进度条 */}
        <div className="mt-3 h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all"
            style={{ width: `${project.progress}%` }}
          />
        </div>
        <div className="mt-1 text-xs text-zinc-400">{project.progress}% 完成</div>
      </div>

      {/* 进度：4 节点时间线 */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-100 dark:border-zinc-800">
        <h2 className="text-sm font-medium mb-3 flex items-center gap-1.5">
          📋 交付进度
        </h2>
        <div className="space-y-3">
          {milestones.map((m) => {
            const isCurrent =
              m.status !== "confirmed" && m.node_index === project.current_milestone
            return (
              <div
                key={m.id}
                className={`p-3 rounded-lg border ${
                  isCurrent
                    ? "border-blue-300 bg-blue-50 dark:bg-blue-950/30"
                    : "border-zinc-100 dark:border-zinc-800"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {m.status === "confirmed" ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : m.status === "rejected" ? (
                      <XCircle className="w-4 h-4 text-red-500" />
                    ) : m.status === "in_review" ? (
                      <Clock className="w-4 h-4 text-blue-500" />
                    ) : (
                      <Clock className="w-4 h-4 text-zinc-300" />
                    )}
                    <span className="text-sm font-medium">{m.node_name}</span>
                    {m.weight > 0 && (
                      <span className="text-xs text-zinc-400">{m.weight}%</span>
                    )}
                  </div>
                  <span className={`text-xs ${STATUS_STYLE[m.status]}`}>
                    {STATUS_LABEL[m.status]}
                  </span>
                </div>

                {/* 已提交的交付物 */}
                {m.submitted_attachments.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {m.submitted_attachments.map((a, i) => (
                      <a
                        key={i}
                        href={a.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                      >
                        {a.type === "image" ? (
                          <ImageIcon className="w-3 h-3" />
                        ) : (
                          <FileText className="w-3 h-3" />
                        )}
                        {a.name}
                      </a>
                    ))}
                  </div>
                )}
                {m.submitted_note && (
                  <p className="mt-1.5 text-xs text-zinc-500">{m.submitted_note}</p>
                )}

                {/* 操作按钮 */}
                {!isCompleted && (
                  <div className="mt-2 flex items-center gap-2">
                    {/* 设计师：提交交付物 */}
                    {myRole === "designer" && m.status !== "confirmed" && (
                      <>
                        <input
                          value={noteDraft[m.node_index] || ""}
                          onChange={(e) =>
                            setNoteDraft({ ...noteDraft, [m.node_index]: e.target.value })
                          }
                          placeholder="附言（选填）"
                          className="flex-1 text-xs px-2 py-1.5 rounded border border-zinc-200 dark:border-zinc-700 bg-transparent"
                        />
                        <button
                          onClick={() => handleUpload(m)}
                          disabled={uploadingIdx === m.node_index}
                          className="text-xs px-3 py-1.5 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50 flex items-center gap-1"
                        >
                          <Upload className="w-3 h-3" />
                          {uploadingIdx === m.node_index ? "上传中…" : "提交交付"}
                        </button>
                      </>
                    )}

                    {/* 业主：确认 / 退回 */}
                    {myRole === "client" && m.status === "in_review" && (
                      <>
                        <button
                          onClick={() => handleAction(m, "confirm")}
                          className="text-xs px-3 py-1.5 rounded bg-green-500 text-white hover:bg-green-600"
                        >
                          确认通过
                        </button>
                        <button
                          onClick={() => handleAction(m, "reject")}
                          className="text-xs px-3 py-1.5 rounded border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300"
                        >
                          退回
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 交付看板 */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-100 dark:border-zinc-800">
        <h2 className="text-sm font-medium mb-3">💰 交付看板</h2>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-zinc-400">合同总额</div>
            <div className="font-semibold">¥{project.contract?.total_price.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-xs text-zinc-400">已确认节点</div>
            <div className="font-semibold">
              {milestones.filter((m) => m.status === "confirmed").length} / {milestones.length}
            </div>
          </div>
        </div>
        <p className="mt-2 text-xs text-zinc-400">
          资金由业主与设计师自行结算，平台不托管资金，仅见证交付节点。
        </p>
      </div>

      {/* 对话入口 */}
      <Link
        href="/messages"
        className="block bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-100 dark:border-zinc-800 hover:border-zinc-200"
      >
        <h2 className="text-sm font-medium">💬 项目沟通</h2>
        <p className="text-xs text-zinc-400 mt-1">所有沟通记录在平台留痕，纠纷时有据可查</p>
      </Link>

      {/* 竣工后评价入口（业主） */}
      {isCompleted && myRole === "client" && (
        <Link
          href={`/designers/${project.designer?.id}`}
          className="block bg-green-50 dark:bg-green-950/30 rounded-xl p-4 border border-green-200 dark:border-green-900"
        >
          <h2 className="text-sm font-medium text-green-700 dark:text-green-400">
            ⭐ 项目已竣工，去评价设计师
          </h2>
          <p className="text-xs text-zinc-500 mt-1">你的评价将计入设计师真实信用分</p>
        </Link>
      )}
    </div>
  )
}
