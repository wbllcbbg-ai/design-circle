-- ============================================================
-- 全量 Schema 幂等校准（根治历史漂移）
-- 策略：所有 CREATE TABLE 用 IF NOT EXISTS，所有 ADD COLUMN 用 IF NOT EXISTS，
--       所有索引/约束用 IF NOT EXISTS，函数用 CREATE OR REPLACE。
-- 无论远程库历史漂移成什么样，执行后必然与代码期望对齐。
-- 可安全重复执行。
-- 执行方式：Supabase Dashboard → SQL Editor → 粘贴 → Run
-- ============================================================

-- ════════════════════════════════════════
-- 一、基础表（如不存在则建）
-- ════════════════════════════════════════

-- users：注册 trigger 依赖此表（00001 + 00009 role 扩展）
-- users 表本身必须存在（引用 auth.users），不在此重建，只校准列与约束
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('user', 'admin', 'designer', 'company', 'worker', 'supplier', 'inspector', 'contractor', 'homeowner'));
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'user';

-- ════════════════════════════════════════
-- 二、内容表列校准（00001 + 后续 ALTER）
-- ════════════════════════════════════════

-- cases：案例
ALTER TABLE cases ADD COLUMN IF NOT EXISTS virtual_user_id UUID REFERENCES virtual_users(id);
ALTER TABLE cases ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE cases ADD COLUMN IF NOT EXISTS ai_generated_content BOOLEAN DEFAULT false;
ALTER TABLE cases ADD COLUMN IF NOT EXISTS edited_by_human BOOLEAN DEFAULT false;

-- articles：文章（关键：author_id 列曾被遗漏）
ALTER TABLE articles ADD COLUMN IF NOT EXISTS virtual_user_id UUID REFERENCES virtual_users(id);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS ai_generated_content BOOLEAN DEFAULT false;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS edited_by_human BOOLEAN DEFAULT false;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS style_reference TEXT;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_articles_author ON articles(author_id) WHERE is_published = true;

