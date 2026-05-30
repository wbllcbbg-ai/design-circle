"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { use } from "react"
import { createClient } from "@/lib/supabase/client"
import { getCover } from "@/lib/images"
import { Skeleton } from "@/components/ui/skeleton"

type Comment = {
  id: string
  content: string
  parent_id: string | null
  created_at: string
  user_id: string
}

export default function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [data, setData] = useState<any>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState("")
  const [posting, setPosting] = useState(false)
  const [user, setUser] = useState<any>(null)
  const supabase = createClient()

  const loadData = async () => {
    const [caseRes, commentRes, userRes] = await Promise.all([
      fetch(`/api/cases/${id}`).then((r) => r.json()),
      fetch(`/api/comments?target_type=case&target_id=${id}`).then((r) => r.json()),
      supabase.auth.getUser(),
    ])
    setData(caseRes.case)
    setComments(commentRes.comments ?? [])
    setUser(userRes.data.user)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [id])

  const handlePostComment = async () => {
    if (!newComment.trim() || posting) return
    setPosting(true)
    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_type: "case", target_id: id, content: newComment }),
    })
    if (res.ok) {
      setNewComment("")
      await loadData()
    }
    setPosting(false)
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-zinc-900 min-h-screen">
        <Skeleton className="w-full aspect-[4/5] rounded-none" />
        <div className="px-4 pt-4 space-y-3">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <Skeleton className="h-24 w-full mt-3" />
        </div>
      </div>
    )
  }

  if (!data) return null

  return (
    <div className="bg-white dark:bg-zinc-900 min-h-screen">
      <div className="w-full aspect-[4/5] relative overflow-hidden bg-zinc-100 dark:bg-zinc-800">
        <img src={getCover(0)} alt={data.title} className="w-full h-full object-cover" />
        <Link href="/" className="absolute top-4 left-4 w-8 h-8 rounded-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur flex items-center justify-center">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
      </div>

      <div className="px-4 pt-4 pb-6">
        <h1 className="text-lg font-semibold leading-snug">{data.title}</h1>
        <div className="flex items-center gap-1.5 mt-1.5">
          <div className="w-4 h-4 rounded-full bg-zinc-300 dark:bg-zinc-600" />
          <span className="text-xs text-zinc-400">设计师</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">设计师</span>
          <span className="text-xs text-zinc-300">·</span>
          <span className="text-xs text-zinc-400">{data.style} · {data.area}㎡</span>
        </div>

        <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-3 leading-relaxed whitespace-pre-line">{data.description}</p>

        <div className="flex items-center gap-6 mt-4 py-3 border-t border-zinc-100 dark:border-zinc-800">
          <button className="flex items-center gap-1.5 text-sm text-zinc-500">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M7 22V4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v18l-4-2.5Z" />
            </svg>
            {data.like_count}
          </button>
          <button className="flex items-center gap-1.5 text-sm text-zinc-500">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15a2 2 0 0 1-2 2H7l-5 3V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            评论
          </button>
          <button className="flex items-center gap-1.5 text-sm text-zinc-500">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 10v4m0 0v4m0-4h4m-4 0H8" />
            </svg>
            收藏
          </button>
        </div>

        {/* 评论区 */}
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-700 shrink-0 flex items-center justify-center text-[10px] text-zinc-500">
              {user?.email?.[0]?.toUpperCase() || "?"}
            </div>
            <div className="flex-1 flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-full px-3 py-2">
              <input
                type="text"
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handlePostComment()}
                placeholder={user ? "说点什么..." : "登录后评论"}
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-zinc-400"
                disabled={!user}
              />
              <button
                onClick={handlePostComment}
                disabled={!user || !newComment.trim() || posting}
                className="text-xs text-zinc-400 font-medium disabled:opacity-40"
              >
                {posting ? "..." : "发布"}
              </button>
            </div>
          </div>

          <div className="space-y-3">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-zinc-300 to-zinc-400 dark:from-zinc-600 dark:to-zinc-700 shrink-0 flex items-center justify-center text-[10px] text-white" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-zinc-400">{new Date(comment.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-0.5">{comment.content}</p>
                </div>
              </div>
            ))}
            {comments.length === 0 && (
              <p className="text-xs text-zinc-400 text-center py-6">暂无评论，来说点什么吧</p>
            )}
          </div>
        </div>

        <div className="h-8" />
      </div>
    </div>
  )
}
