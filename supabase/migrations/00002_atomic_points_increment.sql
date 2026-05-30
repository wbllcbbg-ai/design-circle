-- 原子积分增量函数
-- 修复 user_points 使用 upsert 直接覆盖值而非累加的 bug

CREATE OR REPLACE FUNCTION increment_user_points(
  p_user_id UUID,
  p_points INT,
  p_total_invites INT DEFAULT 0
) RETURNS VOID AS $$
BEGIN
  INSERT INTO user_points (user_id, points, total_earned, total_invites)
  VALUES (p_user_id, p_points, p_points, p_total_invites)
  ON CONFLICT (user_id) DO UPDATE SET
    points = user_points.points + p_points,
    total_earned = user_points.total_earned + p_points,
    total_invites = user_points.total_invites + p_total_invites,
    updated_at = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