-- comments：评论（00002 + 00003 parent_id）
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('article', 'case')),
  target_id UUID NOT NULL,
  content TEXT NOT NULL,
  virtual_user_id UUID REFERENCES virtual_users(id),
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES comments(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_comments_target ON comments(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_comments_virtual_user ON comments(virtual_user_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);

-- questions：提问（00002 完整版，含 tags/view_count/like_count/answer_count）
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  view_count INT NOT NULL DEFAULT 0,
  like_count INT NOT NULL DEFAULT 0,
  answer_count INT NOT NULL DEFAULT 0,
  virtual_user_id UUID REFERENCES virtual_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category);
CREATE INDEX IF NOT EXISTS idx_questions_virtual_user ON questions(virtual_user_id);
CREATE INDEX IF NOT EXISTS idx_questions_created_at ON questions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_questions_user ON questions(user_id, created_at DESC);

-- ════════════════════════════════════════
-- 三、设计师信用字段（00007）
-- ════════════════════════════════════════
ALTER TABLE designers ADD COLUMN IF NOT EXISTS completed_projects INT NOT NULL DEFAULT 0;
ALTER TABLE designers ADD COLUMN IF NOT EXISTS avg_response_hours DECIMAL(5,2);
ALTER TABLE designers ADD COLUMN IF NOT EXISTS dispute_count INT NOT NULL DEFAULT 0;
ALTER TABLE designers ADD COLUMN IF NOT EXISTS skip_order_count INT NOT NULL DEFAULT 0;
ALTER TABLE designers ADD COLUMN IF NOT EXISTS credit_score DECIMAL(5,2) NOT NULL DEFAULT 50.00;
ALTER TABLE designers ADD COLUMN IF NOT EXISTS credit_score_updated_at TIMESTAMPTZ;

-- ════════════════════════════════════════
-- 四、reviews 评价表（缺列导致提交500的根因）
-- ════════════════════════════════════════
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (review_status IN ('pending','approved','rejected','flagged'));
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS review_source TEXT
  CHECK (review_source IN ('consult','browse','transaction'));
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS ai_confidence DECIMAL(3,2);
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS target_type TEXT NOT NULL DEFAULT 'designer'
  CHECK (target_type IN ('designer', 'supplier', 'contractor', 'inspector'));
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS contractor_id UUID REFERENCES contractors(id) ON DELETE CASCADE;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS inspector_id UUID REFERENCES inspectors(id) ON DELETE CASCADE;

-- review_flags 明细表
CREATE TABLE IF NOT EXISTS review_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID REFERENCES reviews(id) ON DELETE CASCADE,
  flag TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_review_flags_review ON review_flags(review_id);

-- ════════════════════════════════════════
-- 五、过程托管（00007：如不存在则建）
-- ════════════════════════════════════════
CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  designer_id UUID NOT NULL REFERENCES designers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  design_fee DECIMAL(10,2) NOT NULL,
  design_fee_breakdown JSONB NOT NULL DEFAULT '{}',
  estimated_construction_fee DECIMAL(10,2),
  design_period TEXT,
  construction_period TEXT,
  payment_rhythm JSONB NOT NULL DEFAULT '[]',
  exclusions TEXT[] NOT NULL DEFAULT '{}',
  budget_warning TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_quotes_designer ON quotes(designer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quotes_user ON quotes(user_id, status);
CREATE INDEX IF NOT EXISTS idx_quotes_pending ON quotes(expires_at) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
  designer_id UUID NOT NULL REFERENCES designers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  service_fee_amount DECIMAL(10,2) NOT NULL,
  service_fee_paid BOOLEAN NOT NULL DEFAULT false,
  service_fee_paid_at TIMESTAMPTZ,
  total_price DECIMAL(10,2) NOT NULL,
  quote_snapshot JSONB NOT NULL,
  designer_snapshot JSONB NOT NULL,
  user_snapshot JSONB NOT NULL,
  warning_threshold DECIMAL(5,2) NOT NULL DEFAULT 5.00,
  alert_threshold DECIMAL(5,2) NOT NULL DEFAULT 15.00,
  e_signature_id TEXT,
  contract_pdf_url TEXT,
  signed_by_designer_at TIMESTAMPTZ,
  signed_by_user_at TIMESTAMPTZ,
  signed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'signed', 'cancelled', 'terminated', 'completed')),
  cancelled_at TIMESTAMPTZ,
  terminated_at TIMESTAMPTZ,
  terminated_reason TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contracts_designer ON contracts(designer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_contracts_user ON contracts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contracts(status) WHERE status IN ('draft', 'signed');

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id UUID NOT NULL,
  designer_id UUID NOT NULL REFERENCES designers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  city_id UUID REFERENCES cities(id),
  current_milestone INT NOT NULL DEFAULT 0,
  progress INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'disputed')),
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- 补循环外键（如不存在）
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_projects_contract') THEN
    ALTER TABLE projects ADD CONSTRAINT fk_projects_contract
      FOREIGN KEY (contract_id) REFERENCES contracts(id) ON DELETE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_projects_designer ON projects(designer_id, status);
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id, status);
CREATE INDEX IF NOT EXISTS idx_projects_active ON projects(status) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  contract_id UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  node_index INT NOT NULL CHECK (node_index BETWEEN 0 AND 3),
  node_code TEXT NOT NULL CHECK (node_code IN ('measure', 'scheme', 'deepening', 'final')),
  node_name TEXT NOT NULL,
  weight INT NOT NULL DEFAULT 0,
  submitted_attachments JSONB NOT NULL DEFAULT '[]',
  submitted_note TEXT,
  designer_submitted_at TIMESTAMPTZ,
  user_confirmed_at TIMESTAMPTZ,
  user_rejected_at TIMESTAMPTZ,
  reject_reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'confirmed', 'rejected')),
  due_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, node_index)
);
CREATE INDEX IF NOT EXISTS idx_milestones_project ON milestones(project_id, node_index);
CREATE INDEX IF NOT EXISTS idx_milestones_pending ON milestones(project_id) WHERE status IN ('pending', 'in_review', 'rejected');

