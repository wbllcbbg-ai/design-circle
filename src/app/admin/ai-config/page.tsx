"use client"

import { useEffect, useState } from "react"

export default function AiConfigPage() {
  const [config, setConfig] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    fetch("/api/admin/ai-config")
      .then(r => r.json())
      .then(data => {
        setConfig(data.config || {})
        setLoading(false)
      })
  }, [])

  const handleSave = async () => {
    setSaving(true)
    setMessage("")
    const res = await fetch("/api/admin/ai-config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ updates: config }),
    })
    const data = await res.json()
    if (data.success) {
      setMessage("保存成功")
    } else {
      setMessage(data.error || "保存失败")
    }
    setSaving(false)
  }

  const fields = [
    { key: "ai_api_key", label: "DeepSeek API Key", placeholder: "sk-xxxxxxxxxxxxxxxx", type: "password" },
    { key: "wanxiang_key", label: "通义万相 API Key（用于 AI 生图）", placeholder: "sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", type: "password" },
    { key: "unsplash_key", label: "Unsplash Access Key（备用配图）", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", type: "text" },
  ]

  if (loading) return <div className="flex items-center justify-center py-10 text-sm text-zinc-400">加载中...</div>

  return (
    <div className="p-4">
      <h2 className="text-sm font-medium mb-4">AI 服务配置</h2>

      <div className="space-y-4">
        {fields.map((f) => (
          <div key={f.key}>
            <p className="text-xs text-zinc-500 mb-1">{f.label}</p>
            <input
              type={f.type}
              value={config[f.key] || ""}
              onChange={(e) => setConfig({ ...config, [f.key]: e.target.value })}
              placeholder={f.placeholder}
              className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-sm outline-none font-mono"
            />
          </div>
        ))}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2.5 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-full text-sm font-medium disabled:opacity-50"
        >
          {saving ? "保存中..." : "保存配置"}
        </button>

        {message && (
          <p className={`text-xs text-center ${message === "保存成功" ? "text-green-600" : "text-red-500"}`}>
            {message}
          </p>
        )}

        <div className="mt-6 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
          <p className="text-xs text-zinc-500">
            <strong>说明：</strong>配置保存后立即生效，无需重启服务。
          </p>
          <ul className="mt-2 space-y-1 text-[10px] text-zinc-400 list-disc list-inside">
            <li>DeepSeek Key — 用于 AI 内容生成（文章、评论、评价等文本内容）</li>
            <li>通义万相 Key — 用于 AI 生图（案例封面、文章配图），配置后自动启用，否则用 Unsplash 或占位图</li>
            <li>Unsplash Key — 备用配图（通义万相关闭或失败时会回退到 Unsplash）</li>
            <li>Key 存储在数据库中，优先级高于环境变量</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
