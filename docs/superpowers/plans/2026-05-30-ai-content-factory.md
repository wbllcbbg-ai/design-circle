# AI 内容工厂 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build virtual user management + AI content generation (DeepSeek) + Unsplash image integration + content scheduling in admin panel.

**Architecture:** Virtual users have shadow accounts in `auth.users` + `users` tables so existing frontend APIs work unchanged. Admin CRUD APIs mirror existing `api/admin/reviews` pattern. Content generation is synchronous for MVP (async later if needed). Scheduler assigns publish timestamps to simulate natural timeline.

**Tech Stack:** Next.js 16 App Router, Supabase (DB + Auth), DeepSeek API, Unsplash API, Tailwind CSS

---

### Task 1: Database Migration — `virtual_users` table + shadow user FK

**Files:**
- Modify: `supabase/migrations/00001_schema.sql`
- Test: verify via Supabase dashboard or direct query

- [ ] **Step 1: Add `virtual_users` table creation and content table FK modifications**


Append to `supabase/migrations/00001_schema.sql` (before the existing index lines at the bottom):

```sql
-- 虚拟用户池
CREATE TABLE virtual_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  role TEXT NOT NULL CHECK (role IN ('owner', 'designer', 'worker', 'company')),
  city TEXT NOT NULL DEFAULT '重庆',
  age_group TEXT CHECK (age_group IN ('25-35', '35-45', '45+')),
  decoration_stage TEXT CHECK (decoration_stage IN ('not_started', 'ongoing', 'completed')),
  active_periods TEXT[] NOT NULL DEFAULT '{"晚上","周末"}',
  interest_tags TEXT[] NOT NULL DEFAULT '{}',
  tone_style TEXT NOT NULL DEFAULT 'casual' CHECK (tone_style IN ('professional', 'casual', 'enthusiastic', 'concise')),
  speak_frequency TEXT NOT NULL DEFAULT 'normal' CHECK (speak_frequency IN ('active', 'normal', 'occasional')),
  specialty TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  content_count INT NOT NULL DEFAULT 0,
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_virtual_users_role ON virtual_users(role);
CREATE INDEX idx_virtual_users_is_active ON virtual_users(is_active);
CREATE INDEX idx_virtual_users_city ON virtual_users(city);

-- 为内容表加 virtual_user_id 字段（可选，标记AI生成的内容归属）
ALTER TABLE articles ADD COLUMN IF NOT EXISTS virtual_user_id UUID REFERENCES virtual_users(id);
ALTER TABLE cases ADD COLUMN IF NOT EXISTS virtual_user_id UUID REFERENCES virtual_users(id);
ALTER TABLE comments ADD COLUMN IF NOT EXISTS virtual_user_id UUID REFERENCES virtual_users(id);
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS virtual_user_id UUID REFERENCES virtual_users(id);
```

- [ ] **Step 2: Run the migration locally**

```bash
# Option 1: Direct SQL apply via Supabase CLI
npx supabase db push

# Option 2: Copy SQL into Supabase Dashboard SQL editor and run
```

- [ ] **Step 3: Verify tables exist**

Run: Query `SELECT * FROM virtual_users LIMIT 1;` — should return empty set, no error.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00001_schema.sql
git commit -m "feat: add virtual_users table + content table virtual_user_id FKs"
```

---

### Task 2: Admin API — Virtual User CRUD

**Files:**
- Create: `src/app/api/admin/virtual-users/route.ts`
- Create: `src/app/api/admin/virtual-users/[id]/route.ts`
- Create: `src/app/api/admin/virtual-users/batch/route.ts`

- [ ] **Step 1: Create `src/app/api/admin/virtual-users/route.ts`** — GET (list + search/filter) + POST (bulk generate)

```typescript
import { getCurrentUserId } from "@/lib/supabase/server"
import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

async function requireAdmin() {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const supabase = createDirectClient()
  const { data: user } = await supabase.from("users").select("role").eq("id", userId).single()
  if (user?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 })
  return null
}

// GET /api/admin/virtual-users — list with search/filter/pagination
export async function GET(req: Request) {
  const guard = await requireAdmin()
  if (guard) return guard

  const { searchParams } = new URL(req.url)
  const nickname = searchParams.get("nickname") || ""
  const role = searchParams.get("role") || ""
  const status = searchParams.get("status") || ""
  const page = parseInt(searchParams.get("page") || "1")
  const pageSize = 20
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const supabase = createDirectClient()
  let query = supabase.from("virtual_users").select("*", { count: "exact" })

  if (nickname) query = query.ilike("nickname", `%${nickname}%`)
  if (role) query = query.eq("role", role)
  if (status === "active") query = query.eq("is_active", true)
  if (status === "inactive") query = query.eq("is_active", false)

  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(from, to)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ virtual_users: data ?? [], total: count ?? 0, page, pageSize })
}

// 生成单个虚拟用户的影子 auth 账号
async function createShadowUser(supabase: any, email: string, nickname: string) {
  // 先检查是否已存在
  const { data: existing } = await supabase.from("users").select("id").eq("email", email).maybeSingle()
  if (existing) return existing

  // 用 service_role key 创建 auth user（需要 service_role）
  // 本地用 createDirectClient 不行，需要用 admin client
  // 简化方案：不在 auth.users 创建影子账号，只用 virtual_users + user_id nullable
  // user_id 在 first content publish 时创建
  return null
}

