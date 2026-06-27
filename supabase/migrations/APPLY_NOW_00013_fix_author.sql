-- 补建 articles.author_id 列（数据完整性修复）
-- 问题：articles.author_id 在 migration 里从未建立，代码写入时静默忽略，
--       导致虚拟设计师详情页查不到文章（数据关联断裂）
-- 执行方式：Supabase Dashboard → SQL Editor → 粘贴 → Run

-- 1. 补建 author_id 列（关联 users 表，可空）
ALTER TABLE articles ADD COLUMN IF NOT EXISTS author_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- 2. 建索引（详情页按 author_id 查文章）
CREATE INDEX IF NOT EXISTS idx_articles_author ON articles(author_id) WHERE is_published = true;

-- 3. 回填：为已存在的 AI 文章补 author_id
-- AI 文章是虚拟人写的，通过 virtual_user_id 关联到 virtual_users，再关联到 users
UPDATE articles
SET author_id = vu.user_id
FROM virtual_users vu
WHERE articles.virtual_user_id = vu.id
  AND articles.author_id IS NULL
  AND vu.user_id IS NOT NULL;

-- 4. 确保 AI 虚拟设计师都有对应的 designers 记录（详情页案例需要 designer_id）
-- 对是 designer 角色、有 user_id、但缺 designers 记录的虚拟人补建
INSERT INTO designers (user_id, type, name, description, is_verified, city_id)
SELECT vu.user_id, 'designer', vu.nickname, 'AI 虚拟设计师', true, NULL
FROM virtual_users vu
WHERE vu.role = 'designer'
  AND vu.user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM designers d WHERE d.user_id = vu.user_id)
ON CONFLICT DO NOTHING;
