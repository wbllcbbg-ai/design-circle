-- ============================================================
-- 过程托管 + 注册修复 + 五角色 · 合并迁移脚本
-- 适用于：已执行 00001-00006 的 Supabase 项目
-- 执行方式：Supabase Dashboard → SQL Editor → 粘贴本文件全文 → Run
-- 三部分顺序不可调换：00007 → 00008 → 00009
-- ============================================================

-- ============================================================
-- 第一部分：00007 过程托管交易系统
-- ============================================================

-- 过程托管交易系统 (Process Custody)
-- 平台不碰业主的钱，只掌握「报价 → 签约 → 交付节点 → 评价」这条真实交易链。
-- 信用、防跳单、变现全部挂在这条链上。
--
-- 关系图：
--   quotes → contracts → projects → milestones（固定4节点）
--                 └───────────→ reviews（真实交易评价，source='contract'）
--   credit_records 由签约/节点确认/竣工/评价/跳单 等真实事件驱动
--   conversations 绑定 project_id（签约后不可删除）
--
-- 建表顺序说明：projects 与 contracts 存在循环引用（projects.contract_id ↔ contracts.project_id），
-- 故先建无外键依赖的表，再用 ALTER TABLE 补循环外键。

-- ============================================================
-- 一、新建表：quotes（结构化报价）—— 无前置依赖
-- ============================================================

CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  designer_id UUID NOT NULL REFERENCES designers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,

  -- 报价明细
  design_fee DECIMAL(10,2) NOT NULL,           -- 设计费总额
  design_fee_breakdown JSONB NOT NULL DEFAULT '{}', -- {方案, 施工图, 效果图, 跟踪}
  estimated_construction_fee DECIMAL(10,2),     -- 预估施工费（可选，平台不托管）
  design_period TEXT,                           -- 设计周期，如「15工作日」
  construction_period TEXT,                     -- 预估施工周期
  payment_rhythm JSONB NOT NULL DEFAULT '[]',   -- 付款节奏 [{node, ratio}]
  exclusions TEXT[] NOT NULL DEFAULT '{}',      -- 不含项
  budget_warning TEXT,                          -- 预算预警说明（三层）
  notes TEXT,                                   -- 特别说明

  -- 状态机
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL,              -- 报价有效期（默认 +48h）
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_quotes_designer ON quotes(designer_id, created_at DESC);
CREATE INDEX idx_quotes_user ON quotes(user_id, status);
CREATE INDEX idx_quotes_pending ON quotes(expires_at) WHERE status = 'pending';

-- ============================================================
-- 二、新建表：projects（项目容器，服务线中枢）
-- 注意：contract_id 的外键因循环引用稍后用 ALTER 补
-- ============================================================

CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL,                    -- 外键稍后补（循环引用 contracts）
  designer_id UUID NOT NULL REFERENCES designers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,

  title TEXT NOT NULL,                          -- 如「张女士·原木风130平全案」
  city_id UUID REFERENCES cities(id),
  current_milestone INT NOT NULL DEFAULT 0,     -- 当前节点序号 0-3
  progress INT NOT NULL DEFAULT 0,              -- 进度百分比 0-100

  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'cancelled', 'disputed')),
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_designer ON projects(designer_id, status);
CREATE INDEX idx_projects_user ON projects(user_id, status);
CREATE INDEX idx_projects_active ON projects(status) WHERE status = 'active';

-- ============================================================
-- 三、新建表：contracts（合同 —— 固定服务费 + 报价快照）
-- 引用 projects.project_id 回填，此时 projects 已存在
-- ============================================================

CREATE TABLE contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
  designer_id UUID NOT NULL REFERENCES designers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL, -- 签约后回填

  -- 固定服务费（本版决策：写死固定金额，设计师向平台对公转账）
  service_fee_amount DECIMAL(10,2) NOT NULL,    -- 固定金额，如 500.00
  service_fee_paid BOOLEAN NOT NULL DEFAULT false,
  service_fee_paid_at TIMESTAMPTZ,

  -- 报价快照（法律存证，签约时冻结，不可改）
  total_price DECIMAL(10,2) NOT NULL,           -- 设计费总额（从 quote 带入）
  quote_snapshot JSONB NOT NULL,                -- 完整报价快照
  designer_snapshot JSONB NOT NULL,             -- 签约时设计师身份快照
  user_snapshot JSONB NOT NULL,                 -- 签约时业主身份快照

  -- 预算预警阈值（写死合同）
  warning_threshold DECIMAL(5,2) NOT NULL DEFAULT 5.00,  -- 5% 预警
  alert_threshold DECIMAL(5,2) NOT NULL DEFAULT 15.00,    -- 15% 超限

  -- 电子签约（首版用平台生成合同 + 双签模拟，后续接法大大）
  e_signature_id TEXT,                          -- 法大大合同ID
  contract_pdf_url TEXT,                        -- 合同PDF存证
  signed_by_designer_at TIMESTAMPTZ,
  signed_by_user_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,                        -- 双方都签后回填

  -- 状态机
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'signed', 'cancelled', 'terminated', 'completed')),
  cancelled_at TIMESTAMPTZ,
  terminated_at TIMESTAMPTZ,
  terminated_reason TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contracts_designer ON contracts(designer_id, created_at DESC);
