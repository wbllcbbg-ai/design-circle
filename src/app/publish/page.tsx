"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { ImageUpload } from "@/components/ui/image-upload"

type Mode = "select" | "case" | "review" | "question"

// 发布案例表单
function CaseForm({ onBack, onSuccess }: { onBack: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ title: "", description: "", style: "", area: "", budget: "", duration: "" })
  const [images, setImages] = useState<string[]>([])
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async () => {
    if (!form.title) return
    setPosting(true)
    setError("")

    const res = await fetch("/api/cases", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        description: form.description,
        style: form.style,
        area: form.area ? parseFloat(form.area) : null,
        budget: form.budget ? parseFloat(form.budget) : null,
        duration: form.duration,
        cover_url: images[0] || "",
        images: images,
      }),
    })
    const data = await res.json()
    if (data.success) {
      onSuccess()
    } else {
      setError(data.error || "发布失败")
    }
    setPosting(false)
  }

  const styles = ["现代简约", "北欧风", "新中式", "日式", "轻奢", "混搭"]

  return (
    <div className="bg-white dark:bg-zinc-900 min-h-screen">
      <div className="flex items-center gap-2 px-4 h-12 border-b border-zinc-100 dark:border-zinc-800">
        <button onClick={onBack} className="p-1">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <h1 className="text-sm font-medium flex-1 text-center">发布案例</h1>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <p className="text-sm font-medium mb-2">上传图片</p>
          <ImageUpload images={images} onChange={setImages} max={9} />
        </div>
        <div>
          <p className="text-sm font-medium mb-2">标题 *</p>
          <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="给你的案例起个名字" className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm outline-none" />
        </div>
        <div>
          <p className="text-sm font-medium mb-2">描述</p>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="分享一下你的装修心得..." rows={4} className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm outline-none resize-none" />
        </div>
        <div>
          <p className="text-sm font-medium mb-2">风格</p>
          <div className="flex flex-wrap gap-2">
            {styles.map((s) => (
              <button key={s} onClick={() => setForm({ ...form, style: s })}
                className={`px-3 py-1.5 rounded-full text-xs ${form.style === s ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400"}`}
              >{s}</button>
            ))}
          </div>
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <p className="text-sm font-medium mb-2">面积 (㎡)</p>
            <input type="number" value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} placeholder="130" className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm outline-none" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium mb-2">预算 (万)</p>
            <input type="number" value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} placeholder="28" className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm outline-none" />
          </div>
        </div>
        <div>
          <p className="text-sm font-medium mb-2">工期</p>
          <input type="text" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="如：4个月" className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm outline-none" />
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button onClick={handleSubmit} disabled={!form.title || posting}
          className="w-full py-2.5 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-full text-sm font-medium disabled:opacity-50"
        >
          {posting ? "发布中..." : "发布"}
        </button>
      </div>
    </div>
  )
}

// 写点评表单
function ReviewForm({ onBack, onSuccess }: { onBack: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ designer_name: "", rating: 0, design_score: 0, construction_score: 0, service_score: 0, content: "", is_real_name: false })
  const [images, setImages] = useState<string[]>([])
  const [designers, setDesigners] = useState<any[]>([])
  const [selectedDesigner, setSelectedDesigner] = useState<any>(null)
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch("/api/designers").then(r => r.json()).then(d => setDesigners(d.designers || []))
  }, [])

  const StarBtn = ({ score, setScore }: { score: number; setScore: (n: number) => void }) => (
    <div className="flex gap-1 text-2xl">
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} onClick={() => setScore(i)} className={`${i <= score ? "text-amber-400" : "text-zinc-200 dark:text-zinc-700"} transition`}>★</button>
      ))}
    </div>
  )

  const handleSubmit = async () => {
    if (!selectedDesigner || !form.rating || !form.content) return
    setPosting(true)
    setError("")

    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        designer_id: selectedDesigner.id,
        rating: form.rating,
        design_score: form.design_score || form.rating,
        construction_score: form.construction_score || form.rating,
        service_score: form.service_score || form.rating,
        content: form.content,
        images: images,
        is_real_name: form.is_real_name,
      }),
    })
    const data = await res.json()
    if (data.success) onSuccess()
    else setError(data.error || "提交失败")
    setPosting(false)
  }

  return (
    <div className="bg-white dark:bg-zinc-900 min-h-screen">
      <div className="flex items-center gap-2 px-4 h-12 border-b border-zinc-100 dark:border-zinc-800">
        <button onClick={onBack} className="p-1">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <h1 className="text-sm font-medium flex-1 text-center">写点评</h1>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <p className="text-sm font-medium mb-2">设计师/公司 *</p>
          <select onChange={(e) => setSelectedDesigner(designers.find(d => d.id === e.target.value))} className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm outline-none">
            <option value="">选择设计师</option>
            {designers.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>

        <div>
          <p className="text-sm font-medium mb-2">综合评分 *</p>
          <StarBtn score={form.rating} setScore={(n) => setForm({ ...form, rating: n })} />
        </div>

        <div className="space-y-3">
          {[
            { label: "设计", key: "design_score" as const },
            { label: "施工", key: "construction_score" as const },
            { label: "服务", key: "service_score" as const },
          ].map((dim) => (
            <div key={dim.label} className="flex items-center gap-3">
              <span className="text-sm text-zinc-500 w-10">{dim.label}</span>
              <StarBtn score={form[dim.key]} setScore={(n) => setForm({ ...form, [dim.key]: n })} />
            </div>
          ))}
        </div>

        <div>
          <p className="text-sm font-medium mb-2">评价内容 *</p>
          <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="分享你的真实体验..." rows={4} className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm outline-none resize-none" />
        </div>

        <div>
          <p className="text-sm font-medium mb-2">上传图片（可选）</p>
          <ImageUpload images={images} onChange={setImages} max={6} />
        </div>

        <label className="flex items-center gap-2">
          <input type="checkbox" checked={form.is_real_name} onChange={(e) => setForm({ ...form, is_real_name: e.target.checked })} className="rounded" />
          <span className="text-sm text-zinc-500">实名评价</span>
        </label>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button onClick={handleSubmit} disabled={!selectedDesigner || !form.rating || !form.content || posting}
          className="w-full py-2.5 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-full text-sm font-medium disabled:opacity-50"
        >
          {posting ? "提交中..." : "提交点评"}
        </button>
      </div>
    </div>
  )
}

