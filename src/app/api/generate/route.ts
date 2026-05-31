import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

const supabase = createDirectClient()

const AI_BASE_URL = process.env.AI_BASE_URL || "https://api.deepseek.com/v1"
const AI_MODEL = process.env.AI_MODEL || "deepseek-chat"
const AI_API_KEY = process.env.AI_API_KEY || ""

const TOPICS = [
  "2025年最流行的客厅设计趋势",
  "小户型厨房装修的10个实用技巧",
  "卫生间干湿分离设计方案对比",
  "装修预算的合理分配比例",
  "2025年最受欢迎的卧室装修风格",
  "阳台改造的5种创意方案",
  "全屋定制家具的选购指南",
  "装修中的隐蔽工程质量把控",
]

// 手动创建文章（不需要AI）
export async function PUT(req: Request) {
  const body = await req.json()
  const { title, summary, content, category } = body

  if (!title || !content) {
    return NextResponse.json({ error: "标题和正文不能为空" }, { status: 400 })
  }

  const { data, error } = await supabase.from("articles").insert({
    title,
    summary: summary || "",
    content,
    category: category || "装修攻略",
    tags: [title.slice(0, 10)],
    is_published: true,
    published_at: new Date().toISOString(),
    view_count: 0,
    like_count: 0,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, article: data })
}

// AI一键生成
export async function POST() {
  const topic = TOPICS[Math.floor(Math.random() * TOPICS.length)]

  const prompt = `你是一个专业的家居装修内容创作者。请写一篇关于"${topic}"的装修攻略文章。

要求：
1. 标题要吸引人，包含关键词
2. 正文不少于500字
3. 内容专业实用，有具体建议
4. 语气亲切，面向装修业主
5. 用中文写

返回格式：
标题：<文章标题>
摘要：<一句话摘要>
正文：<文章正文>`

  try {
    const res = await fetch(`${AI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(AI_API_KEY ? { Authorization: `Bearer ${AI_API_KEY}` } : {}),
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 2048,
      }),
    })

    if (!res.ok) {
      const body = await res.text().catch(() => "").then(t => t.slice(0, 100))
      return NextResponse.json({ error: `AI 服务连接失败 (${res.status}): ${body}` }, { status: 502 })
    }

    const json = await res.json()
    const content = json.choices?.[0]?.message?.content || ""

    if (!content) {
      return NextResponse.json({ error: "AI 返回内容为空" }, { status: 502 })
    }

    const titleMatch = content.match(/标题[：:]\s*(.+)/)
    const summaryMatch = content.match(/摘要[：:]\s*(.+)/)
    const bodyMatch = content.match(/正文[：:]([\s\S]*)/)

    const title = titleMatch?.[1]?.trim() || topic
    const summary = summaryMatch?.[1]?.trim() || ""
    const body = bodyMatch?.[1]?.trim() || content.replace(/标题[：:].+?(\n|$)/, "").replace(/摘要[：:].+?(\n|$)/, "").trim()

    const { data, error } = await supabase.from("articles").insert({
      title,
      summary,
      content: body,
      category: "装修攻略",
      tags: [topic.slice(0, 10)],
      is_published: true,
      published_at: new Date().toISOString(),
      view_count: 0,
      like_count: 0,
    }).select().single()

    if (error) {
      return NextResponse.json({ error: error.message, draft: { title, summary, content: body } }, { status: 500 })
    }

    return NextResponse.json({ success: true, article: data })
  } catch (err: any) {
    return NextResponse.json({ error: `AI 服务异常: ${err.message}` }, { status: 502 })
  }
}
