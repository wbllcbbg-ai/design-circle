-- 修复注册断层：新用户注册时自动在 users 表创建对应行
-- 问题：auth.users 与 public.users 是分离表，注册成功后 users 表无行，
--       导致 profile/role 判定/入驻/积分等全部异常。
-- 方案：用数据库 trigger 在 auth.users 插入时自动建 users 行（Supabase 标准做法）。

-- 1. 回填：为已存在于 auth.users 但缺 public.users 行的用户补建
-- （邮箱前缀作为初始昵称，避免 NOT NULL 约束失败）
INSERT INTO users (id, email, nickname)
SELECT au.id, au.email,
       COALESCE(split_part(au.email, '@', 1), '用户') AS nickname
FROM auth.users au
LEFT JOIN users u ON u.id = au.id
WHERE u.id IS NULL;

-- 2. trigger 函数：从 auth.users 复制 id/email，生成默认 nickname
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO users (id, email, nickname, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(split_part(NEW.email, '@', 1), '用户'),
    NEW.created_at
  )
  ON CONFLICT (id) DO NOTHING;  -- 幂等，防重复注册时报错
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. trigger：auth.users 插入后触发
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
