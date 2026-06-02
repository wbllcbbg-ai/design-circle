"use client"

import { useState } from "react"
import { getRoleLabel } from "@/lib/types"
import Link from "next/link"

export default function ApplyPage() {
  const [form, setForm] = useState({
    type: "designer",
    name: "",
    phone: "",
    description: "",
    specialties: "",
  })
  const [posting, setPosting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async () => {
    if (!form.name || !form.phone) return
    setPosting(true)
    setError("")

    const res = await fetch("/api/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        specialties: form.specialties.split(/[,\s\/]+/).filter(Boolean),
      }),
    })
    const data = await res.json()
    if (data.success) setDone(true)
    else setError(data.error || "提交失败")
    setPosting(false)
  }

  if (done) {
    return (
      <div className="bg-white dark:bg-zinc-900 min-h-screen flex items-center justify-center">
        <div className="text-center px-4">
          <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 2 11 13M22 2l-8 20-4-8" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold mb-2">申请已提交</h2>
          <p className="text-sm text-zinc-500">我们会在1-3个工作日内审核你的申请</p>
          <Link href="/" className="mt-6 inline-block text-sm text-zinc-400 underline">返回首页</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-zinc-900 min-h-screen">
      <div className="flex items-center px-4 h-12 border-b border-zinc-100 dark:border-zinc-800">
        <Link href="/profile" className="p-1">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
        <h1 className="text-sm font-medium flex-1 text-center">设计师入驻申请</h1>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <p className="text-sm font-medium mb-2">申请类型 *</p>
          <div className="flex gap-2">
            {["designer", "company", "worker"].map((value) => {
              const label = getRoleLabel(value)
              return (
                <button
                  key={value}
                  onClick={() => setForm({ ...form, type: value })}
                  className={`flex-1 py-2.5 rounded-full text-sm font-medium ${
                    form.type === value
                      ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                      : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <p className="text-sm font-medium mb-1.5">名称 *</p>
          <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="你的姓名/公司名/工长名" className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm outline-none" />
        </div>

        <div>
          <p className="text-sm font-medium mb-1.5">手机号 *</p>
          <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="联系方式" className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm outline-none" />
        </div>

        <div>
          <p className="text-sm font-medium mb-1.5">简介</p>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="介绍一下你自己或团队" rows={3} className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm outline-none resize-none" />
        </div>

        <div>
          <p className="text-sm font-medium mb-1.5">专长标签</p>
          <input type="text" value={form.specialties} onChange={(e) => setForm({ ...form, specialties: e.target.value })} placeholder="多个标签用逗号分隔，如：现代简约,北欧风,小户型" className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm outline-none" />
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button onClick={handleSubmit} disabled={!form.name || !form.phone || posting}
          className="w-full py-2.5 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-full text-sm font-medium disabled:opacity-50"
        >
          {posting ? "提交中..." : "提交申请"}
        </button>
      </div>
    </div>
  )
}
