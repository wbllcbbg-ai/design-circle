import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"
import { requireAdmin } from "@/lib/auth-guard"

export const dynamic = "force-dynamic"

// POST /api/admin/publish-stale — 发布策略引擎未发布的存量内容
export async function POST() {
  const guard = await requireAdmin()
  if (guard) return guard

  const supabase = createDirectClient()
  const published = { articles: 0, cases: 0 }

  // 发布未发布的文章（策略引擎生成的 is_published=false 且 virtual_user_id 不为空）
  const { data: staleArticles, error: aErr } = await supabase
    .from("articles")
    .update({ is_published: true })
    .eq("is_published", false)
    .not("virtual_user_id", "is", null)
    .select()

  if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 })
  published.articles = staleArticles?.length ?? 0

  // 发布未发布的案例
  const { data: staleCases, error: cErr } = await supabase
    .from("cases")
    .update({ is_published: true })
    .eq("is_published", false)
    .not("virtual_user_id", "is", null)
    .select()

  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })
  published.cases = staleCases?.length ?? 0

  return NextResponse.json({ success: true, published })
}
