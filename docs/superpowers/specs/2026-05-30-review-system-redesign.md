# 点评系统重构 — 设计文档

> 日期：2026-05-30
> 项目：设计圈 - 家居设计点评平台

## 一、问题

当前发布页 `/publish` 包含"写点评"入口，用户可以在没有接触过设计师的情况下随意点评，导致点评可信度低。

## 二、点评规则

| 触发条件 | 审核方式 | 前台显示 |
|----------|---------|---------|
| 1. 咨询过后点评 | AI 审核 | 通过后显示 |
| 2. 浏览案例后点评 | AI 审核 | 通过后显示 |
| 3. 真实交易后点评 | 人工审核（管理员） | 通过后显示 |
| 4. 无任何关联直接点评 | ❌ 不允许 | — |

## 三、入口调整

| 位置 | 改动 |
|------|------|
| 发布页 `/publish` | 去掉"写点评"入口 |
| 设计师详情页 | 底部加"写评价"按钮（检测用户是否有咨询记录或浏览记录） |
| 案例详情页 | 评论区上方加"我也要评价这个设计师"入口 |
| 用户消息页 `/messages` | 咨询过的设计师展示"写评价"按钮 |

## 四、AI 审核逻辑

### 审核流程
```
用户提交点评
    ↓
AI 审核（自动）
    ├── 通过 → 前台立即显示
    ├── 疑似 → 标记 pending → 管理员人工审核
    └── 拒绝 → 提示用户修改
```

### AI 检测要点
- 广告/垃圾内容检测
- 恶意攻击/辱骂检测
- 内容与设计师关联性检测（是否张冠李戴）
- 完成1咨询或浏览行为验证
- 自动通过正面合理评价
- 疑似内容加 `review_flags` 标记

## 五、数据库变更

```sql
-- reviews 表加审核相关字段
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
```

## 六、API 变动

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/reviews | 提交点评时自动带 `source` 字段（consult/browse/transaction）|
| GET | /api/reviews/check-access?designer_id=X | 检测当前用户是否有权限点评该设计师 |
| GET | /api/admin/reviews/pending | 待审核点评列表 |
| PUT | /api/admin/reviews/[id] | 审核通过/拒绝 |

## 七、Admin 审核面板

- `/admin/reviews` — 待审核点评列表
- 显示：点评内容、评分、来源、关联设计师
- 操作：通过 / 拒绝

## 八、实施计划

| Phase | 内容 |
|-------|------|
| Phase 1 | AI 审核 mock 实现（简单关键词检测 + 自动通过）|
| Phase 2 | 入口调整（发布页去掉点评 + 设计师/案例详情页加入口）|
| Phase 3 | Admin 审核面板 + 完整审核流程 |