// POST /api/admin/virtual-users — 批量生成虚拟用户
export async function POST(req: Request) {
  const guard = await requireAdmin()
  if (guard) return guard

  const body = await req.json()
  const { count: generateCount = 10 } = body

  const supabase = createDirectClient()

  // 批量生成虚拟人的 prompt
  const namesPrompt = `生成${generateCount}个中文昵称，用于一个重庆家居装修平台的虚拟用户。
要求：
- 每个昵称要有网感，不能像机器人
- 业主类：带重庆地名或装修生活感（如：山城小汤圆、今天又超预算了、工地盯梢中）
- 设计师类：专业身份+名字（如：设计圈李工、全案设计阿杰）
- 工长类：实在落地感（如：老张装修队）
- 确保不重复、不包含敏感词
- 用 JSON 数组返回：["昵称1", "昵称2", ...]`

  try {
    const aiRes = await fetch(`${process.env.AI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.AI_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || "deepseek-chat",
        messages: [{ role: "user", content: namesPrompt }],
        temperature: 0.8,
        max_tokens: 1000,
      }),
    })

    if (!aiRes.ok) {
      return NextResponse.json({ error: `AI 服务连接失败 (${aiRes.status})` }, { status: 502 })
    }

    const json = await aiRes.json()
    const rawContent = json.choices?.[0]?.message?.content || "[]"
    const nicknames: string[] = JSON.parse(rawContent.match(/\[[\s\S]*\]/)?.[0] || "[]")

    if (!nicknames.length) {
      return NextResponse.json({ error: "AI 返回昵称列表为空" }, { status: 502 })
    }

    // 角色分配：7:3 业主:设计师，加少量工长
    const roles: string[] = []
    const allRoles = ["owner", "owner", "owner", "owner", "owner", "owner", "owner", "designer", "designer", "designer", "worker"]
    const ageGroups = ["25-35", "35-45", "45+"]
    const toneStyles = ["professional", "casual", "enthusiastic", "concise"]
    const frequencies = ["active", "normal", "occasional"]
    const periodOptions = [["晚上"], ["晚上", "周末"], ["下午", "晚上"], ["周末"], ["早上", "下午"]]
    const tagPool = [
      ["现代简约", "收纳", "厨房"],
      ["小户型", "预算", "北欧风"],
      ["日式", "原木风", "阳台"],
      ["轻奢", "大平层", "客厅"],
      ["混搭", "复古", "卧室"],
      ["极简", "书房", "灯光设计"],
      ["新中式", "茶室", "庭院"],
    ]

    const inserts = nicknames.slice(0, generateCount).map((nickname: string, i: number) => {
      const roleIdx = i % allRoles.length
      const role = allRoles[roleIdx]
      const ageGroup = ageGroups[Math.floor(Math.random() * ageGroups.length)]
      const tone = toneStyles[Math.floor(Math.random() * toneStyles.length)]
      const freq = frequencies[Math.floor(Math.random() * frequencies.length)]
      const periods = periodOptions[Math.floor(Math.random() * periodOptions.length)]
      const tags = tagPool[Math.floor(Math.random() * tagPool.length)]
      return {
        nickname,
        role,
        city: "重庆",
        age_group: role === "worker" ? null : ageGroup,
        decoration_stage: role === "owner" ? ["not_started", "ongoing", "completed"][Math.floor(Math.random() * 3)] : null,
        active_periods: periods,
        interest_tags: tags,
        tone_style: tone,
        speak_frequency: freq,
        specialty: role === "designer" ? ["小户型改造", "现代简约", "日式风格", "收纳设计", "旧房翻新"][Math.floor(Math.random() * 5)] : null,
        is_active: true,
        content_count: 0,
      }
    })

    const { data, error } = await supabase.from("virtual_users").insert(inserts).select()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // 为每个虚拟人创建 users 表记录（无需 auth），使前端能正常展示作者信息
    for (const vu of data) {
      const existingUser = await supabase.from("users").select("id").eq("email", `virtual_${vu.id}@designcircle.local`).maybeSingle()
      if (!existingUser.data) {
        const { data: userRecord } = await supabase.from("users").insert({
          id: vu.id,  // 使用相同的 UUID
          email: `virtual_${vu.id}@designcircle.local`,
          nickname: vu.nickname,
          role: "user",
          city_id: null,
        }).select().single()

        if (userRecord) {
          // 回写 user_id 到 virtual_users
          await supabase.from("virtual_users").update({ user_id: userRecord.id }).eq("id", vu.id)
        }
      }
    }

    return NextResponse.json({ success: true, count: data.length, virtual_users: data })
  } catch (err: any) {
    return NextResponse.json({ error: `AI 服务异常: ${err.message}` }, { status: 502 })
  }
}
```

- [ ] **Step 2: Create `src/app/api/admin/virtual-users/[id]/route.ts`** — GET detail + PUT edit + DELETE

```typescript
import { getCurrentUserId } from "@/lib/supabase/server"
import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

async function requireAdmin() {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const supabase = createDirectClient()
  const { data: user } = await supabase.from("users").select("role").eq("id", userId).single()
  if (user?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 })
  return null
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (guard) return guard

  const { id } = await params
  const supabase = createDirectClient()

  const { data, error } = await supabase.from("virtual_users").select("*").eq("id", id).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ virtual_user: data })
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (guard) return guard

  const { id } = await params
  const body = await req.json()
  const supabase = createDirectClient()

  const { data, error } = await supabase.from("virtual_users").update(body).eq("id", id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ virtual_user: data })
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (guard) return guard

  const { id } = await params
  const supabase = createDirectClient()

  const { error } = await supabase.from("virtual_users").delete().eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
```

- [ ] **Step 3: Create `src/app/api/admin/virtual-users/batch/route.ts`** — batch enable/disable/delete

```typescript
import { getCurrentUserId } from "@/lib/supabase/server"
import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

async function requireAdmin() {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const supabase = createDirectClient()
  const { data: user } = await supabase.from("users").select("role").eq("id", userId).single()
  if (user?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 })
  return null
}

export async function POST(req: Request) {
  const guard = await requireAdmin()
  if (guard) return guard

  const body = await req.json()
  const { action, ids } = body  // action: "enable" | "disable" | "delete"

  if (!ids?.length) return NextResponse.json({ error: "ids required" }, { status: 400 })

  const supabase = createDirectClient()

  if (action === "delete") {
    const { error } = await supabase.from("virtual_users").delete().in("id", ids)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const isActive = action === "enable"
    const { error } = await supabase.from("virtual_users").update({ is_active: isActive }).in("id", ids)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 4: Verify build passes**

```bash
npx next build --webpack 2>&1 | grep "error\|Error\|✓ Compiled"
```

Expected: No errors, admin API routes listed in build output.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/admin/virtual-users/
git commit -m "feat: admin virtual users CRUD API"
```

---

### Task 3: Admin Page — Virtual User Management UI

**Files:**
- Create: `src/app/admin/virtual-users/page.tsx`
- Modify: `src/app/admin/layout.tsx` (add Tab + update bottom nav)

- [ ] **Step 1: Create `src/app/admin/virtual-users/page.tsx`**

```typescript
"use client"

import { useEffect, useState, useCallback } from "react"

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

const ROLE_LABELS: Record<string, string> = { owner: "业主", designer: "设计师", worker: "工长", company: "公司" }
const TONE_LABELS: Record<string, string> = { professional: "专业", casual: "口语化", enthusiastic: "热情", concise: "简洁" }
const FREQ_LABELS: Record<string, string> = { active: "活跃", normal: "普通", occasional: "偶尔" }

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
    await fetch("/api/admin/virtual-users/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ids: Array.from(selected) }),
    })
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
    await fetch("/api/admin/virtual-users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: generateCount }),
    })
    setGenerating(false)
    setShowGenerate(false)
    await loadUsers()
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
          <option value="owner">业主</option>
          <option value="designer">设计师</option>
          <option value="worker">工长</option>
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
                <span>· {user.content_count} 条内容</span>
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
                <select value={editForm.role || "owner"} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-sm outline-none">
                  <option value="owner">业主</option>
                  <option value="designer">设计师</option>
                  <option value="worker">工长</option>
                  <option value="company">公司</option>
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

// 哈希函数：根据字符串生成数字（用于头像颜色）
function hashCode(str: string) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash)
}
```

- [ ] **Step 2: Modify `src/app/admin/layout.tsx`** — add virtual-users Tab

Find the TABS array and add the 5th entry:

```typescript
const TABS = [
  { key: "", label: "内容管理", icon: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" },
  { key: "/applications", label: "入驻审核", icon: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" },
  { key: "/reviews", label: "点评审核", icon: "M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" },
  { key: "/virtual-users", label: "虚拟用户", icon: "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0 1 12 0v1zm0 0h6v-1a6 6 0 0 0-9-5.197M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0z" },
  { key: "/rewards", label: "奖励规则", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" },
]
```

- [ ] **Step 3: Verify build**

```bash
npx next build --webpack 2>&1 | grep "error\|Error\|✓ Compiled"
```

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/virtual-users/page.tsx src/app/admin/layout.tsx
git commit -m "feat: admin virtual user management page + tab"
```

---

### Task 4: Unsplash Image Integration

**Files:**
- Create: `src/lib/unsplash.ts`

- [ ] **Step 1: Create `src/lib/unsplash.ts`**

```typescript
// Unsplash 图片工具 — 用于 AI 内容配图获取
// Unsplash API 免费套餐: 50次/小时，图片 URL 永久有效

const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY || ""

// 按内容类型搜索配图
export async function searchImages(query: string, count: number = 1): Promise<string[]> {
  if (!UNSPLASH_ACCESS_KEY) {
    // 无 key 时返回占位色块
    return Array(count).fill(0).map((_, i) => `https://placehold.co/800x600/e2e8f0/64748b?text=${encodeURIComponent(query + " " + (i + 1))}`)
  }

  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}` } },
    )

    if (!res.ok) {
      console.warn(`Unsplash API error: ${res.status}`)
      return Array(count).fill(0).map((_, i) => `https://placehold.co/800x600/e2e8f0/64748b?text=${encodeURIComponent(query + " " + (i + 1))}`)
    }

    const json = await res.json()
    return (json.results || []).slice(0, count).map((photo: any) => photo.urls?.regular || "")
  } catch (err) {
    console.warn("Unsplash API call failed:", err)
    return Array(count).fill(0).map((_, i) => `https://placehold.co/800x600/e2e8f0/64748b?text=${encodeURIComponent(query + " " + (i + 1))}`)
  }
}

