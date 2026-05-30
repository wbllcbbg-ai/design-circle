// Unsplash 家居图片合集 — 通过图片ID直接引用
// 这些是公开可用的 Unsplash 图片

export const COVERS = [
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=1000&fit=crop", // 现代客厅
  "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&h=1000&fit=crop", // 客厅
  "https://images.unsplash.com/photo-1600573472550-8090b5e0745e?w=800&h=1000&fit=crop", // 别墅客厅
  "https://images.unsplash.com/photo-1600607687644-81a1e4f0e0e4?w=800&h=1000&fit=crop", // 现代厨房
  "https://images.unsplash.com/photo-1600607687126-8a3414349a51?w=800&h=1000&fit=crop", // 卧室
  "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&h=1000&fit=crop", // 餐厅
  "https://images.unsplash.com/photo-1600573472591-ee6b68d14c68?w=800&h=1000&fit=crop", // 书房
  "https://images.unsplash.com/photo-1600566752355-35792bedcfea?w=800&h=1000&fit=crop", // 浴室
]

export const ARTICLE_COVERS = [
  "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1616046229478-9901c5536a45?w=800&h=600&fit=crop",
  "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=800&h=600&fit=crop",
]

export const AVATARS = [
  "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop",
  "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop",
]

export function getCover(index: number): string {
  return COVERS[index % COVERS.length]
}

export function getArticleCover(index: number): string {
  return ARTICLE_COVERS[index % ARTICLE_COVERS.length]
}