CREATE TABLE IF NOT EXISTS credit_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  designer_id UUID NOT NULL REFERENCES designers(id) ON DELETE CASCADE,
  delta INT NOT NULL,
  metric TEXT NOT NULL CHECK (metric IN ('completion', 'praise', 'dispute', 'response', 'skip_order', 'sign_contract')),
  reason TEXT NOT NULL,
  related_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  related_milestone_id UUID REFERENCES milestones(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_credit_designer ON credit_records(designer_id, created_at DESC);

-- conversations 绑定项目 + 状态（00007）
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE SET NULL;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'archived', 'bound'));

-- ════════════════════════════════════════
-- 六、五角色表（00009：如不存在则建）
-- ════════════════════════════════════════
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  logo_url TEXT,
  description TEXT,
  brand TEXT,
  category TEXT NOT NULL DEFAULT 'other',
  city_id UUID REFERENCES cities(id),
  contact_phone TEXT,
  qualification_urls TEXT[] NOT NULL DEFAULT '{}',
  is_verified BOOLEAN NOT NULL DEFAULT false,
  case_count INT NOT NULL DEFAULT 0,
  avg_rating DECIMAL(2,1) NOT NULL DEFAULT 0.0,
  review_count INT NOT NULL DEFAULT 0,
  delay_count INT NOT NULL DEFAULT 0,
  credit_score DECIMAL(5,2) NOT NULL DEFAULT 50.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_suppliers_user ON suppliers(user_id);

CREATE TABLE IF NOT EXISTS contractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  logo_url TEXT,
  description TEXT,
  city_id UUID REFERENCES cities(id),
  service_areas TEXT[] NOT NULL DEFAULT '{}',
  specialties TEXT[] NOT NULL DEFAULT '{}',
  contact_phone TEXT,
  qualification_urls TEXT[] NOT NULL DEFAULT '{}',
  is_verified BOOLEAN NOT NULL DEFAULT false,
  completed_projects INT NOT NULL DEFAULT 0,
  pass_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  rework_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  schedule_deviation DECIMAL(5,2),
  avg_rating DECIMAL(2,1) NOT NULL DEFAULT 0.0,
  review_count INT NOT NULL DEFAULT 0,
  dispute_count INT NOT NULL DEFAULT 0,
  credit_score DECIMAL(5,2) NOT NULL DEFAULT 50.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contractors_user ON contractors(user_id);

CREATE TABLE IF NOT EXISTS inspectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  logo_url TEXT,
  description TEXT,
  city_id UUID REFERENCES cities(id),
  service_areas TEXT[] NOT NULL DEFAULT '{}',
  contact_phone TEXT,
  qualification_urls TEXT[] NOT NULL DEFAULT '{}',
  is_verified BOOLEAN NOT NULL DEFAULT false,
  inspection_count INT NOT NULL DEFAULT 0,
  punctuality_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
  report_quality_score DECIMAL(3,2),
  issue_finding_rate DECIMAL(5,2),
  avg_rating DECIMAL(2,1) NOT NULL DEFAULT 0.0,
  review_count INT NOT NULL DEFAULT 0,
  credit_score DECIMAL(5,2) NOT NULL DEFAULT 50.00,
  is_mentor BOOLEAN NOT NULL DEFAULT false,
  mentor_id UUID REFERENCES inspectors(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inspectors_user ON inspectors(user_id);

-- 保证金（纯记录）
CREATE TABLE IF NOT EXISTS deposits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL CHECK (role IN ('supplier', 'contractor')),
  entity_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  category TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'received', 'used', 'refunded')),
  received_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  used_reason TEXT,
  refunded_at TIMESTAMPTZ,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_deposits_entity ON deposits(role, entity_id);