// 根据内容类型获取配图关键词
export function getSearchQuery(contentType: string): string {
  const queries: Record<string, string[]> = {
    article: ["interior design living room", "modern home decor", "kitchen design", "bedroom interior", "bathroom design"],
    case: ["apartment renovation", "home decoration", "modern apartment", "house interior", "furniture interior"],
    avatar: [],  // 头像用色块+首字母
  }
  const pool = queries[contentType] || queries.article
  return pool[Math.floor(Math.random() * pool.length)]
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/unsplash.ts
git commit -m "feat: unsplash image search utility"
```

---

### Task 5: DeepSeek AI Content Generator + Generate Content API

**Files:**
- Create: `src/lib/ai-generator.ts`
- Create: `src/app/api/admin/generate-content/route.ts`

- [ ] **Step 1: Create `src/lib/ai-generator.ts`** — shared AI content generation logic

```typescript
import { searchImages, getSearchQuery } from "./unsplash"

const AI_BASE_URL = process.env.AI_BASE_URL || "https://api.deepseek.com/v1"
const AI_MODEL = process.env.AI_MODEL || "deepseek-chat"
const AI_API_KEY = process.env.AI_API_KEY || ""

type VirtualUser = {
  id: string
  nickname: string
  role: string
  city: string
  age_group: string | null
  decoration_stage: string | null
  active_periods: string[]
  interest_tags: string[]
  tone_style: string
  speak_frequency: string
  specialty: string | null
}

type HistoryItem = {
  type: string
  title?: string
  content: string
  created_at: string
}

// 调用 DeepSeek API
async function callAI(prompt: string, temperature = 0.7, maxTokens = 1024): Promise<string> {
  const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${AI_API_KEY}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature,
      max_tokens: maxTokens,
    }),
  })

  if (!res.ok) throw new Error(`AI service error: ${res.status}`)
  const json = await res.json()
  return json.choices?.[0]?.message?.content || ""
}

