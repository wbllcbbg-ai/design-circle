-- 内容分析聚合快照表
-- 每天一次快照，记录各维度的内容产出和生态状况
CREATE TABLE IF NOT EXISTS content_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL UNIQUE,                -- 快照日期
  total_articles INT NOT NULL DEFAULT 0,
  total_cases INT NOT NULL DEFAULT 0,
  total_comments INT NOT NULL DEFAULT 0,
  total_questions INT NOT NULL DEFAULT 0,
  new_articles INT NOT NULL DEFAULT 0,               -- 当日新增
  new_cases INT NOT NULL DEFAULT 0,
  new_comments INT NOT NULL DEFAULT 0,
  new_questions INT NOT NULL DEFAULT 0,
  active_virtual_users INT NOT NULL DEFAULT 0,        -- 当日有产出的虚拟人数
  total_virtual_users INT NOT NULL DEFAULT 0,
  total_likes INT NOT NULL DEFAULT 0,
  total_dislikes INT NOT NULL DEFAULT 0,
  avg_view_count NUMERIC(10,2) NOT NULL DEFAULT 0,    -- 平均阅读量
  -- 时段分布：按小时存储各时段产出量（JSON 格式）
  hourly_distribution JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- 角色产出分布
  role_distribution JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_analytics_date ON content_analytics(snapshot_date DESC);
