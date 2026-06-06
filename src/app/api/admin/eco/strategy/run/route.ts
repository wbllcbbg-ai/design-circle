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

// 评论/回复文案池：按角色区分，追求真人感
const COMMENT_POOLS: Record<string, string[]> = {
  designer: [
    "这个方案挺有想法，我在类似户型中用过这种布局，效果不错",
    "从专业角度看这块确实值得投入，性价比很高",
    "分享得很实在，建议再考虑一下采光的问题",
    "同款方案做过几套，客户反馈都挺好",
    "细节处理得很到位，学习了",
    "这个思路可以，不过厨房动线可以再优化一下",
    "实用为主的设计越来越受欢迎了",
    "我也遇到过类似的情况，最后用了另一种方案解决的",
  ],
  owner: [
    "我家就是这种风格，住了两年了还是很喜欢",
    "正打算装修，这篇文章来得太及时了",
    "有没有靠谱的师傅推荐？同在重庆",
    "说的跟我家情况一模一样，收藏了",
    "纠结了好久要不要这么做，看你说的放心了",
    "预算有限，不知道这样搞下来要多少钱",
    "这个方法好，回头我也试试",
    "要是早点看到就好了，我家刚装完",
    "同重庆！你找的哪家公司做的？",
    "干货，先马住慢慢看",
  ],
}

