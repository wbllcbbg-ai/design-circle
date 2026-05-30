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
        Authorization: `Bearer ${process.env.AI_API_KEY}`,
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

    // 为每个虚拟人创建 users 表记录，使前端能正常展示作者信息
    for (const vu of data) {
      const { data: existingUser } = await supabase
        .from("users")
        .select("id")
        .eq("email", `virtual_${vu.id}@designcircle.local`)
        .maybeSingle()

      if (!existingUser) {
        const { data: userRecord } = await supabase
          .from("users")
          .insert({
            id: vu.id,
            email: `virtual_${vu.id}@designcircle.local`,
            nickname: vu.nickname,
            role: "user",
            city_id: null,
          })
          .select()
          .single()

        if (userRecord) {
          await supabase.from("virtual_users").update({ user_id: userRecord.id }).eq("id", vu.id)
        }

        // 设计师角色还需要在 designers 表创建记录（供案例发布使用）
        if (vu.role === "designer") {
          const { data: existingDesigner } = await supabase
            .from("designers")
            .select("id")
            .eq("user_id", vu.id)
            .maybeSingle()

          if (!existingDesigner) {
            await supabase.from("designers").insert({
              user_id: vu.id,
              type: "designer",
              name: vu.nickname,
              description: `${vu.specialty || "全案设计"} · 重庆`,
              specialties: vu.interest_tags || [],
              city_id: null,
              is_verified: false,
              avg_rating: 0.0,
              review_count: 0,
              case_count: 0,
            })
          }
        }
      }
    }

    return NextResponse.json({ success: true, count: data.length, virtual_users: data })
  } catch (err: any) {
    return NextResponse.json({ error: `AI 服务异常: ${err.message}` }, { status: 502 })
  }
}
