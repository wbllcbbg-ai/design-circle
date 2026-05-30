import type { Metadata } from "next"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const { data: article } = await supabase
    .from("articles")
    .select("title, summary")
    .eq("id", id)
    .single()

  if (!article) {
    return { title: "文章 - 设计圈" }
  }

  return {
    title: `${article.title} - 设计圈`,
    description: article.summary || `阅读文章：${article.title}`,
    openGraph: {
      title: article.title,
      description: article.summary || undefined,
      type: "article",
    },
  }
}

export default function ArticleLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
