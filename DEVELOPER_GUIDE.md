# 设计圈 — 开发者指南

> 家居设计点评平台，一个面向业主和设计师的装修社区。
> 最后更新：2026-05-31

---

## 一、项目概况

### 技术栈

- **框架：** Next.js 16.2.6（App Router）+ React 19 + TypeScript
- **数据库：** Supabase（PostgreSQL + Auth + Storage）
- **样式：** Tailwind CSS
- **部署：** Vercel（已配置）
- **AI 服务：** DeepSeek API（内容生成）、Unsplash API（配图）

### 启动方式

```bash
npm install
npm run dev -- --webpack    # 本地开发（因 @next/swc-darwin-arm64 签名问题，需用 webpack 代替 turbopack）
npm run build -- --webpack  # 生产构建
```

### 环境变量

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx

# AI 服务（也可在后台管理 → AI 配置中设置，存数据库运行时生效）
AI_BASE_URL=https://api.deepseek.com/v1
AI_MODEL=deepseek-chat
AI_API_KEY=sk-xxx
AI_BASE_URL=http://127.0.0.1:8000/v1    # 后端 AI 旧配置（旧生成接口）
AI_MODEL=Qwen3.6-27B

# Unsplash（也可在后台配置）
UNSPLASH_ACCESS_KEY=xxx
```

> **重要：** AI_API_KEY 和 UNSPLASH_ACCESS_KEY 也可以在后台管理 → AI 配置页面填写，存到 `ai_config` 表，优先级高于环境变量。

---

## 二、项目结构

```
src/
├── app/
│   ├── admin/                    # 后台管理页面
│   │   ├── layout.tsx            # Admin 布局（鉴权 + 底部 Tab 导航）
│   │   ├── page.tsx              # 内容管理（AI生成/手动创建/批量生成）
│   │   ├── ai-config/page.tsx    # AI 配置（Key 管理）
│   │   ├── applications/page.tsx # 入驻审核
│   │   ├── reviews/page.tsx      # 点评审核
│   │   ├── rewards/page.tsx      # 奖励规则
│   │   └── virtual-users/page.tsx# 虚拟用户管理
│   ├── api/                      # API 路由
│   │   ├── admin/                # Admin API
│   │   │   ├── ai-config/        # AI 配置 CRUD
│   │   │   ├── applications/     # 入驻审核
│   │   │   ├── generate-content/ # AI 批量内容生成
│   │   │   ├── reviews/          # 点评审核
│   │   │   ├── reward-rules/     # 奖励规则
│   │   │   └── virtual-users/    # 虚拟用户 CRUD + 批量
│   │   ├── articles/             # 文章 CRUD
│   │   ├── cases/                # 案例 CRUD + 评价
│   │   ├── comments/             # 评论 CRUD
│   │   ├── conversations/        # 对话/消息
│   │   ├── designers/            # 设计师
│   │   ├── favorites/            # 收藏
│   │   ├── feed/                 # 首页 Feed
│   │   ├── generate/             # 旧 AI 生成（本地模型）
│   │   ├── invite/               # 邀请系统
│   │   ├── likes/                # 点赞
│   │   ├── notifications/        # 通知
│   │   ├── points/               # 积分
│   │   ├── profile/              # 个人资料
│   │   ├── questions/            # 提问
│   │   ├── reviews/              # 评价 + check-access
│   │   ├── search/               # 多类型搜索
│   │   ├── tags/                 # 标签
│   │   ├── upload/               # 图片上传
│   │   └── users/                # 用户主页
│   ├── apply/                    # 入驻申请页
│   ├── articles/                 # 文章列表/详情
│   ├── auth/                     # 登录回调
│   ├── cases/                    # 案例列表/详情
│   ├── city/                     # 城市筛选
│   ├── dashboard/                # 设计师工作台
│   ├── designers/                # 设计师列表/详情
│   ├── invite/                   # 邀请中心
│   ├── login/                    # 登录页
│   ├── messages/                 # 消息/对话
│   ├── notifications/            # 通知列表
│   ├── points/                   # 积分页
│   ├── profile/                  # 个人中心/浏览历史
│   ├── publish/                  # 发布页
│   ├── search/                   # 搜索页
│   ├── tags/                     # 标签聚合页
│   └── users/                    # 用户主页
├── components/
│   ├── layout/                   # 布局组件
│   │   ├── bottom-nav.tsx        # 底部导航栏
│   │   ├── header.tsx            # 顶部栏
│   │   └── invite-tracker.tsx    # 邀请跟踪器
│   └── ui/                       # UI 组件
│       ├── avatar.tsx
│       ├── badge.tsx
│       ├── card.tsx
│       ├── image-upload.tsx
│       ├── share-button.tsx
│       ├── skeleton.tsx
│       └── stars.tsx
└── lib/
    ├── ai-generator.ts           # DeepSeek AI 内容生成器
    ├── images.ts                 # 图片工具
    ├── types.ts                  # 类型定义
    ├── unsplash.ts               # Unsplash 配图工具
    └── utils.ts                  # 工具函数
