# 全民裂变邀请系统 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full referral/invite system where any user can invite others to join the platform via links/codes/QR, with rewards for both inviter and invitee.

**Architecture:** Phase 1 = core DB + APIs + invite page + registration binding + profile/dashboard entry points. Phase 2 = share-on-content + QR. Phase 3 = admin reward rules + points system. Each phase layers on the previous without rework.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres + Auth), TypeScript, Tailwind CSS

---

## File Structure

### New files to create:
- `src/app/api/invite/code/route.ts` — GET (get my code), POST (create), PUT (modify)
- `src/app/api/invite/check/route.ts` — GET ?code=xxx (validate code)
- `src/app/api/invite/bind/route.ts` — POST (bind invitee to inviter post-registration)
- `src/app/api/invite/stats/route.ts` — GET (inviter dashboard stats)
- `src/app/api/invite/list/route.ts` — GET (invitation detail list)
- `src/app/api/points/route.ts` — GET (my points + history)
- `src/app/api/admin/reward-rules/route.ts` — GET/POST (manage rules)
- `src/app/api/admin/reward-rules/[id]/route.ts` — PUT/DELETE (edit/delete rule)
- `src/app/invite/page.tsx` — Invitation hub page
- `src/app/points/page.tsx` — Points & rewards page
- `src/app/admin/rewards/page.tsx` — Admin reward rules config
- `src/app/auth/register/page.tsx` — Registration with invite code input (if separate from login page; currently login.tsx handles both)

### Existing files to modify:
- `supabase/migrations/00001_schema.sql` — Add invites, reward_rules, user_points tables
- `src/app/login/page.tsx` — Add invite code input to registration form
- `src/app/profile/page.tsx` — Add "邀请好友" menu item
- `src/app/dashboard/page.tsx` — Add invitation stats card
- `src/app/cases/[id]/page.tsx` — Add share button to case detail
- `src/app/articles/[id]/page.tsx` — Add share button to article detail
- `src/app/layout.tsx` — Maybe nothing, but checking for global invite-ref handling

## Phase 1 — Core (Database + API + Invite Page + Registration Binding + Entries)

### Task 1: Database Migration

**Files:**
- Modify: `supabase/migrations/00001_schema.sql`

- [ ] **Step 1: Add invites table + indexes**

Append before existing indexes section (find the end of message table + before `CREATE INDEX idx_designers_city_id`):

```sql
-- 邀请关系
CREATE TABLE invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id UUID NOT NULL REFERENCES users(id),
  invitee_id UUID REFERENCES users(id),
  code TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'link',
  source_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  registered_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  rewarded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invites_inviter ON invites(inviter_id);
CREATE INDEX idx_invites_invitee ON invites(invitee_id);
CREATE UNIQUE INDEX idx_invites_code ON invites(code);

-- 奖励规则
CREATE TABLE reward_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  trigger_event TEXT NOT NULL DEFAULT 'register',
  inviter_points INT NOT NULL DEFAULT 0,
  invitee_points INT NOT NULL DEFAULT 0,
  inviter_reward_desc TEXT,
  invitee_reward_desc TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 用户积分
CREATE TABLE user_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  points INT NOT NULL DEFAULT 0,
  total_earned INT NOT NULL DEFAULT 0,
  total_invites INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_user_points_user ON user_points(user_id);
```

- [ ] **Step 2: Commit migration**

```bash
git add supabase/migrations/00001_schema.sql
git commit -m "feat: add invites, reward_rules, user_points tables"
```

### Task 2: Invite Code API (Generate / Check / Modify)

**Files:**
- Create: `src/app/api/invite/code/route.ts`
- Create: `src/app/api/invite/check/route.ts`

- [ ] **Step 1: Create invite code GET/POST/PUT API**

