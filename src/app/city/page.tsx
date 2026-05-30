"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

type City = {
  id: string
  name: string
  code: string
}

export default function CityPage() {
  const [cities, setCities] = useState<City[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/cities")
      .then((r) => r.json())
      .then((data) => {
        setCities(data.cities ?? [])
        setLoading(false)
      })
  }, [])

  // 按拼音首字母分组
  const grouped = cities.reduce<Record<string, City[]>>((acc, city) => {
    const key = city.code.charAt(0).toUpperCase()
    if (!acc[key]) acc[key] = []
    acc[key].push(city)
    return acc
  }, {})

  const letters = Object.keys(grouped).sort()

  return (
    <div className="bg-white dark:bg-zinc-900 min-h-screen">
      <div className="flex items-center gap-2 px-4 h-12 border-b border-zinc-100 dark:border-zinc-800">
        <Link href="/" className="p-1">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </Link>
        <h1 className="text-sm font-medium">选择城市</h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-zinc-400">加载中...</div>
      ) : (
        <div>
          {/* 字母快速导航 */}
          <div className="flex flex-wrap gap-1 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
            {letters.map((letter) => (
              <a key={letter} href={`#city-${letter}`} className="w-7 h-7 flex items-center justify-center text-xs text-zinc-500 font-medium rounded hover:bg-zinc-100 dark:hover:bg-zinc-800">
                {letter}
              </a>
            ))}
          </div>

          <div className="px-4 py-3 space-y-4">
            {letters.map((letter) => (
              <div key={letter} id={`city-${letter}`}>
                <div className="text-xs font-medium text-zinc-400 mb-2">{letter}</div>
                <div className="grid grid-cols-3 gap-2">
                  {grouped[letter].map((city) => (
                    <Link
                      key={city.id}
                      href={`/search?city=${city.code}`}
                      className="px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 text-sm text-center hover:bg-zinc-100 dark:hover:bg-zinc-700 transition"
                    >
                      {city.name}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
