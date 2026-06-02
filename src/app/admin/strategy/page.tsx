"use client"

import { useEffect, useState } from "react"

type ConfigKey = "daily_quota" | "publish_rhythm" | "eco_balance" | "interaction" | "virtual_user" | "scheduling"

type ConfigMap = Record<ConfigKey, Record<string, any>>

const DEFAULT_CONFIG: ConfigMap = {
  daily_quota: { article: 5, case: 3, comment: 10, question: 2 },
  publish_rhythm: { slots: ["08-12", "14-18", "19-22"], slot_max: 4, interval_hours: 6, quiet_hours: ["23-07"] },
  eco_balance: { target_ratio: { article: 30, case: 20, comment: 40, question: 10 }, tolerance: 10 },
  interaction: { like_range: [5, 15], comment_delay: [3, 8], reply_rate: [20, 40], delay_mode: "simulation", familiar_ratio: 70, ugc_dynamic_override: false, ugc_ratio_threshold: 20, real_user_probability: 5 },
  virtual_user: { active_threshold_days: 7, auto_replenish: true, min_active: 5, batch_size: 3, idle_action: "generate_content", lifecycle_active: "daily", lifecycle_steady: "1perweek", lifecycle_retire: "90d" },
  scheduling: { enabled: true, run_at: "08:00", timezone: "Asia/Shanghai" },
}

const SECTION_LABELS: Record<ConfigKey, string> = {
  daily_quota: "每日产量",
  publish_rhythm: "发布节奏",
  eco_balance: "生态平衡",
  interaction: "互动设置",
  virtual_user: "虚拟人管理",
  scheduling: "定时调度",
}