```typescript
// src/app/api/invite/code/route.ts
import { getCurrentUserId } from "@/lib/supabase/server"
import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // No 0/O/1/I to avoid confusion
function generateCode(length = 6): string {
  let code = ""
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  }
  return code
}

// 获取或创建我的邀请码
export async function GET() {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const supabase = createDirectClient()

  // 查现有的邀请码
  const { data: existing } = await supabase
    .from("invites")
    .select("code")
    .eq("inviter_id", userId)
    .limit(1)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ code: existing.code })
  }

  // 没有就生成一个
  let code = generateCode()
  let retries = 0
  while (retries < 10) {
    const { data } = await supabase.from("invites").select("id").eq("code", code).maybeSingle()
    if (!data) break
    code = generateCode()
    retries++
  }

  if (retries >= 10) {
    return NextResponse.json({ error: "无法生成邀请码，请重试" }, { status: 500 })
  }

  // 创建邀请记录（没有 invitee 的占位行）
  const { error } = await supabase.from("invites").insert({
    inviter_id: userId,
    code,
    channel: "link",
    status: "pending",
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ code })
}

// 修改邀请码
export async function PUT(req: Request) {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const body = await req.json()
  const { code } = body

  if (!code || code.length < 4 || code.length > 20) {
    return NextResponse.json({ error: "邀请码长度4-20位" }, { status: 400 })
  }

  if (!/^[A-Za-z0-9]+$/.test(code)) {
    return NextResponse.json({ error: "邀请码只能包含字母和数字" }, { status: 400 })
  }

  const supabase = createDirectClient()
  const upperCode = code.toUpperCase()

  // 检查唯一性
  const { data: existing } = await supabase
    .from("invites")
    .select("id")
    .eq("code", upperCode)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: "该邀请码已被使用" }, { status: 409 })
  }

  // 更新当前用户的邀请码
  const { error } = await supabase
    .from("invites")
    .update({ code: upperCode })
    .eq("inviter_id", userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ code: upperCode })
}
```

- [ ] **Step 2: Create invite check API**

```typescript
// src/app/api/invite/check/route.ts
import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get("code")?.trim().toUpperCase()

  if (!code || code.length < 4 || code.length > 20) {
    return NextResponse.json({ valid: false, error: "无效的邀请码" })
  }

  const supabase = createDirectClient()
  const { data } = await supabase
    .from("invites")
    .select("inviter_id, code")
    .eq("code", code)
    .maybeSingle()

  if (!data) {
    return NextResponse.json({ valid: false, error: "邀请码不存在" })
  }

  // 查邀请人昵称
  const { data: inviter } = await supabase
    .from("users")
    .select("nickname")
    .eq("id", data.inviter_id)
    .single()

  return NextResponse.json({
    valid: true,
    code: data.code,
    inviter_nickname: inviter?.nickname || "用户",
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/invite/
git commit -m "feat: invite code generation, validation, and modification API"
```

### Task 3: Invite Bind API (Post-registration binding)

**Files:**
- Create: `src/app/api/invite/bind/route.ts`

- [ ] **Step 1: Create bind API**

