# 设计圈 (Design Circle) — 开发文档

> 版本：2026-05-31
> 项目路径：`/Users/easywb/design-circle`
> 线上地址：https://design-circle-nine.vercel.app

---

## 📋 项目概述

设计圈是一个**家居设计点评平台**，连接业主和设计师。核心功能包括：

- **装修案例** — 设计师发布案例，业主浏览、评价
- **装修攻略** — AI 生成／人工发布的文章内容
- **设计师生态** — 设计师入驻、工作台、消息咨询
- **社区互动** — 点赞、收藏、评论、评价、通知
- **AI 内容工厂** — 虚拟用户 + AI 生成文章/案例/评论/评价
- **全民裂变** — 邀请好友积分系统

---

## 🛠 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 框架 | Next.js (App Router) | 16.2.6 |
| UI 框架 | React | 19.2.4 |
| 语言 | TypeScript | 5.x |
| 样式 | Tailwind CSS | 3.4 |
| 数据库 | Supabase (PostgreSQL) | — |
| Auth | Supabase Auth | — |
| Storage | Supabase Storage | — |
| 部署 | Vercel | — |
| 测试 | Vitest + Testing Library | — |

### 关键依赖

- `@supabase/ssr` / `@supabase/supabase-js` — Supabase 客户端
- `lucide-react` — 图标库
- `clsx` / `tailwind-merge` / `class-variance-authority` — 样式工具
- `qrcode` — 邀请分享二维码
- `next-themes` — 暗色模式

---

## 🏗 项目结构

```
design-circle/
├── src/
│   ├── app/                     # Next.js App Router 页面 + API
│   │   ├── layout.tsx           # 根布局（Header + BottomNav + 侧边栏）
│   │   ├── page.tsx             # 首页
│   │   ├── admin/               # 管理后台
│   │   ├── api/                 # 所有 API 路由
│   │   ├── articles/            # 文章列表 + 详情
│   │   ├── cases/               # 案例列表 + 详情
│   │   ├── designers/           # 设计师列表 + 详情
│   │   ├── messages/            # 消息/对话
│   │   ├── profile/             # 个人中心 + 浏览历史
│   │   ├── search/              # 搜索
│   │   ├── city/                # 城市筛选
│   │   ├── tags/                # 标签聚合
│   │   ├── dashboard/           # 设计师工作台
│   │   ├── invite/              # 邀请中心
│   │   ├── points/              # 积分页面
│   │   ├── notifications/       # 通知列表
│   │   ├── publish/             # 发布内容
│   │   ├── users/               # 用户主页
│   │   ├── apply/               # 设计师入驻申请
│   │   ├── login/               # 登录
│   │   └── auth/                # Auth callback / logout
│   ├── components/
│   │   ├── layout/              # 布局组件（Header, BottomNav, InviteTracker）
│   │   └── ui/                  # UI 组件（Avatar, Badge, Card, Stars, etc.）
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts        # 客户端 Supabase 实例
│   │   │   └── server.ts        # 服务端 Supabase 实例（含 getCurrentUserId）
│   │   ├── types.ts             # TypeScript 类型定义
│   │   ├── utils.ts             # 工具函数（cn, formatDate 等）
│   │   ├── images.ts            # 图片处理工具
│   │   ├── unsplash.ts          # Unsplash 图片搜索
│   │   └── ai-generator.ts      # DeepSeek AI 内容生成器
│   └── __tests__/               # Vitest 测试
├── supabase/
│   └── migrations/
│       └── 00001_schema.sql     # 数据库完整 schema
├── docs/
│   ├── development-guide.md     # 本文件
│   ├── features-brainstorm.md   # 功能头脑风暴
│   └── superpowers/             # 设计文档
│       ├── specs/
│       │   ├── 2026-05-30-invite-system-design.md
│       │   ├── 2026-05-30-review-system-redesign.md
│       │   └── 2026-05-30-ai-content-factory-design.md
│       └── plans/
│           ├── 2026-05-30-invite-system.md
│           ├── 2026-05-30-review-system-redesign.md
│           └── 2026-05-30-ai-content-factory.md
├── .env.local                   # 环境变量
├── next.config.ts               # Next.js 配置
├── tailwind.config.js           # Tailwind 配置
├── tsconfig.json                # TypeScript 配置
├── package.json
├── CLAUDE.md                    # AI 辅助开发指引
└── AGENTS.md                    # 重要：Next.js 非标准行为的提示
```

---

## 🚀 本地开发

### 环境要求

- Node.js >= 18
- npm

### 环境变量（`.env.local`）

```
NEXT_PUBLIC_SUPABASE_URL=https://rlbxldrtxbyrrtekfims.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_5IJqR5lHe7-svgOI9rdFoA_KVyhpT9u
AI_BASE_URL=https://api.deepseek.com
AI_MODEL=deepseek-chat
```

