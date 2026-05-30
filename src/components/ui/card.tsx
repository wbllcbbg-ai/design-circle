import { cn } from "@/lib/utils"

interface CardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

export function Card({ children, className, onClick }: CardProps) {
  return (
    <div
      className={cn(
        "bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden",
        onClick && "cursor-pointer hover:shadow-md transition-shadow",
        className,
      )}
      onClick={onClick}
    >
      {children}
    </div>
  )
}

export function CardImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <div className={cn("aspect-[4/3] overflow-hidden bg-zinc-100 dark:bg-zinc-800", className)}>
      <img
        src={src}
        alt={alt}
        className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
      />
    </div>
  )
}

export function CardContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("p-3", className)}>{children}</div>
}
