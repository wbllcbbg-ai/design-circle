import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

// GET /api/admin/virtual-users/:id/profile — 获取虚拟人画像分析
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (guard) return guard

  const { id } = await params
  const supabase = createDirectClient()

  // 1. 取最近 20 条内容
  const [articles, cases, comments, reviews] = await Promise.all([
    supabase.from("articles").select("title, content, category").eq("virtual_user_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.from("cases").select("title, description, style").eq("virtual_user_id", id).order("created_at", { ascending: false }).limit(5),
    supabase.from("comments").select("content").eq("virtual_user_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.from("reviews").select("content, rating").eq("virtual_user_id", id).order("created_at", { ascending: false }).limit(5),
  ])

  // 2. 提取高频词（简单词频统计）
  const allText = [
    ...(articles.data || []).map((a: any) => `${a.title} ${a.content}`),
    ...(cases.data || []).map((c: any) => `${c.title} ${c.description || ""} ${c.style || ""}`),
    ...(comments.data || []).map((c: any) => c.content),
    ...(reviews.data || []).map((r: any) => r.content),
  ].join(" ")

  const keywords = extractKeywords(allText, 8)

  // 3. 计算互动对象
  const interactionMap: Record<string, number> = {}
  for (const a of articles.data || []) {
    const vuId = (a as any).virtual_user_id
    if (vuId && vuId !== id) {
      interactionMap[vuId] = (interactionMap[vuId] || 0) + 1
    }
  }

  const vuIds = Object.keys(interactionMap)
  const vuNameMap: Record<string, string> = {}
  if (vuIds.length > 0) {
    const { data: vus } = await supabase.from("virtual_users").select("id, nickname").in("id", vuIds)
    for (const vu of vus || []) {
      vuNameMap[vu.id] = vu.nickname
    }
  }

  const interactions = vuIds.map((vid) => ({
    nickname: vuNameMap[vid] || "未知",
    count: interactionMap[vid],
  }))

  // 4. 推断风格
  const style = inferStyle(allText)

  // 5. 统计内容量
  const totalContent = (articles.data?.length || 0) + (cases.data?.length || 0) + (comments.data?.length || 0) + (reviews.data?.length || 0)

  return NextResponse.json({
    profile: {
      topics: keywords,
      style,
      totalContent,
      interactions,
    },
  })
}

// PUT /api/admin/virtual-users/:id/profile — 更新（手动确认）画像
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireAdmin()
  if (guard) return guard

  const { id } = await params
  const body = await req.json()
  const supabase = createDirectClient()

  const { error } = await supabase
    .from("virtual_users")
    .update({ content_profile: body })
    .eq("id", id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// --- 工具函数 ---

// 简单词频提取
function extractKeywords(text: string, count: number): string[] {
  // 中文停用词
  const stopWords = new Set([
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

  // 匹配中文词（2-4字）
  const words: string[] = []
  const regex = /[一-鿿]{2,4}/g
  let match
  while ((match = regex.exec(text)) !== null) {
    const w = match[0]
    if (!stopWords.has(w)) {
      words.push(w)
    }
  }

  // 词频统计
  const freq: Record<string, number> = {}
  for (const w of words) {
    freq[w] = (freq[w] || 0) + 1
  }

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([word]) => word)
}

// 推断内容风格
function inferStyle(text: string): string {
  const casualIndicators = ["哈", "啦", "哟", "呗", "嘛", "呢", "吧", "啊", "哦"]
  const enthusiasticIndicators = ["!", "！", "超级", "非常", "太", "绝了", "真的", "推荐"]
  const professionalIndicators = ["指标", "参数", "规范", "标准", "流程", "原理", "方案", "系统"]

  const casualScore = casualIndicators.filter((c) => text.includes(c)).length
  const enthusiasticScore = enthusiasticIndicators.filter((c) => text.includes(c)).length
  const professionalScore = professionalIndicators.filter((c) => text.includes(c)).length

  if (professionalScore > casualScore && professionalScore > enthusiasticScore) return "专业严谨"
  if (enthusiasticScore > casualScore) return "热情积极"
  if (casualScore > 0) return "口语化"
  return "简洁直接"
}
