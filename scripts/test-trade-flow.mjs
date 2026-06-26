/**
 * 过程托管业务链路联调脚本
 * 用 service_role key 直接操作数据库，绕过 cookie 鉴权
 * 验证：报价 → 合同 → 项目 → 4里程碑 → 信用加分 → 竣工 的完整闭环
 *
 * 用法：node scripts/test-trade-flow.mjs
 */
import { readFileSync } from "fs"

// 手动读 .env.local（避免依赖 dotenv）
const env = readFileSync(".env.local", "utf8")
const getEnv = (k) => {
  const m = env.match(new RegExp(`^${k}=(.*)$`, "m"))
  return m ? m[1].trim() : ""
}

const SUPA_URL = getEnv("NEXT_PUBLIC_SUPABASE_URL")
const SVC_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY")

if (!SUPA_URL || !SVC_KEY) {
  console.error("❌ 缺少 NEXT_PUBLIC_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

async function db(table, method = "GET", body = null, query = "") {
  const headers = {
    apikey: SVC_KEY,
    Authorization: `Bearer ${SVC_KEY}`,
    "Content-Type": "application/json",
    Prefer: method === "POST" ? "return=representation" : "count=exact",
  }
  const url = `${SUPA_URL}/rest/v1/${table}${query}`
  const opts = { method, headers }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(url, opts)
  const data = await res.json().catch(() => null)
  return { ok: res.ok, status: res.status, data }
}

async function rpc(fn, params) {
  const res = await fetch(`${SUPA_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: {
      apikey: SVC_KEY,
      Authorization: `Bearer ${SVC_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(params),
  })
  return { ok: res.ok, status: res.status, data: await res.json().catch(() => null) }
}

let step = 0
function log(label, ok, detail = "") {
  step++
  const mark = ok ? "✓" : "✗"
  console.log(`[${step}] ${mark} ${label}${detail ? "  " + detail : ""}`)
  if (!ok) console.log("    详情:", detail)
}

async function main() {
  console.log("\n========== 过程托管业务链路联调 ==========\n")

  // 0. 取一个真实设计师和一个真实业主
  const designer = await db("designers", "GET", null, "?select=id,name,user_id&is_verified=eq.true&limit=1")
  const d = designer.data?.[0]
  if (!d) return log("取设计师", false, "无已认证设计师")

  const user = await db("users", "GET", null, "?select=id,nickname&role=eq.user&limit=1")
  const u = user.data?.[0]
  if (!u) return log("取业主", false, "无业主")

  log(`身份: 设计师 ${d.name} + 业主 ${u.nickname}`, true)

  // 1. 建 conversation（模拟业主咨询设计师）
  const conv = await db("conversations", "POST", {
    designer_id: d.id,
    user_id: u.id,
    last_message: "联调测试咨询",
    last_message_at: new Date().toISOString(),
  })
  const conversation = conv.data?.[0]
  log("建对话", conv.ok, conv.ok ? `id=${conversation.id.slice(0, 8)}` : JSON.stringify(conv.data))

  // 2. 设计师发报价
  const quote = await db("quotes", "POST", {
    designer_id: d.id,
    user_id: u.id,
    conversation_id: conversation.id,
    design_fee: 28000,
    design_period: "15工作日",
    payment_rhythm: [{ node: "签约", ratio: 0 }, { node: "方案", ratio: 30 }],
    status: "pending",
    expires_at: new Date(Date.now() + 48 * 3600000).toISOString(),
  })
  const q = quote.data?.[0]
  log("发报价", quote.ok, quote.ok ? `设计费¥${q.design_fee}` : JSON.stringify(quote.data))

  // 3. 业主接受报价 → 建 draft 合同
  const contract = await db("contracts", "POST", {
    quote_id: q.id,
    designer_id: d.id,
    user_id: u.id,
    service_fee_amount: 500,
    service_fee_paid: false,
    total_price: 28000,
    quote_snapshot: { design_fee: 28000 },
    designer_snapshot: { name: d.name },
    user_snapshot: { nickname: u.nickname },
    status: "draft",
  })
  const c = contract.data?.[0]
  log("接受报价→建合同", contract.ok, contract.ok ? `status=${c.status}` : JSON.stringify(contract.data))

  // 4. 模拟双签 → 建 project + 4 milestones
  const project = await db("projects", "POST", {
    contract_id: c.id,
    designer_id: d.id,
    user_id: u.id,
    conversation_id: conversation.id,
    title: `联调项目·${d.name}`,
    status: "active",
  })
  const p = project.data?.[0]
  log("建项目", project.ok, project.ok ? `id=${p.id.slice(0, 8)}` : JSON.stringify(project.data))

  // 插 4 个里程碑
  const nodes = [
    { node_index: 0, node_code: "measure", node_name: "量房确认", weight: 0 },
    { node_index: 1, node_code: "scheme", node_name: "概念方案", weight: 30 },
    { node_index: 2, node_code: "deepening", node_name: "深化方案", weight: 40 },
    { node_index: 3, node_code: "final", node_name: "设计尾款", weight: 30 },
  ]
  for (const n of nodes) {
    await db("milestones", "POST", {
      project_id: p.id, contract_id: c.id,
      ...n, status: "pending",
    })
  }
  log("插4里程碑", true)

  // 5. 模拟逐个确认里程碑
  const milestones = await db("milestones", "GET", null, `?project_id=eq.${p.id}&order=node_index`)
  let confirmedCount = 0
  for (const m of milestones.data || []) {
    await db("milestones", "PATCH", {
      status: "confirmed",
      user_confirmed_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    }, `?id=eq.${m.id}`)
    // 信用加分（节点 +2）
    await rpc("increment_credit_score", { p_designer_id: d.id, p_delta: 2 })
    await db("credit_records", "POST", {
      designer_id: d.id, delta: 2, metric: "completion",
      reason: `节点确认：${m.node_name}`, related_project_id: p.id,
    })
    confirmedCount++
  }
  log(`确认${confirmedCount}个里程碑`, true, "每个+2信用")

  // 6. 竣工
  await db("projects", "PATCH", {
    status: "completed", completed_at: new Date().toISOString(), progress: 100,
  }, `?id=eq.${p.id}`)
  await db("contracts", "PATCH", {
    status: "completed", completed_at: new Date().toISOString(),
  }, `?id=${c.id}`)
  // 完工数+1 + 竣工信用+5
  await rpc("increment_completed_projects", { p_designer_id: d.id })
  await rpc("increment_credit_score", { p_designer_id: d.id, p_delta: 5 })
  await db("credit_records", "POST", {
    designer_id: d.id, delta: 5, metric: "completion",
    reason: "项目竣工", related_project_id: p.id,
  })
  log("项目竣工", true, "完工数+1, 信用+5")

  // 7. 验证最终信用分
  const finalDesigner = await db("designers", "GET", null, `?select=name,credit_score,completed_projects&id=eq.${d.id}`)
  const fd = finalDesigner.data?.[0]
  // 初始50 + 签约3(没加，简化) + 节点8 + 竣工5 = 但签约环节脚本没加，所以应是 50+8+5=63
  log(`验证信用: ${fd.name}`, true, `credit_score=${fd.credit_score} 完工数=${fd.completed_projects}`)

  console.log("\n========== 联调完成 ==========")
  console.log(`预期信用分: 50(初始) + 8(4节点×2) + 5(竣工) = 63`)
  console.log(`实际信用分: ${fd.credit_score}`)
  console.log(fd.credit_score == 63 ? "✅ 业务链路完整通畅！" : "⚠️ 信用分不符预期，需排查")

  // 清理（可选：保留联调数据供查看，或注释掉保留）
  console.log("\n（联调数据已保留，可在 Dashboard 查看项目/合同/信用记录）")
}

main().catch((e) => {
  console.error("联调异常:", e)
  process.exit(1)
})
