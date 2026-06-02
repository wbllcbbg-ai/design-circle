"use client"

import { useEffect, useState, useCallback } from "react"
import { getRoleLabel, ROLE_LABELS } from "@/lib/types"

type VirtualUser = {
  id: string
  nickname: string
  avatar_url: string | null
  role: string
  city: string
  age_group: string | null
  decoration_stage: string | null
  active_periods: string[]
  interest_tags: string[]
  tone_style: string
  speak_frequency: string
  specialty: string | null
  is_active: boolean
  content_count: number
  last_active_at: string | null
  created_at: string
}


export default function VirtualUsersPage() {
  const [users, setUsers] = useState<VirtualUser[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [editing, setEditing] = useState<VirtualUser | null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [showGenerate, setShowGenerate] = useState(false)
  const [generateCount, setGenerateCount] = useState(10)
  const [generating, setGenerating] = useState(false)
  const [batchError, setBatchError] = useState("")

  const loadUsers = useCallback(async () => {
    const params = new URLSearchParams()
    if (search) params.set("nickname", search)
    if (roleFilter) params.set("role", roleFilter)
    if (statusFilter) params.set("status", statusFilter)
    params.set("page", String(page))

    const res = await fetch(`/api/admin/virtual-users?${params}`)
    const data = await res.json()
    setUsers(data.virtual_users ?? [])
    setTotal(data.total ?? 0)
    setLoading(false)
  }, [page, search, roleFilter, statusFilter])

  useEffect(() => { loadUsers() }, [loadUsers])

  const handleBatchAction = async (action: string) => {
    if (selected.size === 0) return
    if (action === "delete" && !confirm("确定删除选中的虚拟用户？")) return
    setBatchError("")
    const res = await fetch("/api/admin/virtual-users/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ids: Array.from(selected) }),
    })
    const data = await res.json()
    if (!res.ok) {
      setBatchError(data.error || "操作失败")
      return
    }
    setSelected(new Set())
    await loadUsers()
  }

  const handleToggleActive = async (user: VirtualUser) => {
    await fetch(`/api/admin/virtual-users/${user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !user.is_active }),
    })
    await loadUsers()
  }

  const handleEditSave = async () => {
    if (!editing) return
    await fetch(`/api/admin/virtual-users/${editing.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    })
    setEditing(null)
    await loadUsers()
  }

  const startEdit = (user: VirtualUser) => {
    setEditing(user)
    setEditForm({ ...user })
  }

  const handleGenerate = async () => {
    setGenerating(true)
    const res = await fetch("/api/admin/virtual-users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: generateCount }),
    })
    const data = await res.json()
    setGenerating(false)
    setShowGenerate(false)
    if (data.success) {
      await loadUsers()
    } else {
      alert(data.error || "生成失败")
    }
  }

  const toggleSelect = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id); else next.add(id)
    setSelected(next)
  }

  const toggleAll = () => {
    if (selected.size === users.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(users.map(u => u.id)))
    }
  }

  const pageCount = Math.ceil(total / 20)

  if (loading) return <div className="flex items-center justify-center py-10 text-sm text-zinc-400">加载中...</div>

  return (
    <div>
      {/* 工具栏 */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800">
        <input
          type="text"
          placeholder="搜索昵称..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="flex-1 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-xs outline-none"
        />
        <select value={roleFilter} onChange={(e) => { setRoleFilter(e.target.value); setPage(1) }} className="px-2 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-xs outline-none">
          <option value="">全部角色</option>
          <option value="homeowner">{getRoleLabel("homeowner")}</option>
          <option value="designer">{getRoleLabel("designer")}</option>
          <option value="worker">{getRoleLabel("worker")}</option>
        </select>
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }} className="px-2 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-xs outline-none">
          <option value="">全部状态</option>
          <option value="active">启用</option>
          <option value="inactive">禁用</option>
        </select>
        <button onClick={() => setShowGenerate(true)} className="px-3 py-1.5 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-lg text-xs font-medium whitespace-nowrap">
          + 生成虚拟用户
        </button>
      </div>

      {/* 批量操作栏 */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800">
          <span className="text-xs text-blue-600 dark:text-blue-400">已选 {selected.size} 项</span>
          <button onClick={() => handleBatchAction("enable")} className="px-2 py-1 bg-green-600 text-white rounded text-[10px]">启用</button>
          <button onClick={() => handleBatchAction("disable")} className="px-2 py-1 bg-zinc-500 text-white rounded text-[10px]">禁用</button>
          <button onClick={() => handleBatchAction("delete")} className="px-2 py-1 bg-red-500 text-white rounded text-[10px]">删除</button>
        </div>
      )}
      {batchError && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
          <p className="text-xs text-red-600 dark:text-red-400">{batchError}</p>
        </div>
      )}

      {/* 全选 */}
      {users.length > 0 && (
        <label className="flex items-center gap-2 px-4 py-2 border-b border-zinc-100 dark:border-zinc-800">
          <input
            type="checkbox"
            checked={selected.size === users.length}
            onChange={toggleAll}
            className="rounded border-zinc-300 dark:border-zinc-600"
          />
          <span className="text-xs text-zinc-400">全选</span>
        </label>
      )}

      {/* 列表 */}
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {users.map((user) => (
          <div key={user.id} className="px-4 py-3 flex items-start gap-3">
            <input
              type="checkbox"
              checked={selected.has(user.id)}
              onChange={() => toggleSelect(user.id)}
              className="mt-1.5 rounded border-zinc-300 dark:border-zinc-600"
            />
            {/* 头像 */}
            <div className="w-9 h-9 rounded-full shrink-0 flex items-center justify-center text-white text-sm font-medium" style={{ background: `linear-gradient(135deg, hsl(${hashCode(user.nickname) % 360}, 40%, 60%), hsl(${(hashCode(user.nickname) + 60) % 360}, 35%, 50%))` }}>
              {user.nickname[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{user.nickname}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500">{ROLE_LABELS[user.role] || user.role}</span>
                {!user.is_active && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-400">已禁用</span>}
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-zinc-400">
                <span>{user.city}</span>
                {user.age_group && <span>· {user.age_group}</span>}
                {user.specialty && <span>· {user.specialty}</span>}
              </div>
              {user.interest_tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {user.interest_tags.map((tag) => (
                    <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-50 dark:bg-zinc-800 text-zinc-400">{tag}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-1 shrink-0">
              <button onClick={() => handleToggleActive(user)} className="text-[10px] text-zinc-400 underline">{user.is_active ? "禁用" : "启用"}</button>
              <button onClick={() => startEdit(user)} className="text-[10px] text-zinc-400 underline">编辑</button>
            </div>
          </div>
        ))}
        {users.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-zinc-400">暂无虚拟用户，点击上方"生成虚拟用户"创建</div>
        )}
      </div>

      {/* 分页 */}
      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-2 px-4 py-3">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-2 py-1 text-xs text-zinc-400 disabled:opacity-30">上一页</button>
          <span className="text-xs text-zinc-400">{page}/{pageCount}</span>
          <button disabled={page >= pageCount} onClick={() => setPage(p => p + 1)} className="px-2 py-1 text-xs text-zinc-400 disabled:opacity-30">下一页</button>
        </div>
      )}

      {/* 编辑弹窗 */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditing(null)} />
          <div className="relative bg-white dark:bg-zinc-900 w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5 pb-8 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">编辑虚拟用户</h3>
              <button onClick={() => setEditing(null)} className="p-1">
                <svg className="w-5 h-5 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-zinc-500 mb-1">昵称</p>
                <input type="text" value={editForm.nickname || ""} onChange={(e) => setEditForm({ ...editForm, nickname: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-sm outline-none" />
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1">角色</p>
                <select value={editForm.role || "homeowner"} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-sm outline-none">
                  <option value="homeowner">{getRoleLabel("homeowner")}</option>
                  <option value="designer">{getRoleLabel("designer")}</option>
                  <option value="worker">{getRoleLabel("worker")}</option>
                  <option value="company">{getRoleLabel("company")}</option>
                </select>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1">城市</p>
                <input type="text" value={editForm.city || "重庆"} onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-sm outline-none" />
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1">语气风格</p>
                <select value={editForm.tone_style || "casual"} onChange={(e) => setEditForm({ ...editForm, tone_style: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-sm outline-none">
                  <option value="professional">专业</option>
                  <option value="casual">口语化</option>
                  <option value="enthusiastic">热情</option>
                  <option value="concise">简洁</option>
                </select>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1">发言频率</p>
                <select value={editForm.speak_frequency || "normal"} onChange={(e) => setEditForm({ ...editForm, speak_frequency: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-sm outline-none">
                  <option value="active">活跃</option>
                  <option value="normal">普通</option>
                  <option value="occasional">偶尔</option>
                </select>
              </div>
              <div>
                <p className="text-xs text-zinc-500 mb-1">专长（仅设计师）</p>
                <input type="text" value={editForm.specialty || ""} onChange={(e) => setEditForm({ ...editForm, specialty: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-sm outline-none" />
              </div>

              {/* 内容画像（自动分析） */}
              <ProfileSection userId={editing.id} />

              <button onClick={handleEditSave} className="w-full py-2.5 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-full text-sm font-medium">保存</button>
            </div>
          </div>
        </div>
      )}

      {/* 生成弹窗 */}
      {showGenerate && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowGenerate(false)} />
          <div className="relative bg-white dark:bg-zinc-900 w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl p-5 pb-8">
            <h3 className="text-sm font-semibold mb-4">批量生成虚拟用户</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-zinc-500 mb-1">生成数量</p>
                <input type="number" value={generateCount} onChange={(e) => setGenerateCount(parseInt(e.target.value) || 1)}
                  min={1} max={50}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-sm outline-none" />
              </div>
              <p className="text-xs text-zinc-400">AI 将自动生成昵称、分配角色、设置画像，所有用户锁定在重庆</p>
              <button onClick={handleGenerate} disabled={generating}
                className="w-full py-2.5 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-full text-sm font-medium disabled:opacity-50">
                {generating ? "生成中..." : "开始生成"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function hashCode(str: string) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash)
}

// 内容画像组件
function ProfileSection({ userId }: { userId: string }) {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [topics, setTopics] = useState<string[]>([])
  const [style, setStyle] = useState("")
  const [interactions, setInteractions] = useState<{ nickname: string; count: number }[]>([])
  const [saving, setSaving] = useState(false)

  const loadProfile = async (signal: AbortSignal) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/virtual-users/${userId}/profile`, { signal })
      if (signal.aborted) return
      const data = await res.json()
      if (signal.aborted) return
      if (data.profile) {
        setProfile(data.profile)
        setTopics(data.profile.topics || [])
        setStyle(data.profile.style || "")
        setInteractions(data.profile.interactions || [])
      }
    } catch (e: any) {
      if (e.name === "AbortError") return
    }
    setLoading(false)
  }

  useEffect(() => {
    const controller = new AbortController()
    loadProfile(controller.signal)
    return () => controller.abort()
  }, [userId])

  const handleConfirm = async () => {
    setSaving(true)
    await fetch(`/api/admin/virtual-users/${userId}/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topics, style, interactions }),
    })
    setSaving(false)
  }

  return (
    <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-zinc-500">🎯 内容画像</p>
        <button onClick={() => { const c = new AbortController(); loadProfile(c.signal); }} disabled={loading} className="text-[10px] text-zinc-400 underline">
          {loading ? "分析中..." : "刷新分析"}
        </button>
      </div>

      {!profile && !loading && (
        <p className="text-[10px] text-zinc-400">暂无内容数据，点击「刷新分析」提取画像</p>
      )}

      {loading && <p className="text-[10px] text-zinc-400">分析中...</p>}

      {profile && !loading && (
        <div className="space-y-1.5">
          <div>
            <span className="text-[10px] text-zinc-400">擅长话题: </span>
            <div className="flex flex-wrap gap-1 mt-0.5">
              {Array.isArray(topics) && topics.map((t) => (
                <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-white dark:bg-zinc-700 text-zinc-500">{t}</span>
              ))}
            </div>
          </div>
          {style && (
            <p className="text-[10px] text-zinc-400">内容风格: {style}</p>
          )}
          {interactions.length > 0 && (
            <div>
              <span className="text-[10px] text-zinc-400">互动对象: </span>
              <span className="text-[10px] text-zinc-500">
                {interactions.map((i) => `${i.nickname}(${i.count})`).join(" ")}
              </span>
            </div>
          )}
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="text-[10px] px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 mt-1"
          >
            {saving ? "保存中..." : "✓ 确认画像"}
          </button>
        </div>
      )}
    </div>
  )
}
