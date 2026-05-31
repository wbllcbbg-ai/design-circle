import { searchImages, getSearchQuery } from "./unsplash"
import { generateImages, getImagePrompt, setWanxiangKey } from "./wanxiang"

let _wanxiangEnabled = false

export function setWanxiangEnabled(enabled: boolean) {
  _wanxiangEnabled = enabled
}

const AI_BASE_URL = process.env.AI_BASE_URL || "https://api.deepseek.com/v1"
const AI_MODEL = process.env.AI_MODEL || "deepseek-chat"

// 运行时从全局配置读取 key（优先级：运行时配置 > 环境变量）
let _cachedKey: string | null = null

export function setRuntimeAiKey(key: string) {
  _cachedKey = key
}

function getEnvAiKey(): string {
  return process.env.AI_API_KEY || ""
}

function getApiKey(): string {
  return _cachedKey || getEnvAiKey()
}

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
  const key = getApiKey()
  if (!key) throw new Error("AI_API_KEY 未配置，请在后台管理 → AI 配置中设置")

  const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
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

const toneMap: Record<string, string> = {
  professional: "语言专业严谨，使用行业术语",
  casual: "口语化，像朋友聊天一样自然",
  enthusiastic: "热情积极，喜欢用感叹号和emoji",
  concise: "简洁直接，不说废话",
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

// 构建上下文 prompt
function buildContextPrompt(user: VirtualUser, history: HistoryItem[], task: string): string {
  const roleDesc: Record<string, string> = {
    owner: `装修阶段：${user.decoration_stage === "completed" ? "已完工" : user.decoration_stage === "ongoing" ? "装修中" : "未开始"}`,
    designer: `专长：${user.specialty || "全案设计"}`,
    worker: "",
    company: "",
  }

  const historyBlock = history.map((h, i) =>
    `  ${"①②③④⑤"[i] || (i + 1)} [${timeAgo(h.created_at)}] ${h.type === "文章" ? "发布了文章：" + h.title : h.type === "提问" ? "提问：" + h.title : h.type === "评价" ? "评价了设计师：" + h.content?.slice(0, 30) : "评论：" + h.content?.slice(0, 30)}`
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

  let cover_url = ""

  if (_wanxiangEnabled) {
    const prompt = getImagePrompt("cover", json.style)
    const images = await generateImages(prompt)
    cover_url = images[0] || ""
  }

  if (!cover_url) {
    const imageQuery = getSearchQuery("article")
    const images = await searchImages(imageQuery)
    cover_url = images[0] || ""
  }

  return {
    title: json.title || "重庆装修攻略",
    summary: json.summary || "",
    content: json.content || "",
    cover_url,
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

  let images: string[] = []

  if (_wanxiangEnabled && json.style) {
    const prompt = getImagePrompt("case", json.style)
    const result = await generateImages(prompt)
    images = result.length > 0 ? [...result, ...result, ...result, ...result, ...result].slice(0, 5) : []
  }

  if (images.length === 0) {
    images = await searchImages(getSearchQuery("case"), 5)
  }

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