### 启动命令

```bash
# 安装依赖
npm install

# 开发服务器（注意：必须用 --webpack）
npm run dev -- --webpack

# 启动后访问 http://localhost:3000（如果 3000 被占用则跳到 3001）
```

> **⚠️ 重要：** 由于 `@next/swc-darwin-arm64` 在 macOS 上有代码签名问题，必须使用 `--webpack` 参数启动，否则会报错。这是已知问题，不影响 Vercel 生产构建。

### 测试

```bash
npm test           # 运行所有测试
npm run test:watch # 监听模式
```

### 构建

```bash
# 本地构建（用于检查编译错误）
npm run build -- --webpack

# Vercel 构建由 Vercel 自动处理
```

### 部署

```bash
# 预览部署
vercel

# 生产部署（会提示确认）
vercel --prod

# 强制重新部署（跳过缓存）
vercel --prod --force
```

Vercel 项目已关联，自动从 GitHub `main` 分支部署。

---

## 🗄 数据库

### 数据库地址

Supabase 项目：`https://rlbxldrtxbyrrtekfims.supabase.co`

### 表结构概要（完整 SQL 见 `supabase/migrations/00001_schema.sql`）

| 表名 | 说明 | 关键字段 |
|------|------|----------|
| `users` | 用户 | id, email, nickname, role (user/admin), avatar_url, phone, city_id |
| `designers` | 设计师/公司/工长 | id, user_id, type, name, logo_url, avg_rating, review_count, is_verified |
| `cases` | 装修案例 | id, designer_id, title, cover_url, images, style, area, budget, view_count, like_count |
| `reviews` | 案例点评 | id, user_id, designer_id, case_id, rating, design_score, construction_score, service_score, content, review_status |
| `articles` | 文章 | id, title, summary, cover_url, content, tags, category, view_count, like_count, author_id, virtual_user_id |
| `comments` | 评论 | id, user_id, target_type, target_id, content (含 virtual_user_id) |
| `likes` | 点赞 | id, user_id, target_type, target_id (UNIQUE) |
| `favorites` | 收藏 | id, user_id, target_type, target_id (UNIQUE) |
| `conversations` | 对话 | id, designer_id, user_id, case_id, last_message |
| `messages` | 消息 | id, conversation_id, sender_id, content, is_read |
| `browse_history` | 浏览历史 | id, user_id, target_type, target_id (UNIQUE) |
| `notifications` | 通知 | id, user_id, type (like/comment/review), actor_id, target_type, target_id, is_read |
| `designer_applications` | 入驻申请 | id, user_id, type, name, phone, status (pending/approved/rejected) |
| `cities` | 城市 | id, name, code, is_active |
| `invites` | 邀请关系 | id, inviter_id, invitee_id, code, status |
| `reward_rules` | 奖励规则 | id, name, trigger_event, inviter_points, invitee_points, is_active |
| `user_points` | 用户积分 | id, user_id, points, total_earned, total_invites |
| `point_records` | 积分变动记录 | id, user_id, amount, reason, related_invite_id |
| `review_flags` | 审核标记 | id, review_id, flag_type, reason |
| `virtual_users` | 虚拟用户池 | id, user_id, nickname, avatar_url, role, city, tone_style, is_active |
| `ai_config` | AI 配置 | key, value (存储 DeepSeek / Unsplash API Key) |

### 存储桶

- `images` — 上传的图片（头像、案例图片等）
  - 需要 RLS 策略：允许已认证用户上传，公开读取

---

## 🧩 功能模块详解

### 1. 认证系统

- 使用 Supabase Auth
- 登录方式：邮箱密码
- 服务端鉴权：`getCurrentUserId()` (`src/lib/supabase/server.ts`)
  - 使用 `createServerClient` + `service_role` key
  - 主要用于 API 路由
- 客户端鉴权：`createClient()` (`src/lib/supabase/client.ts`)
  - 使用 `createBrowserClient` + anon key
  - 用于前端页面

### 2. 内容管理 (Admin)

后台入口：管理员个人中心 → 「⚙️ 后台管理」

| Tab | 路由 | 说明 |
|-----|------|------|
| 内容管理 | `/admin` | AI 生成 / 手动创建 / 批量生成内容 |
| 入驻审核 | `/admin/applications` | 设计师入驻申请审核 |
| 点评审核 | `/admin/reviews` | 案例点评内容审核 |
| 虚拟用户 | `/admin/virtual-users` | AI 内容工厂虚拟用户 CRUD |
| 奖励规则 | `/admin/rewards` | 邀请积分奖励规则管理 |
| AI 配置 | `/admin/ai-config` | DeepSeek / Unsplash API Key 配置 |

