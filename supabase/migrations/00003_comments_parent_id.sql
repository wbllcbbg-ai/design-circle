-- 为 comments 表添加 parent_id 列（支持回复/楼中楼功能）
ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);
