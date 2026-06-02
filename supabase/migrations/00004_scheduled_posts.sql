-- 定时排期任务表
-- 运营策略生成的内容先写入此表，设定发布时间
-- 生成时直接 is_published=true（Vercel Hobby 单 cron 限制）
-- publish_at 作为元数据保留，将来升级 Pro 后由 cron/publish 恢复分散排期

CREATE TABLE scheduled_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL CHECK (target_type IN ('article', 'case', 'comment', 'question')),
  target_id UUID,                                  -- 关联到 articles/cases 等表的 ID（发布后回填）
  virtual_user_id UUID REFERENCES virtual_users(id) ON DELETE SET NULL,
  target_title TEXT,                                -- 内容标题，前端展示用
  display_title TEXT,                               -- 展示用标题（可能与 target_title 不同）
  display_virtual_user_name TEXT,                   -- 展示用虚拟人名称
  publish_at TIMESTAMPTZ NOT NULL,                  -- 计划发布时间
  is_published BOOLEAN NOT NULL DEFAULT false,      -- 是否已发布
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 索引：按发布状态 + 发布时间查询
CREATE INDEX idx_scheduled_posts_pending
  ON scheduled_posts (publish_at)
  WHERE is_published = false;

-- 索引：按目标类型查询
CREATE INDEX idx_scheduled_posts_target_type
  ON scheduled_posts (target_type)
  WHERE is_published = false;

-- 虚拟人内容计数递增函数
CREATE OR REPLACE FUNCTION increment_vu_content(p_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE virtual_users
  SET content_count = content_count + 1,
      last_active_at = now()
  WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 虚拟人内容画像（AI 分析结果 + 人工确认）
-- 格式：{ topics: string[], style: string, interactions: { nickname: string, count: number }[] }
ALTER TABLE virtual_users ADD COLUMN IF NOT EXISTS content_profile JSONB DEFAULT '{}'::jsonb;

-- 虚拟人生命周期阶段
-- new = 刚创建，尚未产出内容
-- active = 活跃期，按正常频率产出
-- steady = 平稳期，减少产出频率
-- retired = 退场，不再产出但保留历史内容
ALTER TABLE virtual_users ADD COLUMN IF NOT EXISTS lifecycle_stage TEXT NOT NULL DEFAULT 'active'
  CHECK (lifecycle_stage IN ('new', 'active', 'steady', 'retired'));
