-- 修复注册 500 真正根因：trigger 的 search_path 歧义
-- 执行方式：Supabase Dashboard → SQL Editor → 粘贴全文 → Run

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

-- 2. 重新挂载 trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. 给其他 SECURITY DEFINER 函数加 search_path 保险
ALTER FUNCTION public.increment_credit_score(UUID, INT) SET search_path = public;
ALTER FUNCTION public.increment_completed_projects(UUID) SET search_path = public;
ALTER FUNCTION public.increment_dispute_count(UUID) SET search_path = public;
ALTER FUNCTION public.increment_skip_order_count(UUID) SET search_path = public;
ALTER FUNCTION public.increment_supplier_credit(UUID, INT) SET search_path = public;
ALTER FUNCTION public.increment_contractor_credit(UUID, INT) SET search_path = public;
ALTER FUNCTION public.increment_inspector_credit(UUID, INT) SET search_path = public;
ALTER FUNCTION public.increment_contractor_completed(UUID) SET search_path = public;
ALTER FUNCTION public.increment_inspector_count(UUID) SET search_path = public;
