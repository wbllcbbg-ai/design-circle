-- 修复注册 500 的真正根因：trigger 的 search_path 歧义
--
-- 根因：handle_new_user 函数里写 INSERT INTO users（裸表名），
--   在 trigger 执行上下文中，search_path 包含 auth，导致 users 被解析成
--   auth.users（Supabase 内部认证表，没有 nickname 列）→ 报错
--   "column nickname of relation users does not exist"，整个注册事务回滚 → 500。
--
-- 修复：函数显式 schema 限定（public.users）+ SET search_path = public
--   这是 SECURITY DEFINER 函数的标准安全写法。

-- 1. 重建 trigger 函数：schema 限定 + 显式 search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, nickname, role, created_at)
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
$$;

-- 2. 重新挂载 trigger，确保用新函数
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. 顺带给其他 SECURITY DEFINER 函数加 search_path 保险（同样的歧义隐患）
--    虽然它们用 service_role 调用暂时没出问题，但加上更稳妥
ALTER FUNCTION public.increment_credit_score(UUID, INT) SET search_path = public;
ALTER FUNCTION public.increment_completed_projects(UUID) SET search_path = public;
ALTER FUNCTION public.increment_dispute_count(UUID) SET search_path = public;
ALTER FUNCTION public.increment_skip_order_count(UUID) SET search_path = public;
ALTER FUNCTION public.increment_supplier_credit(UUID, INT) SET search_path = public;
ALTER FUNCTION public.increment_contractor_credit(UUID, INT) SET search_path = public;
ALTER FUNCTION public.increment_inspector_credit(UUID, INT) SET search_path = public;
ALTER FUNCTION public.increment_contractor_completed(UUID) SET search_path = public;
ALTER FUNCTION public.increment_inspector_count(UUID) SET search_path = public;
