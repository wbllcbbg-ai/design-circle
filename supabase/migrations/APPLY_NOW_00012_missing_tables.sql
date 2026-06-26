-- 补建远程库缺失的表（历史 schema 漂移修复）
-- 远程库当初部署 00001 时部分表未建，导致功能 500
-- 执行方式：Supabase Dashboard → SQL Editor → 粘贴 → Run

-- 1. browse_history 浏览历史（缺失）
CREATE TABLE IF NOT EXISTS browse_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('case', 'article')),
  target_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, target_type, target_id)
);

-- 2. questions 提问表（确认存在，缺失则建）
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT '设计',
  virtual_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_questions_user ON questions(user_id, created_at DESC);
