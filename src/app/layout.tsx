import type { Metadata } from "next"
import "./globals.css"
import { Header } from "@/components/layout/header"
import { BottomNav } from "@/components/layout/bottom-nav"

export const metadata: Metadata = {
  title: "设计圈 - 家居设计点评平台",
  description: "真实家居案例 · 设计口碑 · 装修避坑指南",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full bg-zinc-50 dark:bg-zinc-950">
        <Header />
        <main className="max-w-lg mx-auto pb-20">{children}</main>
        <BottomNav />
      </body>
    </html>
  )
}