CREATE INDEX idx_contracts_user ON contracts(user_id, status);
CREATE INDEX idx_contracts_status ON contracts(status) WHERE status IN ('draft', 'signed');

-- ============================================================
-- 四、补循环外键：projects.contract_id → contracts(id)
-- ============================================================

ALTER TABLE projects
  ADD CONSTRAINT fk_projects_contract
  FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE;

-- ============================================================
-- 五、新建表：milestones（交付里程碑 —— 固定4节点模板）
-- 此时 projects 和 contracts 都已存在
-- ============================================================

CREATE TABLE milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,

  -- 固定4节点模板
  node_index INT NOT NULL CHECK (node_index BETWEEN 0 AND 3),
  node_code TEXT NOT NULL CHECK (node_code IN ('measure', 'scheme', 'deepening', 'final')),
  -- measure=量房确认(权重0) scheme=概念方案(30%) deepening=深化方案(40%) final=设计尾款(30%)
  node_name TEXT NOT NULL,                      -- 显示名
  weight INT NOT NULL DEFAULT 0,                -- 权重（进度/服务费分期参考）

  -- 设计师提交（交付物托管在此 —— 业主跳不了交付物）
  submitted_attachments JSONB NOT NULL DEFAULT '[]', -- [{type, url, name}]
  submitted_note TEXT,
  designer_submitted_at TIMESTAMPTZ,

  -- 业主确认（过程托管的核心动作）
  user_confirmed_at TIMESTAMPTZ,
  user_rejected_at TIMESTAMPTZ,
  reject_reason TEXT,

  -- 状态机
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_review', 'confirmed', 'rejected')),
  due_at TIMESTAMPTZ,                           -- 约定完成时间
  completed_at TIMESTAMPTZ,                     -- confirmed 后回填
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE(project_id, node_index)
);

CREATE INDEX idx_milestones_project ON milestones(project_id, node_index);
CREATE INDEX idx_milestones_pending ON milestones(project_id) WHERE status IN ('pending', 'in_review', 'rejected');

-- ============================================================
-- 六、新建表：credit_records（信用变动流水 —— 类比 point_records）
-- ============================================================

CREATE TABLE credit_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  designer_id UUID NOT NULL REFERENCES designers(id) ON DELETE CASCADE,
  delta INT NOT NULL,                           -- 正分加分，负分扣分
  metric TEXT NOT NULL CHECK (metric IN (
    'completion', 'praise', 'dispute', 'response', 'skip_order', 'sign_contract'
  )),
  reason TEXT NOT NULL,
  related_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  related_milestone_id UUID REFERENCES milestones(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_credit_designer ON credit_records(designer_id, created_at DESC);

-- ============================================================
-- 七、改造现有表（此时新表都已存在，外键可正常引用）
-- ============================================================

-- designers：加信用维度字段（冗余计数，只来自真实交付，由 RPC 原子维护）
ALTER TABLE designers ADD COLUMN IF NOT EXISTS completed_projects INT NOT NULL DEFAULT 0;
ALTER TABLE designers ADD COLUMN IF NOT EXISTS avg_response_hours DECIMAL(5,2);
ALTER TABLE designers ADD COLUMN IF NOT EXISTS dispute_count INT NOT NULL DEFAULT 0;
ALTER TABLE designers ADD COLUMN IF NOT EXISTS skip_order_count INT NOT NULL DEFAULT 0;
ALTER TABLE designers ADD COLUMN IF NOT EXISTS credit_score DECIMAL(5,2) NOT NULL DEFAULT 50.00;
ALTER TABLE designers ADD COLUMN IF NOT EXISTS credit_score_updated_at TIMESTAMPTZ;

-- conversations：加项目绑定 + 状态机（bound=已绑项目，前端禁止删）
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'archived', 'bound'));

-- reviews：加项目关联（真实交易评价绑定项目）
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;

