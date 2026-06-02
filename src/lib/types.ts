// 城市
export interface City {
  id: string
  name: string
  code: string
  is_active: boolean
  created_at: string
}

// 用户
export interface User {
  id: string
  email: string
  nickname: string
  avatar_url: string | null
  phone: string | null
  is_real_name_verified: boolean
  city_id: string | null
  created_at: string
}

// 设计师/装修公司
export type DesignerType = "designer" | "company" | "worker"

// 身份标签字典 — 数据库存英文，显示层转中文
export const ROLE_LABELS: Record<string, string> = {
  designer: "设计师",
  company: "装修公司",
  worker: "工长",
  homeowner: "业主",
  supplier: "材料商",
  editor: "编辑",
}

export function getRoleLabel(type: string | null | undefined): string {
  if (!type) return ""
  return ROLE_LABELS[type] || type
}

export interface Designer {
  id: string
  user_id: string
  type: DesignerType
  name: string
  logo_url: string | null
  description: string | null
  city_id: string | null
  service_areas: string[]
  specialties: string[]
  years_experience: number | null
  contact_phone: string | null
  is_verified: boolean
  avg_rating: number
  review_count: number
  case_count: number
  created_at: string
}

// 案例
export interface Case {
  id: string
  designer_id: string
  title: string
  description: string | null
  cover_url: string
  images: string[]
  style: string
  area: number | null
  budget: number | null
  duration: string | null
  city_id: string | null
  is_published: boolean
  view_count: number
  like_count: number
  created_at: string
}

// 点评
export interface Review {
  id: string
  user_id: string
  designer_id: string
  case_id: string | null
  rating: number
  design_score: number
  construction_score: number
  service_score: number
  content: string
  images: string[]
  is_real_name: boolean
  is_verified: boolean
  follow_up: string | null
  created_at: string
}

// 文章 (AI PGC)
export interface Article {
  id: string
  title: string
  summary: string | null
  cover_url: string | null
  content: string
  tags: string[]
  category: string
  city_id: string | null
  is_published: boolean
  view_count: number
  like_count: number
  published_at: string
  created_at: string
}

// 首页 Feed 流
export type DesignerInfo = {
  id: string
  name: string
  type: string
  user_id: string
}

export type FeedItem = {
  type: "case" | "article"
  id: string
  title: string
  likes: number
  style: string
  area: number
  category: string
  imgIndex: number
  coverUrl: string | null
  firstImage: string | null
  designer_id: string | null
  designer: DesignerInfo | null
}

// 设计师入驻申请
export interface DesignerApplication {
  id: string
  user_id: string
  type: DesignerType
  name: string
  phone: string
  description: string | null
  specialties: string[]
  city_id: string | null
  credentials: string[]
  status: "pending" | "approved" | "rejected"
  created_at: string
}