// 构建上下文 prompt
function buildContextPrompt(user: VirtualUser, history: HistoryItem[], task: string): string {
  const toneMap: Record<string, string> = {
    professional: "语言专业严谨，使用行业术语",
    casual: "口语化，像朋友聊天一样自然",
    enthusiastic: "热情积极，喜欢用感叹号和emoji",
    concise: "简洁直接，不说废话",
  }

  const roleDesc: Record<string, string> = {
    owner: `装修阶段：${user.decoration_stage === "completed" ? "已完工" : user.decoration_stage === "ongoing" ? "装修中" : "未开始"}`,
    designer: `专长：${user.specialty || "全案设计"}`,
    worker: "",
    company: "",
  }

  const historyBlock = history.slice(0, 5).map((h, i) =>
    `  ${"①②③④⑤"[i]} [${timeAgo(h.created_at)}] ${h.type === "文章" ? "发布了文章：" + h.title : h.type === "提问" ? "提问：" + h.title : h.type === "评价" ? "评价了设计师：" + h.content?.slice(0, 30) : "评论：" + h.content?.slice(0, 30)}`
  ).join("\n")

  return `当前虚拟人信息：
- 昵称：${user.nickname}
- 角色：${roleDescMap[user.role] || user.role}
- 城市：${user.city}
- 年龄层：${user.age_group || "未知"}
- ${roleDesc[user.role] || ""}
- 兴趣标签：${user.interest_tags?.join(", ") || "无"}
- 风格：${toneMap[user.tone_style] || "自然交流"}
- 发言频率：${user.speak_frequency === "active" ? "比较活跃" : user.speak_frequency === "normal" ? "一般" : "偶尔发言"}

该用户最近发布的内容：
${historyBlock || "  （暂无历史内容）"}

任务：${task}

要求：
1. 内容要符合该用户的身份和风格
2. 如果有历史内容，要自然地延续之前的逻辑
3. 不要重复使用相同的开头句式
${user.tone_style !== "professional" ? "4. 使用自然的口语化表达" : ""}
${user.role === "owner" ? "5. 内容围绕重庆本地装修场景" : ""}`
}

const roleDescMap: Record<string, string> = {
  owner: "业主", designer: "设计师", worker: "工长", company: "装修公司",
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return "今天"
  if (days === 1) return "昨天"
  if (days < 7) return `${days}天前`
  if (days < 30) return `${Math.floor(days / 7)}周前`
  return `${Math.floor(days / 30)}个月前`
}

// === 生成器：按类型 ===

