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

-- 索引
CREATE INDEX idx_cases_city_id ON cases(city_id);
CREATE INDEX idx_cases_style ON cases(style);
CREATE INDEX idx_cases_created_at ON cases(created_at DESC);
CREATE INDEX idx_designers_city_id ON designers(city_id);
CREATE INDEX idx_designers_type ON designers(type);
CREATE INDEX idx_designers_avg_rating ON designers(avg_rating DESC);
CREATE INDEX idx_reviews_designer_id ON reviews(designer_id);
CREATE INDEX idx_reviews_created_at ON reviews(created_at DESC);
CREATE INDEX idx_articles_category ON articles(category);
CREATE INDEX idx_articles_published_at ON articles(published_at DESC);
CREATE INDEX idx_articles_city_id ON articles(city_id);
