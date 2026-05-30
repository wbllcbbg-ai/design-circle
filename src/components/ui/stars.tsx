"use client"

import { cn } from "@/lib/utils"

interface StarsProps {
  rating: number
  size?: "sm" | "md" | "lg"
  showValue?: boolean
  className?: string
}

const sizeMap = {
  sm: "text-sm",
  md: "text-lg",
  lg: "text-2xl",
}

export function Stars({ rating, size = "md", showValue = false, className }: StarsProps) {
  const fullStars = Math.floor(rating)
  const hasHalf = rating - fullStars >= 0.5

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {Array.from({ length: 5 }).map((_, i) => {
        if (i < fullStars) {
          return (
            <span key={i} className={cn(sizeMap[size], "text-amber-400")}>
              ★
            </span>
          )
        }
        if (i === fullStars && hasHalf) {
          return (
            <span key={i} className={cn(sizeMap[size], "relative text-zinc-300 dark:text-zinc-600")}>
              ★
              <span className="absolute inset-0 overflow-hidden w-1/2 text-amber-400">★</span>
            </span>
          )
        }
        return (
          <span key={i} className={cn(sizeMap[size], "text-zinc-300 dark:text-zinc-600")}>
            ★
          </span>
        )
      })}
      {showValue && (
        <span className="ml-1 text-sm font-medium text-zinc-600 dark:text-zinc-400">
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  )
}