-- ============================================================
-- 八、SECURITY DEFINER 函数（原子维护冗余计数，参照 00002 范式）
-- ============================================================

-- 原子增减信用分（约束在 0-100）
CREATE OR REPLACE FUNCTION increment_credit_score(p_designer_id UUID, p_delta INT)
RETURNS VOID AS $$
BEGIN
  UPDATE designers
  SET credit_score = LEAST(100, GREATEST(0, credit_score + p_delta)),
      credit_score_updated_at = now()
  WHERE id = p_designer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 原子递增完工数
CREATE OR REPLACE FUNCTION increment_completed_projects(p_designer_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE designers
  SET completed_projects = completed_projects + 1
  WHERE id = p_designer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 原子递增纠纷数
CREATE OR REPLACE FUNCTION increment_dispute_count(p_designer_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE designers
  SET dispute_count = dispute_count + 1
  WHERE id = p_designer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 原子递增跳单数
CREATE OR REPLACE FUNCTION increment_skip_order_count(p_designer_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE designers
  SET skip_order_count = skip_order_count + 1
  WHERE id = p_designer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- 九、固定4节点模板说明（签约时由应用层按此模板插入 milestones）
-- ============================================================
-- node_index | node_code   | node_name  | weight | 业主确认动作
-- -----------+-------------+------------+--------+----------------------------------
--     0      | measure     | 量房确认    |   0    | 确认量房报告（含现场照）
--     1      | scheme      | 概念方案    |  30    | 确认平面布局 + 意向图
--     2      | deepening   | 深化方案    |  40    | 确认效果图 + 施工图
--     3      | final       | 设计尾款    |  30    | 确认全部图纸交付 → 触发评价


-- ============================================================
-- 第二部分：00008 注册 trigger 修复
-- ============================================================

-- 修复注册断层：新用户注册时自动在 users 表创建对应行
-- 问题：auth.users 与 public.users 是分离表，注册成功后 users 表无行，
--       导致 profile/role 判定/入驻/积分等全部异常。
-- 方案：用数据库 trigger 在 auth.users 插入时自动建 users 行（Supabase 标准做法）。

-- 1. 回填：为已存在于 auth.users 但缺 public.users 行的用户补建
-- （邮箱前缀作为初始昵称，避免 NOT NULL 约束失败）
INSERT INTO users (id, email, nickname)
SELECT au.id, au.email,
       COALESCE(split_part(au.email, '@', 1), '用户') AS nickname
FROM auth.users au
LEFT JOIN users u ON u.id = au.id
WHERE u.id IS NULL;

-- 2. trigger 函数：从 auth.users 复制 id/email，生成默认 nickname
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO users (id, email, nickname, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(split_part(NEW.email, '@', 1), '用户'),
    NEW.created_at
  )
  ON CONFLICT (id) DO NOTHING;  -- 幂等，防重复注册时报错
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. trigger：auth.users 插入后触发
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ============================================================
-- 第三部分：00009 五角色完整数据层
-- ============================================================

-- 五角色完整数据层（材料商 / 施工方 / 监理 + 保证金 + 验收派单）
--
-- 资金边界（用户已确认）：
--   · 保证金：纯记录状态（已收/未收），运营线下对公收取，平台不建立资金池，零资金沉淀
--   · 施工款：前期平台不碰，业主与施工方自行结算，平台只见证交付节点
--   · 完全符合「信任优先 / 不碰钱」战略
--
-- 复用：信用分（designers.credit_score 已在 00007 建立），新角色各自的信用字段独立维护。
-- 统一入驻申请：扩展现有 designer_applications 表，新增 role 字段区分申请角色。

-- ============================================================
-- 一、扩展 users.role 枚举：支持多角色
-- 原 CHECK ('user','admin')，扩展为支持商户角色标记
-- ============================================================
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('user', 'admin', 'designer', 'company', 'worker', 'supplier', 'inspector', 'contractor'));

-- ============================================================
-- 二、扩展入驻申请表：支持五角色申请
-- 原 type CHECK ('designer','company','worker')，扩展为支持全部角色
-- ============================================================
ALTER TABLE designer_applications DROP CONSTRAINT IF EXISTS designer_applications_type_check;
ALTER TABLE designer_applications ADD CONSTRAINT designer_applications_type_check
  CHECK (type IN ('designer', 'company', 'worker', 'supplier', 'inspector', 'contractor'));

-- ============================================================
-- 三、材料商 suppliers
-- ============================================================
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                              -- 品牌/商家名
  logo_url TEXT,
  description TEXT,
  brand TEXT,                                      -- 代理品牌
  category TEXT NOT NULL DEFAULT 'other',          -- 品类：tile瓷砖/furniture定制家具/appliance电器/other
  city_id UUID REFERENCES cities(id),
  contact_phone TEXT,
  qualification_urls TEXT[] NOT NULL DEFAULT '{}', -- 营业执照/品牌授权/质检报告 URL
  is_verified BOOLEAN NOT NULL DEFAULT false,      -- 平台审核通过
  -- 信用维度
  case_count INT NOT NULL DEFAULT 0,               -- 关联案例数
  avg_rating DECIMAL(2,1) NOT NULL DEFAULT 0.0,
  review_count INT NOT NULL DEFAULT 0,
  delay_count INT NOT NULL DEFAULT 0,              -- 供货延迟次数
  credit_score DECIMAL(5,2) NOT NULL DEFAULT 50.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_suppliers_user ON suppliers(user_id);
CREATE INDEX idx_suppliers_category ON suppliers(category);
CREATE INDEX idx_suppliers_city ON suppliers(city_id);

-- ============================================================
-- 四、施工方 contractors
-- ============================================================
CREATE TABLE contractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                              -- 施工队/公司名
  logo_url TEXT,
  description TEXT,
  city_id UUID REFERENCES cities(id),
  service_areas TEXT[] NOT NULL DEFAULT '{}',
  specialties TEXT[] NOT NULL DEFAULT '{}',        -- 擅长工种：水电/泥木/油漆/拆改/全包
  contact_phone TEXT,
  qualification_urls TEXT[] NOT NULL DEFAULT '{}', -- 营业执照/资质证书
  is_verified BOOLEAN NOT NULL DEFAULT false,
  -- 信用维度（来自平台见证的真实交付）
  completed_projects INT NOT NULL DEFAULT 0,
  pass_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,    -- 一次性验收通过率
  rework_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,  -- 整改率
  schedule_deviation DECIMAL(5,2),                 -- 工期偏差（实际/预估）
  avg_rating DECIMAL(2,1) NOT NULL DEFAULT 0.0,
  review_count INT NOT NULL DEFAULT 0,
  dispute_count INT NOT NULL DEFAULT 0,
  credit_score DECIMAL(5,2) NOT NULL DEFAULT 50.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contractors_user ON contractors(user_id);
CREATE INDEX idx_contractors_city ON contractors(city_id);

-- ============================================================
-- 五、监理 inspectors
-- ============================================================
CREATE TABLE inspectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  logo_url TEXT,
  description TEXT,
  city_id UUID REFERENCES cities(id),
  service_areas TEXT[] NOT NULL DEFAULT '{}',
  contact_phone TEXT,
  qualification_urls TEXT[] NOT NULL DEFAULT '{}', -- 监理资质证书
  is_verified BOOLEAN NOT NULL DEFAULT false,
  -- 信用维度
  inspection_count INT NOT NULL DEFAULT 0,         -- 验收项目数
  punctuality_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00, -- 到场准时率
  report_quality_score DECIMAL(3,2),               -- 报告质量评分
  issue_finding_rate DECIMAL(5,2),                 -- 整改发现率
  avg_rating DECIMAL(2,1) NOT NULL DEFAULT 0.0,
  review_count INT NOT NULL DEFAULT 0,
  credit_score DECIMAL(5,2) NOT NULL DEFAULT 50.00,
  -- 师徒制：带教中的新监理，老监理复核其报告
  is_mentor BOOLEAN NOT NULL DEFAULT false,
  mentor_id UUID REFERENCES inspectors(id) ON DELETE SET NULL, -- 带教师傅
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inspectors_user ON inspectors(user_id);
CREATE INDEX idx_inspectors_city ON inspectors(city_id);

-- ============================================================
-- 六、保证金 deposits（纯记录，平台不碰钱）
-- 运营线下对公收取，平台只记录状态
-- ============================================================
CREATE TABLE deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 多态关联：role + entity_id（指向 suppliers/contractors）
  role TEXT NOT NULL CHECK (role IN ('supplier', 'contractor')),
  entity_id UUID NOT NULL,                         -- suppliers.id 或 contractors.id
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,                   -- 保证金金额
  category TEXT,                                   -- 品类（如瓷砖2万/定制家具5万）
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'received', 'used', 'refunded')),  -- 纯记录，线下收取
  received_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,                             -- 用于赔付时记录
  used_reason TEXT,
  refunded_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_deposits_entity ON deposits(role, entity_id);
