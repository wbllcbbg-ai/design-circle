"use client"

import { useState } from "react"

type Mode = "manual" | "auto" | "batch"

export default function AdminPage() {
  const [mode, setMode] = useState<Mode>("auto")
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  // 手动表单
  const [form, setForm] = useState({ title: "", summary: "", content: "", category: "装修攻略" })

  // 批量生成
  const [genStrategy, setGenStrategy] = useState<"daily" | "init">("daily")
  const [genTypes, setGenTypes] = useState<string[]>(["article", "comment"])
  const [genCount, setGenCount] = useState(10)
  const [batchGenerating, setBatchGenerating] = useState(false)
  const [genResult, setGenResult] = useState<any>(null)
  const [genError, setGenError] = useState("")

  const handleBatchGenerate = async () => {
    setBatchGenerating(true)
    setGenError("")
    setGenResult(null)

    try {
      const counts: any = {}
      if (genStrategy === "init") {
        counts.articles = Math.max(1, Math.floor(genCount * 0.3))
        counts.comments = Math.max(1, Math.floor(genCount * 0.4))
        counts.questions = Math.max(1, Math.floor(genCount * 0.15))
        counts.reviews = Math.max(1, Math.floor(genCount * 0.1))
        counts.cases = Math.max(1, Math.floor(genCount * 0.05))
      }

      const res = await fetch("/api/admin/generate-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy: genStrategy, types: genTypes, counts }),
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
      {/* 模式切换 */}
      <div className="flex border-b border-zinc-100 dark:border-zinc-800">
        <button
          onClick={() => setMode("auto")}
          className={`flex-1 py-3 text-sm font-medium text-center ${mode === "auto" ? "border-b-2 border-zinc-900 dark:border-white" : "text-zinc-400"}`}
        >
          AI 生成
        </button>
        <button
          onClick={() => setMode("manual")}
          className={`flex-1 py-3 text-sm font-medium text-center ${mode === "manual" ? "border-b-2 border-zinc-900 dark:border-white" : "text-zinc-400"}`}
        >
          手动创建
        </button>
        <button
          onClick={() => setMode("batch")}
          className={`flex-1 py-3 text-sm font-medium text-center ${mode === "batch" ? "border-b-2 border-zinc-900 dark:border-white" : "text-zinc-400"}`}
        >
          批量生成
        </button>
      </div>

      <div className="p-4">
        {success && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <p className="text-xs text-green-600 dark:text-green-400">{success}</p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {mode === "auto" ? (
          <div>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="w-full py-3 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-full text-sm font-medium disabled:opacity-50"
            >
              {generating ? "AI 正在生成中..." : "一键生成装修文章"}
            </button>

            {result && (
              <div className="mt-4 space-y-4">
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                  <p className="text-xs text-zinc-400 mb-1">标题</p>
                  <p className="text-sm font-medium">{result.title}</p>
                </div>
                {result.summary && (
                  <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                    <p className="text-xs text-zinc-400 mb-1">摘要</p>
                    <p className="text-sm">{result.summary}</p>
                  </div>
                )}
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
                  <p className="text-xs text-zinc-400 mb-1">正文</p>
                  <p className="text-sm whitespace-pre-line">{result.content}</p>
                </div>
              </div>
            )}
          </div>
        ) : mode === "manual" ? (
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium mb-1.5">标题</p>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="文章标题"
                className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm outline-none"
              />
            </div>
            <div>
              <p className="text-sm font-medium mb-1.5">摘要</p>
              <input
                type="text"
                value={form.summary}
                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                placeholder="一句话摘要（可选）"
                className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm outline-none"
              />
            </div>
            <div>
              <p className="text-sm font-medium mb-1.5">分类</p>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm outline-none"
              >
                <option value="装修攻略">装修攻略</option>
                <option value="预算规划">预算规划</option>
                <option value="避坑指南">避坑指南</option>
                <option value="主材选购">主材选购</option>
                <option value="风格灵感">风格灵感</option>
              </select>
            </div>
            <div>
              <p className="text-sm font-medium mb-1.5">正文</p>
              <textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                placeholder="文章正文..."
                rows={10}
                className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm outline-none resize-none"
              />
            </div>
            <button
              onClick={handleManualSubmit}
              disabled={!form.title || !form.content}
              className="w-full py-2.5 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-full text-sm font-medium disabled:opacity-50"
            >
              发布文章
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* 生成策略 */}
            <div>
              <p className="text-sm font-medium mb-1.5">生成策略</p>
              <div className="flex gap-2">
                {(["daily", "init"] as const).map((s) => (
                  <button key={s}
                    onClick={() => setGenStrategy(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                      genStrategy === s ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {s === "daily" ? "日常维护" : "初始化填充"}
                  </button>
                ))}
              </div>
            </div>

            {/* 内容类型 */}
            <div>
              <p className="text-sm font-medium mb-1.5">内容类型</p>
              <div className="flex flex-wrap gap-3">
                {(["article", "case", "question", "comment", "review"] as const).map((t) => (
                  <label key={t} className="flex items-center gap-1.5 text-sm">
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
            </div>

            {genStrategy === "init" && (
              <div>
                <p className="text-sm font-medium mb-1.5">生成数量（仅初始化模式）</p>
                <input type="number" value={genCount} onChange={(e) => setGenCount(parseInt(e.target.value) || 1)}
                  min={1} max={100}
                  className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm outline-none" />
              </div>
            )}

            <button onClick={handleBatchGenerate} disabled={batchGenerating || genTypes.length === 0}
              className="w-full py-2.5 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-full text-sm font-medium disabled:opacity-50">
              {batchGenerating ? "生成中..." : "一键批量生成"}
            </button>

            {genResult && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <p className="text-xs text-green-600 dark:text-green-400">生成完成：共 {genResult.total} 条内容</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {genResult.results?.slice(0, 10).map((r: any, i: number) => (
                    <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded ${r.error ? "bg-red-50 text-red-500" : "bg-green-50 text-green-600"}`}>
                      {r.type}{r.title ? ": " + r.title.slice(0, 12) : ""}
                    </span>
                  ))}
                  {genResult.results?.length > 10 && (
                    <span className="text-[10px] text-zinc-400">...还有 {genResult.results.length - 10} 条</span>
                  )}
                </div>
              </div>
            )}

            {genError && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <p className="text-xs text-red-600 dark:text-red-400">{genError}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
