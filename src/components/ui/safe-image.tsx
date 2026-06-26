"use client"

import { useState } from "react"

// 带兜底的图片组件：加载失败时回退到占位图，避免破图白格
// 社区站图源多（Unsplash/AI生成/用户上传/外部链接），失效是常态

const PLACEHOLDER_SVG =
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="100%" height="100%" fill="#f4f4f5"/><text x="50%" y="50%" font-size="14" fill="#a1a1aa" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif">图片加载失败</text></svg>`,
  )

interface SafeImageProps {
  src: string | null | undefined
  alt: string
  className?: string
  // 兜底图（默认内置占位 SVG）
  fallbackSrc?: string
}

export function SafeImage({ src, alt, className, fallbackSrc = PLACEHOLDER_SVG }: SafeImageProps) {
  const [errored, setErrored] = useState(false)
  const safeSrc = !src || errored ? fallbackSrc : src

  return (
    // 用原生 img 是为了跨域外部图（Unsplash/万相）容错，next/image 对这些图源配置成本高
    <img
      src={safeSrc}
      alt={alt}
      className={className}
      onError={() => setErrored(true)}
      loading="lazy"
    />
  )
}