CREATE INDEX idx_deposits_user ON deposits(user_id);
CREATE INDEX idx_deposits_pending ON deposits(status) WHERE status = 'pending';

-- ============================================================
-- 七、监理派单 inspector_assignments
-- 一个项目可分配监理，监理代表业主验收关键节点
-- ============================================================
CREATE TABLE inspector_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  inspector_id UUID NOT NULL REFERENCES inspectors(id) ON DELETE CASCADE,
  -- 模式：platform 平台派单 / client 业主自带
  assign_mode TEXT NOT NULL DEFAULT 'platform' CHECK (assign_mode IN ('platform', 'client')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'completed', 'cancelled')),
  fee_per_sqm DECIMAL(8,2),                        -- 按平米收费（业主与监理自行结算，平台仅记录）
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, inspector_id)
);

CREATE INDEX idx_assignments_inspector ON inspector_assignments(inspector_id, status);
CREATE INDEX idx_assignments_project ON inspector_assignments(project_id);

-- ============================================================
-- 八、验收报告 inspections
-- 监理对施工节点的验收：通过 / 整改 / 复验
-- ============================================================
CREATE TABLE inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  assignment_id UUID REFERENCES inspector_assignments(id) ON DELETE SET NULL,
  inspector_id UUID NOT NULL REFERENCES inspectors(id) ON DELETE CASCADE,
  milestone_node TEXT NOT NULL,                    -- 验收节点：measure/water_elec/waterproof/masonry/paint/install/final
  -- 监理报告内容
  photos TEXT[] NOT NULL DEFAULT '{}',             -- 现场照片
  checklist JSONB NOT NULL DEFAULT '[]',           -- 检查项 [{item, passed, note}]
  issues TEXT[] NOT NULL DEFAULT '{}',             -- 发现的问题
  conclusion TEXT NOT NULL CHECK (conclusion IN ('pass', 'rework', 'reinspect')),
  rework_required TEXT,                            -- 整改要求
  report_note TEXT,
  -- 师徒制：新监理的报告需师傅复核
  mentor_reviewed BOOLEAN NOT NULL DEFAULT true,
  mentor_review_note TEXT,
  -- 状态
  status TEXT NOT NULL DEFAULT 'completed'
    CHECK (status IN ('draft', 'completed', 'reworked')),
  inspected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_inspections_project ON inspections(project_id, inspected_at DESC);
