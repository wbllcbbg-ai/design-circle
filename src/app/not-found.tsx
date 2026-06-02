import Link from "next/link"

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-zinc-50 dark:bg-zinc-950">
      <div className="text-center">
        <div className="text-6xl font-bold text-zinc-200 dark:text-zinc-800 mb-4">404</div>
        <h1 className="text-lg font-medium text-zinc-700 dark:text-zinc-300 mb-2">页面不存在</h1>
        <p className="text-sm text-zinc-400 mb-6">你访问的页面可能已被删除或地址有误</p>
        <Link
          href="/"
          className="inline-flex items-center gap-1 px-5 py-2 bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 rounded-full text-sm font-medium"
        >
          返回首页
        </Link>
      </div>
    </div>
  )
}
