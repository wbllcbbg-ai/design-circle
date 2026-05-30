"use client"

import { useEffect, useState, useCallback } from "react"

type Rule = {
  id: string
  name: string
  trigger_event: string
  inviter_points: number
  invitee_points: number
  inviter_reward_desc: string | null
  invitee_reward_desc: string | null
  is_active: boolean
  created_at: string
}

const TRIGGER_LABELS: Record<string, string> = {
  register: "注册完成",
  browse: "浏览内容",
  consult: "发起咨询",
  any: "任意行为",
}

export default function AdminRewardsPage() {
  const [rules, setRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Rule | null>(null)
  const [form, setForm] = useState({ name: "", trigger_event: "register", inviter_points: 10, invitee_points: 5, inviter_reward_desc: "", invitee_reward_desc: "", is_active: true })

  const loadRules = useCallback(async () => {
    const res = await fetch("/api/admin/reward-rules")
    const data = await res.json()
    setRules(data.rules ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadRules() }, [])

  const handleSave = async () => {
    if (!form.name) return
    const body = {
      ...form,
      inviter_reward_desc: form.inviter_reward_desc || null,
      invitee_reward_desc: form.invitee_reward_desc || null,
    }

    if (editing) {
      await fetch(`/api/admin/reward-rules/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    } else {
      await fetch("/api/admin/reward-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    }
    setEditing(null)
    setForm({ name: "", trigger_event: "register", inviter_points: 10, invitee_points: 5, inviter_reward_desc: "", invitee_reward_desc: "", is_active: true })
    await loadRules()
  }

  const handleDelete = async (id: string) => {
    if (!confirm("确定删除这条规则？")) return
    await fetch(`/api/admin/reward-rules/${id}`, { method: "DELETE" })
    await loadRules()
  }

  const handleToggle = async (rule: Rule) => {
    await fetch(`/api/admin/reward-rules/${rule.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !rule.is_active }),
    })
    await loadRules()
  }

  const startEdit = (rule: Rule) => {
    setEditing(rule)
    setForm({
      name: rule.name,
      trigger_event: rule.trigger_event,
      inviter_points: rule.inviter_points,
      invitee_points: rule.invitee_points,
      inviter_reward_desc: rule.inviter_reward_desc || "",
      invitee_reward_desc: rule.invitee_reward_desc || "",
      is_active: rule.is_active,
    })
  }

  if (loading) return <div className="flex items-center justify-center py-10 text-sm text-zinc-400">加载中...</div>

  return (
    <div>
      {/* 表单 */}
      <div className="p-4 border-b border-zinc-100 dark:border-zinc-800">
        <h2 className="text-sm font-medium mb-3">{editing ? "编辑规则" : "新增规则"}</h2>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-zinc-500 mb-1">规则名称</p>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如：注册奖励" className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm outline-none" />
          </div>
          <div>
            <p className="text-xs text-zinc-500 mb-1">触发事件</p>
            <select value={form.trigger_event} onChange={(e) => setForm({ ...form, trigger_event: e.target.value })} className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm outline-none">
              {Object.entries(TRIGGER_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <p className="text-xs text-zinc-500 mb-1">邀请方积分</p>
              <input type="number" value={form.inviter_points} onChange={(e) => setForm({ ...form, inviter_points: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm outline-none" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-zinc-500 mb-1">被邀请方积分</p>
              <input type="number" value={form.invitee_points} onChange={(e) => setForm({ ...form, invitee_points: parseInt(e.target.value) || 0 })} className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm outline-none" />
            </div>
          </div>
          <div>
            <p className="text-xs text-zinc-500 mb-1">邀请方奖励描述</p>
            <input type="text" value={form.inviter_reward_desc} onChange={(e) => setForm({ ...form, inviter_reward_desc: e.target.value })} placeholder="如：50元红包" className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm outline-none" />
          </div>
          <div>
            <p className="text-xs text-zinc-500 mb-1">被邀请方奖励描述</p>
            <input type="text" value={form.invitee_reward_desc} onChange={(e) => setForm({ ...form, invitee_reward_desc: e.target.value })} placeholder="如：20元优惠券" className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm outline-none" />
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="rounded" />
            <span className="text-xs text-zinc-500">启用</span>
          </label>
          <div className="flex gap-2">
            <button onClick={handleSave} className="flex-1 py-2 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-lg text-sm font-medium">保存</button>
            {editing && <button onClick={() => { setEditing(null); setForm({ name: "", trigger_event: "register", inviter_points: 10, invitee_points: 5, inviter_reward_desc: "", invitee_reward_desc: "", is_active: true }) }} className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm">取消</button>}
          </div>
        </div>
      </div>

      {/* 规则列表 */}
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {rules.map((rule) => (
          <div key={rule.id} className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{rule.name}</span>
                <span className={`text-[10px] px-1.5 py-0.5 rounded ${rule.is_active ? "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400" : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800"}`}>
                  {rule.is_active ? "启用" : "禁用"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleToggle(rule)} className="text-[10px] text-zinc-400 underline">{rule.is_active ? "禁用" : "启用"}</button>
                <button onClick={() => startEdit(rule)} className="text-[10px] text-zinc-400 underline">编辑</button>
                <button onClick={() => handleDelete(rule.id)} className="text-[10px] text-red-400 underline">删除</button>
              </div>
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              {TRIGGER_LABELS[rule.trigger_event] || rule.trigger_event} · 邀请方+{rule.inviter_points}分 · 被邀请方+{rule.invitee_points}分
            </div>
            {(rule.inviter_reward_desc || rule.invitee_reward_desc) && (
              <div className="text-[10px] text-zinc-400 mt-0.5">
                {rule.inviter_reward_desc && <span>邀请方: {rule.inviter_reward_desc} </span>}
                {rule.invitee_reward_desc && <span>被邀请方: {rule.invitee_reward_desc}</span>}
              </div>
            )}
          </div>
        ))}
        {rules.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-zinc-400">暂无奖励规则，添加一条吧</div>
        )}
      </div>
    </div>
  )
}