// 提问表单
function QuestionForm({ onBack, onSuccess }: { onBack: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ title: "", content: "", category: "其他" })
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async () => {
    if (!form.title || !form.content) return
    setPosting(true)
    setError("")

    const res = await fetch("/api/questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (data.success) onSuccess()
    else setError(data.error || "发布失败")
    setPosting(false)
  }

  const cats = ["设计", "施工", "预算", "主材", "软装", "验收", "其他"]

  return (
    <div className="bg-white dark:bg-zinc-900 min-h-screen">
      <div className="flex items-center gap-2 px-4 h-12 border-b border-zinc-100 dark:border-zinc-800">
        <button onClick={onBack} className="p-1">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <h1 className="text-sm font-medium flex-1 text-center">提问求助</h1>
      </div>

      <div className="p-4 space-y-4">
        <div>
          <p className="text-sm font-medium mb-2">标题 *</p>
          <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="用一句话概括你的问题" className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm outline-none" />
        </div>
        <div>
          <p className="text-sm font-medium mb-2">详细描述 *</p>
          <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="描述你遇到的具体问题..." rows={6} className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm outline-none resize-none" />
        </div>
        <div>
          <p className="text-sm font-medium mb-2">分类</p>
          <div className="flex flex-wrap gap-2">
            {cats.map((c) => (
              <button key={c} onClick={() => setForm({ ...form, category: c })}
                className={`px-3 py-1.5 rounded-full text-xs ${form.category === c ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400"}`}
              >{c}</button>
            ))}
          </div>
        </div>

        {error && <p className="text-xs text-red-500">{error}</p>}

        <button onClick={handleSubmit} disabled={!form.title || !form.content || posting}
          className="w-full py-2.5 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-full text-sm font-medium disabled:opacity-50"
        >
          {posting ? "发布中..." : "发布"}
        </button>
      </div>
    </div>
  )
}

export default function PublishPage() {
  const [mode, setMode] = useState<Mode>("select")
  const [successMsg, setSuccessMsg] = useState("")

  const handleSuccess = () => {
    setSuccessMsg("发布成功！")
    setTimeout(() => { setMode("select"); setSuccessMsg("") }, 2000)
  }

  if (mode === "case") return <CaseForm onBack={() => setMode("select")} onSuccess={handleSuccess} />
  if (mode === "review") return <ReviewForm onBack={() => setMode("select")} onSuccess={handleSuccess} />
  if (mode === "question") return <QuestionForm onBack={() => setMode("select")} onSuccess={handleSuccess} />

  return (
    <div className="bg-white dark:bg-zinc-900 min-h-screen">
      <div className="flex items-center px-4 h-12 border-b border-zinc-100 dark:border-zinc-800">
        <Link href="/" className="p-1">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
        <h1 className="text-sm font-medium flex-1 text-center">发布</h1>
      </div>

      {successMsg && (
        <div className="mx-4 mt-4 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
          <p className="text-sm text-green-600 dark:text-green-400">{successMsg}</p>
        </div>
      )}

      <div className="p-4 space-y-3">
        <button onClick={() => setMode("case")} className="w-full p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl text-left hover:bg-zinc-100 dark:hover:bg-zinc-700 transition">
          <p className="font-medium">发布案例</p>
          <p className="text-sm text-zinc-400 mt-1">分享你的装修完工实拍</p>
        </button>
        <button onClick={() => setMode("review")} className="w-full p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl text-left hover:bg-zinc-100 dark:hover:bg-zinc-700 transition">
          <p className="font-medium">写点评</p>
          <p className="text-sm text-zinc-400 mt-1">评价你的设计师或装修公司</p>
        </button>
        <button onClick={() => setMode("question")} className="w-full p-4 bg-zinc-50 dark:bg-zinc-800 rounded-xl text-left hover:bg-zinc-100 dark:hover:bg-zinc-700 transition">
          <p className="font-medium">提问求助</p>
          <p className="text-sm text-zinc-400 mt-1">装修中的问题，向圈友求助</p>
        </button>
      </div>
    </div>
  )
}