-- 监理派单
CREATE TABLE IF NOT EXISTS inspector_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  inspector_id UUID NOT NULL REFERENCES inspectors(id) ON DELETE CASCADE,
  assign_mode TEXT NOT NULL DEFAULT 'platform' CHECK (assign_mode IN ('platform', 'client')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  fee_per_sqm DECIMAL(8,2),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, inspector_id)
);
CREATE INDEX IF NOT EXISTS idx_assignments_inspector ON inspector_assignments(inspector_id, status);

-- 验收报告
CREATE TABLE IF NOT EXISTS inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  assignment_id UUID REFERENCES inspector_assignments(id) ON DELETE SET NULL,
  inspector_id UUID NOT NULL REFERENCES inspectors(id) ON DELETE CASCADE,
  milestone_node TEXT NOT NULL,
  photos TEXT[] NOT NULL DEFAULT '{}',
  checklist JSONB NOT NULL DEFAULT '[]',
  issues TEXT[] NOT NULL DEFAULT '{}',
  conclusion TEXT NOT NULL CHECK (conclusion IN ('pass', 'rework', 'reinspect')),
  rework_required TEXT,
  report_note TEXT,
  mentor_reviewed BOOLEAN NOT NULL DEFAULT true,
  mentor_review_note TEXT,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('draft', 'completed', 'reworked')),
  inspected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inspections_project ON inspections(project_id, inspected_at DESC);

-- 材料商案例关联
CREATE TABLE IF NOT EXISTS supplier_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  case_id UUID NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  product_info TEXT,
  product_photos TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'auto_approved')),
  designer_id UUID REFERENCES designers(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(supplier_id, case_id)
);
CREATE INDEX IF NOT EXISTS idx_supplier_cases_supplier ON supplier_cases(supplier_id, status);

-- 浏览历史（曾被遗漏）
CREATE TABLE IF NOT EXISTS browse_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('case', 'article')),
  target_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, target_type, target_id)
);

-- ════════════════════════════════════════
-- 七、入驻申请表 role 扩展（00009）
-- ════════════════════════════════════════
ALTER TABLE designer_applications DROP CONSTRAINT IF EXISTS designer_applications_type_check;
ALTER TABLE designer_applications ADD CONSTRAINT designer_applications_type_check
  CHECK (type IN ('designer', 'company', 'worker', 'supplier', 'inspector', 'contractor'));

-- ════════════════════════════════════════
-- 八、注册 trigger（最终修复版：search_path 限定）
-- ════════════════════════════════════════
-- 回填：为已存在 auth.users 但缺 public.users 行的用户补建
INSERT INTO users (id, email, nickname)
SELECT au.id, au.email, COALESCE(split_part(au.email, '@', 1), '用户')
FROM auth.users au
LEFT JOIN users u ON u.id = au.id
WHERE u.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- 修复历史 homeowner 数据
UPDATE users SET role = 'user' WHERE role = 'homeowner';

-- trigger 函数（最终修复版：显式 schema + search_path）
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, nickname, role, created_at)
  VALUES (NEW.id, NEW.email, COALESCE(split_part(NEW.email, '@', 1), '用户'), 'user', NEW.created_at)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ════════════════════════════════════════
