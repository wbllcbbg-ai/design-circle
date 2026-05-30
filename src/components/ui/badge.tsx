import { cn } from "@/lib/utils"

interface BadgeProps {
  children: React.ReactNode
  variant?: "default" | "secondary" | "outline" | "success" | "warning"
  className?: string
}

const variants = {
  default: "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900",
  secondary: "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100",
  outline: "border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300",
  success: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  warning: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