export default function StrategyPage() {
  const [config, setConfig] = useState<ConfigMap>(DEFAULT_CONFIG)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [executing, setExecuting] = useState(false)
  const [execResult, setExecResult] = useState<string>("")
  const [logs, setLogs] = useState<any[]>([])
  const [strategyEnabled, setStrategyEnabled] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/eco/strategy").then((r) => r.json()),
      fetch("/api/admin/eco/strategy/logs?limit=5").then((r) => r.json()),
    ])
      .then(([configData, logsData]) => {
        if (configData.config) setConfig((prev) => ({ ...prev, ...configData.config }))
        if (configData.scheduling) setStrategyEnabled(configData.scheduling.enabled !== false)
        setLogs(logsData.logs ?? [])
        setLoading(false)
      })
      .catch(() => {
        setLoading(false)
      })
  }, [])

  const updateConfig = (key: ConfigKey, field: string, value: any) => {
    setConfig((prev) => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }))
  }

  const updateRatio = (field: string, value: number) => {
    setConfig((prev) => ({
      ...prev,
      eco_balance: {
        ...prev.eco_balance,
        target_ratio: { ...prev.eco_balance.target_ratio, [field]: value },
      },
    }))
  }

  const handleSave = async () => {
    setSaving(true)
    setMessage("")
    try {
      const res = await fetch("/api/admin/eco/strategy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config: { ...config, scheduling: { ...config.scheduling, enabled: strategyEnabled } } }),
      })
      const data = await res.json()
      setMessage(data.success ? "保存成功" : data.error || "保存失败")
    } catch {
      setMessage("保存失败")
    }
    setSaving(false)
  }

  const handleRunNow = async () => {
    setExecuting(true)
    setExecResult("")
    try {
      const res = await fetch("/api/admin/eco/strategy/run", { method: "POST" })
      const data = await res.json()
      if (data.run_id) {
        setExecResult(`策略已启动 (ID: ${data.run_id.slice(0, 8)}...)，刷新日志查看进度`)
      } else {
        setExecResult(data.error || "执行失败")
      }
    } catch {
      setExecResult("执行失败")
    }
    setExecuting(false)
  }

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-sm text-zinc-400">加载中...</div>
  }

  return (
    <div className="p-4 space-y-5">
      {/* 策略开关 */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">运营策略</p>
          <p className="text-xs text-zinc-400 mt-0.5">配置自动运营的参数，设定后系统将按计划执行</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRunNow}
            disabled={executing}
            className="px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-xs font-medium disabled:opacity-50"
          >
            {executing ? "执行中..." : "立即执行一次"}
          </button>
        </div>
      </div>

      {execResult && (
        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-xs text-blue-600 dark:text-blue-400">
          {execResult}
        </div>
      )}

      {/* 每日产量 */}
      <Section title="每日产量">
        <div className="grid grid-cols-4 gap-3">
          <NumberInput label="文章" value={config.daily_quota.article} onChange={(v) => updateConfig("daily_quota", "article", v)} />
          <NumberInput label="案例" value={config.daily_quota.case} onChange={(v) => updateConfig("daily_quota", "case", v)} />
          <NumberInput label="评论" value={config.daily_quota.comment} onChange={(v) => updateConfig("daily_quota", "comment", v)} />
          <NumberInput label="提问" value={config.daily_quota.question} onChange={(v) => updateConfig("daily_quota", "question", v)} />
        </div>
      </Section>

      {/* 发布节奏 */}
      <Section title="发布节奏">
        <div className="space-y-2">
          <div className="flex items-center gap-4">
            {["早上(8-12)", "下午(14-18)", "晚上(19-22)"].map((label, i) => {
              const slots = config.publish_rhythm.slots
              const checked = slots.includes(["08-12", "14-18", "19-22"][i])
              return (
                <label key={label} className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => {
                      const key = ["08-12", "14-18", "19-22"][i]
                      const next = checked ? slots.filter((s: string) => s !== key) : [...slots, key]
                      updateConfig("publish_rhythm", "slots", next)
                    }}
                    className="rounded"
                  />
                  {label}
                </label>
              )
            })}
          </div>
          <div className="flex gap-4">
            <NumberInput label="单时段上限" value={config.publish_rhythm.slot_max} onChange={(v) => updateConfig("publish_rhythm", "slot_max", v)} />
            <NumberInput label="同虚拟人间隔(h)" value={config.publish_rhythm.interval_hours} onChange={(v) => updateConfig("publish_rhythm", "interval_hours", v)} />
          </div>
        </div>
      </Section>

      {/* 生态平衡 */}
      <Section title="生态平衡">
        <div className="space-y-1.5">
          <div className="grid grid-cols-4 gap-3">
            <NumberInput label="文章 %" value={config.eco_balance.target_ratio.article} onChange={(v) => updateRatio("article", v)} />
            <NumberInput label="案例 %" value={config.eco_balance.target_ratio.case} onChange={(v) => updateRatio("case", v)} />
            <NumberInput label="评论 %" value={config.eco_balance.target_ratio.comment} onChange={(v) => updateRatio("comment", v)} />
            <NumberInput label="提问 %" value={config.eco_balance.target_ratio.question} onChange={(v) => updateRatio("question", v)} />
          </div>
          <NumberInput label="偏差容忍度 ±%" value={config.eco_balance.tolerance} onChange={(v) => updateConfig("eco_balance", "tolerance", v)} />
        </div>
      </Section>

      {/* 互动设置 */}
      <Section title="互动设置">
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <p className="text-xs text-zinc-500 mb-1">点赞（每条）</p>
              <div className="flex items-center gap-1 text-xs">
                <input
                  type="number"
                  value={config.interaction.like_range[0]}
                  onChange={(e) => updateConfig("interaction", "like_range", [parseInt(e.target.value) || 1, config.interaction.like_range[1]])}
                  className="w-full px-2 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-xs outline-none"
                />
                <span>-</span>
                <input
                  type="number"
                  value={config.interaction.like_range[1]}
                  onChange={(e) => updateConfig("interaction", "like_range", [config.interaction.like_range[0], parseInt(e.target.value) || 20])}
                  className="w-full px-2 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-xs outline-none"
                />
                <span className="text-zinc-400">个</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">评论延迟</p>
              <div className="flex items-center gap-1 text-xs">
                <input
                  type="number"
                  value={config.interaction.comment_delay[0]}
                  onChange={(e) => updateConfig("interaction", "comment_delay", [parseInt(e.target.value) || 1, config.interaction.comment_delay[1]])}
                  className="w-full px-2 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-xs outline-none"
                />
                <span>-</span>
                <input
                  type="number"
                  value={config.interaction.comment_delay[1]}
                  onChange={(e) => updateConfig("interaction", "comment_delay", [config.interaction.comment_delay[0], parseInt(e.target.value) || 12])}
                  className="w-full px-2 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-xs outline-none"
                />
                <span className="text-zinc-400">h</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">回复率</p>
              <div className="flex items-center gap-1 text-xs">
                <input
                  type="number"
                  value={config.interaction.reply_rate[0]}
                  onChange={(e) => updateConfig("interaction", "reply_rate", [parseInt(e.target.value) || 0, config.interaction.reply_rate[1]])}
                  className="w-full px-2 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-xs outline-none"
                />
                <span>-</span>
                <input
                  type="number"
                  value={config.interaction.reply_rate[1]}
                  onChange={(e) => updateConfig("interaction", "reply_rate", [config.interaction.reply_rate[0], parseInt(e.target.value) || 50])}
                  className="w-full px-2 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-xs outline-none"
                />
                <span className="text-zinc-400">%</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 text-xs">
              <span className="text-zinc-500">延迟模式:</span>
              <select
                value={config.interaction.delay_mode}
                onChange={(e) => updateConfig("interaction", "delay_mode", e.target.value)}
                className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-xs outline-none"
              >
                <option value="fixed">固定延迟</option>
                <option value="simulation">仿真作息</option>
                <option value="random">完全随机</option>
              </select>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <span className="text-zinc-500">熟人圈:</span>
              <input
                type="number"
                value={config.interaction.familiar_ratio}
                onChange={(e) => updateConfig("interaction", "familiar_ratio", parseInt(e.target.value) || 50)}
                className="w-16 px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-xs outline-none"
              />
              <span className="text-zinc-400">%</span>
            </div>
          </div>
          {/* ⚖️ UGC 反向调节 */}
          <div className="flex items-center gap-4 mt-1 pt-2 border-t border-zinc-200 dark:border-zinc-700">
            <label className="flex items-center gap-1 text-xs">
              <input type="checkbox" checked={config.interaction.ugc_dynamic_override || false}
                onChange={(e) => updateConfig("interaction", "ugc_dynamic_override", e.target.checked)}
                className="rounded"
              />
              ⚖️ UGC 达阈值时自动降低 AI 产出
            </label>
            <div className="flex items-center gap-1 text-xs">
              <span className="text-zinc-400">阈值:</span>
              <input type="number" value={config.interaction.ugc_ratio_threshold || 20}
                onChange={(e) => updateConfig("interaction", "ugc_ratio_threshold", parseInt(e.target.value) || 10)}
                className="w-14 px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-xs outline-none"
              />
              <span className="text-zinc-400">%</span>
            </div>
          </div>
          {/* 👥 真实用户互动 */}
          <div className="flex items-center gap-4 mt-1">
            <div className="flex items-center gap-1 text-xs">
              <span className="text-zinc-400">👥 真实用户互动概率:</span>
              <input type="number" value={config.interaction.real_user_probability || 5}
                onChange={(e) => updateConfig("interaction", "real_user_probability", parseInt(e.target.value) || 0)}
                className="w-14 px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-xs outline-none"
              />
              <span className="text-zinc-400">%</span>
            </div>
          </div>
        </div>
      </Section>

      {/* 虚拟人管理 */}
      <Section title="虚拟人管理">
        <div className="grid grid-cols-2 gap-3">
          <NumberInput label="活跃阈值（天）" value={config.virtual_user.active_threshold_days} onChange={(v) => updateConfig("virtual_user", "active_threshold_days", v)} />
          <NumberInput label="自动补充下限" value={config.virtual_user.min_active} onChange={(v) => updateConfig("virtual_user", "min_active", v)} />
          <NumberInput label="每次补充数量" value={config.virtual_user.batch_size} onChange={(v) => updateConfig("virtual_user", "batch_size", v)} />
        </div>
        {/* 🌀 生命周期 */}
        <div className="mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-700">
          <p className="text-xs font-medium text-zinc-500 mb-1.5">🌀 虚拟人生命周期</p>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className="text-[10px] text-zinc-400 mb-0.5">活跃期每周产出</p>
              <select
                value={config.virtual_user.lifecycle_active || "daily"}
                onChange={(e) => updateConfig("virtual_user", "lifecycle_active", e.target.value)}
                className="w-full px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-[10px] outline-none"
              >
                <option value="daily">每天 5-7 条</option>
                <option value="3perweek">每周 3 条</option>
                <option value="1perweek">每周 1 条</option>
              </select>
            </div>
            <div>
              <p className="text-[10px] text-zinc-400 mb-0.5">平稳期每周产出</p>
              <select
                value={config.virtual_user.lifecycle_steady || "1perweek"}
                onChange={(e) => updateConfig("virtual_user", "lifecycle_steady", e.target.value)}
                className="w-full px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-[10px] outline-none"
              >
                <option value="daily">每天 1-2 条</option>
                <option value="3perweek">每周 3 条</option>
                <option value="1perweek">每周 1 条</option>
                <option value="occasional">偶尔点赞</option>
              </select>
            </div>
            <div>
              <p className="text-[10px] text-zinc-400 mb-0.5">退场条件</p>
              <select
                value={config.virtual_user.lifecycle_retire || "90d"}
                onChange={(e) => updateConfig("virtual_user", "lifecycle_retire", e.target.value)}
                className="w-full px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-[10px] outline-none"
              >
                <option value="90d">连续 90 天不活跃</option>
                <option value="180d">连续 180 天不活跃</option>
                <option value="never">永不退场</option>
              </select>
            </div>
          </div>
        </div>
      </Section>

      {/* 定时调度 */}
      <Section title="定时调度">
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={strategyEnabled}
              onChange={(e) => setStrategyEnabled(e.target.checked)}
              className="rounded"
            />
            启用自动运营
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-zinc-500 mb-1">执行时间</p>
              <input
                type="time"
                value={config.scheduling.run_at || "08:00"}
                onChange={(e) => updateConfig("scheduling", "run_at", e.target.value)}
                className="w-full px-2 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-xs outline-none"
              />
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">时区</p>
              <input
                type="text"
                value={config.scheduling.timezone || "Asia/Shanghai"}
                onChange={(e) => updateConfig("scheduling", "timezone", e.target.value)}
                className="w-full px-2 py-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-xs outline-none font-mono text-[10px]"
              />
            </div>
          </div>
        </div>
      </Section>

      {/* 保存 */}
      {message && (
        <div className={`p-2 rounded-lg text-xs ${message === "保存成功" ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}>
          {message}
        </div>
      )}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full py-2.5 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-full text-sm font-medium disabled:opacity-50"
      >
        {saving ? "保存中..." : "保存配置"}
      </button>

      {/* 执行日志 */}
      <Section title="最近执行记录">
        {logs.length === 0 ? (
          <p className="text-xs text-zinc-400">暂无执行记录</p>
        ) : (
          <div className="space-y-1">
            {logs.map((log: any) => {
              const failedCount = Array.isArray(log.summary?.failed) ? log.summary.failed.length : 0
              const totalSuccess = log.summary?.succeeded
                ? Number(Object.values(log.summary.succeeded).reduce((a: any, b: any) => a + (typeof b === "number" ? b : 0), 0))
                : 0
              return (
                <div key={log.id} className="flex items-center justify-between px-3 py-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg text-xs">
                  <div className="flex items-center gap-2">
                    <span className={log.status === "completed" ? "text-green-600" : log.status === "failed" ? "text-red-500" : "text-amber-500"}>
                      {log.status === "completed" ? "✅" : log.status === "failed" ? "❌" : "⏳"}
                    </span>
                    <span className="text-zinc-400 font-mono text-[10px]">
                      {log.started_at?.slice(0, 16).replace("T", " ")}
                    </span>
                    <span>{totalSuccess} 条成功</span>
                    {failedCount > 0 && <span className="text-red-500">{failedCount} 条失败</span>}
                  </div>
                  <span className="text-zinc-400 text-[10px]">
                    {log.summary?.duration_ms ? `${(log.summary.duration_ms / 1000).toFixed(1)}s` : ""}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </Section>
    </div>
  )
}

// --- 子组件 ---

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-zinc-500 mb-2">{title}</p>
      <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl">{children}</div>
    </div>
  )
}

function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value) || 0)}
        className="w-full px-2 py-1.5 bg-white dark:bg-zinc-700 rounded-lg text-xs outline-none"
      />
    </div>
  )
}