```

### Supabase 客户端

```typescript
// 浏览器客户端（useState/useEffect）
import { createClient } from "@/lib/supabase/client"

// Server Action / API Route 服务端客户端
import { createServerSupabaseClient } from "@/lib/supabase/server"

// API Route 直连客户端（无 cookie 校验，用于后台管理）
import { createDirectClient } from "@/lib/supabase/client"

// 获取当前登录用户 ID（API Route）
import { getCurrentUserId } from "@/lib/supabase/server"
```

---

## 三、数据库结构

完整的 SQL 见 `supabase/migrations/00001_schema.sql`。核心表概览：

### 核心业务表

| 表名 | 说明 | 关键字段 |
|------|------|---------|
| `cities` | 城市 | name, code |
| `users` | 用户 | email, nickname, role(user/admin) |
| `designers` | 设计师/公司/工长 | type, name, specialties, avg_rating |
| `cases` | 装修案例 | title, style, area, budget, images[], designer_id |
| `reviews` | 评价 | rating, content, designer_id, review_status, review_source |
| `articles` | 文章 | title, summary, content, category, tags[], author_id |
| `comments` | 评论 | target_type, target_id, user_id, content |
| `likes` | 点赞 | user_id, target_type, target_id |
| `favorites` | 收藏 | user_id, target_type, target_id |

### 辅助业务表

| 表名 | 说明 |
|------|------|
| `designer_applications` | 设计师入驻申请 |
| `conversations` / `messages` | 对话/消息 |
| `browse_history` | 浏览历史 |
| `notifications` | 通知（like/comment/review） |
| `invites` / `reward_rules` / `user_points` / `point_records` | 邀请/积分系统 |
| `review_flags` | 点评审核标记 |

### AI 内容工厂表

| 表名 | 说明 |
|------|------|
| `virtual_users` | 虚拟用户池（owner/designer/worker/company） |
| `ai_config` | AI 服务 Key 配置（ai_api_key, unsplash_key 等） |

所有内容表（articles, cases, comments, reviews）额外有 `virtual_user_id` 字段标记 AI 生成内容。

---

## 四、核心功能

### 1. 用户系统
- 邮箱登录注册（Supabase Auth）
- 用户角色：`user` / `admin`
- 个人资料编辑（昵称、手机号）
- 设计师身份认证

### 2. 案例系统
- 发布案例（含多图上传到 Supabase Storage）
- 案例列表/详情页
- 按风格/城市/预算筛选
- 点赞/收藏/分享

### 3. 文章系统
- AI 生成攻略文章 + 手动发布
- 文章列表/详情页（带 SEO metadata）
- 标签聚合浏览
- 评论区

### 4. 设计师系统
- 设计师入驻/申请
- 设计师详情页（案例+评价）
- 设计师工作台（统计/案例管理/评价管理）
- 咨询消息

### 5. 评价系统（AI 审核）
- 用户咨询或浏览后可以评价设计师
- AI 自动审核（关键词检测 + 评分阈值）
- 评价状态：pending → approved/rejected/flagged
- Admin 审核面板（通过/拒绝）
- 评价分项评分（设计/施工/服务）

### 6. 社区互动
- 评论（文章/案例）
- 点赞/收藏
- 互动通知（实时小红点）
- 业主提问

### 7. 邀请裂变系统
- 6位邀请码（可自定义）
- 扫码/链接分享邀请
- 积分奖励（邀请人+10分，被邀请人+5分）
- 积分明细记录
- Admin 奖励规则配置

### 8. AI 内容工厂（最新）
- **虚拟用户池**：50+ 虚拟人，每人有完整画像（角色/城市/年龄/语气风格/活跃时段）
- **DeepSeek 内容生成**：支持文章/案例/提问/评论/评价五种类型，带上下文记忆
- **Unsplash 配图**：按内容类型搜索配图
- **发布调度器**：初始化模式（过去30天随机）或日常维护（按活跃时段分配）
- **Admin 管理**：虚拟用户 CRUD + 批量生成 + AI 配置
- **昵称风格**：业主接地气有网感（如：山城小汤圆、今天又超预算了），设计师带专业身份

---

## 五、Admin 后台管理

底部 Tab 导航栏，共 6 个入口：

| Tab | 路径 | 功能 |
|-----|------|------|
| 内容管理 | `/admin` | AI 生成文章 + 手动创建 + 批量内容生成 |
| 入驻审核 | `/admin/applications` | 审核设计师入驻申请 |
| 点评审核 | `/admin/reviews` | 审核评价（待审核/已通过/已拒绝） |
| 虚拟用户 | `/admin/virtual-users` | 管理虚拟用户池（增删改查/批量/生成） |
| 奖励规则 | `/admin/rewards` | 配置邀请奖励规则 |
| AI 配置 | `/admin/ai-config` | 配置 DeepSeek Key 和 Unsplash Key |

---

## 六、常见开发问题

### 1. `@next/swc-darwin-arm64` 签名错误
```bash
npm run dev -- --webpack    # 用 webpack 代替 turbopack
```

### 2. Supabase RLS
`images` 存储桶需要 RLS 策略才能上传，已在 Supabase 控制台配置。

### 3. 后台鉴权
Admin 页面通过 `admin/layout.tsx` 统一鉴权（检查 `users.role === 'admin'`）。
Admin API 使用 `requireAdmin()` 辅助函数鉴权。

### 4. 影子用户
AI 虚拟用户生成时自动在 `users` 表创建记录（email 格式：`virtual_{uuid}@designcircle.local`），前端无需改造即可展示作者信息。

### 5. 评论表
`comments` 表不在 migration SQL 中（早期通过控制台创建），迁移到新环境需要手动创建。

---

## 七、使用流程（首次上线）

1. 配置 Supabase 环境变量
2. 执行 `supabase/migrations/00001_schema.sql`
3. 启动项目
4. 在 DB 中将自己的用户设为 admin
5. 进入后台 → **AI 配置** → 填写 DeepSeek API Key
6. 进入后台 → **虚拟用户** → 生成 50 个虚拟用户
7. 进入后台 → **内容管理** → 选"初始化填充"→ 一键生成

---

## 八、设计文档索引

| 文档 | 位置 |
|------|------|
| AI 内容工厂设计 | `docs/superpowers/specs/2026-05-30-ai-content-factory-design.md` |
| AI 内容工厂实施计划 | `docs/superpowers/plans/2026-05-30-ai-content-factory.md` |
| 裂变邀请系统设计 | `docs/superpowers/specs/2026-05-30-invite-system-design.md` |
| 裂变邀请系统实施 | `docs/superpowers/plans/2026-05-30-invite-system.md` |
| 点评系统重构设计 | `docs/superpowers/specs/2026-05-30-review-system-redesign.md` |
| 点评系统重构实施 | `docs/superpowers/plans/2026-05-30-review-system-redesign.md` |
| 功能头脑风暴 | `docs/features-brainstorm.md` |
