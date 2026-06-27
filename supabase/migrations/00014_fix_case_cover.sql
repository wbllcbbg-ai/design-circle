-- 回填案例封面（cover_url 为空时用 images[0] 兜底）
-- 问题：AI 生成的案例有 images 但 cover_url 为空，导致首页/列表无封面
-- 执行方式：Supabase Dashboard → SQL Editor → 粘贴 → Run

UPDATE cases
SET cover_url = images[1]  -- PG 数组从 1 开始
WHERE cover_url IS NULL
  AND images IS NOT NULL
  AND array_length(images, 1) > 0;