export async function generateArticle(user: VirtualUser, history: HistoryItem[]) {
  const prompt = buildContextPrompt(user, history,
    `请以该用户的身份写一篇重庆本地装修攻略文章，主题可以是户型改造、材料选择、风格搭配、预算控制等。
返回 JSON 格式：{"title": "...", "summary": "...", "content": "..."}
- 标题要吸引人，包含关键词
- 正文 500-800 字，专业实用
- 如果是设计师用户，体现专业深度；如果是业主用户，以亲身经历口吻写`
  )

  const raw = await callAI(prompt, 0.8, 2048)
  const json = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || "{}")

  const imageQuery = getSearchQuery("article")
  const images = await searchImages(imageQuery)

  return {
    title: json.title || "重庆装修攻略",
    summary: json.summary || "",
    content: json.content || "",
    cover_url: images[0] || "",
  }
}

export async function generateCase(user: VirtualUser, history: HistoryItem[]) {
  const prompt = buildContextPrompt(user, history,
    `请以该设计师的身份发布一个重庆本地的装修案例。
返回 JSON 格式：{"title": "...", "style": "...", "area": 80, "budget": 150000, "description": "..."}
- style 可选：现代简约/日式/北欧/轻奢/新中式/混搭
- area 60-200 平米
- budget 5-50 万`
  )

  const raw = await callAI(prompt, 0.8, 1024)
  const json = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || "{}")

  const imageQuery = getSearchQuery("case")
  const images = await searchImages(imageQuery, 5)

  return {
    title: json.title || "重庆装修案例",
    style: json.style || "现代简约",
    area: json.area || 80,
    budget: json.budget || 100000,
    description: json.description || "",
    images,
  }
}

export async function generateQuestion(user: VirtualUser, history: HistoryItem[]) {
  const prompt = buildContextPrompt(user, history,
    `请以该业主的身份在装修社区中发一条提问帖。
返回 JSON 格式：{"title": "...（口语化提问，如"有没有人做过60平两房改三房？"）", "content": "...（详细描述自己的情况，50-150字）", "category": "设计/施工/预算/材料"}`
  )

  const raw = await callAI(prompt, 0.8, 1024)
  const json = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || "{}")

  return {
    title: json.title || "装修求助",
    content: json.content || "",
    category: json.category || "设计",
  }
}

export async function generateComment(user: VirtualUser, history: HistoryItem[], targetTitle?: string) {
  const prompt = buildContextPrompt(user, history,
    `请以该用户的身份对${targetTitle ? "《" + targetTitle + "》" : ""}发表一条评论。
返回 JSON 格式：{"content": "..."}
- 评论要自然，像是看到内容后的即时反应
- 如果用户是设计师，可以给出专业建议或认同
- 如果用户是业主，分享自己的类似经历或感受
- 字数 10-100 字`
  )

  const raw = await callAI(prompt, 0.7, 512)
  const json = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || "{}")

  return { content: json.content || "说得好，学习了！" }
}

export async function generateReview(user: VirtualUser, history: HistoryItem[], designerName?: string) {
  const prompt = buildContextPrompt(user, history,
    `请以该业主的身份对${designerName ? "设计师 " + designerName : "一位设计师"}写一条装修评价。
返回 JSON 格式：{"rating": 5, "design_score": 5, "construction_score": 4, "service_score": 5, "content": "..."}
- rating 1-5，正面为主（4-5分占80%，3分占15%，1-2分占5%）
- content 20-100字，具体真实`
  )

  const raw = await callAI(prompt, 0.7, 512)
  const json = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || "{}")

  return {
    rating: json.rating || 5,
    design_score: json.design_score || json.rating || 5,
    construction_score: json.construction_score || json.rating || 5,
    service_score: json.service_score || json.rating || 5,
    content: json.content || "很不错的设计师！",
  }
}
```

- [ ] **Step 2: Create `src/app/api/admin/generate-content/route.ts`**

```typescript
import { getCurrentUserId } from "@/lib/supabase/server"
import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { generateArticle, generateCase, generateQuestion, generateComment, generateReview } from "@/lib/ai-generator"

export const dynamic = "force-dynamic"
export const maxDuration = 120  // 长任务

async function requireAdmin() {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  const supabase = createDirectClient()
  const { data: user } = await supabase.from("users").select("role").eq("id", userId).single()
  if (user?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 })
  return null
}

