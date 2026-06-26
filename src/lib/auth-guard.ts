import { getCurrentUserId } from "@/lib/supabase/server"
import { createDirectClient } from "@/lib/supabase/client"
import { NextResponse } from "next/server"

export type ContractRole = "client" | "designer"

export interface ContractParty {
  userId: string
  role: ContractRole
  contract: {
    id: string
    designer_id: string
    designer_user_id: string
    user_id: string
    status: string
    project_id: string | null
  }
}

/**
 * 要求用户已登录。
 * 未登录返回 401（Response），已登录返回 userId（string）。
 * 可选传 req 以支持 Bearer token 鉴权（API 客户端场景）。
 */
export async function requireAuth(req?: Request): Promise<any> {
  const userId = await getCurrentUserId(req)
  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }
  return userId
}

/**
 * 要求用户是 admin。
 * 未登录返回 401，非 admin 返回 403，已授权返回 void。
 * 可选传 req 以支持 Bearer token 鉴权。
 */
export async function requireAdmin(req?: Request): Promise<any> {
  const userId = await getCurrentUserId(req)
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  }

  const supabase = createDirectClient()
  const { data: user } = await supabase
    .from("users")
    .select("role")
    .eq("id", userId)
    .single()

  if (user?.role !== "admin") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }
}

/**
 * 查询当前登录用户的商户身份（任意角色）。
 * 返回 { userId, role, entity } 或 null（未登录或无商户身份）。
 * 用于三角色（材料商/施工方/监理）的统一身份查询。
 */
export async function getMyMerchantIdentity(): Promise<{
  userId: string
  role: "designer" | "supplier" | "contractor" | "inspector"
  entityId: string
} | null> {
  const userId = await getCurrentUserId()
  if (!userId) return null

  const supabase = createDirectClient()
  const { data: user } = await supabase
    .from("users")
    .select("role")
    .eq("id", userId)
    .single()

  const role = user?.role
  let table = ""
  if (role === "designer" || role === "company" || role === "worker") table = "designers"
  else if (role === "supplier") table = "suppliers"
  else if (role === "contractor") table = "contractors"
  else if (role === "inspector") table = "inspectors"
  else return null

  const { data: entity } = await supabase
    .from(table)
    .select("id")
    .eq("user_id", userId)
    .maybeSingle()

  if (!entity) return null

  // 统一归并为 4 类商户身份
  const merchantRole =
    role === "supplier" ? "supplier" :
    role === "contractor" ? "contractor" :
    role === "inspector" ? "inspector" : "designer"

  return { userId, role: merchantRole as "designer" | "supplier" | "contractor" | "inspector", entityId: entity.id }
}
export async function requireContractParty(contractId: string, req?: Request): Promise<any> {
  const userId = await getCurrentUserId(req)
  if (!userId) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 })
  }

  const supabase = createDirectClient()
  // contracts.designer_id 指向 designers，需 join 取 designer.user_id 做当事人校验
  const { data: contract, error } = await supabase
    .from("contracts")
    .select(`
      id, designer_id, user_id, status, project_id,
      designer:designers(user_id)
    `)
    .eq("id", contractId)
    .maybeSingle()

  if (error || !contract) {
    return NextResponse.json({ error: "合同不存在" }, { status: 404 })
  }

  const designerUserId = (contract.designer as { user_id?: string } | null)?.user_id
  const isClient = contract.user_id === userId
  const isDesigner = !!designerUserId && designerUserId === userId

  if (!isClient && !isDesigner) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  return {
    userId,
    role: (isClient ? "client" : "designer") as ContractRole,
    contract: {
      id: contract.id,
      designer_id: contract.designer_id,
      designer_user_id: designerUserId || "",
      user_id: contract.user_id,
      status: contract.status,
      project_id: contract.project_id,
    },
  } as ContractParty
}