const REPLY_POOLS: Record<string, string[]> = {
  designer: [
    "补充一下，这个做法在重庆的湿度条件下要注意防潮",
    "这个思路不错，我在实际项目中试过类似方案",
    "说得对，另外要注意的是材料的选择也很关键",
  ],
  owner: [
    "是的，我家也是这样做的",
    "有道理，学到了",
    "真的吗？那我下次也试试",
    "收藏了，以后装修可以参考",
  ],
}

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

    // 互动配置
    const interactCfg = config.interaction || {}
    const likeRange: [number, number] = interactCfg.like_range || [5, 15]
    const commentDelay: [number, number] = interactCfg.comment_delay || [3, 8]
    const replyRate: [number, number] = interactCfg.reply_rate || [20, 40]
    const familiarRatio = interactCfg.familiar_ratio ?? 70
    const realUserProbability = interactCfg.real_user_probability ?? 5
    // 评论回复概率（均值/100），在互动模拟中共享使用
    const commentChance = (replyRate[0] + replyRate[1]) / 2 / 100
    // 评论 user_id：取 auth.users 中第一个管理员 ID（虚拟人没有 auth.users 记录，共用管理员）
    let commentUserId = ""
    try {
      const { data: adminUsers } = await supabase.auth.admin.listUsers()
      if (adminUsers?.users?.length) {
        commentUserId = adminUsers.users[0].id
      }
    } catch {}

    // 虚拟人健康检查
    const vuConfig = config.virtual_user || {}

    // 获取活跃虚拟人时排除已互动过的（模拟版"熟人圈"）
    function pickRandom<T>(arr: T[], min = 1, max = 3): T[] {
      const count = Math.min(arr.length, min + Math.floor(Math.random() * (max - min + 1)))
      return arr.sort(() => Math.random() - 0.5).slice(0, count)
    }
    function pickOne<T>(arr: T[]): T | undefined {
      return arr.length ? arr.sort(() => Math.random() - 0.5)[0] : undefined
    }
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
            lifecycle_stage: "new",
          })),
        )
        .select("id, nickname, role, city, age_group, decoration_stage, active_periods, interest_tags, tone_style, speak_frequency, specialty")
    }

    // 重新获取 active 列表（可能刚补充了新的）
    const { data: refreshedVus } = await supabase
      .from("virtual_users")
      .select("*")
      .eq("is_active", true)
      .limit(50)
    const allActive = refreshedVus || virtualUsers || []

    // 生命周期演进：检查每个虚拟人的阶段是否需要推进
    const now_ = new Date()
    const thirtyDaysAgo = new Date(now_.getTime() - 30 * 86400000).toISOString()
    const ninetyDaysAgo = new Date(now_.getTime() - 90 * 86400000).toISOString()
    for (const vu of allActive) {
      const currentStage = vu.lifecycle_stage || "new"
      let newStage = currentStage

      if (currentStage === "new" && (vu.content_count || 0) >= 5) {
        newStage = "active"
      }
      if (currentStage === "active" && (vu.content_count || 0) >= 30) {
        newStage = "steady"
      }
      if (currentStage === "active" && vu.last_active_at && vu.last_active_at < thirtyDaysAgo) {
        newStage = "steady" // 长期不活跃 → 平稳期
      }
      if (currentStage === "steady" && (vu.content_count || 0) >= 60) {
        newStage = "retired"
      }
      if (currentStage === "steady" && vu.last_active_at && vu.last_active_at < ninetyDaysAgo) {
        newStage = "retired" // 太久不活跃 → 退场
      }

      if (newStage !== currentStage) {
        await supabase.from("virtual_users").update({ lifecycle_stage: newStage }).eq("id", vu.id)
      }
    }
    // 重新读取更新后的生命周期
    const { data: evolvedVus } = await supabase
      .from("virtual_users")
      .select("*")
      .eq("is_active", true)
      .limit(50)
    const evolvedList = evolvedVus || allActive

    // 按生命周期阶段过滤
    const lifecycleConfig = vuConfig.lifecycle_active || "daily"  // daily / 3perweek / 1perweek
    const activeVus = (evolvedList || []).filter((u) => {
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

    // 内容画像自动填充：对 content_profile 为空且有足够内容的虚拟人自动生成画像
    const profilelessVus = activeVus.filter(v => !v.content_profile || Object.keys(v.content_profile).length === 0)
    if (profilelessVus.length > 0) {
      for (const vu of profilelessVus) {
        try {
          // 查内容量
          const [{ count: artC }, { count: caseC }, { count: commentC }, { count: questionC }] = await Promise.all([
            supabase.from("articles").select("id", { count: "exact", head: true }).eq("virtual_user_id", vu.id),
            supabase.from("cases").select("id", { count: "exact", head: true }).eq("virtual_user_id", vu.id),
            supabase.from("comments").select("id", { count: "exact", head: true }).eq("virtual_user_id", vu.id),
            supabase.from("questions").select("id", { count: "exact", head: true }).eq("virtual_user_id", vu.id),
          ])
          const total = (artC || 0) + (caseC || 0) + (commentC || 0) + (questionC || 0)
          if (total < 3) continue // 内容不够，不分析
          // 取最近内容文本做词频分析
          const [articles, cases, comments] = await Promise.all([
            supabase.from("articles").select("title, content").eq("virtual_user_id", vu.id).limit(10),
            supabase.from("cases").select("title, description, style").eq("virtual_user_id", vu.id).limit(5),
            supabase.from("comments").select("content").eq("virtual_user_id", vu.id).limit(10),
          ])
          const allText = [
            ...(articles.data || []).map((a: any) => `${a.title} ${a.content}`),
            ...(cases.data || []).map((c: any) => `${c.title} ${c.description || ""} ${c.style || ""}`),
            ...(comments.data || []).map((c: any) => c.content),
          ].join(" ")
          const keywords = extractKeywords(allText, 5)
          const style = inferStyle(allText)
          const profile = { topics: keywords, style, interactions: [] }
          await supabase.from("virtual_users").update({ content_profile: profile }).eq("id", vu.id)
          // 更新内存中的 activeVus
          const idx = activeVus.findIndex(v => v.id === vu.id)
          if (idx >= 0) activeVus[idx] = { ...activeVus[idx], content_profile: profile }
        } catch {} // 单条失败不影响整体
      }
    }

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
              view_count: Math.floor(Math.random() * (likeRange[1] - likeRange[0] + 1)) + likeRange[0] * 10,
              like_count: Math.floor(Math.random() * likeRange[1]) + likeRange[0],
            }).select("id").single()
            if (error) {
              failed.push({ type: "article", virtual_user: user.nickname, error: error.message })
              return { ok: false, error: error.message }
            }
            // 写入排期表（生成即发布）
            await supabase.from("scheduled_posts").insert({
              target_type: "article",
              target_id: dbResult.id,
              virtual_user_id: user.id,
              target_title: article.title,
              display_title: article.title,
              display_virtual_user_name: user.nickname,
              publish_at: publishAt,
              is_published: true,
            }).then(() => {}).catch(() => {})
            // 互动：随机选取其他虚拟人为这篇文章点赞、评论
            const otherVus = activeVus.filter(v => v.id !== user.id)
            const likers = pickRandom(otherVus, likeRange[0], likeRange[1])
            for (const liker of likers) {
              await supabase.from("likes").insert({
                user_id: liker.user_id,
                target_type: "article",
                target_id: dbResult.id,
              }).then(() => {}).catch(() => {})
            }
            // 加一条评论
            const commenter = pickOne(otherVus)
            if (commenter && Math.random() < commentChance) {
              const commentPool = COMMENT_POOLS[commenter.role] || COMMENT_POOLS.owner
              await supabase.from("comments").insert({
                target_type: "article",
                target_id: dbResult.id,
                user_id: commentUserId || commenter.user_id,
                content: commentPool[Math.floor(Math.random() * commentPool.length)],
                virtual_user_id: commenter.id,
              }).then(() => {}).catch(() => {})
            }
            // 回复模拟：随机选取该内容下一条已有评论，由另一个虚拟人回复
            const { data: existingComments } = await supabase
              .from("comments")
              .select("id, user_id")
              .eq("target_type", "article")
              .eq("target_id", dbResult.id)
              .is("parent_id", null)
              .limit(3)
            if (existingComments?.length && Math.random() < commentChance) {
              const replyWriter = pickOne(otherVus)
              if (replyWriter) {
                const targetComment = existingComments[Math.floor(Math.random() * existingComments.length)]
                await supabase.from("comments").insert({
                  target_type: "article",
                  target_id: dbResult.id,
                  parent_id: targetComment.id,
                  user_id: commentUserId || replyWriter.user_id,
                  content: ["确实", "有道理", "说的对", "学习了", "我也这样觉得"][Math.floor(Math.random() * 5)],
                  virtual_user_id: replyWriter.id,
                }).then(() => {}).catch(() => {})
              }
            }
            // 踩模拟：随机给这条内容一个踩
            if (otherVus.length > 2) {
              const disliker = otherVus[Math.floor(Math.random() * otherVus.length)]
              if (disliker && Math.random() < 0.15) { // 15% 概率有踩
                await supabase.from("dislikes").insert({
                  user_id: commentUserId || disliker.user_id,
                  target_type: "article",
                  target_id: dbResult.id,
                }).then(() => {}).catch(() => {})
              }
            }
            succeeded.article++
            // 更新虚拟人内容计数和活跃时间
            await supabase.rpc("increment_vu_content", { p_id: user.id }).then(() => {}).catch(() => {})
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
              tags: [caseItem.style || "装修"],
              designer_id: designerId,
              virtual_user_id: user.id,
              is_published: true,
              published_at: publishAt,
              view_count: Math.floor(Math.random() * (likeRange[1] - likeRange[0] + 1)) + likeRange[0] * 10,
            }).select("id").single()
            if (error) {
              failed.push({ type: "case", virtual_user: user.nickname, error: error.message })
              return { ok: false, error: error.message }
            }
            // 写入排期表（生成即发布）
            await supabase.from("scheduled_posts").insert({
              target_type: "case",
              target_id: dbResult.id,
              virtual_user_id: user.id,
              target_title: caseItem.title,
              display_title: caseItem.title,
              display_virtual_user_name: user.nickname,
              publish_at: publishAt,
              is_published: true,
            }).then(() => {}).catch(() => {})
            // 互动：随机点赞、评论
            const otherCaseVus = activeVus.filter(v => v.id !== user.id)
            const caseLikers = pickRandom(otherCaseVus, likeRange[0], likeRange[1])
            for (const liker of caseLikers) {
              await supabase.from("likes").insert({
                user_id: liker.user_id,
                target_type: "case",
                target_id: dbResult.id,
              }).then(() => {}).catch(() => {})
            }
            const caseCommenter = pickOne(otherCaseVus)
            if (caseCommenter && Math.random() < commentChance) {
              const commentPool = COMMENT_POOLS[caseCommenter.role] || COMMENT_POOLS.owner
              await supabase.from("comments").insert({
                target_type: "case",
                target_id: dbResult.id,
                user_id: commentUserId || caseCommenter.user_id,
                content: commentPool[Math.floor(Math.random() * commentPool.length)],
                virtual_user_id: caseCommenter.id,
              }).then(() => {}).catch(() => {})
            }
            // 回复模拟：随机选取该内容下一条已有评论，由另一个虚拟人回复
            const { data: caseComments } = await supabase
              .from("comments")
              .select("id")
              .eq("target_type", "case")
              .eq("target_id", dbResult.id)
              .is("parent_id", null)
              .limit(3)
            if (caseComments?.length && Math.random() < commentChance) {
              const replyWriter = pickOne(otherCaseVus)
              if (replyWriter) {
                const targetComment = caseComments[Math.floor(Math.random() * caseComments.length)]
                await supabase.from("comments").insert({
                  target_type: "case",
                  target_id: dbResult.id,
                  parent_id: targetComment.id,
                  user_id: commentUserId || replyWriter.user_id,
                  content: ["有道理", "这个方案可以", "收藏了", "谢谢分享"][Math.floor(Math.random() * 4)],
                  virtual_user_id: replyWriter.id,
                }).then(() => {}).catch(() => {})
              }
            }
            // 踩模拟：随机给这条内容一个踩
            if (otherCaseVus.length > 2) {
              const disliker = otherCaseVus[Math.floor(Math.random() * otherCaseVus.length)]
              if (disliker && Math.random() < 0.15) {
                await supabase.from("dislikes").insert({
                  user_id: commentUserId || disliker.user_id,
                  target_type: "case",
                  target_id: dbResult.id,
                }).then(() => {}).catch(() => {})
              }
            }
            succeeded.case++
            await supabase.rpc("increment_vu_content", { p_id: user.id }).then(() => {}).catch(() => {})
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
              created_at: new Date().toISOString(),
            })
            if (error) {
              failed.push({ type: "question", virtual_user: user.nickname, error: error.message })
              return { ok: false, error: error.message }
            }
            succeeded.question++
            await supabase.rpc("increment_vu_content", { p_id: user.id }).then(() => {}).catch(() => {})
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
      supabase.from("articles").select("id, title").limit(20),
      supabase.from("cases").select("id, title").limit(20),
    ])
    const commentTargets = [
      ...(articlesRes.data || []).map(a => ({ type: "article", id: a.id, title: a.title })),
      ...(casesRes.data || []).map(c => ({ type: "case", id: c.id, title: c.title })),
    ]
    const commentCount = Math.min(quota.comment || 0, evolvedList.length, commentTargets.length)
    planned.comment = commentCount

    if (commentCount > 0) {
      const commentItems = Array.from({ length: commentCount }, (_, i) => ({
        user: evolvedList[i % evolvedList.length],
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
              user_id: commentUserId || user.user_id,
              content: comment.content,
              virtual_user_id: user.id,
              created_at: new Date().toISOString(),
            })
            if (error) {
              failed.push({ type: "comment", virtual_user: user.nickname, error: error.message })
              return { ok: false, error: error.message }
            }
            succeeded.comment++
            await supabase.rpc("increment_vu_content", { p_id: user.id }).then(() => {}).catch(() => {})
            await updateProgress("评论生成中")
            return { ok: true }
          } catch (err: any) {
            failed.push({ type: "comment", virtual_user: user.nickname, error: err.message })
            return { ok: false, error: err.message }
          }
        },
      )
    }

    // --- 回复模拟：从已有评论中随机选一些回复 ---
    const replyCount = Math.min(3, evolvedList.length)
    if (replyCount > 0) {
      const { data: replyTargets } = await supabase
        .from("comments")
        .select("id, target_type, target_id")
        .is("parent_id", null)
        .limit(20)
      if (replyTargets?.length) {
        const repliers = evolvedList.sort(() => Math.random() - 0.5).slice(0, replyCount)
        for (const replier of repliers) {
          try {
            const target = replyTargets[Math.floor(Math.random() * replyTargets.length)]
            // 根据角色区分回复文案
            const replyPool = REPLY_POOLS[replier.role] || REPLY_POOLS.owner
            await supabase.from("comments").insert({
              target_type: target.target_type,
              target_id: target.target_id,
              user_id: commentUserId || replier.user_id,
              content: replyPool[Math.floor(Math.random() * replyPool.length)],
              virtual_user_id: replier.id,
              parent_id: target.id,
            }).then(() => {}).catch(() => {})
          } catch {}
        }
      }
    }

    // 异步生成内容快照（不影响主流程）
    generateSnapshot(supabase).catch(() => {})

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

