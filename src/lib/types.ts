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

// 商户角色类型（扩展五角色）
export type MerchantRole = "designer" | "company" | "worker" | "supplier" | "inspector" | "contractor"

// 身份标签字典 — 数据库存英文，显示层转中文
export const ROLE_LABELS: Record<string, string> = {
  designer: "设计师",
  company: "装修公司",
  worker: "工长",
  homeowner: "业主",
  supplier: "材料商",
  inspector: "监理",
  contractor: "施工方",
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

// ============================================================
// 过程托管交易系统（Process Custody）
// 平台不碰业主的钱，只掌握「报价 → 签约 → 交付节点 → 评价」真实交易链
// ============================================================

// --- 报价 ---
export type QuoteStatus = "pending" | "accepted" | "rejected" | "expired"
export const QUOTE_STATUS_LABELS: Record<string, string> = {
  pending: "待回复",
  accepted: "已接受",
  rejected: "已拒绝",
  expired: "已过期",
}
export function getQuoteStatusLabel(status: string | null | undefined): string {
  if (!status) return ""
  return QUOTE_STATUS_LABELS[status] || status
}
export interface Quote {
  id: string
  designer_id: string
  user_id: string
  conversation_id: string | null
  design_fee: number
  design_fee_breakdown: Record<string, number>
  estimated_construction_fee: number | null
  design_period: string | null
  construction_period: string | null
  payment_rhythm: { node: string; ratio: number }[]
  exclusions: string[]
  budget_warning: string | null
  notes: string | null
  status: QuoteStatus
  expires_at: string
  accepted_at: string | null
  rejected_at: string | null
  created_at: string
}

// --- 合同 ---
export type ContractStatus = "draft" | "signed" | "cancelled" | "terminated" | "completed"
export const CONTRACT_STATUS_LABELS: Record<string, string> = {
  draft: "待签约",
  signed: "履约中",
  cancelled: "已取消",
  terminated: "已解除",
  completed: "已完成",
}
export function getContractStatusLabel(status: string | null | undefined): string {
  if (!status) return ""
  return CONTRACT_STATUS_LABELS[status] || status
}
export interface Contract {
  id: string
  quote_id: string | null
  designer_id: string
  user_id: string
  project_id: string | null
  service_fee_amount: number
  service_fee_paid: boolean
  service_fee_paid_at: string | null
  total_price: number
  quote_snapshot: Record<string, unknown>
  designer_snapshot: Record<string, unknown>
  user_snapshot: Record<string, unknown>
  warning_threshold: number
  alert_threshold: number
  e_signature_id: string | null
  contract_pdf_url: string | null
  signed_by_designer_at: string | null
  signed_by_user_at: string | null
  signed_at: string | null
  status: ContractStatus
  cancelled_at: string | null
  terminated_at: string | null
  terminated_reason: string | null
  completed_at: string | null
  created_at: string
}

// --- 项目 ---
export type ProjectStatus = "active" | "completed" | "cancelled" | "disputed"
export const PROJECT_STATUS_LABELS: Record<string, string> = {
  active: "进行中",
  completed: "已竣工",
  cancelled: "已取消",
  disputed: "纠纷中",
}
export function getProjectStatusLabel(status: string | null | undefined): string {
  if (!status) return ""
  return PROJECT_STATUS_LABELS[status] || status
}
export interface Project {
  id: string
  contract_id: string
  designer_id: string
  user_id: string
  conversation_id: string | null
  title: string
  city_id: string | null
  current_milestone: number
  progress: number
  status: ProjectStatus
  completed_at: string | null
  cancelled_at: string | null
  created_at: string
}

// --- 交付里程碑（固定4节点） ---
export type MilestoneStatus = "pending" | "in_review" | "confirmed" | "rejected"
export const MILESTONE_STATUS_LABELS: Record<string, string> = {
  pending: "待提交",
  in_review: "待业主确认",
  confirmed: "已确认",
  rejected: "已退回",
}
export function getMilestoneStatusLabel(status: string | null | undefined): string {
  if (!status) return ""
  return MILESTONE_STATUS_LABELS[status] || status
}

export type MilestoneNodeCode = "measure" | "scheme" | "deepening" | "final"
export const NODE_LABELS: Record<string, string> = {
  measure: "量房确认",
  scheme: "概念方案",
  deepening: "深化方案",
  final: "设计尾款",
}
// 固定4节点模板（与 migration 00007 第四节说明一致）
export const MILESTONE_TEMPLATE: { node_index: number; node_code: MilestoneNodeCode; node_name: string; weight: number }[] = [
  { node_index: 0, node_code: "measure", node_name: "量房确认", weight: 0 },
  { node_index: 1, node_code: "scheme", node_name: "概念方案", weight: 30 },
  { node_index: 2, node_code: "deepening", node_name: "深化方案", weight: 40 },
  { node_index: 3, node_code: "final", node_name: "设计尾款", weight: 30 },
]

export interface Milestone {
  id: string
  project_id: string
  contract_id: string
  node_index: number
  node_code: MilestoneNodeCode
  node_name: string
  weight: number
  submitted_attachments: { type: string; url: string; name: string }[]
  submitted_note: string | null
  designer_submitted_at: string | null
  user_confirmed_at: string | null
  user_rejected_at: string | null
  reject_reason: string | null
  status: MilestoneStatus
  due_at: string | null
  completed_at: string | null
  created_at: string
}

// --- 信用 ---
export type CreditMetric = "completion" | "praise" | "dispute" | "response" | "skip_order" | "sign_contract"
export const CREDIT_METRIC_LABELS: Record<string, string> = {
  completion: "项目交付",
  praise: "评价",
  dispute: "纠纷",
  response: "响应速度",
  skip_order: "跳单",
  sign_contract: "签约",
}
// 信用分增减规则（与开发计划 M3.1 一致）
export const CREDIT_DELTA: Record<CreditMetric, number> = {
  sign_contract: 3,    // 签约成功
  completion: 5,       // 项目竣工（节点确认按节点单独 +2，见 route 逻辑）
  praise: 3,           // 好评（≥4），差评（≤2）记 -5
  dispute: -8,         // 纠纷
  response: 1,         // 响应及时
  skip_order: -20,     // 跳单
}
export interface CreditRecord {
  id: string
  designer_id: string
  delta: number
  metric: CreditMetric
  reason: string
  related_project_id: string | null
  related_milestone_id: string | null
  created_at: string
}

// ============================================================
// 五角色扩展（材料商 / 施工方 / 监理）
// ============================================================

// --- 材料商 ---
export type SupplierCategory = "tile" | "furniture" | "appliance" | "other"
export const SUPPLIER_CATEGORY_LABELS: Record<string, string> = {
  tile: "瓷砖", furniture: "定制家具", appliance: "电器", other: "其他",
}
export interface Supplier {
  id: string
  user_id: string
  name: string
  logo_url: string | null
  description: string | null
  brand: string | null
  category: SupplierCategory
  city_id: string | null
  contact_phone: string | null
  qualification_urls: string[]
  is_verified: boolean
  case_count: number
  avg_rating: number
  review_count: number
  delay_count: number
  credit_score: number
  created_at: string
}

// --- 施工方 ---
export interface Contractor {
  id: string
  user_id: string
  name: string
  logo_url: string | null
  description: string | null
  city_id: string | null
  service_areas: string[]
  specialties: string[]
  contact_phone: string | null
  qualification_urls: string[]
  is_verified: boolean
  completed_projects: number
  pass_rate: number
  rework_rate: number
  schedule_deviation: number | null
  avg_rating: number
  review_count: number
  dispute_count: number
  credit_score: number
  created_at: string
}

// --- 监理 ---
export interface Inspector {
  id: string
  user_id: string
  name: string
  logo_url: string | null
  description: string | null
  city_id: string | null
  service_areas: string[]
  contact_phone: string | null
  qualification_urls: string[]
  is_verified: boolean
  inspection_count: number
  punctuality_rate: number
  report_quality_score: number | null
  issue_finding_rate: number | null
  avg_rating: number
  review_count: number
  credit_score: number
  is_mentor: boolean
  mentor_id: string | null
  created_at: string
}

// --- 保证金（纯记录） ---
export type DepositStatus = "pending" | "received" | "used" | "refunded"
export const DEPOSIT_STATUS_LABELS: Record<string, string> = {
  pending: "待收取", received: "已收取", used: "已用于赔付", refunded: "已退还",
}
export interface Deposit {
  id: string
  role: "supplier" | "contractor"
  entity_id: string
  user_id: string
  amount: number
  category: string | null
  status: DepositStatus
  received_at: string | null
  used_at: string | null
  used_reason: string | null
  refunded_at: string | null
  note: string | null
  created_at: string
}

// --- 监理派单 ---
export type AssignMode = "platform" | "client"
export interface InspectorAssignment {
  id: string
  project_id: string
  inspector_id: string
  assign_mode: AssignMode
  status: "active" | "completed" | "cancelled"
  fee_per_sqm: number | null
  assigned_at: string
  completed_at: string | null
  created_at: string
}

// --- 验收报告 ---
export type InspectionConclusion = "pass" | "rework" | "reinspect"
export const INSPECTION_CONCLUSION_LABELS: Record<string, string> = {
  pass: "验收通过", rework: "需整改", reinspect: "待复验",
}
export interface Inspection {
  id: string
  project_id: string
  assignment_id: string | null
  inspector_id: string
  milestone_node: string
  photos: string[]
  checklist: { item: string; passed: boolean; note: string }[]
  issues: string[]
  conclusion: InspectionConclusion
  rework_required: string | null
  report_note: string | null
  mentor_reviewed: boolean
  mentor_review_note: string | null
  status: "draft" | "completed" | "reworked"
  inspected_at: string
  created_at: string
}
