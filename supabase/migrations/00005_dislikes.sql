-- 踩（dislike）表，与 likes 对称
-- 用于用户对文章/案例/评论表示"不喜欢"
CREATE TABLE IF NOT EXISTS dislikes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('article', 'case', 'comment')),
  target_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_dislikes_target ON dislikes(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_dislikes_user ON dislikes(user_id);