Admin Layout 在 `src/app/admin/layout.tsx`，包含：
- Admin 角色校验（从 `users` 表查 role）
- 顶部导航栏 + 横向 Tab 导航

### 3. AI 内容工厂

**架构文件：** `src/lib/ai-generator.ts` + `src/lib/unsplash.ts`

- 使用 DeepSeek API 生成文章、案例、提问、评论、评价
- 使用 Unsplash API 搜索配图
- API Key 存储在 `ai_config` 表，管理员可运行时配置
- 支持初始化填充（过去 30 天随机时间）和日常维护（按角色活跃时段分配）
- 所有虚拟用户锁定重庆地域
- 业主昵称接地气有网感，设计师带专业身份

### 4. 设计师生态

| 功能 | 路由/API | 说明 |
|------|----------|------|
| 设计师列表 | `/designers` | 按评分排序展示 |
| 设计师详情 | `/designers/[id]` | 个人信息、案例、评价、咨询按钮 |
| 设计师工作台 | `/dashboard` | 统计卡片、案例管理、最新评价 |
| 入驻申请 | `/apply` | 设计师提交入驻申请 |
| 消息咨询 | `/messages` | 用户与设计师聊天 |

### 5. 社区互动

| 功能 | API | 说明 |
|------|-----|------|
| 点赞 | `POST /api/likes` + `DELETE` | 案例/文章点赞 |
| 收藏 | `POST /api/favorites` + `DELETE` | 案例/文章/设计师收藏 |
| 评论 | `POST /api/comments` + `GET` | 案例/文章评论区 |
| 评价 | `POST /api/reviews` | 案例评分（分项+综合） |
| 通知 | `GET /api/notifications` | 点赞/评论/评价触发通知 |
| 未读数 | `GET /api/notifications/unread-count` | 轮询未读数（30秒间隔） |

### 6. 兴趣裂变邀请系统

| 功能 | API | 说明 |
|------|-----|------|
| 邀请码生成 | `GET /api/invite/code` + `PUT` | 自动生成6位码，支持修改 |
| 邀请绑定 | `POST /api/invite/bind` | 注册时绑定邀请关系 |
| 邀请统计 | `GET /api/invite/stats` | 总邀请数、已注册、已奖励 |
| 邀请列表 | `GET /api/invite/list` | 明细列表 |
| 积分查询 | `GET /api/points` | 积分余额 + 明细 |

- 邀请人 +10 分，被邀请人 +5 分
- `InviteTracker` 组件捕获 URL `?ref=` 参数，登录后自动绑定

### 7. 搜索

- API: `GET /api/search?q=xxx`
- 多类型搜索：案例（按标题/描述/风格）、文章（按标题/摘要）、设计师（按名称）

### 8. 城市 / 标签筛选

- 城市列表 API: `GET /api/cities`
- 城市页面: `/city` — 字母索引导航，点击跳转搜索
- 标签 API: `GET /api/tags` + `GET /api/tags/[tag]`
- 标签聚合页: `/tags/[tag]` — 文章 + 案例双 Tab

### 9. 个人中心

- `/profile` — 用户信息、编辑资料、统计数据、菜单导航
  - 登录状态：点评数/收藏数/赞过数、浏览历史、邀请好友、设计师工作台
  - 非登录状态：展示引导登录
  - **管理员** 额外显示「后台管理」入口

### 10. 响应式布局

- **手机端**（< 1024px）：单栏 + 底部导航（首页/发现/发布/消息/我的）
- **桌面端**（>= 1024px）：双栏 + 顶部导航 + 侧边栏（关于/快速入口）
- Header 固定在顶部，带通知小红点

---

## 🌐 API 路由一览

### 公共 API

| 方法 | 路由 | 说明 |
|------|------|------|
| GET | `/api/cases` | 案例列表（支持 style/city 筛选）|
| GET | `/api/cases/[id]` | 案例详情 |
| GET | `/api/articles` | 文章列表 |
| GET | `/api/articles/[id]` | 文章详情 |
| GET | `/api/designers` | 设计师列表 |
| GET | `/api/designers/[id]` | 设计师详情 |
| GET | `/api/feed` | 首页 Feed |
| GET | `/api/search?q=xxx` | 多类型搜索 |
| GET | `/api/tags` | 标签列表 |
| GET | `/api/tags/[tag]` | 标签聚合数据 |
| GET | `/api/cities` | 城市列表 |
| GET | `/api/users/[id]` | 用户主页信息 |
| GET | `/api/profile` | 当前用户资料 |
| PUT | `/api/profile` | 更新用户资料 |

### 互动 API

