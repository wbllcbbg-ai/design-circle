"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { House, Search, PlusSquare, MessageCircle, User } from "lucide-react"

const navItems = [
  { href: "/", label: "首页", icon: House },
  { href: "/search", label: "发现", icon: Search },
  { href: "/publish", label: "", icon: PlusSquare },
  { href: "/messages", label: "消息", icon: MessageCircle },
  { href: "/profile", label: "我的", icon: User },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 z-50 pb-safe lg:hidden">
      <div className="max-w-lg mx-auto flex items-center justify-around h-14">
        {navItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          const isPublish = item.href === "/publish"

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5",
                isPublish ? "relative -top-3" : "",
              )}
            >
              {isPublish ? (
                <div className="w-12 h-12 rounded-full bg-zinc-900 dark:bg-white flex items-center justify-center">
                  <Icon className="w-6 h-6 text-white dark:text-zinc-900" />
                </div>
              ) : (
                <Icon
                  className={cn(
                    "w-6 h-6",
                    isActive
                      ? "text-zinc-900 dark:text-white"
                      : "text-zinc-400 dark:text-zinc-500",
                  )}
                />
              )}
              {!isPublish && (
                <span
                  className={cn(
                    "text-xs",
                    isActive
                      ? "text-zinc-900 dark:text-white font-medium"
                      : "text-zinc-400 dark:text-zinc-500",
                  )}
                >
                  {item.label}
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
