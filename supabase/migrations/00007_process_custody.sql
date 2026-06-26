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
