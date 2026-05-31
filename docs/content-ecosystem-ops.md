# 🏞️ 内容生态运营系统 (Content Ecosystem Ops)

设计圈后台管理的核心运营模块，旨在通过 **一次配置、自动运营、只看异常** 的方式，降低内容运营的人工成本，维持平台的社区真实感。

---

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                     前端 SPA (Next.js)                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐       │
│  │ 生态概览  │ │ 运营策略  │ │ 内容库    │ │ 虚拟人    │       │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘       │
│       │            │            │            │              │
│       ▼            ▼            ▼            ▼              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Next.js API Routes (src/app/api/)         │   │
│  └──────────────────┬───────────────────────────────────┘   │
│                     │                                       │
├─────────────────────┼───────────────────────────────────────┤
│                     ▼                                       │
│           ┌──────────────────┐                              │
│           │    Supabase      │                              │
│           │  (PostgreSQL)    │                              │
│           └──────────────────┘                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 7 个管理 Tab

| # | Tab | 路径 | 核心功能 |
|---|-----|------|---------|
| 1 | 🏞️ **生态概览** | `/admin/eco` | 告警分级 + 发布时间线 + 内容配比 + 虚拟人活跃 + 执行记录 |
| 2 | 📰 **内容库** | `/admin` | 内容列表(搜索/筛选/分页) + 编辑弹窗(版本diff) + 批量生成 |
| 3 | 👥 **入驻审核** | `/admin/applications` | 设计师/公司/工长入驻审核 |
| 4 | ⭐ **点评审核** | `/admin/reviews` | 用户评价审核(筛选/通过/拒绝) |
| 5 | 👤 **虚拟人** | `/admin/virtual-users` | 人设管理 + 内容画像自动分析 + 互动图谱 |
| 6 | ⚙️ **运营策略** | `/admin/strategy` | 策略参数配置 + 立即执行 + 执行日志 |
| 7 | 🏆 **奖励规则** | `/admin/rewards` | 积分规则 CRUD |
| 8 | 🤖 **AI 配置** | `/admin/ai-config` | API Key 管理 |

---

## 核心组件

### 生态概览

运营者的日常工作台，一眼看清平台生态状况。

- **🔴 阻塞告警** — AI 连续失败、发布队列拥堵、数据库错误，需立即处理
- **🟡 关注告警** — 内容配比偏差、虚拟人活跃度下降，可择时处理
- **发布时间线** — 未来 24 小时内容排期可视化，密集时段自动告警
- **内容配比** — 各类内容当前占比 vs 目标占比，偏差可视化
- **虚拟人活跃动态** — 每位虚拟人的活跃状态（🔥活跃 / ⚠️预警 / 💤闲置）
- **告警静音** — `[静音48h]` 免打扰 + `[↻ 恢复所有]`
- **阻塞重试** — `[重试]` 一键重新执行失败批次

### 运营策略

自动运营的配置中心，一次配好系统自动执行。

| 区块 | 参数 |
|------|------|
| 每日产量 | 文章/案例/评论/提问 每日生成量 |
| 发布节奏 | 发布时段、单时段上限、同人间隔、禁止时段 |
| 生态平衡 | 各类内容目标占比、偏差容忍度 |
| 互动设置 | 点赞(高频随机)、评论(延迟范围)、回复率(低频)、延迟模式(仿真作息)、熟人圈比例、🦾UGC反向调节阈值、👥真实用户互动概率 |
| 虚拟人管理 | 活跃阈值、自动补充下限、🌀生命周期(活跃期/平稳期/退场条件) |
| 定时调度 | 启用开关、执行时间、时区 |

### 内容库

所有内容的统一管理入口。

- **搜索 + 筛选** — 按标题、类型(文章/案例)、来源(🗲纯AI/✏️改过/👤手动) 筛选
- **来源标记** — 每行显示 `🗲纯AI生成` / `✏️人工修改过` / `👤手动创建`
- **编辑弹窗** — 标题/正文编辑 + 版本 diff（AI 原始版 vs 当前版）
- **风格参考** — ☑️ 将此修改作为该虚拟人后续生成的参考
- **分页** — 代码层合并排序截取（避免两表各自 LIMIT 错位）
- **批量生成** — AI 一键 / 手动创建 / 批量生成

### 虚拟人

虚拟人设管理与内容运营数据。

- **人设编辑** — 昵称、角色、城市、语气风格、发言频率、专长
- **内容画像** — 自动分析已发布内容提取擅长话题(词频)、内容风格推断
- **互动图谱** — 该虚拟人的历史互动对象和频次
- **DELETE 保护** — `content_count > 0` 时禁止硬删除，只能禁用

---

## API 清单

所有 API 统一通过 `requireAdmin()` 鉴权。

