import type { Metadata } from "next"
import "./globals.css"
import { Header } from "@/components/layout/header"
import { BottomNav } from "@/components/layout/bottom-nav"
import { InviteTracker } from "@/components/layout/invite-tracker"

export const metadata: Metadata = {
  title: "设计圈 - 家居设计点评平台",
  description: "真实家居案例 · 设计口碑 · 装修避坑指南",
  manifest: "/manifest.json",
  openGraph: {
    title: "设计圈 - 家居设计点评平台",
    description: "真实家居案例 · 设计口碑 · 装修避坑指南",
    type: "website",
    locale: "zh_CN",
  },
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
        <InviteTracker />
        <main className="max-w-lg mx-auto pb-20 lg:max-w-5xl lg:pb-0 lg:pt-4 lg:px-4">
          <div className="lg:flex lg:gap-6">
            <div className="lg:flex-1 lg:min-w-0">
              {children}
            </div>
            {/* 桌面端侧边信息栏 */}
            <aside className="hidden lg:block lg:w-72 xl:w-80 shrink-0">
              <div className="sticky top-16 space-y-4">
                <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-100 dark:border-zinc-800">
                  <h3 className="text-sm font-medium mb-2">关于设计圈</h3>
                  <p className="text-xs text-zinc-500 leading-relaxed">真实家居案例分享平台，帮你找到靠谱的设计师和装修灵感。</p>
                </div>
                <div className="bg-white dark:bg-zinc-900 rounded-xl p-4 border border-zinc-100 dark:border-zinc-800">
                  <h3 className="text-sm font-medium mb-2">快速入口</h3>
                  <div className="flex flex-wrap gap-2">
                    <a href="/cases" className="text-xs px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition">装修案例</a>
                    <a href="/articles" className="text-xs px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition">装修攻略</a>
                    <a href="/designers" className="text-xs px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition">找设计师</a>
                    <a href="/city" className="text-xs px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition">城市筛选</a>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </main>
        <BottomNav />
      </body>
    </html>
  )
}
