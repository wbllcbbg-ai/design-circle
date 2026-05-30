export default function MessagesPage() {
  return (
    <div className="p-4">
      <h1 className="text-lg font-semibold mb-4">消息</h1>
      <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
        <svg className="w-12 h-12 mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
        <p className="text-sm">暂无消息</p>
        <p className="text-xs mt-1">咨询设计师或收到回复时会显示在这里</p>
      </div>
    </div>
  )
}
