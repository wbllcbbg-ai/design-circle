-- 修复注册断层 bug：users.role 默认值异常导致注册 500
-- 执行方式：Supabase Dashboard → SQL Editor → 粘贴全文 → Run

-- 1. 重建 CHECK 约束（补 homeowner，向后兼容）
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('user', 'admin', 'designer', 'company', 'worker', 'supplier', 'inspector', 'contractor', 'homeowner'));

-- 2. 重置默认值为 'user'
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'user';

-- 3. 强化 trigger：显式插入 role='user'
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO users (id, email, nickname, role, created_at)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(split_part(NEW.email, '@', 1), '用户'),
    'user',
    NEW.created_at
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. 修复历史数据
UPDATE users SET role = 'user' WHERE role = 'homeowner';
