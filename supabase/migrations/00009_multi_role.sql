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