-- 九、所有 SECURITY DEFINER 函数（DROP + CREATE，幂等）
-- 注意：必须先 DROP，因为现有函数可能带参数默认值，CREATE OR REPLACE 不允许去掉默认值
-- ════════════════════════════════════════
DROP FUNCTION IF EXISTS increment_user_points(UUID, INT, INT) CASCADE;
DROP FUNCTION IF EXISTS increment_vu_content(UUID) CASCADE;
DROP FUNCTION IF EXISTS increment_credit_score(UUID, INT) CASCADE;
DROP FUNCTION IF EXISTS increment_completed_projects(UUID) CASCADE;
DROP FUNCTION IF EXISTS increment_dispute_count(UUID) CASCADE;
DROP FUNCTION IF EXISTS increment_skip_order_count(UUID) CASCADE;
DROP FUNCTION IF EXISTS increment_supplier_credit(UUID, INT) CASCADE;
DROP FUNCTION IF EXISTS increment_contractor_credit(UUID, INT) CASCADE;
DROP FUNCTION IF EXISTS increment_inspector_credit(UUID, INT) CASCADE;
DROP FUNCTION IF EXISTS increment_contractor_completed(UUID) CASCADE;
DROP FUNCTION IF EXISTS increment_inspector_count(UUID) CASCADE;

CREATE FUNCTION increment_user_points(p_user_id UUID, p_points INT, p_total_invites INT)
RETURNS VOID AS $$
BEGIN
  INSERT INTO user_points (user_id, points, total_invites)
  VALUES (p_user_id, p_points, p_total_invites)
  ON CONFLICT (user_id) DO UPDATE SET
    points = user_points.points + p_points,
    total_invites = user_points.total_invites + p_total_invites;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE FUNCTION increment_vu_content(p_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE virtual_users SET content_count = content_count + 1 WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE FUNCTION increment_credit_score(p_designer_id UUID, p_delta INT)
RETURNS VOID AS $$
BEGIN
  UPDATE designers SET credit_score = LEAST(100, GREATEST(0, credit_score + p_delta)), credit_score_updated_at = now()
  WHERE id = p_designer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE FUNCTION increment_completed_projects(p_designer_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE designers SET completed_projects = completed_projects + 1 WHERE id = p_designer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE FUNCTION increment_dispute_count(p_designer_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE designers SET dispute_count = dispute_count + 1 WHERE id = p_designer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE FUNCTION increment_skip_order_count(p_designer_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE designers SET skip_order_count = skip_order_count + 1 WHERE id = p_designer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE FUNCTION increment_supplier_credit(p_id UUID, p_delta INT)
RETURNS VOID AS $$
BEGIN
  UPDATE suppliers SET credit_score = LEAST(100, GREATEST(0, credit_score + p_delta)) WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE FUNCTION increment_contractor_credit(p_id UUID, p_delta INT)
RETURNS VOID AS $$
BEGIN
  UPDATE contractors SET credit_score = LEAST(100, GREATEST(0, credit_score + p_delta)) WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE FUNCTION increment_inspector_credit(p_id UUID, p_delta INT)
RETURNS VOID AS $$
BEGIN
  UPDATE inspectors SET credit_score = LEAST(100, GREATEST(0, credit_score + p_delta)) WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE FUNCTION increment_contractor_completed(p_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE contractors SET completed_projects = completed_projects + 1 WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE FUNCTION increment_inspector_count(p_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE inspectors SET inspection_count = inspection_count + 1 WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ════════════════════════════════════════
-- 十、数据回填（幂等）
-- ════════════════════════════════════════
-- 案例封面回填
UPDATE cases SET cover_url = images[1]
WHERE cover_url IS NULL AND images IS NOT NULL AND images[1] IS NOT NULL;

-- AI 文章 author_id 回填
UPDATE articles SET author_id = vu.user_id
FROM virtual_users vu
WHERE articles.virtual_user_id = vu.id AND articles.author_id IS NULL AND vu.user_id IS NOT NULL;

-- AI 虚拟设计师补 designers 记录
INSERT INTO designers (user_id, type, name, description, is_verified, city_id)
SELECT vu.user_id, 'designer', vu.nickname, 'AI 虚拟设计师', true, NULL
FROM virtual_users vu
WHERE vu.role = 'designer' AND vu.user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM designers d WHERE d.user_id = vu.user_id)
ON CONFLICT DO NOTHING;
