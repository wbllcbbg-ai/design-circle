// 通义万相 (Tongyi Wanxiang) 生图工具
// 使用阿里云 DashScope API 生成室内设计图片

import { createDirectClient } from "@/lib/supabase/client"

let _cachedKey: string | null = null

export function setWanxiangKey(key: string) {
  _cachedKey = key
}

const BASE_URL = "https://dashscope.aliyuncs.com"

function getKey(): string {
  return _cachedKey || process.env.WANXIANG_API_KEY || ""
}

// 根据内容类型获取合适的室内设计 prompt
export function getImagePrompt(contentType: string, style?: string): string {
  const styleMap: Record<string, string> = {
    "现代简约": "现代简约风格, 简洁线条, 浅色调",
    "日式": "日式风格, 原木家具, 自然材质, 柔和灯光",
    "北欧": "北欧风格, 明亮, 简约家具, 绿植点缀",
    "轻奢": "轻奢风格, 金属质感, 大理石元素, 精致灯光",
    "新中式": "新中式风格, 木质格栅, 水墨元素, 禅意",
    "混搭": "混搭风格, 色彩丰富, 个性装饰, 艺术感",
    "工业风": "工业风格, 水泥墙面, 裸露管道, 复古灯具",
  }

  const baseStyle = style && styleMap[style] ? styleMap[style] : "现代简约风格, 明亮温馨"

  const prompts: Record<string, string[]> = {
    article: [
      `${baseStyle}, 客厅全景, 大落地窗, 阳光洒入, 室内设计实景, 4k`,
      `${baseStyle}, 开放式厨房餐厅, 精致餐具, 温馨灯光`,
      `${baseStyle}, 卧室, 舒适大床, 柔软床品, 柔和光线`,
      `${baseStyle}, 卫生间, 干湿分离, 现代洁具, 明亮整洁`,
    ],
    case: [
      `${baseStyle}, 客厅, 沙发背景墙, 艺术装饰画, 室内设计实景`,
      `${baseStyle}, 客厅餐厅一体化, 空间通透, 家具搭配`,
      `${baseStyle}, 卧室, 衣柜设计, 床头背景, 温馨灯光`,
      `${baseStyle}, 阳台, 休闲区, 绿植, 户外椅, 自然光线`,
      `${baseStyle}, 玄关, 鞋柜设计, 挂画装饰, 明亮整洁`,
      `${baseStyle}, 厨房, 橱柜设计, 操作台, 现代厨电`,
    ],
    cover: [
      `${baseStyle}, 客厅全景, 设计感, 杂志风格, 高级感`,
      `${baseStyle}, 房屋外观或最美角度, 构图精美`,
    ],
  }

  const pool = prompts[contentType] || prompts.article
  return pool[Math.floor(Math.random() * pool.length)]
}

// 等待异步任务完成
async function waitForTask(
  taskId: string,
  key: string,
  maxRetries = 30,
  interval = 2000,
): Promise<string | null> {
  for (let i = 0; i < maxRetries; i++) {
    await new Promise((r) => setTimeout(r, interval))

    const res = await fetch(`${BASE_URL}/api/v1/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${key}` },
    })

    if (!res.ok) {
      console.warn(`Wanxiang task query failed: ${res.status}`)
      continue
    }

    const json = await res.json()
    const status = json.output?.task_status

    if (status === "SUCCEEDED") {
      const results = json.output?.results || []
      return results.length > 0 ? results.map((r: any) => r.url).filter(Boolean).join(",") : null
    }

    if (status === "FAILED") {
      console.warn("Wanxiang image generation failed:", json.output?.message)
      return null
    }

    // PENDING / RUNNING — keep polling
  }

  console.warn("Wanxiang task polling timed out")
  return null
}

// 使用通义万相生图
export async function generateImages(
  prompt: string,
  count: number = 1,
): Promise<string[]> {
  const key = getKey()
  if (!key) return fallbackImages(count)

  try {
    // 提交异步生图任务
    const res = await fetch(
      `${BASE_URL}/api/v1/services/aigc/text2image/image-synthesis`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "X-DashScope-Async": "enable",
        },
        body: JSON.stringify({
          model: "wanx2.1-t2i-turbo",
          input: { prompt },
          parameters: { size: "1024*1024", n: Math.min(count, 4) },
        }),
      },
    )

    if (!res.ok) {
      const err = await res.text()
      console.warn(`Wanxiang API error (${res.status}):`, err)
      return fallbackImages(count)
    }

    const json = await res.json()
    const taskId = json.output?.task_id
    if (!taskId) {
      console.warn("Wanxiang: no task_id returned")
      return fallbackImages(count)
    }

    // 轮询等待结果（waitForTask 返回逗号分隔的多个 URL）
    const urlsCsv = await waitForTask(taskId, key)
    if (!urlsCsv) return fallbackImages(count)

    const urls = urlsCsv.split(",").filter(Boolean)
    // 转存每张图片到 Supabase Storage
    const permanentUrls = await Promise.all(urls.map((u) => rehostImage(u)))
    return permanentUrls.filter(Boolean)
  } catch (err) {
    console.warn("Wanxiang API call failed:", err)
    return fallbackImages(count)
  }
}

// 下载 OSS URL 图片并上传到 Supabase Storage，返回永久 URL
async function rehostImage(imageUrl: string): Promise<string> {
  try {
    const res = await fetch(imageUrl)
    if (!res.ok) return imageUrl
    const blob = await res.blob()
    const supabase = createDirectClient()
    const ext = imageUrl.includes(".png") ? "png" : "jpg"
    const fileName = `rehosted/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { data, error } = await supabase.storage.from("images").upload(fileName, blob, {
      contentType: blob.type,
      upsert: false,
    })
    if (error || !data) return imageUrl
    const { data: { publicUrl } } = supabase.storage.from("images").getPublicUrl(fileName)
    return publicUrl
  } catch {
    return imageUrl
  }
}

function fallbackImages(count: number): string[] {
  const colors = ["e2e8f0", "cbd5e1", "f1f5f9", "e4e4e7"]
  return Array.from({ length: count }, (_, i) =>
    `https://placehold.co/1024x1024/${colors[i % colors.length]}/64748b?text=${encodeURIComponent("等待配图 " + (i + 1))}`,
  )
}