| 方法 | 路由 | 说明 |
|------|------|------|
| POST/DELETE | `/api/likes` | 点赞/取消 |
| POST/DELETE | `/api/favorites` | 收藏/取消 |
| GET/POST | `/api/comments` | 获取/发布评论 |
| GET/POST | `/api/reviews` | 获取/提交评价 |
| GET | `/api/reviews/check-access` | 检测是否能评价 |

### 消息 API

| 方法 | 路由 | 说明 |
|------|------|------|
| GET/POST | `/api/conversations` | 对话列表/创建 |
| GET/POST | `/api/conversations/[id]` | 聊天详情/发消息 |

### 通知 API

| 方法 | 路由 | 说明 |
|------|------|------|
| GET/PUT | `/api/notifications` | 通知列表/标记已读 |
| GET | `/api/notifications/unread-count` | 未读数量 |

### 设计师 API

| 方法 | 路由 | 说明 |
|------|------|------|
| GET/POST | `/api/apply` | 入驻申请查询/提交 |

### 邀请/积分 API

| 方法 | 路由 | 说明 |
|------|------|------|
| GET/PUT | `/api/invite/code` | 邀请码查询/修改 |
| POST | `/api/invite/bind` | 绑定邀请关系 |
| GET | `/api/invite/stats` | 邀请统计 |
| GET | `/api/invite/list` | 邀请明细 |
| POST | `/api/invite/check` | 校验邀请码 |
| GET | `/api/points` | 积分查询 |

### 浏览历史

| 方法 | 路由 | 说明 |
|------|------|------|
| GET | `/api/browse-history` | 获取浏览历史 |
| POST | `/api/browse-history` | 记录浏览（由页面自动调用）|

### AI 内容 API

| 方法 | 路由 | 说明 |
|------|------|------|
| POST | `/api/generate` | AI 生成一篇文章（维护模式）|
| POST/PUT | `/api/upload` | 图片上传 |

### Admin API

| 方法 | 路由 | 说明 |
|------|------|------|
| CRUD | `/api/admin/virtual-users` | 虚拟用户管理 |
| POST | `/api/admin/virtual-users/batch` | 批量操作 |
| CRUD | `/api/admin/reward-rules` | 奖励规则 CRUD |
| GET/PUT | `/api/admin/reviews` + `/api/admin/reviews/[id]` | 点评审核 |
| GET/PUT | `/api/admin/applications` | 入驻申请审核 |
| GET/PUT | `/api/admin/ai-config` | AI 配置管理 |
| POST | `/api/admin/generate-content` | 批量内容生成 |

---

## 🧪 测试

```bash
src/__tests__/
├── api-routes.test.ts       # API 路由测试
├── components.test.tsx      # 组件测试
├── critical-path.test.ts    # 核心路径集成测试
├── images.test.ts           # 图片工具测试
├── types.test.ts            # 类型测试
├── unsplash.test.ts         # Unsplash 工具测试
└── ai-generator.test.ts     # AI 生成器测试
```

---

## 🧭 未实现/待办功能

### 优先级 🔴 高

1. **数据分析/埋点** — 接入 Plausible / GA 等分析工具
2. **内容填充** — 运行 AI 内容工厂填充真实内容
3. **设计师生态运营** — 邀请真实设计师入驻

### 优先级 🟡 中

4. **关注设计师** — 用户可以关注设计师，首页 Feed 优先展示
5. **回复评价** — 设计师对评价回复沟通
6. **设计师排行榜** — 按评价/人气排名
7. **预算筛选** — 按预算区间筛选案例
8. **问答列表页** — 展示 questions 表里的内容

### 优先级 🔵 低

9. **每日精选推送** — 每日推荐热门内容
10. **装修百科/攻略合集** — 文章按话题组织
11. **内容审核工作流** — 发布内容需审核

完整功能头脑风暴见 `docs/features-brainstorm.md`

---

## 🤖 AI 辅助开发指引

### CLAUDE.md

项目根目录有 `CLAUDE.md` 和 `AGENTS.md`，其中 `AGENTS.md` 提示：
> 这不是你熟悉的 Next.js — 有破坏性变更，API、约定、文件结构可能与你训练数据不一致。在写代码之前先阅读 `node_modules/next/dist/docs/` 中的相关指南。

### 项目会话状态

项目的会话状态存储在 `~/.claude/projects/-Users-easywb/memory/design-circle-session-state.md`
每次完成工作后应同步更新。

---

## 🔐 安全注意事项

1. Admin API 路由需要校验 `getCurrentUserId()` + `role === 'admin'`
2. Admin layout 页面鉴权在客户端完成（`supabase.auth.getUser()` + 查 role）
3. 图片上传使用 Supabase Storage RLS 策略
4. AI 配置（API Key）存储在 `ai_config` 表，通过 Admin 页面管理