| 分组 | 端点 | 方法 | 说明 |
|------|------|------|------|
| **生态概览** | `/api/admin/eco/overview` | GET | 聚合数据(告警/配比/活跃/日志) |
| **告警** | `/api/admin/eco/alerts` | POST | 静音告警(48h) |
| | `/api/admin/eco/alerts` | PUT | 恢复所有静音 |
| **策略** | `/api/admin/eco/strategy` | GET/PUT | 配置读写 |
| | `/api/admin/eco/strategy/run` | POST | 立即执行(同步) |
| **日志** | `/api/admin/eco/strategy/logs` | GET | 执行日志列表 |
| **内容库** | `/api/admin/content` | GET | 列表+筛选+分页 |
| | `/api/admin/content/:id` | GET/PUT | 详情+编辑(含diff回传) |
| | `/api/admin/content/:id?view=diff` | GET | 版本 diff |
| **虚拟人画像** | `/api/admin/virtual-users/:id/profile` | GET/PUT | 自动分析+确认保存 |
| **排期** | `/api/admin/scheduled` | GET | 未来24h排期查询 |
| | `/api/admin/scheduled` | PUT | 调整发布时间 |
| | `/api/admin/scheduled/auto-spread` | POST | 自动分散密集排期 |
| **发布** | `/api/cron/publish` | GET | 定时发布任务(CRON_SECRET 鉴权) |
| **虚拟人CRUD** | `/api/admin/virtual-users` | GET/POST | 列表+生成 |
| | `/api/admin/virtual-users/:id` | GET/PUT/DELETE | 详情+编辑+保护性删除 |
| | `/api/admin/virtual-users/batch` | POST | 批量操作(保护性删除) |
| **旧路由** | `/api/generate` | POST/PUT | 一键生成/手动创建(已加鉴权) |

---

## 数据库表

### 已有表（系统依赖）

| 表 | 用途 | 关键字段 |
|----|------|---------|
| `users` | 用户（含虚拟人映射） | `id, email, nickname, role, avatar_url` |
| `virtual_users` | 虚拟人池 | `id, user_id, nickname, role, content_count, is_active, content_profile` |
| `articles` | 文章内容 | `id, title, content, cover_url, is_published, virtual_user_id, ai_generated_content, edited_by_human` |
| `cases` | 案例内容 | `id, title, description, images, is_published, virtual_user_id, ai_generated_content, edited_by_human` |
| `designers` | 设计师记录 | `id, user_id, type, name, is_verified` |
| `designer_applications` | 入驻申请 | `id, user_id, type, name, status` |
| `reviews` | 评价 | `id, user_id, designer_id, rating, content, review_status` |
| `reward_rules` | 奖励规则 | `id, name, trigger_event, inviter_points, invitee_points, is_active` |

### 新增表（策略引擎）

| 表 | 用途 | 关键字段 |
|----|------|---------|
| `auto_operate_config` | 策略参数配置(分块JSONB) | `key(PK), value(JSONB), updated_at` |
| `auto_operate_state` | 运行时状态(与配置隔离) | `key(PK), value(JSONB), updated_at` |
| `auto_operate_logs` | 执行日志 | `id, status, summary(JSONB), started_at, completed_at` |
| `scheduled_posts` | 发布排期 | `id, target_type, target_id, virtual_user_id, display_*, publish_at, is_published` |

---

## 增强特性

### 🎲 指纹散射

在 `ai-generator.ts` 中实现的风格偏移机制。每个虚拟人基于其 `id` 的 hash 值映射到一个固定的风格偏移点，确保同一虚拟人的内容始终落在其风格区间内的同一点，而不同虚拟人的内容落在不同的点。

```
20% 完全一致 → 30% 轻微偏移 → 25% 中度偏移 → 15% 较强偏移 → 10% 混入相邻风格
```

### 🌀 虚拟人生命周期

策略引擎中配置的参数，让虚拟人的活跃度自然衰减：
- **活跃期** → 每天 5-7 条
- **平稳期** → 每周 1-3 条
- **退场** → 连续 90/180 天不活跃后自动静默

### ⚖️ UGC 反向调节

当真实用户在某内容品类的占比超过阈值时，策略引擎自动降低该品类的 AI 产出，让 AI 内容从主力退成补充。

### 👥 真实用户互动

低概率（默认 5%）触发虚拟人对真实用户内容的随机互动，形成真实的对话链。

---

## 功能路线图

| 期 | 内容 | 状态 |
|----|------|------|
| P0 | 告警分级 + 来源标记 + 内容库改造 | ✅ |
| P1 | 策略引擎 + 执行日志 + 发布排期 + 4 张新表 | ✅ |
| P2 | 发布时间线 + 版本diff + 生态概览API | ✅ |
| P3 | 虚拟人画像自动分析 + 互动图谱 + 指纹散射 | ✅ |
| P4 | 4条真实感机制(生命周期/UGC调节/指纹散射/真实互动) | ✅ |
| 补丁 | 修复 27 个小问题 | ✅ |

---

## 已知问题

- `comments` 表和 `questions` 表尚未创建（策略引擎的评论/提问生成跳过）
- `/api/generate` 读环境变量 API Key 而非 `ai_config` 表（已加鉴权）
- 内容配比仅统计文章和案例（评论/提问表不存在）
- 策略引擎同步执行（120s 超时风险，异步改造待做）
