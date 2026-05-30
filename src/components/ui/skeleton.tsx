import { cn } from "@/lib/utils"

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800",
        className,
      )}
    />
  )
}

export function CaseCardSkeleton() {
  return (
    <div className="bg-white dark:bg-zinc-900">
      <Skeleton className="w-full aspect-[4/5] rounded-none" />
      <div className="px-3 pt-2 pb-3 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <div className="flex justify-between">
          <Skeleton className="h-3 w-1/4" />
          <Skeleton className="h-3 w-1/6" />
        </div>
      </div>
    </div>
  )
}
