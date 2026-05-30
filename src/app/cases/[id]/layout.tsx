import type { Metadata } from "next"
import { createServerSupabaseClient } from "@/lib/supabase/server"

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const { data: caseItem } = await supabase
    .from("cases")
    .select("title, description, style")
    .eq("id", id)
    .single()

  if (!caseItem) {
    return { title: "案例 - 设计圈" }
  }

  return {
    title: `${caseItem.title} - 设计圈案例`,
    description: caseItem.description || `${caseItem.style}风格案例：${caseItem.title}`,
    openGraph: {
      title: caseItem.title,
      description: caseItem.description || undefined,
      type: "article",
    },
  }
}

export default function CaseLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