// --- 内容画像辅助函数（与 profile API route 同步） ---
const STOP_WORDS = new Set([
  "的", "了", "在", "是", "我", "有", "和", "就", "不", "人", "都", "一",
  "一个", "上", "也", "很", "到", "说", "要", "去", "你", "会", "着",
  "没有", "看", "好", "自己", "这", "他", "她", "它", "们", "那", "些",
  "吧", "吗", "啊", "呢", "哦", "嘛", "得", "地", "与", "对", "为",
  "能", "可以", "还是", "这个", "那个", "什么", "怎么", "如何", "因为",
  "所以", "但是", "而且", "然后", "虽然", "如果", "不仅", "除了",
  "装修", "设计", "风格", "空间", "房间", "客厅", "卧室", "厨房",
  "卫生间", "阳台", "我们", "他们", "已经", "可以", "没有", "比较",
  "就是", "觉得", "真的", "但是", "因为", "所以", "这个", "时候",
])

function extractKeywords(text: string, count: number): string[] {
  const words: string[] = []
  const regex = /[一-鿿]{2,4}/g
  let match
  while ((match = regex.exec(text)) !== null) {
    const w = match[0]
    if (!STOP_WORDS.has(w)) words.push(w)
  }
  const freq: Record<string, number> = {}
  for (const w of words) freq[w] = (freq[w] || 0) + 1
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, count).map(([word]) => word)
}

