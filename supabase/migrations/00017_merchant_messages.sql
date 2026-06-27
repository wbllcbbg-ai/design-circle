-- 业主给商家的留言（轻量咨询闭环，不碰 conversations 表）
-- 解决：材料商/施工方/监理可被业主咨询，商家在工作台看到留言
-- 执行方式：Supabase Dashboard → SQL Editor → 粘贴 → Run

CREATE TABLE IF NOT EXISTS merchant_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 商家身份（多态）
  merchant_type TEXT NOT NULL CHECK (merchant_type IN ('supplier', 'contractor', 'inspector')),
  merchant_id UUID NOT NULL,           -- suppliers/contractors/inspectors 的 id
  merchant_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- 商家背后的用户（收件人）
  -- 业主
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- 内容
  content TEXT NOT NULL,
  contact_info TEXT,                    -- 业主可选留下的联系方式
  -- 状态
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'read', 'replied')),
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merchant_messages_merchant ON merchant_messages(merchant_type, merchant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_merchant_messages_user ON merchant_messages(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_merchant_messages_pending ON merchant_messages(merchant_user_id) WHERE status = 'pending';
