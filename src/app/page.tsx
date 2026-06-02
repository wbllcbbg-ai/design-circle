import { createDirectClient } from "@/lib/supabase/client"
import { HomeFeed } from "@/components/home/HomeFeed"
import { Search, Building2, Eye, Palette, ListTodo } from "lucide-react"
import Link from "next/link"
import type { FeedItem } from "@/lib/types"

export const dynamic = "force-dynamic"


type FeedItem = {
  type: "case" | "article"
  id: string
  title: string
  likes: number
  style: string
  area: number
  category: string
  imgIndex: number
  coverUrl: string | null
  firstImage: string | null
  designer_id: string | null
  designer: DesignerInfo | null
}

const FUNC_ENTRIES = [
  { label: "整屋案例", to: "/cases", icon: Building2 },
  { label: "找灵感", to: "/cases", icon: Eye },
  { label: "找设计师", to: "/designers", icon: Palette },
  { label: "好物清单", to: "/articles", icon: ListTodo },
]

async function getInitialFeed(): Promise<{ items: FeedItem[]; hasMore: boolean }> {
  try {
    const supabase = createDirectClient()
    const [casesRes, articlesRes] = await Promise.all([
      supabase
        .from("cases")
        .select("id, title, style, area, cover_url, images, like_count, designer_id")
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .range(0, 9),
      supabase
        .from("articles")
        .select("id, title, category, cover_url, like_count, author_id")
        .eq("is_published", true)
        .order("created_at", { ascending: false })
        .range(0, 9),
    ])

    // 获取案例的设计师信息
    const cases = casesRes.data ?? []
    const designerIds = [...new Set(cases.map((c) => c.designer_id).filter(Boolean))] as string[]
    let designerMap: Record<string, DesignerInfo> = {}
    if (designerIds.length > 0) {
      const { data: designers } = await supabase.from("designers").select("id, name, type, user_id").in("id", designerIds)
      for (const d of designers ?? []) {
        designerMap[d.id] = { id: d.id, name: d.name, type: d.type, user_id: d.user_id }
      }
    }

    const items: FeedItem[] = [
      ...cases.map((c, i) => ({
        type: "case" as const,
        id: c.id,
        title: c.title,
        likes: c.like_count,
        style: c.style,
        area: c.area,
        category: "整屋",
        imgIndex: i,
        coverUrl: c.cover_url || null,
        firstImage: c.images?.[0] || null,
        designer_id: c.designer_id || null,
        designer: c.designer_id && designerMap[c.designer_id] ? designerMap[c.designer_id] : null,
      })),
      ...(articlesRes.data ?? []).map((a, i) => ({
        type: "article" as const,
        id: a.id,
        title: a.title,
        likes: a.like_count,
        style: a.category,
        area: 0,
        category: "攻略",
        imgIndex: i + 10,
        coverUrl: a.cover_url || null,
        firstImage: null,
        designer_id: null,
        designer: null,
      })),
    ]
    items.sort((a, b) => b.likes - a.likes)
    const hasMore = cases.length >= 10 || (articlesRes.data?.length ?? 0) >= 10
    return { items, hasMore }
  } catch {
    return { items: [], hasMore: false }
  }
}

export default async function HomePage() {
  const { items, hasMore } = await getInitialFeed()

  return (
    <div className="bg-surface min-h-screen pb-4">
      {/* 搜索框 */}
      <div className="px-4 pt-2.5 pb-1.5">
        <Link
          href="/search"
          className="flex items-center gap-2.5 h-10 px-4 rounded-full bg-wash text-muted text-[13px]"
        >
          <Search size={15} />
          <span>找设计师、案例或装修灵感…</span>
        </Link>
      </div>

      {/* 功能入口 */}
      <div className="flex justify-around px-2 py-2 border-b border-black/[0.03]">
        {FUNC_ENTRIES.map((f) => {
          const Icon = f.icon
          return (
            <Link
              key={f.label}
              href={f.to}
              className="flex flex-col items-center gap-1.5 flex-1"
            >
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-accent-light">
                <Icon size={18} strokeWidth={1.8} className="text-accent" />
              </div>
              <span className="text-[10px] text-muted font-medium">{f.label}</span>
            </Link>
          )
        })}
      </div>

      <HomeFeed initialItems={items} initialHasMore={hasMore} />
    </div>
  )
}
