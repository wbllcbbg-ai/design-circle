-- 评论表
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

CREATE INDEX idx_comments_target ON comments(target_type, target_id);
CREATE INDEX idx_comments_virtual_user ON comments(virtual_user_id);
CREATE INDEX idx_comments_created_at ON comments(created_at DESC);

-- 提问表
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

CREATE INDEX idx_questions_category ON questions(category);
CREATE INDEX idx_questions_virtual_user ON questions(virtual_user_id);
CREATE INDEX idx_questions_created_at ON questions(created_at DESC);
