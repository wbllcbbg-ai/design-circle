-- 修复注册断层 bug：users.role 默认值异常导致 trigger 建行失败
--
-- 问题根因：远程库 users.role 的 DEFAULT 在历史变更中变成了 'homeowner'，
--   而 00009 的 CHECK 枚举不含 'homeowner'，导致 00008 的 handle_new_user trigger
--   用默认值建 users 行时违反 CHECK 约束，整个注册流程 500。
--
-- 修复策略：
--   1. 把 DEFAULT 明确重置为 'user'（正常用户）
--   2. CHECK 枚举补上 'homeowner'（向后兼容历史数据 + ROLE_LABELS 里已有）
--   3. handle_new_user 显式插入 role='user'（不依赖默认值，双保险）

-- 1. 重建 CHECK 约束（补 homeowner）
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('user', 'admin', 'designer', 'company', 'worker', 'supplier', 'inspector', 'contractor', 'homeowner'));

-- 2. 重置默认值为 'user'（修复历史异常的 homeowner 默认值）
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'user';

-- 3. 强化 trigger：显式插入 role='user'，不依赖列默认值
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

-- 4. 修复历史数据：把 role='homeowner' 的记录统一为 'user'（业主）
UPDATE users SET role = 'user' WHERE role = 'homeowner';
