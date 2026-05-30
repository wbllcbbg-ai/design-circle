import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "装修攻略 - 设计圈",
  description: "装修知识、家居设计灵感、避坑指南",
}

export default function ArticlesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
