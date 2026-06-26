import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {}
        },
      },
    },
  )
}

/**
 * 获取当前登录用户的 ID（在 Server Action / API Route 中使用）。
 * 未登录时返回 null。
 *
 * 支持两种鉴权方式：
 * 1. Cookie session（浏览器正常访问）
 * 2. Bearer token（Authorization header，供 API 客户端/e2e 测试用）
 */
export async function getCurrentUserId(req?: Request) {
  // 优先尝试 Bearer token（API 客户端场景）
  const authHeader = req?.headers?.get("authorization") || ""
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7)
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        Authorization: `Bearer ${token}`,
      },
    })
    if (res.ok) {
      const user = await res.json()
      return user?.id ?? null
    }
    return null
  }

  // 默认走 cookie session（浏览器场景）
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user?.id ?? null
}
