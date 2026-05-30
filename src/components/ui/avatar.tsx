"use client"

import { cn } from "@/lib/utils"

interface AvatarProps {
  src?: string | null
  alt?: string
  size?: "sm" | "md" | "lg" | "xl"
  className?: string
}

const sizeMap = {
  sm: "w-8 h-8 text-xs",
  md: "w-10 h-10 text-sm",
  lg: "w-14 h-14 text-base",
  xl: "w-20 h-20 text-lg",
}

export function Avatar({ src, alt = "", size = "md", className }: AvatarProps) {
  const initials = alt
    ? alt.slice(0, 2).toUpperCase()
    : "U"

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={cn("rounded-full object-cover", sizeMap[size], className)}
      />
    )
  }

  return (
    <div
      className={cn(
        "rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center font-medium text-zinc-500 dark:text-zinc-400",
        sizeMap[size],
        className,
      )}
    >
      {initials}
    </div>
  )
}
