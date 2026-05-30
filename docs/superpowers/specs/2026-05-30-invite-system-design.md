# 全民裂变邀请系统 — 设计文档

> 日期：2026-05-30
> 项目：设计圈 - 家居设计点评平台

## 一、概述

全民裂变邀请系统，让所有用户（设计师、业主、业务员、普通用户）都能通过邀请链接/二维码/邀请码推广平台，邀请新用户注册并完成指定行为，邀请方和被邀请方均可获得奖励。

## 二、核心流程

```
用户进入邀请页面
      ↓
系统自动生成邀请码（可自定义修改）
      ↓
选择分享方式：链接 / 二维码 / 邀请码
      ↓
分享到微信/朋友圈/社群/线下
      ↓
新用户点击链接 或 注册时输入邀请码
      ↓
完成注册 → 系统绑定邀请关系
      ↓
后台判定是否满足奖励条件（默认：完成注册即可）
      ↓
邀请方获得积分 + 被邀请方获得奖励
```

## 三、邀请码规则

- 系统自动生成 6 位字母数字混合码（如 `A3K7P9`）
- 用户可在邀请设置页面自定义修改邀请码（需校验唯一性）
- 邀请码创建后不可删除，修改后旧码仍可访问（301 跳转到新码）

### 邀请介质

| 方式 | 实现 | 使用场景 |
|------|------|---------|
| 专属链接 | `t.cn/invite/{code}` → 自动绑定 | 微信聊天、朋友圈 |
| 二维码 | 链接转二维码 PNG 可下载 | 线下传单、海报、名片 |
| 邀请码 | 注册时在表单底部输入 | 线下见面、电话推荐、纸质宣传 |
| 分享携带 | 分享案例/文章时，URL 自动附带 `?ref={code}` | 内容分享 |

### 绑定逻辑

- **链接方式**：用户点击链接时，`?ref={inviteCode}` 参数存入 localStorage/cookie，注册时自动绑定
- **邀请码方式**：注册表单底部显示「有邀请码？」输入框，用户手动输入后绑定
- **绑定时机**：用户完成注册（email 验证通过）时写入 `invites` 表
- **互斥规则**：一个用户只能被一个邀请码绑定（先到先得）
- **自邀禁止**：不能用自己的邀请码注册自己

## 四、数据库设计

```sql
-- 邀请关系表
CREATE TABLE invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id UUID NOT NULL REFERENCES users(id),
  invitee_id UUID REFERENCES users(id),      -- 注册后绑定
  code TEXT NOT NULL,                          -- 实际使用的邀请码
  channel TEXT NOT NULL DEFAULT 'link',        -- 渠道: link | qrcode | code | share
  source_url TEXT,                             -- 来源页面（分享时记录）
  status TEXT NOT NULL DEFAULT 'pending',      -- pending | registered | completed | rewarded
  registered_at TIMESTAMPTZ,                   -- 注册时间
  completed_at TIMESTAMPTZ,                    -- 达成奖励条件时间
  rewarded_at TIMESTAMPTZ,                     -- 奖励发放时间
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_invites_inviter ON invites(inviter_id);
CREATE INDEX idx_invites_invitee ON invites(invitee_id);
CREATE UNIQUE INDEX idx_invites_code ON invites(code);

-- 奖励规则表（Admin 后台配置）
CREATE TABLE reward_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,                           -- 规则名称（如"注册奖励"）
  trigger_event TEXT NOT NULL DEFAULT 'register', -- register | browse | consult | any
  inviter_points INT NOT NULL DEFAULT 0,         -- 邀请方获得积分
  invitee_points INT NOT NULL DEFAULT 0,         -- 被邀请方获得积分
  inviter_reward_desc TEXT,                      -- 邀请方奖励描述（如"50元红包"）
  invitee_reward_desc TEXT,                      -- 被邀请方奖励描述（如"20元券"）
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 用户积分表
CREATE TABLE user_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  points INT NOT NULL DEFAULT 0,
  total_earned INT NOT NULL DEFAULT 0,
  total_invites INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_user_points_user ON user_points(user_id);
```

## 五、API 设计

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/invite/code | 获取/创建我的邀请码 |
| PUT | /api/invite/code | 修改邀请码 |
| GET | /api/invite/links | 获取我的分享链接和二维码 |
| POST | /api/invite/bind | 注册时绑定邀请码 |
| GET | /api/invite/stats | 邀请统计（总邀请、已完成、待完成） |
| GET | /api/invite/list | 邀请明细列表 |
| GET | /api/invite/rewards | 奖励记录 |
| GET | /api/invite/check?code=xxx | 检查邀请码是否可用（注册页输入时实时校验） |
| GET | /api/points | 我的积分 |
| GET | /api/admin/reward-rules | 奖励规则列表 |
| POST | /api/admin/reward-rules | 创建/修改奖励规则 |

## 六、前端页面

### 1. 邀请页面 `/invite`

- 顶部：邀请码展示（可复制） + 自定义修改按钮
- 分享方式 Tab：链接 / 二维码 / 邀请码
  - 链接：显示可复制链接 + 一键复制按钮
  - 二维码：显示二维码图片 + 下载按钮
  - 邀请码：显示邀请码大字 + 复制按钮
- 邀请统计：总邀请人数、已完成人数、累计积分
- 邀请明细列表：被邀请人、状态、时间

### 2. 注册页邀请码输入（修改 `/login`）

- 注册表单底部加「有邀请码？」折叠输入框
- 输入后实时校验（`GET /api/invite/check?code=xxx`）
- 有效 → 显示邀请人昵称（"你被 {昵称} 邀请"）
- 无效 → 提示"邀请码不存在"

### 3. Profile 入口（修改 `/profile`）

- 新增「📢 邀请好友」菜单项 → `/invite`
- 显示未读邀请通知数（如有）

### 4. 设计师工作台入口（修改 `/dashboard`）

- 新增「邀请客户」模块卡片
- 显示：邀请链接、邀请人数、积分

### 5. 文章/案例分享（修改详情页）

- 文章/案例详情页底部加分享按钮
- 分享 URL 自动带 `?ref={我的邀请码}`

### 6. Admin 奖励规则配置 `/admin/rewards`

- 规则列表：显示所有规则及启用状态
- 新增/编辑：名称、触发事件、邀请方积分、被邀请方积分、描述
- 启用/禁用开关

### 7. 积分页面 `/points`

- 积分余额、累计获得、邀请贡献
- 积分记录列表（来自邀请、消费等）

## 七、状态机

```
      邀请链接被点击
          ↓
    pending（等待注册）
          ↓
     用户完成注册
          ↓
    registered（已注册）
          ↓
     满足奖励条件（默认：注册即满足）
          ↓
    completed（已达成）
          ↓
     发放奖励
          ↓
    rewarded（已奖励）
```

## 八、安全与防刷

- 同一 IP 注册多个账号关联同一邀请码 → 触发风控标记
- 邀请码有效期：永久有效
- 被邀请人注册 7 天内未完成行为 → 邀请仍记为 registered，不自动升级
- 后台可手动调整邀请状态

## 九、实施计划

| Phase | 内容 | 工作量 |
|-------|------|--------|
| Phase 1 | 数据库 migration + 邀请码生成/校验 API + /invite 页面 + 注册页邀请码输入 + Profile 入口 | 核心 |
| Phase 2 | 案例/文章分享携带 + 设计师工作台入口 + 二维码生成 | 扩展 |
| Phase 3 | Admin 奖励规则 + 积分系统 + 提现/兑换 | 进阶 |
