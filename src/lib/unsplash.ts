// Unsplash 图片工具 — 用于 AI 内容配图获取

let _cachedKey: string | null = null

export function setUnsplashKey(key: string) {
  _cachedKey = key
}

function getKey(): string {
  return _cachedKey || process.env.UNSPLASH_ACCESS_KEY || ""
}

// 按内容类型搜索配图
export async function searchImages(query: string, count: number = 1): Promise<string[]> {
  const key = getKey()

  if (!key) {
    return Array(count).fill(0).map((_, i) =>
      `https://placehold.co/800x600/e2e8f0/64748b?text=${encodeURIComponent(query + " " + (i + 1))}`
    )
  }

  try {
    const res = await fetch(
      `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`,
      { headers: { Authorization: `Client-ID ${key}` } },
    )

    if (!res.ok) {
      console.warn(`Unsplash API error: ${res.status}`)
      return fallbackImages(count, query)
    }

    const json = await res.json()
    const urls = (json.results || []).slice(0, count).map((photo: any) => photo.urls?.regular || "")
    return urls.length ? urls : fallbackImages(count, query)
  } catch (err) {
    console.warn("Unsplash API call failed:", err)
    return fallbackImages(count, query)
  }
}

function fallbackImages(count: number, label: string): string[] {
  return Array(count).fill(0).map((_, i) =>
    `https://placehold.co/800x600/e2e8f0/64748b?text=${encodeURIComponent(label + " " + (i + 1))}`
  )
}

// 根据内容类型获取配图关键词
export function getSearchQuery(contentType: string): string {
  const queries: Record<string, string[]> = {
    article: ["interior design living room", "modern home decor", "kitchen design", "bedroom interior", "bathroom design", "home renovation"],
    case: ["apartment renovation", "home decoration", "modern apartment", "house interior", "furniture interior", "living room decor"],
    avatar: [],
  }
  const pool = queries[contentType] || queries.article
  return pool[Math.floor(Math.random() * pool.length)]
}
