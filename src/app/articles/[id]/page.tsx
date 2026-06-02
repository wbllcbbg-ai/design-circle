"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { use } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { ShareButton } from "@/components/ui/share-button"

type Article = {
  id: string
  title: string
  content: string
  summary: string
  cover_url: string | null
  category: string
  tags: string[]
  view_count: number
  like_count: number
  published_at: string
  author?: {
    id: string
    nickname: string
    avatar_url: string | null
    role: string | null
    designer_id: string | null
  }
}

type Comment = {
  id: string
  content: string
  parent_id: string | null
  created_at: string
  user_id: string
}

import { getRoleLabel } from "@/lib/types"


export default function ArticleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [article, setArticle] = useState<Article | null>(null)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [liked, setLiked] = useState(false)
  const [likeCount, setLikeCount] = useState(0)
  const [favorited, setFavorited] = useState(false)
  const [comments, setComments] = useState<Comment[]>([])
  const [newComment, setNewComment] = useState("")
  const [posting, setPosting] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    const load = async () => {
      const [articleRes, userRes, likeRes, favRes, commentRes] = await Promise.all([
        fetch(`/api/articles/${id}`).then((r) => r.json()),
        supabase.auth.getUser(),
        fetch(`/api/likes?target_type=article&target_id=${id}`).then((r) => r.json()),
        fetch(`/api/favorites?target_type=article&target_id=${id}`).then((r) => r.json()),
        fetch(`/api/comments?target_type=article&target_id=${id}`).then((r) => r.json()),
      ])
      setArticle(articleRes.article)
      setUser(userRes.data.user)
      setLiked(likeRes.liked)
      setLikeCount(likeRes.like_count)
      setFavorited(favRes.favorited)
      setComments(commentRes.comments ?? [])
      setLoading(false)

      // 记录浏览历史
      if (userRes.data.user) {
        fetch("/api/browse-history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ target_type: "article", target_id: id }),
        }).catch(() => {})
      }
    }
    load()
  }, [id])

  const handleLike = async () => {
    if (!user) return
    const res = await fetch("/api/likes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_type: "article", target_id: id, action: liked ? "unlike" : "like" }),
    })
    if (res.ok) {
      const data = await res.json()
      setLiked(data.liked)
      setLikeCount(data.like_count)
    }
  }

  const handleFavorite = async () => {
    if (!user) return
    const res = await fetch("/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_type: "article", target_id: id, action: favorited ? "unfavorite" : "favorite" }),
    })
    if (res.ok) {
      const data = await res.json()
      setFavorited(data.favorited)
    }
  }

  const handlePostComment = async () => {
    if (!newComment.trim() || posting) return
    setPosting(true)
    const res = await fetch("/api/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target_type: "article", target_id: id, content: newComment }),
    })
    if (res.ok) {
      setNewComment("")
      const commentRes = await fetch(`/api/comments?target_type=article&target_id=${id}`).then((r) => r.json())
      setComments(commentRes.comments ?? [])
    }
    setPosting(false)
  }

  if (loading) {
    return <div className="bg-white dark:bg-zinc-900 min-h-screen flex items-center justify-center text-sm text-zinc-400">加载中...</div>
  }

  if (!article) return null

  return (
    <article className="bg-white dark:bg-zinc-900 min-h-screen">
      <div className="w-full aspect-[4/3] relative bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
        {article.cover_url ? (
          <Image src={article.cover_url} alt={article.title} fill className="object-cover" sizes="100vw" priority />
        ) : (
          <div className="w-full h-full" style={{ background: "linear-gradient(135deg, hsl(230, 30%, 70%), hsl(180, 25%, 60%))" }} />
        )}
      
        <button onClick={() => { if (window.history.length > 1) router.back(); else router.push("/articles") }} className="absolute top-4 left-4 w-8 h-8 rounded-full bg-white/80 dark:bg-zinc-900/80 backdrop-blur flex items-center justify-center">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <div className="absolute top-4 right-4 px-2 py-0.5 bg-white/90 dark:bg-zinc-900/90 backdrop-blur rounded text-[11px] font-medium text-zinc-700 dark:text-zinc-300">{article.category}</div>
      </div>

      <div className="px-4 pt-4 pb-6">
        <h1 className="text-lg font-semibold leading-snug">{article.title}</h1>
        <div className="flex items-center gap-2 mt-1.5">
          {article.author && (
            <>
              <Link href={article.author.designer_id ? `/designers/${article.author.designer_id}` : `/users/${article.author.id}`}>
                <div className="w-5 h-5 rounded-full bg-zinc-300 dark:bg-zinc-600 overflow-hidden flex-shrink-0 hover:opacity-80">
                  {article.author.avatar_url ? (
                    <Image src={article.author.avatar_url} alt={article.author.nickname} fill className="object-cover" sizes="20px" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-white font-medium">
                      {article.author.nickname?.charAt(0) || "?"}
                    </div>
                  )}
                </div>
              </Link>
              <Link href={article.author.designer_id ? `/designers/${article.author.designer_id}` : `/users/${article.author.id}`} className="text-xs text-zinc-500 font-medium hover:text-zinc-700 dark:hover:text-zinc-300">{article.author.nickname}</Link>
              {article.author.role && (
                <span className="text-[9px] px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-400">{getRoleLabel(article.author.role)}</span>
              )}
              <span className="text-zinc-300 dark:text-zinc-600">·</span>
            </>
          )}
          <span className="text-xs text-zinc-400">{article.published_at ? new Date(article.published_at).toLocaleDateString() : ""}</span>
        </div>

        <div className="flex items-center gap-1.5 mt-2">
          {(article.tags ?? []).map((tag) => <span key={tag} className="text-xs text-zinc-400">#{tag}</span>)}
        </div>

        <div className="mt-4 text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-line">{article.content}</div>

        <div className="mt-6 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
          <p className="text-xs text-zinc-400">本文由AI基于平台数据生成，仅供参考</p>
        </div>

        <div className="flex items-center gap-6 mt-4 py-3 border-t border-zinc-100 dark:border-zinc-800">
          <button onClick={handleLike} className={`flex items-center gap-1.5 text-sm ${liked ? "text-red-500" : "text-zinc-500"}`}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5">
              <path d="M7 22V4a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v18l-4-2.5Z" />
            </svg>
            {likeCount}
          </button>
          <button onClick={handleFavorite} className={`flex items-center gap-1.5 text-sm ${favorited ? "text-amber-500" : "text-zinc-500"}`}>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill={favorited ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            收藏
          </button>
          <ShareButton url={typeof window !== "undefined" ? `${window.location.origin}/articles/${id}` : ""} title={article?.title} />
        </div>

        {/* 评论区 */}
        <div className="mt-4">
          <h3 className="text-sm font-medium mb-3">评论</h3>
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
    </article>
  )
}
