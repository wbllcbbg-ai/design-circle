"use client"

import { useState } from "react"
import Link from "next/link"

type Mode = "manual" | "auto"

export default function AdminPage() {
  const [mode, setMode] = useState<Mode>("auto")
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  // 手动表单
  const [form, setForm] = useState({ title: "", summary: "", content: "", category: "装修攻略" })

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
    <div className="bg-white dark:bg-zinc-900 min-h-screen">
      <div className="flex items-center px-4 h-12 border-b border-zinc-100 dark:border-zinc-800">
        <Link href="/" className="p-1">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
        <h1 className="text-sm font-medium flex-1 text-center">内容管理</h1>
      </div>

      {/* 导航链接 */}
      <div className="flex gap-4 px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800 text-xs">
        <Link href="/admin/applications" className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition">入驻审核</Link>
        <Link href="/admin/rewards" className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition">奖励规则</Link>
      </div>

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
        ) : (
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
        )}
      </div>
    </div>
  )
}
