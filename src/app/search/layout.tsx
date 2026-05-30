import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "搜索 - 设计圈",
  description: "搜索家居案例、装修文章、设计师",
}

export default function SearchLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