function inferStyle(text: string): string {
  const casualScore = ["哈", "啦", "哟", "呗", "嘛", "呢", "吧", "啊", "哦"].filter(c => text.includes(c)).length
  const enthusiasticScore = ["!", "！", "超级", "非常", "太", "绝了", "真的", "推荐"].filter(c => text.includes(c)).length
  const professionalScore = ["指标", "参数", "规范", "标准", "流程", "原理", "方案", "系统"].filter(c => text.includes(c)).length
  if (professionalScore > casualScore && professionalScore > enthusiasticScore) return "专业严谨"
  if (enthusiasticScore > casualScore) return "热情积极"
  if (casualScore > 0) return "口语化"
  return "简洁直接"
}


// 异步生成内容快照
async function generateSnapshot(supabase: ReturnType<typeof createDirectClient>) {
  const today = new Date().toISOString().slice(0, 10)
  const todayStart = today + 'T00:00:00Z'
  const todayEnd = today + 'T23:59:59Z'

  const [
    { count: totalArticles }, { count: totalCases },
    { count: totalComments }, { count: totalQuestions },
    { count: totalVus }, { count: totalLikes }, { count: totalDislikes },
    { count: todayArticles }, { count: todayCases },
    { count: todayComments }, { count: todayQuestions },
  ] = await Promise.all([
    supabase.from("articles").select("id", { count: "exact", head: true }),
    supabase.from("cases").select("id", { count: "exact", head: true }),
    supabase.from("comments").select("id", { count: "exact", head: true }),
    supabase.from("questions").select("id", { count: "exact", head: true }),
    supabase.from("virtual_users").select("id", { count: "exact", head: true }),
    supabase.from("likes").select("id", { count: "exact", head: true }),
    supabase.from("dislikes").select("id", { count: "exact", head: true }),
    supabase.from("articles").select("id", { count: "exact", head: true }).gte("created_at", todayStart),
    supabase.from("cases").select("id", { count: "exact", head: true }).gte("created_at", todayStart),
    supabase.from("comments").select("id", { count: "exact", head: true }).gte("created_at", todayStart),
    supabase.from("questions").select("id", { count: "exact", head: true }).gte("created_at", todayStart),
  ])

  // 时段分布
  const hourly: Record<string, number> = {}
  for (let h = 0; h < 24; h++) hourly[String(h).padStart(2, "0")] = 0
  const addHour = (items: any[]) => { for (const i of items || []) { const hh = (i.created_at || "").slice(11, 13); if (hourly[hh] !== undefined) hourly[hh]++ } }
  const [arts, cases, comments, questions] = await Promise.all([
    supabase.from("articles").select("created_at").gte("created_at", todayStart).lte("created_at", todayEnd),
    supabase.from("cases").select("created_at").gte("created_at", todayStart).lte("created_at", todayEnd),
    supabase.from("comments").select("created_at").gte("created_at", todayStart).lte("created_at", todayEnd),
    supabase.from("questions").select("created_at").gte("created_at", todayStart).lte("created_at", todayEnd),
  ])
  addHour(arts.data); addHour(cases.data); addHour(comments.data); addHour(questions.data)

  const { data: todayActive } = await supabase.from("articles").select("virtual_user_id").gte("created_at", todayStart).not("virtual_user_id", "is", null)
  const activeVus = new Set((todayActive || []).map((a: any) => a.virtual_user_id))

  await supabase.from("content_analytics").upsert({
    snapshot_date: today,
    total_articles: totalArticles || 0, total_cases: totalCases || 0,
    total_comments: totalComments || 0, total_questions: totalQuestions || 0,
    new_articles: todayArticles || 0, new_cases: todayCases || 0,
    new_comments: todayComments || 0, new_questions: todayQuestions || 0,
    active_virtual_users: activeVus.size, total_virtual_users: totalVus || 0,
    total_likes: totalLikes || 0, total_dislikes: totalDislikes || 0,
    avg_view_count: 0, hourly_distribution: hourly, role_distribution: {},
  }, { onConflict: "snapshot_date" })
}
