"use client"

import { useEffect, useState } from "react"

type Mode = "manual" | "auto" | "batch"

type ContentItem = {
  id: string
  title: string
  type: "article" | "case" | "comment" | "question"
  source: "ai" | "edited" | "manual"
  virtualUser: string | null
  status: "published" | "draft"
  createdAt: string
}

const SOURCE_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  ai: { label: "纯AI生成", icon: "🗲", color: "text-zinc-400" },
  edited: { label: "人工修改过", icon: "✏️", color: "text-blue-500" },
  manual: { label: "手动创建", icon: "👤", color: "text-green-500" },
}

const TYPE_ICONS: Record<string, string> = {
  article: "📄",
  case: "📷",
  comment: "💬",
  question: "💬",
}

export default function AdminPage() {
  // --- 内容列表状态 ---
  const [contents, setContents] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState<string>("")
  const [sourceFilter, setSourceFilter] = useState<string>("")
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const pageSize = 15

  // --- 生成模式状态 ---
  const [mode, setMode] = useState<Mode>("auto")
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [form, setForm] = useState({ title: "", summary: "", content: "", category: "装修攻略" })
  const [genStrategy, setGenStrategy] = useState<"daily" | "init">("daily")
  const [genTypes, setGenTypes] = useState<string[]>(["article", "comment"])
  const [genCount, setGenCount] = useState(10)
  const [batchGenerating, setBatchGenerating] = useState(false)
  const [genResult, setGenResult] = useState<any>(null)
  const [genError, setGenError] = useState("")

  // --- 编辑弹窗状态 ---
  const [editingContent, setEditingContent] = useState<ContentItem | null>(null)
  const [editDetail, setEditDetail] = useState<any>(null)
  const [editLoading, setEditLoading] = useState(false)
  const [editTitle, setEditTitle] = useState("")
  const [editContent, setEditContent] = useState("")
  const [editSaving, setEditSaving] = useState(false)
  const [editMessage, setEditMessage] = useState("")
  const [editError, setEditError] = useState("")
  const [diffData, setDiffData] = useState<any>(null)
  const [styleRefAsRef, setStyleRefAsRef] = useState(true)

  const openEdit = async (item: ContentItem) => {
    setEditingContent(item)
    setEditLoading(true)
    setDiffData(null)
    setEditError("")
    try {
      const [detailRes, diffRes] = await Promise.all([
        fetch(`/api/admin/content/${item.id}`),
        item.type === "article" || item.type === "case"
          ? fetch(`/api/admin/content/${item.id}?view=diff`).then((r) => r.json()).catch(() => ({}))
          : Promise.resolve(null),
      ])
      if (!detailRes.ok) throw new Error("加载失败")
      const detail = await detailRes.json()
      if (!detail.content) throw new Error("内容数据异常")
      setEditDetail(detail.content)
      setEditTitle(detail.content?.title || "")
      setEditContent(detail.content?.content || "")
      if (diffRes?.diff) setDiffData(diffRes.diff)
    } catch (e: any) {
      setEditError(e.message || "加载失败，请重试")
    }
    setEditLoading(false)
  }

  const handleEditSave = async () => {
    if (!editingContent) return
    setEditSaving(true)
    setEditMessage("")
    try {
      const res = await fetch(`/api/admin/content/${editingContent.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: editTitle, content: editContent, style_reference: styleRefAsRef }),
      })
      const data = await res.json()
      if (data.success) {
        setEditMessage("保存成功")
        setEditingContent(null)
        // 局部刷新（触发 useEffect 重新加载）
        setPage(1)
        setTimeout(() => setPage(page), 50)
      } else {
        setEditMessage(data.error || "保存失败")
      }
    } catch {
      setEditMessage("保存失败")
    }
    setEditSaving(false)
  }

  // --- 加载内容列表 ---
  useEffect(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set("search", search)
    if (typeFilter) params.set("type", typeFilter)
    if (sourceFilter) params.set("source", sourceFilter)
    params.set("page", String(page))
    params.set("pageSize", String(pageSize))

    fetch(`/api/admin/content?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setContents(data.contents ?? [])
        setTotal(data.total ?? 0)
        setLoading(false)
      })
      .catch(() => {
        // API 还没建时用空数据
        setContents([])
        setTotal(0)
        setLoading(false)
      })
  }, [search, typeFilter, sourceFilter, page])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  // --- 生成操作（保持不变） ---
  const handleBatchGenerate = async () => {
    setBatchGenerating(true)
    setGenError("")
    setGenResult(null)
    try {
      const res = await fetch("/api/admin/generate-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy: genStrategy, types: genTypes }),
      })
      const data = await res.json()
      if (!res.ok) {
        setGenError(data.error || "生成失败")
      } else {
        setGenResult(data)
        setSuccess(`批量生成完成：共 ${data.total} 条内容`)
      }
    } catch (e: any) {
      setGenError(e.message)
    }
    setBatchGenerating(false)
  }

  const handleGenerate = async () => {
    setGenerating(true)
    setError("")
    setResult(null)
    try {
      const res = await fetch("/api/generate", { method: "POST" })
      const data = await res.json()
      if (data.success) {
        setResult(data.article)
        setSuccess(`文章「${data.article.title}」已发布`)
      } else {
        setError(data.error || "生成失败")
        if (data.draft) setResult(data.draft)
      }
    } catch (e: any) {
      setError(e.message)
    }
    setGenerating(false)
  }

  const handleManualSubmit = async () => {
    if (!form.title || !form.content) return
    setError("")
    setSuccess("")
    try {
      const res = await fetch("/api/generate", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (data.success) {
        setSuccess(`文章「${data.article.title}」已发布`)
        setForm({ title: "", summary: "", content: "", category: "装修攻略" })
      } else {
        setError(data.error)
      }
    } catch (e: any) {
      setError(e.message)
    }
  }

  return (
    <div>
      {/* === 操作区（收起在顶部） === */}
      <div className="border-b border-zinc-100 dark:border-zinc-800">
        <div className="flex">
          <button
            onClick={() => setMode("auto")}
            className={`flex-1 py-2.5 text-xs font-medium text-center ${
              mode === "auto" ? "border-b-2 border-zinc-900 dark:border-white" : "text-zinc-400"
            }`}
          >
            AI 生成
          </button>
          <button
            onClick={() => setMode("manual")}
            className={`flex-1 py-2.5 text-xs font-medium text-center ${
              mode === "manual" ? "border-b-2 border-zinc-900 dark:border-white" : "text-zinc-400"
            }`}
          >
            手动创建
          </button>
          <button
            onClick={() => setMode("batch")}
            className={`flex-1 py-2.5 text-xs font-medium text-center ${
              mode === "batch" ? "border-b-2 border-zinc-900 dark:border-white" : "text-zinc-400"
            }`}
          >
            批量生成
          </button>
        </div>

        {/* 生成模式面板 */}
        {mode !== "auto" && mode !== "manual" && mode !== "batch" ? null : (
          <div className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
            {success && (
              <div className="mb-3 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-[10px] text-green-600 dark:text-green-400">{success}</p>
              </div>
            )}
            {error && (
              <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <p className="text-[10px] text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {mode === "auto" && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="flex-1 py-2 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-full text-xs font-medium disabled:opacity-50"
                >
                  {generating ? "AI 正在生成中..." : "一键生成装修文章"}
                </button>
              </div>
            )}

            {mode === "manual" && (
              <div className="space-y-2">
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="文章标题"
                  className="w-full px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-xs outline-none"
                />
                <textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder="正文..."
                  rows={4}
                  className="w-full px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-xs outline-none resize-none"
                />
                <button
                  onClick={handleManualSubmit}
                  disabled={!form.title || !form.content}
                  className="w-full py-1.5 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-full text-xs font-medium disabled:opacity-50"
                >
                  发布文章
                </button>
              </div>
            )}

            {mode === "batch" && (
              <div className="space-y-2">
                <div className="flex gap-2 flex-wrap">
                  {(["article", "case", "question", "comment", "review"] as const).map((t) => (
                    <label key={t} className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={genTypes.includes(t)}
                        onChange={(e) => setGenTypes(e.target.checked ? [...genTypes, t] : genTypes.filter(x => x !== t))}
                        className="rounded border-zinc-300 dark:border-zinc-600"
                      />
                      {t === "article" ? "文章" : t === "case" ? "案例" : t === "question" ? "提问" : t === "comment" ? "评论" : "评价"}
                    </label>
                  ))}
                </div>
                <button
                  onClick={handleBatchGenerate}
                  disabled={batchGenerating || genTypes.length === 0}
                  className="w-full py-1.5 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-full text-xs font-medium disabled:opacity-50"
                >
                  {batchGenerating ? "生成中..." : "一键批量生成"}
                </button>
                {genResult && (
                  <p className="text-[10px] text-green-600">生成完成：共 {genResult.total} 条</p>
                )}
                {genError && <p className="text-[10px] text-red-500">{genError}</p>}
              </div>
            )}

            {result && mode === "auto" && (
              <div className="mt-2 p-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-xs">
                <p className="font-medium">{result.title}</p>
                {result.summary && <p className="text-zinc-500 mt-1">{result.summary}</p>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* === 内容列表 === */}
      <div className="p-4">
        {/* 筛选栏 */}
        <div className="flex items-center gap-2 mb-3">
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="搜索标题..."
            className="flex-1 px-2.5 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-xs outline-none"
          />
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
            className="px-2 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-xs outline-none"
          >
            <option value="">全部类型</option>
            <option value="article">文章</option>
            <option value="case">案例</option>
            <option value="comment">评论</option>
            <option value="question">提问</option>
          </select>
          <select
            value={sourceFilter}
            onChange={(e) => { setSourceFilter(e.target.value); setPage(1) }}
            className="px-2 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-xs outline-none"
          >
            <option value="">全部来源</option>
            <option value="ai">纯AI生成</option>
            <option value="edited">人工修改过</option>
            <option value="manual">手动创建</option>
          </select>
        </div>

        {/* 表格 */}
        {loading ? (
          <div className="py-10 text-center text-xs text-zinc-400">加载中...</div>
        ) : contents.length === 0 ? (
          <div className="py-10 text-center text-xs text-zinc-400">
            {search || typeFilter || sourceFilter ? "没有匹配的内容" : "暂无内容，使用上方操作区生成"}
          </div>
        ) : (
          <div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
                    <th className="text-left py-2 pr-2 font-medium">标题</th>
                    <th className="text-left py-2 px-2 font-medium whitespace-nowrap">类型</th>
                    <th className="text-left py-2 px-2 font-medium whitespace-nowrap">来源</th>
                    <th className="text-left py-2 px-2 font-medium whitespace-nowrap">虚拟人</th>
                    <th className="text-left py-2 px-2 font-medium whitespace-nowrap">状态</th>
                    <th className="text-right py-2 pl-2 font-medium whitespace-nowrap">时间</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {contents.map((item) => {
                    const src = SOURCE_LABELS[item.source]
                    return (
                      <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer" onClick={() => openEdit(item)}>
                        <td className="py-2 pr-2 max-w-[160px] truncate">{item.title}</td>
                        <td className="py-2 px-2 whitespace-nowrap">{TYPE_ICONS[item.type]}</td>
                        <td className="py-2 px-2 whitespace-nowrap">
                          <span className={`${src.color}`}>{src.icon} {src.label}</span>
                        </td>
                        <td className="py-2 px-2 whitespace-nowrap text-zinc-400">
                          {item.virtualUser ? `👤 ${item.virtualUser}` : "—"}
                        </td>
                        <td className="py-2 px-2 whitespace-nowrap">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                            item.status === "published"
                              ? "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400"
                              : "bg-zinc-100 text-zinc-400"
                          }`}>
                            {item.status === "published" ? "已发布" : "草稿"}
                          </span>
                        </td>
                        <td className="py-2 pl-2 whitespace-nowrap text-zinc-400 text-right">{item.createdAt}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* 分页 */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-3">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="px-2 py-1 text-[10px] bg-zinc-100 dark:bg-zinc-800 rounded disabled:opacity-30"
                >
                  上一页
                </button>
                <span className="text-[10px] text-zinc-400">{page}/{totalPages}</span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="px-2 py-1 text-[10px] bg-zinc-100 dark:bg-zinc-800 rounded disabled:opacity-30"
                >
                  下一页
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 编辑弹窗 */}
      {editingContent && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditingContent(null)}>
          <div className="bg-white dark:bg-zinc-900 rounded-2xl p-5 w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {editLoading ? (
              <p className="text-sm text-zinc-400 text-center py-4">加载中...</p>
            ) : editError ? (
              <div className="text-center py-6">
                <p className="text-sm text-red-500">{editError}</p>
                <button onClick={() => { setEditingContent(null) }} className="mt-3 text-xs text-zinc-400 underline">关闭</button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-medium">编辑内容</h2>
                  <span className="text-[10px] text-zinc-400">{editingContent.type === "article" ? "📄 文章" : "📷 案例"}</span>
                </div>

                {/* 来源标记 */}
                <div className="text-[10px] text-zinc-400">
                  来源: {editDetail?.ai_generated_content ? (editDetail?.edited_by_human ? "✏️ 人工修改过" : "🗲 纯AI生成") : "👤 手动创建"}
                  {editDetail?.virtual_user && ` · 👤 ${editDetail.virtual_user}`}
                </div>

                <div>
                  <p className="text-xs text-zinc-500 mb-1">标题</p>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm outline-none"
                  />
                </div>

                <div>
                  <p className="text-xs text-zinc-500 mb-1">正文</p>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={8}
                    className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm outline-none resize-none"
                  />
                </div>

                {/* 版本对比 */}
                {diffData && diffData.ai_version && (
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
                    <p className="text-xs font-medium text-zinc-500 mb-1">版本对比</p>
                    <div className="space-y-1 text-[10px]">
                      <div>
                        <span className="text-zinc-400">🤖 AI 原始版: </span>
                        <span className="text-zinc-500">{diffData.ai_version.slice(0, 200)}{diffData.ai_version.length > 200 ? "..." : ""}</span>
                      </div>
                      {diffData.content_length_change !== 0 && (
                        <div className="text-amber-500">
                          {diffData.content_length_change > 0 ? `+${diffData.content_length_change}` : diffData.content_length_change} 字 (当前 vs AI原始)
                        </div>
                      )}
                      {editDetail?.virtual_user && (
                        <label className="flex items-center gap-1.5 text-[10px] text-zinc-400 mt-1.5 pt-1.5 border-t border-zinc-200 dark:border-zinc-700">
                          <input
                            type="checkbox"
                            checked={styleRefAsRef}
                            onChange={(e) => setStyleRefAsRef(e.target.checked)}
                            className="rounded"
                          />
                          将此修改作为该虚拟人后续生成的参考
                        </label>
                      )}
                    </div>
                  </div>
                )}

                {editMessage && (
                  <p className={`text-xs ${editMessage === "保存成功" ? "text-green-600" : "text-red-500"}`}>{editMessage}</p>
                )}

                <div className="flex gap-2">
                  <button onClick={() => setEditingContent(null)} className="flex-1 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-full text-sm">
                    取消
                  </button>
                  <button onClick={handleEditSave} disabled={editSaving} className="flex-1 py-2 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-full text-sm font-medium disabled:opacity-50">
                    {editSaving ? "保存中..." : "保存"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