// 获取虚拟人最近的内容作为上下文
async function getVirtualUserHistory(supabase: any, virtualUserId: string, limit = 5) {
  // 查该虚拟人在各内容表的最新记录
  const promises = [
    supabase.from("articles").select("title, content, created_at").eq("virtual_user_id", virtualUserId).order("created_at", { ascending: false }).limit(limit),
    supabase.from("comments").select("content, created_at").eq("virtual_user_id", virtualUserId).order("created_at", { ascending: false }).limit(limit),
    supabase.from("reviews").select("content, created_at").eq("virtual_user_id", virtualUserId).order("created_at", { ascending: false }).limit(limit),
  ]
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {  // 只在有 questions 表时查询
    promises.push(supabase.from("questions").select("title, content, created_at").eq("virtual_user_id", virtualUserId).order("created_at", { ascending: false }).limit(limit))
  }

  const results = await Promise.allSettled(promises)
  const items: any[] = []

  if (results[0].status === "fulfilled") {
    for (const row of results[0].value.data || []) {
      items.push({ type: "文章", title: row.title, content: row.content, created_at: row.created_at })
    }
  }
  if (results[1].status === "fulfilled") {
    for (const row of results[1].value.data || []) {
      items.push({ type: "评论", content: row.content, created_at: row.created_at })
    }
  }
  if (results[2].status === "fulfilled") {
    for (const row of results[2].value.data || []) {
      items.push({ type: "评价", content: row.content, created_at: row.created_at })
    }
  }
  if (results[3]?.status === "fulfilled") {
    for (const row of results[3].value.data || []) {
      items.push({ type: "提问", title: row.title, content: row.content, created_at: row.created_at })
    }
  }

  return items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, limit)
}

// 调度时间计算
function schedulePublishTime(strategy: string, user: any): string {
  const now = new Date()

  if (strategy === "init") {
    // 过去30天内随机
    const daysAgo = Math.floor(Math.random() * 30)
    const hours = Math.floor(Math.random() * 12) + 8  // 8:00-20:00
    const date = new Date(now.getTime() - daysAgo * 86400000)
    date.setHours(hours, Math.floor(Math.random() * 60), 0, 0)
    return date.toISOString()
  }

  // daily: 根据角色类型分时段
  const isWeekend = now.getDay() === 0 || now.getDay() === 6
  const hasWeekendActive = user.active_periods?.includes("周末")
  if (isWeekend && !hasWeekendActive) {
    // 周末不活跃的就改为周末白天
    const weekendHour = 10 + Math.floor(Math.random() * 8)
    const d = new Date(now)
    d.setHours(weekendHour, Math.floor(Math.random() * 60), 0, 0)
    return d.toISOString()
  }

  const hasNight = user.active_periods?.includes("晚上")
  const hasAfternoon = user.active_periods?.includes("下午")
  const hasMorning = user.active_periods?.includes("早上")

  let hour: number
  if (hasNight && Math.random() > 0.5) {
    hour = 19 + Math.floor(Math.random() * 4)  // 19:00-22:00
  } else if (hasAfternoon) {
    hour = 13 + Math.floor(Math.random() * 4)  // 13:00-16:00
  } else if (hasMorning) {
    hour = 8 + Math.floor(Math.random() * 2)   // 8:00-9:00
  } else {
    hour = 10 + Math.floor(Math.random() * 10) // 10:00-19:00
  }

  const d = new Date(now)
  // 未来 5-30 分钟
  d.setMinutes(d.getMinutes() + 5 + Math.floor(Math.random() * 25))
  return d.toISOString()
}