```typescript
// src/app/api/invite/bind/route.ts
import { getCurrentUserId } from "@/lib/supabase/server"
import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const body = await req.json()
  const { code, channel } = body

  if (!code) {
    return NextResponse.json({ error: "邀请码不能为空" }, { status: 400 })
  }

  const supabase = createDirectClient()
  const upperCode = code.toUpperCase()

  // 查邀请记录
  const { data: invite } = await supabase
    .from("invites")
    .select("id, inviter_id, status")
    .eq("code", upperCode)
    .maybeSingle()

  if (!invite) {
    return NextResponse.json({ valid: false, error: "邀请码无效" }, { status: 400 })
  }

  // 自邀禁止
  if (invite.inviter_id === userId) {
    return NextResponse.json({ valid: false, error: "不能使用自己的邀请码" }, { status: 400 })
  }

  // 已被绑定
  if (invite.status !== "pending") {
    return NextResponse.json({ valid: false, error: "该邀请码已被使用" }, { status: 400 })
  }

  // 更新邀请记录
  const { error } = await supabase
    .from("invites")
    .update({
      invitee_id: userId,
      status: "registered",
      registered_at: new Date().toISOString(),
      channel: channel || "code",
    })
    .eq("id", invite.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 给邀请人加积分 (默认注册奖励)
  await supabase.from("user_points").upsert(
    { user_id: invite.inviter_id, points: 10, total_earned: 10, total_invites: 1, updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  )

  // 给被邀请人加积分
  await supabase.from("user_points").upsert(
    { user_id: userId, points: 5, total_earned: 5, total_invites: 0, updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  )

  // 标记为已奖励
  await supabase.from("invites").update({ status: "rewarded", rewarded_at: new Date().toISOString() }).eq("id", invite.id)

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 2: Create invite stats and list APIs**

```typescript
// src/app/api/invite/stats/route.ts
import { getCurrentUserId } from "@/lib/supabase/server"
import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const supabase = createDirectClient()

  const [total, registered, rewarded, points] = await Promise.all([
    supabase.from("invites").select("*", { count: "exact", head: true }).eq("inviter_id", userId),
    supabase.from("invites").select("*", { count: "exact", head: true }).eq("inviter_id", userId).eq("status", "registered"),
    supabase.from("invites").select("*", { count: "exact", head: true }).eq("inviter_id", userId).eq("status", "rewarded"),
    supabase.from("user_points").select("points, total_invites").eq("user_id", userId).maybeSingle(),
  ])

  return NextResponse.json({
    total: total.count ?? 0,
    registered: registered.count ?? 0,
    rewarded: rewarded.count ?? 0,
    points: points.data?.points ?? 0,
    total_invites: points.data?.total_invites ?? 0,
  })
}
```

```typescript
// src/app/api/invite/list/route.ts
import { getCurrentUserId } from "@/lib/supabase/server"
import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const supabase = createDirectClient()

  const { data } = await supabase
    .from("invites")
    .select("id, code, channel, status, created_at, registered_at, rewarded_at, invitee_id")
    .eq("inviter_id", userId)
    .order("created_at", { ascending: false })
    .limit(50)

  // 补充被邀请人信息
  const list = (data ?? []).map(async (item: any) => {
    if (item.invitee_id) {
      const { data: u } = await supabase.from("users").select("nickname").eq("id", item.invitee_id).single()
      return { ...item, invitee_nickname: u?.nickname || null }
    }
    return { ...item, invitee_nickname: null }
  })

  const result = await Promise.all(list)
  return NextResponse.json({ invites: result })
}
```

And create the points API:
```typescript
// src/app/api/points/route.ts
import { getCurrentUserId } from "@/lib/supabase/server"
import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const userId = await getCurrentUserId()
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const supabase = createDirectClient()
  const { data } = await supabase
    .from("user_points")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle()

  return NextResponse.json({
    points: data?.points ?? 0,
    total_earned: data?.total_earned ?? 0,
    total_invites: data?.total_invites ?? 0,
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/invite/bind/route.ts src/app/api/invite/stats/route.ts src/app/api/invite/list/route.ts src/app/api/points/route.ts
git commit -m "feat: invite bind, stats, list and points API"
```

### Task 4: Invite Page (/invite)

**Files:**
- Create: `src/app/invite/page.tsx`

- [ ] **Step 1: Create invite hub page**

```typescript
// src/app/invite/page.tsx
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

type Stats = {
  total: number
  registered: number
  rewarded: number
  points: number
  total_invites: number
}

type InviteItem = {
  id: string
  code: string
  channel: string
  status: string
  created_at: string
  registered_at: string | null
  rewarded_at: string | null
  invitee_nickname: string | null
}

const STATUS_MAP: Record<string, string> = {
  pending: "待注册",
  registered: "已注册",
  completed: "已完成",
  rewarded: "已奖励",
}

export default function InvitePage() {
  const router = useRouter()
  const supabase = createClient()
  const [code, setCode] = useState("")
  const [editing, setEditing] = useState(false)
  const [newCode, setNewCode] = useState("")
  const [stats, setStats] = useState<Stats | null>(null)
  const [invites, setInvites] = useState<InviteItem[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<"link" | "code">("link")
  const [copied, setCopied] = useState(false)

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push("/login"); return }

    const [codeRes, statsRes, listRes] = await Promise.all([
      fetch("/api/invite/code").then(r => r.json()),
      fetch("/api/invite/stats").then(r => r.json()),
      fetch("/api/invite/list").then(r => r.json()),
    ])
    setCode(codeRes.code || "")
    setStats(statsRes)
    setInvites(invites ?? [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const handleSaveCode = async () => {
    if (!newCode.trim()) return
    const res = await fetch("/api/invite/code", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: newCode }),
    })
    if (res.ok) {
      const data = await res.json()
      setCode(data.code)
      setEditing(false)
    } else {
      const data = await res.json()
      alert(data.error || "修改失败")
    }
  }

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shareUrl = `${window.location.origin}/?ref=${code}`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(shareUrl)}`

  if (loading) return <div className="bg-white dark:bg-zinc-900 min-h-screen flex items-center justify-center text-sm text-zinc-400">加载中...</div>

  return (
    <div className="bg-white dark:bg-zinc-900 min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 h-12 border-b border-zinc-100 dark:border-zinc-800">
        <Link href="/" className="p-1">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
        <h1 className="text-sm font-medium">邀请好友</h1>
      </div>

      {/* 邀请码 */}
      <div className="px-4 pt-6 pb-4 border-b border-zinc-100 dark:border-zinc-800">
        <p className="text-xs text-zinc-500 mb-2">你的邀请码</p>
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value.toUpperCase())}
              placeholder="4-20位字母数字"
              maxLength={20}
              className="flex-1 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm outline-none font-mono"
              autoFocus
            />
            <button onClick={handleSaveCode} className="px-3 py-2 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-lg text-xs font-medium">保存</button>
            <button onClick={() => setEditing(false)} className="px-3 py-2 text-xs text-zinc-400">取消</button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold font-mono tracking-wider">{code}</span>
            <button onClick={() => setEditing(true)} className="text-[10px] text-zinc-400 underline">修改</button>
          </div>
        )}
      </div>

      {/* 分享方式 */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex gap-2">
          {[
            { key: "link" as const, label: "分享链接" },
            { key: "code" as const, label: "邀请码" },
          ].map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium ${tab === t.key ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"}`}
            >{t.label}</button>
          ))}
        </div>
      </div>

      <div className="px-4 pb-4">
        {tab === "link" ? (
          <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
            <p className="text-xs text-zinc-500 mb-2">分享链接</p>
            <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 rounded-lg px-3 py-2 border border-zinc-200 dark:border-zinc-700">
              <span className="flex-1 text-xs text-zinc-600 dark:text-zinc-400 truncate font-mono">{shareUrl}</span>
              <button onClick={() => handleCopy(shareUrl)} className="text-xs text-zinc-500 font-medium shrink-0">{copied ? "已复制" : "复制"}</button>
            </div>
            <p className="text-xs text-zinc-400 mt-3">朋友点击链接注册后，系统会自动绑定邀请关系</p>
          </div>
        ) : (
          <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
            <p className="text-xs text-zinc-500 mb-3">邀请码</p>
            <div className="text-center py-4">
              <span className="text-3xl font-bold font-mono tracking-widest">{code}</span>
            </div>
            <button onClick={() => handleCopy(code)} className="w-full py-2 bg-white dark:bg-zinc-900 rounded-lg text-sm border border-zinc-200 dark:border-zinc-700">
              {copied ? "已复制" : "复制邀请码"}
            </button>
            <p className="text-xs text-zinc-400 mt-3 text-center">朋友注册时输入此邀请码即可绑定</p>
          </div>
        )}
      </div>

      {/* 统计 */}
      {stats && (
        <div className="mx-4 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl flex items-center justify-around">
          <div className="text-center">
            <p className="font-semibold text-base">{stats.total}</p>
            <p className="text-[10px] text-zinc-400">总邀请</p>
          </div>
          <div className="text-center">
            <p className="font-semibold text-base">{stats.registered}</p>
            <p className="text-[10px] text-zinc-400">已注册</p>
          </div>
          <div className="text-center">
            <p className="font-semibold text-base">{stats.rewarded}</p>
            <p className="text-[10px] text-zinc-400">已奖励</p>
          </div>
          <div className="text-center">
            <p className="font-semibold text-base text-amber-500">{stats.points}</p>
            <p className="text-[10px] text-zinc-400">积分</p>
          </div>
        </div>
      )}

      {/* 邀请明细 */}
      {invites.length > 0 && (
        <div className="mt-4 px-4 pb-6">
          <h2 className="text-sm font-medium mb-3">邀请明细</h2>
          <div className="space-y-2">
            {invites.map((item) => (
              <div key={item.id} className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                <div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400">
                    {item.invitee_nickname || "等待注册"}
                  </p>
                  <p className="text-[10px] text-zinc-400 mt-0.5">
                    {STATUS_MAP[item.status] || item.status} · {new Date(item.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                  item.status === "rewarded" ? "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"}`}>
                  {STATUS_MAP[item.status] || item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 积分入口 */}
      <div className="px-4 pb-8">
        <Link href="/points" className="block p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl">
          <div className="flex items-center justify-between">
            <span className="text-sm">查看积分详情</span>
            <svg className="w-4 h-4 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </div>
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create points page**

```typescript
// src/app/points/page.tsx
"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function PointsPage() {
  const router = useRouter()
  const supabase = createClient()
  const [data, setData] = useState<{ points: number; total_earned: number; total_invites: number } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push("/login"); return }
      const res = await fetch("/api/points")
      setData(await res.json())
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <div className="bg-white dark:bg-zinc-900 min-h-screen flex items-center justify-center text-sm text-zinc-400">加载中...</div>

  return (
    <div className="bg-white dark:bg-zinc-900 min-h-screen">
      <div className="flex items-center gap-2 px-4 h-12 border-b border-zinc-100 dark:border-zinc-800">
        <Link href="/invite" className="p-1">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
        <h1 className="text-sm font-medium">我的积分</h1>
      </div>

      <div className="px-4 pt-8 pb-4 text-center">
        <div className="text-4xl font-bold text-amber-500">{data?.points ?? 0}</div>
        <p className="text-xs text-zinc-400 mt-1">当前积分</p>
      </div>

      <div className="mx-4 p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-zinc-500">累计获得</span>
          <span className="font-medium">{data?.total_earned ?? 0} 积分</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-zinc-500">来自邀请</span>
          <span className="font-medium">{data?.total_invites ?? 0} 人</span>
        </div>
      </div>

      <div className="px-4 mt-6">
        <h2 className="text-sm font-medium mb-2">如何获取积分</h2>
        <div className="space-y-2 text-xs text-zinc-500">
          <p>• 邀请好友注册：+10 积分</p>
          <p>• 被邀请注册：+5 积分</p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/invite/page.tsx src/app/points/page.tsx
git commit -m "feat: invite hub page and points page"
```

### Task 5: Registration Invite Code Input

**Files:**
- Modify: `src/app/login/page.tsx`

- [ ] **Step 1: Add invite code input to registration form**

Find the `register` section in login/page.tsx. Add before the submit button:
```typescript
const [inviteCode, setInviteCode] = useState("")
const [inviteValid, setInviteValid] = useState<{ valid: boolean; inviter_nickname?: string } | null>(null)

// ... inside the register mode JSX, before the submit button:
<div className="mt-2">
  <button
    type="button"
    onClick={() => setShowInviteInput(!showInviteInput)}
    className="text-xs text-zinc-400 underline"
  >
    {showInviteInput ? "收起" : "有邀请码？"}
  </button>
  {showInviteInput && (
    <div className="mt-2">
      <input
        type="text"
        value={inviteCode}
        onChange={async (e) => {
          const v = e.target.value.toUpperCase()
          setInviteCode(v)
          if (v.length >= 4) {
            const res = await fetch(`/api/invite/check?code=${v}`)
            const data = await res.json()
            setInviteValid(data)
          } else {
            setInviteValid(null)
          }
        }}
        placeholder="输入邀请码"
        className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm outline-none"
      />
      {inviteValid && (
        <p className={`text-xs mt-1 ${inviteValid.valid ? "text-green-600" : "text-red-500"}`}>
          {inviteValid.valid ? `你被 ${inviteValid.inviter_nickname} 邀请` : "邀请码不存在"}
        </p>
      )}
    </div>
  )}
</div>
```

And in the signUp success handler, store the invite code to be bound after registration. Add a localStorage write:
```typescript
if (inviteValid?.valid) {
  localStorage.setItem("pending_invite_code", inviteCode)
}
```

- [ ] **Step 2: Modify auth callback to bind invite code**

In the auth callback page `/auth/callback` or in the post-login redirect, add:
```typescript
// After successful login/registration
const pendingCode = localStorage.getItem("pending_invite_code")
if (pendingCode) {
  await fetch("/api/invite/bind", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code: pendingCode, channel: "code" }),
  })
  localStorage.removeItem("pending_invite_code")
}
```

This needs to happen in the login page after signup, and also in the auth callback.

- [ ] **Step 3: Handle ref= parameter in the root layout or home page**

Add to the root layout or a client-side hook in `layout.tsx`:
```typescript
// In a useEffect at the app root level (add to layout or create a small InviteTracker component)
useEffect(() => {
  const params = new URLSearchParams(window.location.search)
  const ref = params.get("ref")
  if (ref) {
    localStorage.setItem("pending_invite_code", ref.toUpperCase())
  }
}, [])
```

This captures the `?ref=CODE` from shared links before registration.

- [ ] **Step 4: Commit**

```bash
git add src/app/login/page.tsx src/app/layout.tsx
git commit -m "feat: invite code input on registration and ref tracking from links"
```

### Task 6: Profile + Dashboard Entry Points

**Files:**
- Modify: `src/app/profile/page.tsx`
- Modify: `src/app/dashboard/page.tsx`

- [ ] **Step 1: Add invite entry to profile page**

Find the menu items section in `/profile/page.tsx` (around the `divide-y` section). Add before "浏览历史":
```typescript
{ icon: "📢", label: "邀请好友", href: "/invite" },
```

- [ ] **Step 2: Add invitation card to dashboard**

Find the dashboard page at `/dashboard/page.tsx`. Add a card after the stats overview section:
```tsx
{/* 邀请客户 */}
<Link href="/invite" className="block p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/10 dark:to-orange-900/10 rounded-xl border border-amber-100 dark:border-amber-800/30">
  <div className="flex items-center justify-between">
    <div>
      <h3 className="text-sm font-medium">邀请客户</h3>
      <p className="text-xs text-zinc-500 mt-1">分享链接获取更多客户</p>
    </div>
    <svg className="w-5 h-5 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  </div>
</Link>
```

- [ ] **Step 3: Commit**

```bash
git add src/app/profile/page.tsx src/app/dashboard/page.tsx
git commit -m "feat: invite entry points in profile and dashboard"
```

## Phase 2 — Share + QR (Will implement after Phase 1 review)

### Task 7: Share Buttons on Case/Article Detail

**Files:**
- Modify: `src/app/cases/[id]/page.tsx`
- Modify: `src/app/articles/[id]/page.tsx`

Will add a share button to each detail page that copies the page URL with `?ref={userCode}`.

### Task 8: QR Code Generation

Will add QR code generation on the invite page (above we used an external API as placeholder, may switch to local `qrcode` npm package).

## Phase 3 — Admin Rewards (Will implement after Phase 2 review)

### Task 9: Admin Reward Rules

### Task 10: Points History + Enhanced Reward Logic
