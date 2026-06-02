import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-guard"
import { generateArticle, generateCase, generateComment, generateQuestion, generateReview, setRuntimeAiKey, setWanxiangEnabled } from "@/lib/ai-generator"
import { setUnsplashKey } from "@/lib/unsplash"
import { schedulePublishTime } from "@/lib/content-scheduler"
import { setWanxiangKey } from "@/lib/wanxiang"

export const dynamic = "force-dynamic"
export const maxDuration = 120

// 单个 AI 调用超时（毫秒）
const AI_CALL_TIMEOUT = 45_000
// 图片生成超时
const IMAGE_TIMEOUT = 25_000
// 并发上限
const CONCURRENCY_LIMIT = 3

// 带超时的 fetch 包装
async function fetchWithTimeout(url: string, options: RequestInit & { timeout?: number } = {}): Promise<Response> {
  const { timeout = AI_CALL_TIMEOUT, ...fetchOpts } = options
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(url, { ...fetchOpts, signal: controller.signal })
    return res
  } finally {
    clearTimeout(timer)
  }
}

// 并发控制：一次最多跑 N 个，成功一个存一个
async function runConcurrent<T>(
  items: T[],
  worker: (item: T, index: number) => Promise<{ ok: boolean; error?: string }>,
  concurrency = CONCURRENCY_LIMIT,
): Promise<{ success: number; failed: { index: number; error: string }[] }> {
  let success = 0
  const failed: { index: number; error: string }[] = []
  const queue = [...items.entries()]

  async function next() {
    while (queue.length > 0) {
      const [index, item] = queue.shift()!
      try {
        const result = await worker(item, index)
        if (result.ok) {
          success++
        } else {
          failed.push({ index, error: result.error || "unknown error" })
        }
      } catch (err: any) {
        failed.push({ index, error: err.message || "unknown error" })
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => next())
  await Promise.all(workers)

  return { success, failed }
}

// POST /api/admin/eco/strategy/run — 立即执行一次策略（异步）
export async function POST(req: Request) {
  // 支持 CRON_SECRET 认证（Vercel Cron Jobs）
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get("authorization") || ""
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`

  if (!isCron) {
    const guard = await requireAdmin()
    if (guard) return guard
  }

  const supabase = createDirectClient()

  // 1. 创建执行日志记录
  const { data: logEntry } = await supabase
    .from("auto_operate_logs")
    .insert({ status: "running", summary: {} })
    .select()
    .single()

  if (!logEntry) {
    return NextResponse.json({ error: "无法创建执行记录" }, { status: 500 })
  }

  const runId = logEntry.id

  // 2. 异步执行 — 不等待完全结束就返回，后台继续跑
  executeStrategy(runId).catch((err) => {
    console.error("策略引擎后台执行错误:", err)
  })

  return NextResponse.json({ run_id: runId, status: "running", message: "策略已在后台开始执行" })
}

async function executeStrategy(runId: string) {
  const supabase = createDirectClient()
  const startedAt = Date.now()

  try {
    // 加载运行时配置
    await loadRuntimeConfig()

    // 读取策略配置
    const { data: configRows } = await supabase.from("auto_operate_config").select("key, value")
    const config: Record<string, any> = {}
    for (const row of configRows || []) {
      config[row.key] = row.value
    }

    const quota = config.daily_quota || { article: 5, case: 3, comment: 10, question: 2 }

    // 生态平衡检测：查当前存量比例，超限则减少对应类型的配额
    const ecoBalance = config.eco_balance || {}
    const targetRatio = ecoBalance.target_ratio || {}
    const tolerance = ecoBalance.tolerance ?? 10
    if (Object.keys(targetRatio).length > 0) {
      const { count: articleTotal } = await supabase.from("articles").select("id", { count: "exact", head: true })
      const { count: caseTotal } = await supabase.from("cases").select("id", { count: "exact", head: true })
      const { count: commentTotal } = await supabase.from("comments").select("id", { count: "exact", head: true })
      const fullTotal = (articleTotal || 0) + (caseTotal || 0) + (commentTotal || 0)
      if (fullTotal > 0) {
        const actualRatio = {
          article: Math.round(((articleTotal || 0) / fullTotal) * 100),
          case: Math.round(((caseTotal || 0) / fullTotal) * 100),
          comment: Math.round(((commentTotal || 0) / fullTotal) * 100),
        }
        for (const key of ["article", "case", "comment", "question"] as const) {
          const targetPct = targetRatio[key]
          if (targetPct != null) {
            const actualPct = key === "article" ? actualRatio.article : key === "case" ? actualRatio.case : key === "comment" ? actualRatio.comment : 0
            if (actualPct > targetPct + tolerance) {
              // 超出容忍范围，减少当日配额
              const reduceBy = Math.ceil(quota[key] * 0.5)
              quota[key] = Math.max(0, quota[key] - reduceBy)
            }
          }
        }
      }
    }

    // 构造调度配置
    const scheduleConfig = {
      slots: config.publish_rhythm?.slots || ["08-12", "14-18", "19-22"],
      slot_max: config.publish_rhythm?.slot_max || 4,
      interval_hours: config.publish_rhythm?.interval_hours || 6,
    }

    // 虚拟人健康检查
    const vuConfig = config.virtual_user || {}
    const activeThresholdDays = vuConfig.active_threshold_days || 7
    const minActive = vuConfig.min_active || 5
    const autoReplenish = vuConfig.auto_replenish !== false
    const batchSize = vuConfig.batch_size || 3

    // 标记不活跃虚拟人（超过阈值天数的）
    const thresholdDate = new Date(Date.now() - activeThresholdDays * 86400000).toISOString()
    try {
      await supabase
        .from("virtual_users")
        .update({ is_active: false })
        .eq("is_active", true)
        .lt("last_active_at", thresholdDate)
    } catch {} // 静默失败

    // 获取活跃虚拟人
    const { data: virtualUsers } = await supabase
      .from("virtual_users")
      .select("*")
      .eq("is_active", true)
      .limit(50)

    // 自动补充：如果活跃数低于下限，生成新虚拟人
    if (autoReplenish && (virtualUsers?.length || 0) < minActive) {
      const need = Math.min(batchSize, minActive - (virtualUsers?.length || 0))
      const { data: newVus } = await supabase
        .from("virtual_users")
        .insert(
          Array.from({ length: need }, (_, i) => ({
            nickname: "虚拟用户_" + Math.random().toString(36).slice(2, 8),
            role: ["owner", "owner", "owner", "owner", "designer", "designer", "worker"][i % 7] as any,
            city: "重庆",
            age_group: ["25-35", "35-45", "45+"][Math.floor(Math.random() * 3)] as any,
            decoration_stage: ["not_started", "ongoing", "completed"][Math.floor(Math.random() * 3)] as any,
            active_periods: ["早上", "下午", "晚上", "周末"].slice(0, 1 + Math.floor(Math.random() * 3)),
            interest_tags: ["装修", "设计", "预算", "风格", "收纳", "施工", "材料", "家具"].sort(() => Math.random() - 0.5).slice(0, 3 + Math.floor(Math.random() * 3)),
            tone_style: ["professional", "casual", "enthusiastic", "concise"][Math.floor(Math.random() * 4)] as any,
            speak_frequency: ["active", "normal", "occasional"][Math.floor(Math.random() * 3)] as any,
            is_active: true,
            content_count: 0,
            last_active_at: new Date().toISOString(),
          })),
        )
        .select("id, nickname, role, city, age_group, decoration_stage, active_periods, interest_tags, tone_style, speak_frequency, specialty")
    }

    // 按生命周期阶段过滤
    const lifecycleConfig = vuConfig.lifecycle_active || "daily"  // daily / 3perweek / 1perweek
    const activeVus = (virtualUsers || []).filter((u) => {
      if (u.lifecycle_stage === "retired") return false
      if (u.lifecycle_stage === "steady") {
        // 平稳期：每周最多 3 条，当前已经够数的不参与本轮
        return Math.random() < 0.3 // 30% 概率参与每次执行
      }
      if (u.lifecycle_stage === "new") {
        // 新用户：强制参与，加速产出
        return true
      }
      return true
    })

    const designers = activeVus.filter((u) => u.role === "designer")
    const owners = activeVus.filter((u) => u.role === "owner")

    const planned = { article: 0, case: 0, comment: 0, question: 0 }
    const succeeded = { article: 0, case: 0, comment: 0, question: 0 }
    const failed: any[] = []

    // 更新进度的辅助函数
    async function updateProgress(phase: string) {
      try {
        await supabase
          .from("auto_operate_logs")
          .update({
            summary: {
              planned,
              succeeded,
              failed: failed.slice(-50),
              phase,
              duration_ms: Date.now() - startedAt,
            },
          })
          .eq("id", runId)
      } catch {} // 静默失败，不影响主流程
    }

    // --- 并行生成文章 ---
    const articleCount = Math.min(quota.article || 0, designers.length)
    planned.article = articleCount

    if (articleCount > 0) {
      const articleItems = Array.from({ length: articleCount }, (_, i) => designers[i % designers.length])

      const articleResult = await runConcurrent(
        articleItems,
        async (user) => {
          try {
            const article = await generateArticle(user, [])
            const publishAt = await schedulePublishTime(supabase, scheduleConfig, user.id)
            const { data: dbResult, error } = await supabase.from("articles").insert({
              title: article.title,
              summary: article.summary,
              content: article.content,
              category: "装修攻略",
              tags: [article.title.slice(0, 10)],
              cover_url: article.cover_url,
              is_published: true,
              author_id: user.user_id,
              virtual_user_id: user.id,
              ai_generated_content: article.content,
              published_at: publishAt,
              view_count: Math.floor(Math.random() * 200) + 10,
              like_count: Math.floor(Math.random() * 30),
            }).select("id").single()
            if (error) {
              failed.push({ type: "article", virtual_user: user.nickname, error: error.message })
              return { ok: false, error: error.message }
            }
            // 写入排期表
            await supabase.from("scheduled_posts").insert({
              target_type: "article",
              target_id: dbResult.id,
              virtual_user_id: user.id,
              target_title: article.title,
              display_title: article.title,
              display_virtual_user_name: user.nickname,
              publish_at: publishAt,
              is_published: false,
            }).catch(() => {})
            // 互动：随机选取其他虚拟人为这篇文章点赞、评论
            const likers = activeVus.filter(v => v.id !== user.id).sort(() => Math.random() - 0.5).slice(0, Math.floor(Math.random() * 3) + 1)
            for (const liker of likers) {
              await supabase.from("likes").insert({
                user_id: liker.user_id,
                target_type: "article",
                target_id: dbResult.id,
              }).catch(() => {}) // 静默失败
            }
            // 加一条评论
            const commenter = activeVus.filter(v => v.id !== user.id).sort(() => Math.random() - 0.5)[0]
            if (commenter && Math.random() < 0.6) {
              const feedback = ["说得好，学习了！", "讲得很实在", "收藏了，谢谢分享", "很有参考价值", "重庆这边确实是这样"]
              await supabase.from("comments").insert({
                target_type: "article",
                target_id: dbResult.id,
                user_id: commenter.user_id,
                content: feedback[Math.floor(Math.random() * feedback.length)],
                virtual_user_id: commenter.id,
              }).catch(() => {})
            }
            succeeded.article++
            // 更新虚拟人内容计数和活跃时间
            await supabase.rpc("increment_vu_content", { p_id: user.id }).catch(() => {})
            await updateProgress("文章生成中")
            return { ok: true }
          } catch (err: any) {
            failed.push({ type: "article", virtual_user: user.nickname, error: err.message })
            return { ok: false, error: err.message }
          }
        },
      )
    }

    // --- 并行生成案例 ---
    const caseCount = Math.min(quota.case || 0, designers.length)
    planned.case = caseCount

    if (caseCount > 0) {
      // 先批量查设计师ID，避免循环内逐条查询
      const userIds = Array.from({ length: caseCount }, (_, i) => designers[i % designers.length].user_id)
      const { data: designerRecords } = await supabase
        .from("designers")
        .select("id, user_id")
        .in("user_id", userIds)
      const designerMap = new Map((designerRecords || []).map((d: any) => [d.user_id, d.id]))

      const caseItems = Array.from({ length: caseCount }, (_, i) => ({
        user: designers[i % designers.length],
        index: i,
      }))

      const caseResult = await runConcurrent(
        caseItems,
        async ({ user }) => {
          const designerId = designerMap.get(user.user_id)
          if (!designerId) {
            failed.push({ type: "case", virtual_user: user.nickname, error: "无对应设计师记录" })
            return { ok: false, error: "无对应设计师记录" }
          }

          try {
            const caseItem = await generateCase(user, [])
            const publishAt = await schedulePublishTime(supabase, scheduleConfig, user.id)
            const { data: dbResult, error } = await supabase.from("cases").insert({
              title: caseItem.title,
              style: caseItem.style,
              area: caseItem.area,
              budget: caseItem.budget,
              description: caseItem.description,
              ai_generated_content: caseItem.description,
              images: caseItem.images,
              designer_id: designerId,
              virtual_user_id: user.id,
              is_published: true,
              published_at: publishAt,
              view_count: Math.floor(Math.random() * 500) + 20,
            }).select("id").single()
            if (error) {
              failed.push({ type: "case", virtual_user: user.nickname, error: error.message })
              return { ok: false, error: error.message }
            }
            // 写入排期表
            await supabase.from("scheduled_posts").insert({
              target_type: "case",
              target_id: dbResult.id,
              virtual_user_id: user.id,
              target_title: caseItem.title,
              display_title: caseItem.title,
              display_virtual_user_name: user.nickname,
              publish_at: publishAt,
              is_published: false,
            }).catch(() => {})
            // 互动：随机点赞、评论
            const caseLikers = activeVus.filter(v => v.id !== user.id).sort(() => Math.random() - 0.5).slice(0, Math.floor(Math.random() * 3) + 1)
            for (const liker of caseLikers) {
              await supabase.from("likes").insert({
                user_id: liker.user_id,
                target_type: "case",
                target_id: dbResult.id,
              }).catch(() => {})
            }
            const caseCommenter = activeVus.filter(v => v.id !== user.id).sort(() => Math.random() - 0.5)[0]
            if (caseCommenter && Math.random() < 0.6) {
              const feedback = ["设计很棒", "这个方案不错", "收藏了参考", "风格很喜欢", "实用性强"]
              await supabase.from("comments").insert({
                target_type: "case",
                target_id: dbResult.id,
                user_id: caseCommenter.user_id,
                content: feedback[Math.floor(Math.random() * feedback.length)],
                virtual_user_id: caseCommenter.id,
              }).catch(() => {})
            }
            succeeded.case++
            await supabase.rpc("increment_vu_content", { p_id: user.id }).catch(() => {})
            await updateProgress("案例生成中")
            return { ok: true }
          } catch (err: any) {
            failed.push({ type: "case", virtual_user: user.nickname, error: err.message })
            return { ok: false, error: err.message }
          }
        },
      )
    }

    // --- 并行生成提问 ---
    const questionCount = Math.min(quota.question || 0, owners.length)
    planned.question = questionCount

    if (questionCount > 0) {
      const questionItems = Array.from({ length: questionCount }, (_, i) => owners[i % owners.length])

      const questionResult = await runConcurrent(
        questionItems,
        async (user) => {
          try {
            const question = await generateQuestion(user, [])
            const { error } = await supabase.from("questions").insert({
              user_id: user.user_id,
              title: question.title,
              content: question.content,
              category: question.category,
              virtual_user_id: user.id,
              created_at: await schedulePublishTime(supabase, scheduleConfig, user.id),
            })
            if (error) {
              failed.push({ type: "question", virtual_user: user.nickname, error: error.message })
              return { ok: false, error: error.message }
            }
            succeeded.question++
            await supabase.rpc("increment_vu_content", { p_id: user.id }).catch(() => {})
            await updateProgress("提问生成中")
            return { ok: true }
          } catch (err: any) {
            failed.push({ type: "question", virtual_user: user.nickname, error: err.message })
            return { ok: false, error: err.message }
          }
        },
      )
    }

    // --- 并行生成评论 ---
    const [articlesRes, casesRes] = await Promise.all([
      supabase.from("articles").select("id, title").is("virtual_user_id", null).limit(10),
      supabase.from("cases").select("id, title").is("virtual_user_id", null).limit(10),
    ])
    const commentTargets = [
      ...(articlesRes.data || []).map(a => ({ type: "article", id: a.id, title: a.title })),
      ...(casesRes.data || []).map(c => ({ type: "case", id: c.id, title: c.title })),
    ]
    const commentCount = Math.min(quota.comment || 0, virtualUsers.length, commentTargets.length)
    planned.comment = commentCount

    if (commentCount > 0) {
      const commentItems = Array.from({ length: commentCount }, (_, i) => ({
        user: virtualUsers[i % virtualUsers.length],
        target: commentTargets[i % commentTargets.length],
      }))

      const commentResult = await runConcurrent(
        commentItems,
        async ({ user, target }) => {
          try {
            const comment = await generateComment(user, [], target.title)
            const { error } = await supabase.from("comments").insert({
              target_type: target.type,
              target_id: target.id,
              user_id: user.user_id,
              content: comment.content,
              virtual_user_id: user.id,
              created_at: await schedulePublishTime(supabase, scheduleConfig, user.id),
            })
            if (error) {
              failed.push({ type: "comment", virtual_user: user.nickname, error: error.message })
              return { ok: false, error: error.message }
            }
            succeeded.comment++
            await supabase.rpc("increment_vu_content", { p_id: user.id }).catch(() => {})
            await updateProgress("评论生成中")
            return { ok: true }
          } catch (err: any) {
            failed.push({ type: "comment", virtual_user: user.nickname, error: err.message })
            return { ok: false, error: err.message }
          }
        },
      )
    }

    // 更新最终执行日志
    await supabase
      .from("auto_operate_logs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        summary: {
          planned,
          succeeded,
          failed: failed.slice(-100),
          duration_ms: Date.now() - startedAt,
        },
      })
      .eq("id", runId)
  } catch (err: any) {
    await supabase
      .from("auto_operate_logs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        summary: {
          planned: {},
          succeeded: {},
          failed: [{ error: err.message }],
          duration_ms: Date.now() - startedAt,
        },
      })
      .eq("id", runId)
  }
}

async function loadRuntimeConfig() {
  try {
    const supabase = createDirectClient()
    const { data } = await supabase.from("ai_config").select("key, value")
    for (const row of data || []) {
      if (row.key === "ai_api_key") setRuntimeAiKey(row.value)
      if (row.key === "unsplash_key") setUnsplashKey(row.value)
      if (row.key === "wanxiang_key") setWanxiangKey(row.value)
    }
    const wanxiangEntry = (data || []).find((r: any) => r.key === "wanxiang_key")
    setWanxiangEnabled(!!wanxiangEntry?.value || !!process.env.WANXIANG_API_KEY)
  } catch (err) {
    console.warn("loadRuntimeConfig failed:", err)
  }
}