CREATE INDEX idx_inspections_inspector ON inspections(inspector_id, inspected_at DESC);

-- ============================================================
-- 九、材料商案例关联 supplier_cases
-- 材料商申请关联平台已有案例，设计师确认后展示
-- ============================================================
CREATE TABLE supplier_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  -- 材料商提供的关联信息
  product_info TEXT,                               -- 产品信息
  product_photos TEXT[] NOT NULL DEFAULT '{}',     -- 案例中使用产品的截图
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'auto_approved')),
  -- 设计师确认：超时未处理自动通过
  designer_id UUID REFERENCES designers(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(supplier_id, case_id)
);

CREATE INDEX idx_supplier_cases_supplier ON supplier_cases(supplier_id, status);
CREATE INDEX idx_supplier_cases_case ON supplier_cases(case_id);

-- ============================================================
-- 十、评价 reviews 扩展：支持多角色评价
-- 原 reviews 只针对 designer，扩展支持 supplier/contractor/inspector
-- ============================================================
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS target_type TEXT NOT NULL DEFAULT 'designer'
  CHECK (target_type IN ('designer', 'supplier', 'contractor', 'inspector'));
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS contractor_id UUID REFERENCES contractors(id) ON DELETE CASCADE;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS inspector_id UUID REFERENCES inspectors(id) ON DELETE CASCADE;

-- ============================================================
-- 十一、信用维护函数（新角色，参照 00007 范式）
-- ============================================================

CREATE OR REPLACE FUNCTION increment_supplier_credit(p_id UUID, p_delta INT)
RETURNS VOID AS $$
BEGIN
  UPDATE suppliers SET credit_score = LEAST(100, GREATEST(0, credit_score + p_delta)) WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_contractor_credit(p_id UUID, p_delta INT)
RETURNS VOID AS $$
BEGIN
  UPDATE contractors SET credit_score = LEAST(100, GREATEST(0, credit_score + p_delta)) WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_inspector_credit(p_id UUID, p_delta INT)
RETURNS VOID AS $$
BEGIN
  UPDATE inspectors SET credit_score = LEAST(100, GREATEST(0, credit_score + p_delta)) WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 完工数/验收数等计数函数
CREATE OR REPLACE FUNCTION increment_contractor_completed(p_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE contractors SET completed_projects = completed_projects + 1 WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_inspector_count(p_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE inspectors SET inspection_count = inspection_count + 1 WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


