-- 设计圈 数据库初始模型

-- 城市
CREATE TABLE cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 用户
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  nickname TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  avatar_url TEXT,
  phone TEXT,
  is_real_name_verified BOOLEAN NOT NULL DEFAULT false,
  city_id UUID REFERENCES cities(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 设计师/装修公司/工长 (商户)
CREATE TABLE designers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('designer', 'company', 'worker')),
  name TEXT NOT NULL,
  logo_url TEXT,
  description TEXT,
  city_id UUID REFERENCES cities(id),
  service_areas TEXT[] NOT NULL DEFAULT '{}',
  specialties TEXT[] NOT NULL DEFAULT '{}',
  years_experience INT,
  contact_phone TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  avg_rating DECIMAL(2,1) NOT NULL DEFAULT 0.0,
  review_count INT NOT NULL DEFAULT 0,
  case_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 案例
CREATE TABLE cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  designer_id UUID NOT NULL REFERENCES designers(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  cover_url TEXT NOT NULL,
  images TEXT[] NOT NULL DEFAULT '{}',
  style TEXT NOT NULL DEFAULT '',
  area DECIMAL(7,2),
  budget DECIMAL(10,2),
  duration TEXT,
  city_id UUID REFERENCES cities(id),
  is_published BOOLEAN NOT NULL DEFAULT false,
  view_count INT NOT NULL DEFAULT 0,
  like_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 点评
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  designer_id UUID NOT NULL REFERENCES designers(id) ON DELETE CASCADE,
  case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  design_score INT CHECK (design_score BETWEEN 1 AND 5),
  construction_score INT CHECK (construction_score BETWEEN 1 AND 5),
  service_score INT CHECK (service_score BETWEEN 1 AND 5),
  content TEXT NOT NULL,
  images TEXT[] NOT NULL DEFAULT '{}',
  is_real_name BOOLEAN NOT NULL DEFAULT false,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  follow_up TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 文章 (AI PGC)
CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  summary TEXT,
  cover_url TEXT,
  content TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  category TEXT NOT NULL DEFAULT '',
  city_id UUID REFERENCES cities(id),
  is_published BOOLEAN NOT NULL DEFAULT false,
  view_count INT NOT NULL DEFAULT 0,
  like_count INT NOT NULL DEFAULT 0,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 设计师入驻申请
CREATE TABLE designer_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('designer', 'company', 'worker')),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  description TEXT,
  specialties TEXT[] NOT NULL DEFAULT '{}',
  city_id UUID REFERENCES cities(id),
  credentials TEXT[] NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 点赞
CREATE TABLE likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('case', 'article')),
  target_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, target_type, target_id)
);

-- 收藏
CREATE TABLE favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('case', 'article', 'designer')),
  target_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, target_type, target_id)
);

-- 索引
CREATE INDEX idx_cases_city_id ON cases(city_id);
CREATE INDEX idx_cases_style ON cases(style);
CREATE INDEX idx_cases_created_at ON cases(created_at DESC);

-- 消息/对话表
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  designer_id UUID NOT NULL REFERENCES designers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  case_id UUID REFERENCES cases(id) ON DELETE SET NULL,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(designer_id, user_id)
);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 浏览历史
CREATE TABLE browse_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('case', 'article')),
  target_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, target_type, target_id)
);

-- 通知
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('like', 'comment', 'review')),
  actor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_type TEXT NOT NULL CHECK (target_type IN ('case', 'article', 'designer')),
  target_id UUID NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_id ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX idx_designers_city_id ON designers(city_id);

-- 邀请关系
CREATE TABLE invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id UUID NOT NULL REFERENCES users(id),
  invitee_id UUID REFERENCES users(id),
  code TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'link',
  source_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'registered', 'completed', 'rewarded')),
  registered_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  rewarded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invites_inviter ON invites(inviter_id);
CREATE INDEX idx_invites_invitee ON invites(invitee_id);
CREATE UNIQUE INDEX idx_invites_code ON invites(code);

-- 奖励规则
CREATE TABLE reward_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  trigger_event TEXT NOT NULL DEFAULT 'register',
  inviter_points INT NOT NULL DEFAULT 0,
  invitee_points INT NOT NULL DEFAULT 0,
  inviter_reward_desc TEXT,
  invitee_reward_desc TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 用户积分
CREATE TABLE user_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  points INT NOT NULL DEFAULT 0,
  total_earned INT NOT NULL DEFAULT 0,
  total_invites INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_user_points_user ON user_points(user_id);

-- 积分变动记录
CREATE TABLE point_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  amount INT NOT NULL,
  reason TEXT NOT NULL,
  related_invite_id UUID REFERENCES invites(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_point_records_user ON point_records(user_id, created_at DESC);

-- 点评审核字段
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'pending'
  CHECK (review_status IN ('pending', 'approved', 'rejected', 'flagged'));
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS review_source TEXT
  CHECK (review_source IN ('consult', 'browse', 'transaction'));
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS ai_confidence DECIMAL(3,2);

-- 审核标记表
CREATE TABLE IF NOT EXISTS review_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  flag_type TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_designers_type ON designers(type);
CREATE INDEX idx_designers_avg_rating ON designers(avg_rating DESC);
CREATE INDEX idx_reviews_designer_id ON reviews(designer_id);
CREATE INDEX idx_reviews_created_at ON reviews(created_at DESC);
CREATE INDEX idx_articles_category ON articles(category);

-- 虚拟用户池
CREATE TABLE virtual_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  role TEXT NOT NULL CHECK (role IN ('owner', 'designer', 'worker', 'company')),
  city TEXT NOT NULL DEFAULT '重庆',
  age_group TEXT CHECK (age_group IN ('25-35', '35-45', '45+')),
  decoration_stage TEXT CHECK (decoration_stage IN ('not_started', 'ongoing', 'completed')),
  active_periods TEXT[] NOT NULL DEFAULT '{"晚上","周末"}',
  interest_tags TEXT[] NOT NULL DEFAULT '{}',
  tone_style TEXT NOT NULL DEFAULT 'casual' CHECK (tone_style IN ('professional', 'casual', 'enthusiastic', 'concise')),
  speak_frequency TEXT NOT NULL DEFAULT 'normal' CHECK (speak_frequency IN ('active', 'normal', 'occasional')),
  specialty TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  content_count INT NOT NULL DEFAULT 0,
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_virtual_users_role ON virtual_users(role);
CREATE INDEX idx_virtual_users_is_active ON virtual_users(is_active);

-- 为内容表加 virtual_user_id 字段
ALTER TABLE articles ADD COLUMN IF NOT EXISTS virtual_user_id UUID REFERENCES virtual_users(id);
ALTER TABLE cases ADD COLUMN IF NOT EXISTS virtual_user_id UUID REFERENCES virtual_users(id);
ALTER TABLE comments ADD COLUMN IF NOT EXISTS virtual_user_id UUID REFERENCES virtual_users(id);
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS virtual_user_id UUID REFERENCES virtual_users(id);
CREATE INDEX idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX idx_articles_city_id ON articles(city_id);