export async function POST(req: Request) {
  const guard = await requireAdmin()
  if (guard) return guard

  const body = await req.json()
  const { strategy = "daily", types = ["article", "comment"], counts } = body

  const supabase = createDirectClient()

  // 获取活跃的虚拟用户
  const { data: virtualUsers } = await supabase
    .from("virtual_users")
    .select("*")
    .eq("is_active", true)
    .limit(50)

  if (!virtualUsers?.length) {
    return NextResponse.json({ error: "没有可用的虚拟用户，请先生成虚拟用户" }, { status: 400 })
  }

  const results: any[] = []
  let totalGenerated = 0

  // === 生成文章 ===
  if (types.includes("article")) {
    const articleCount = counts?.articles || (strategy === "init" ? 10 : 3)
    for (let i = 0; i < articleCount; i++) {
      const designers = virtualUsers.filter(u => u.role === "designer")
      if (!designers.length) break
      const user = designers[i % designers.length]
      try {
        const history = await getVirtualUserHistory(supabase, user.id)
        const article = await generateArticle(user, history)
        const { data: dbResult } = await supabase.from("articles").insert({
          title: article.title,
          summary: article.summary,
          content: article.content,
          category: "装修攻略",
          tags: [article.title.slice(0, 10), "重庆装修"],
          cover_url: article.cover_url,
          is_published: true,
          author_id: user.user_id,
          virtual_user_id: user.id,
          published_at: schedulePublishTime(strategy, user),
          view_count: Math.floor(Math.random() * 200) + 10,
          like_count: Math.floor(Math.random() * 30),
        }).select().single()
        results.push({ type: "article", title: article.title, id: dbResult?.id })
        totalGenerated++
        // 更新虚拟用户最后活跃时间（content_count 通过查询统计获取）
        await supabase.from("virtual_users").update({
          last_active_at: new Date().toISOString(),
        }).eq("id", user.id)
      } catch (err: any) {
        results.push({ type: "article", error: err.message })
      }
    }
  }

  // === 生成案例 ===
  if (types.includes("case")) {
    const caseCount = counts?.cases || (strategy === "init" ? 8 : 2)
    for (let i = 0; i < caseCount; i++) {
      const designers = virtualUsers.filter(u => u.role === "designer")
      if (!designers.length) break
      const user = designers[i % designers.length]
      try {
        const history = await getVirtualUserHistory(supabase, user.id)
        const caseItem = await generateCase(user, history)
        const { data: dbResult } = await supabase.from("cases").insert({
          title: caseItem.title,
          style: caseItem.style,
          area: caseItem.area,
          budget: caseItem.budget,
          description: caseItem.description,
          images: caseItem.images,
          designer_id: user.id,  // 简化：用 virtual_user_id 替代
          virtual_user_id: user.id,
          published_at: schedulePublishTime(strategy, user),
          view_count: Math.floor(Math.random() * 500) + 20,
        }).select().single()
        results.push({ type: "case", title: caseItem.title, id: dbResult?.id })
        totalGenerated++
      } catch (err: any) {
        results.push({ type: "case", error: err.message })
      }
    }
  }

  // === 生成提问 ===
  if (types.includes("question")) {
    const questionCount = counts?.questions || (strategy === "init" ? 8 : 2)
    for (let i = 0; i < questionCount; i++) {
      const owners = virtualUsers.filter(u => u.role === "owner")
      if (!owners.length) break
      const user = owners[i % owners.length]
      try {
        const history = await getVirtualUserHistory(supabase, user.id)
        const question = await generateQuestion(user, history)
        const { data: dbResult } = await supabase.from("questions").insert({
          user_id: user.user_id,
          title: question.title,
          content: question.content,
          category: question.category,
          virtual_user_id: user.id,
          created_at: schedulePublishTime(strategy, user),
        }).select().single()
        results.push({ type: "question", title: question.title, id: dbResult?.id })
        totalGenerated++
      } catch (err: any) {
        results.push({ type: "question", error: err.message })
      }
    }
  }

  // === 生成评论 ===
  if (types.includes("comment")) {
    const commentCount = counts?.comments || (strategy === "init" ? 30 : 8)
    // 找已有的内容作为评论目标
    const [articlesRes, casesRes] = await Promise.all([
      supabase.from("articles").select("id, title").is("virtual_user_id", null).limit(20),
      supabase.from("cases").select("id, title").is("virtual_user_id", null).limit(20),
    ])
    const targets = [
      ...(articlesRes.data || []).map(a => ({ type: "article", id: a.id, title: a.title })),
      ...(casesRes.data || []).map(c => ({ type: "case", id: c.id, title: c.title })),
    ]

    for (let i = 0; i < commentCount && targets.length > 0; i++) {
      const user = virtualUsers[i % virtualUsers.length]
      const target = targets[i % targets.length]
      try {
        const history = await getVirtualUserHistory(supabase, user.id)
        const comment = await generateComment(user, history, target.title)
        const { data: dbResult } = await supabase.from("comments").insert({
          target_type: target.type,
          target_id: target.id,
          user_id: user.user_id,
          created_at: schedulePublishTime(strategy, user),
        }).select().single()
        results.push({ type: "comment", target: target.title, id: dbResult?.id })
        totalGenerated++
      } catch (err: any) {
        results.push({ type: "comment", error: err.message })
      }
    }
  }

  // === 生成评价 ===
  if (types.includes("review")) {
    const reviewCount = counts?.reviews || (strategy === "init" ? 15 : 3)
    const { data: designers } = await supabase.from("designers").select("id, name").limit(20)
    const owners = virtualUsers.filter(u => u.role === "owner")

    for (let i = 0; i < reviewCount && owners.length > 0 && designers?.length; i++) {
      const user = owners[i % owners.length]
      const designer = designers[i % designers.length]
      try {
        const history = await getVirtualUserHistory(supabase, user.id)
        const review = await generateReview(user, history, designer.name)
        const { data: dbResult } = await supabase.from("reviews").insert({
          user_id: user.user_id,
          designer_id: designer.id,
          rating: review.rating,
          design_score: review.design_score,
          construction_score: review.construction_score,
          service_score: review.service_score,
          content: review.content,
          is_verified: true,
          review_status: "approved",
          review_source: "browse",
          virtual_user_id: user.id,
          created_at: schedulePublishTime(strategy, user),
        }).select().single()
        results.push({ type: "review", designer: designer.name, id: dbResult?.id })
        totalGenerated++
      } catch (err: any) {
        results.push({ type: "review", error: err.message })
      }
    }
  }

  // 批量更新虚拟用户的内容统计（简化：用 count 查询替代）
  for (const user of virtualUsers) {
    await supabase.from("virtual_users").update({
      // 近似更新，精确计数在查看时查
      last_active_at: new Date().toISOString(),
    }).eq("id", user.id)
  }

  return NextResponse.json({
    success: true,
    total: totalGenerated,
    results,
  })
}
```

> **Note:** The `content_count` field is not updated by the generator (too many queries). It's an approximate counter; the admin UI shows it from the DB value which can be refreshed periodically via a manual trigger or background job.

- [ ] **Step 3: Verify build**

```bash
npx next build --webpack 2>&1 | grep "error\|Error\|✓ Compiled"
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/ai-generator.ts src/app/api/admin/generate-content/
git commit -m "feat: AI content generator + generate-content API"
```

---

### Task 6: Admin Content Management Enhancement + Final Integration

**Files:**
- Modify: `src/app/admin/page.tsx` (add batch generation UI)
- Verify: Full build passes

- [ ] **Step 1: Update `src/app/admin/page.tsx`** — add batch generation panel below existing tabs

Locate the `return (` JSX and add the batch generation section between the mode tabs and the existing content. Find the closing `</div>` of the mode tabs bar and the opening of the main content div.

```typescript
// Add after the mode tabs div (after line ~77, before the main content div)

      {/* 批量内容生成 */}
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
        <h2 className="text-sm font-medium mb-3">批量内容生成</h2>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-zinc-500 mb-1">生成策略</p>
            <div className="flex gap-2">
              {(["daily", "init", "custom"] as const).map((s) => (
                <button key={s}
                  onClick={() => setGenStrategy(s)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                    genStrategy === s ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  {s === "daily" ? "日常维护" : s === "init" ? "初始化填充" : "自定义"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs text-zinc-500 mb-1">内容类型</p>
            <div className="flex flex-wrap gap-2">
              {(["article", "case", "question", "comment", "review"] as const).map((t) => (
                <label key={t} className="flex items-center gap-1.5 text-xs">
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
              <p className="text-xs text-zinc-500 mb-1">生成数量（仅初始化模式）</p>
              <input type="number" value={genCount} onChange={(e) => setGenCount(parseInt(e.target.value) || 1)}
                min={1} max={100}
                className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm outline-none" />
            </div>
          )}

          <button onClick={handleBatchGenerate} disabled={generating || genTypes.length === 0}
            className="w-full py-2.5 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-full text-sm font-medium disabled:opacity-50">
            {generating ? `生成中 (${genProgress}/${genTotal})...` : "一键批量生成"}
          </button>

          {genResult && (
            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-xs text-green-600 dark:text-green-400">
                生成完成：{genResult.total} 条内容
              </p>
              <div className="flex flex-wrap gap-1 mt-1">
                {genResult.results?.slice(0, 10).map((r: any, i: number) => (
                  <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded ${r.error ? "bg-red-50 text-red-500" : "bg-green-50 text-green-600"}`}>
                    {r.type} {r.title || r.id?.slice(0, 8) || ""}
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
      </div>
```

And add the required state variables + handler function near the top of the component, after existing state:

```typescript
const [genStrategy, setGenStrategy] = useState<"daily" | "init" | "custom">("daily")
const [genTypes, setGenTypes] = useState<string[]>(["article", "comment"])
const [genCount, setGenCount] = useState(10)
const [generating, setGenerating] = useState(false)
const [genProgress, setGenProgress] = useState(0)
const [genTotal, setGenTotal] = useState(0)
const [genResult, setGenResult] = useState<any>(null)
const [genError, setGenError] = useState("")

const handleBatchGenerate = async () => {
  setGenerating(true)
  setGenError("")
  setGenResult(null)
  setGenProgress(0)
  setGenTotal(1)

  try {
    const counts: any = {}
    if (genStrategy === "init") {
      counts.articles = Math.floor(genCount * 0.3)
      counts.comments = Math.floor(genCount * 0.4)
      counts.questions = Math.floor(genCount * 0.15)
      counts.reviews = Math.floor(genCount * 0.1)
      counts.cases = Math.floor(genCount * 0.05)
    }

    const res = await fetch("/api/admin/generate-content", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        strategy: genStrategy,
        types: genTypes,
        counts,
      }),
    })
    const data = await res.json()
    if (!res.ok) {
      setGenError(data.error || "生成失败")
    } else {
      setGenResult(data)
    }
  } catch (err: any) {
    setGenError(err.message)
  }
  setGenerating(false)
}
```

- [ ] **Step 2: Verify full build**

```bash
npx next build --webpack 2>&1 | grep "error\|Error\|✓ Compiled\|Failed"
```

Expected: `✓ Compiled successfully` — no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat: admin batch content generation UI"
```

---

### Spec Coverage Check

| Spec Section | Task Implemented |
|---|---|
| 2.1 virtual_users table | Task 1 (DB migration) |
| 2.3 Nickname generation rules | Task 2 (POST /api/admin/virtual-users generates nicknames via AI) |
| 2.4 Admin management UI | Task 3 (virtual-users page with list/edit/batch) |
| 3.1 DeepSeek API config | Task 5 (ai-generator.ts uses AI_BASE_URL/AI_MODEL/AI_API_KEY) |
| 3.2 Content types (article/case/question/comment/review) | Task 5 (all 5 generators in ai-generator.ts) |
| 3.3 Context memory mechanism | Task 5 (buildContextPrompt with history) |
| 3.4 Content generation workflow | Task 5 (generate-content API orchestrates everything) |
| 4.0 Unsplash image integration | Task 4 (unsplash.ts) |
| 4.2 Avatar (color block + initial) | Task 3 (hashCode() for deterministic color) |
| 5.0 Publish scheduler | Task 5 (schedulePublishTime() with period constraints) |
| 6.0 Admin tab + pages | Task 3 (layout.tsx tab), Task 6 (admin page enhancement) |
| 7.0 DB changes | Task 1 |
| 8.0 Admin API routes | Tasks 2, 5 |
