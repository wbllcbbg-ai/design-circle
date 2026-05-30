# AI 内容工厂 — 设计文档

> 日期：2026-05-30
> 项目：设计圈 - 家居设计点评平台
> 状态：V1 设计稿

## 一、目标

通过 AI（DeepSeek API）批量生成高质量家居内容 + 模拟真实用户互动，让业主和设计师觉得平台上活跃着大量真实用户，营造活跃社区氛围。

**核心原则：** 虚拟人在前台完全不可区分，除非管理员手动干预，否则所有内容和互动都 AI 自动延续逻辑。

**地域约束：** 前期只在一个城市运营（默认为上海），所有虚拟人、内容、互动的城市信息统一锁定在该城市，不涉及跨区域话题。

## 二、虚拟用户系统

### 2.1 虚拟人画像字段

虚拟用户池是内容生态的根基，每个虚拟人有一个完整的画像：

| 字段 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `nickname` | TEXT | 中文昵称，唯一 | 王姐、设计师小李、装修小白 |
| `avatar_url` | TEXT | 从预设头像池分配，固定 | Unsplash portrait URL |
| `role` | ENUM | 业主 / 设计师 / 工长 / 公司 | 业主 |
| `city` | TEXT | 锁定为运营城市（默认上海）| 上海 |
| `age_group` | ENUM | 25-35 / 35-45 / 45+ | 35-45 |
| `decoration_stage` | ENUM (可选) | 未开始 / 进行中 / 已完工 （仅业主角色） | 已完工 |
| `active_periods` | TEXT[] | 活跃时段 | ["晚上", "周末"] |
| `interest_tags` | TEXT[] | 兴趣标签 | ["现代简约", "小户型", "预算", "厨房"] |
| `tone_style` | ENUM | 专业 / 口语化 / 热情 / 简洁 | 口语化 |
| `speak_frequency` | ENUM | 活跃 / 普通 / 偶尔 | 普通 |
| `specialty` | TEXT (可选) | 专长领域（仅设计师角色） | 小户型改造、日式风格 |
| `is_active` | BOOLEAN | 启用/禁用 | true |
| `content_count` | INT | 累计内容数，统计用 | 12 |
| `last_active_at` | TIMESTAMPTZ | 最后一条内容发布时间 | |
| `created_at` | TIMESTAMPTZ | 创建时间 | |

### 2.2 虚拟用户池规模

| 阶段 | 总量 | 业主:设计师比例 |
|------|------|----------------|
| Phase 1 初始化 | 50 个 | 7:3（35 业主，15 设计师） |
| 长期维护 | 100-200 个 | 6:4（社区成熟后设计师增加） |

### 2.3 生成规则

AI 生成虚拟人时遵循以下约束：
- 昵称不重复
- 角色分布符合比例
- 所有虚拟人城市锁定为运营城市（默认上海）
- 兴趣标签互斥组合，避免所有虚拟人都是"现代简约"

### 2.4 管理员管理界面

**「虚拟用户」页面** — Admin Tab 栏新增第 5 项：

#### 列表视图
- 表格：头像、昵称、角色、城市、内容数、状态（启用/禁用）、最后活跃
- 搜索/筛选：按昵称、角色、城市、状态
- 分页：每页 20 条

#### 单个操作
- 点击行 → 打开编辑弹窗：修改所有画像字段
- 头像点击可更换（从预设头像池随机换一张）
- 启用/禁用开关

#### 批量操作
- 复选框多选 → 顶部操作栏出现：
  - 批量启用 / 批量禁用
  - 批量生成内容（弹出配置：内容类型、数量）
  - 批量删除（二次确认）

## 三、AI 内容生成

### 3.1 API 配置

```env
AI_BASE_URL=https://api.deepseek.com/v1
AI_MODEL=deepseek-chat
AI_API_KEY=sk-xxx
```

### 3.2 内容类型

#### 3.2.1 装修攻略文章

| 参数 | 说明 |
|------|------|
| 作者 | 随机分配给设计师角色虚拟人 |
| 配图 | Unsplash 搜索"interior design"、"living room kitchen" 等 |
| 标题 | AI 生成，含 SEO 关键词 |
| 字数 | 500-800 字 |
| 分类 | 装修攻略 / 预算规划 / 避坑指南 / 主材选购 / 风格灵感 |
| 发布频率 | 2-3 篇/天 |

#### 3.2.2 案例

| 参数 | 说明 |
|------|------|
| 作者 | 分配给设计师角色虚拟人 |
| 配图 | Unsplash 搜索"modern home"、"apartment decoration" 等，每个案例 3-5 张 |
| 面积/风格/预算 | AI 生成合理数值 |
| 发布频率 | 1-2 个/天 |

#### 3.2.3 业主提问

| 参数 | 说明 |
|------|------|
| 作者 | 分配给业主角色虚拟人 |
| 标题 | 口语化提问，如"有没有人做过 60 平两房改三房？" |
| 内容 | 详细描述自己的情况 |
| 分类 | 设计 / 施工 / 预算 / 材料 |
| 发布频率 | 1-2 条/天 |

#### 3.2.4 评论

| 参数 | 说明 |
|------|------|
| 作者 | 任意虚拟人 |
| 目标 | 新发布的文章/案例/提问 |
| 内容 | 和该用户的人设+历史发言逻辑一致 |
| 发布频率 | 5-10 条/天，分时段发布 |

#### 3.2.5 评价 + 评分

| 参数 | 说明 |
|------|------|
| 作者 | 业主角色虚拟人 |
| 目标 | 已有案例的设计师 |
| 分项评分 | AI 生成合理分数（正面为主，少量中评） |
| 发布频率 | 2-3 条/天 |

### 3.3 上下文记忆机制

这是实现"逻辑延续"的核心。

**每次生成新内容前，AI prompt 附带该虚拟人的历史发言记录：**

```
当前虚拟人信息：
- 昵称：王姐
- 角色：业主
- 城市：上海
- 年龄层：35-45
- 装修阶段：已完工
- 兴趣标签：现代简约, 厨房, 收纳
- 语气风格：口语化
- 最近发布的内容（最多5条）：
  ① [5天前] 提问：厨房只有4平米，能做U型吗？
  ② [3天前] 评论：我家也是小厨房，U型真的能装很多
  ③ [1天前] 评论：这个设计师的作品不错，可惜在上海我太远了

请生成一条新的评论，延续这个用户的逻辑和语气。
```

#### 上下文范围

| 内容类型 | 记忆范围 | 延续逻辑示例 |
|----------|---------|-------------|
| 同角色内容 | 最近 5 条 | 王姐上周问厨房，今天评论厨房文章 |
| 跨内容引用 | 同人设 | 设计师发了案例后，在别人提问下引用自己案例 |
| 时间线一致性 | 无矛盾 | 王姐不会突然变成专业设计师语气 |
| 观点变化 | 允许（真实业主会变） | 但设计师要保持专业一致性 |

### 3.4 内容生成工作流

```
Admin 点击「一键生成」
    ↓
选择生成策略：初始化 / 日常维护 / 自定义
    ↓
系统遍历待处理的虚拟用户
    ↓
为每个虚拟用户：
  1. 读取该用户的画像 + 最近历史内容
  2. 调用 DeepSeek API 生成新内容
  3. 调用 Unsplash API 获取配图（文章/案例需要）
  4. 写入数据库
  5. 记录上下文供下次使用
    ↓
所有内容写入后，进行发布时间调度
    ↓
返回生成结果（数量、类型统计）
```

### 3.5 内容审核

所有 AI 生成的内容在数据库中有 `is_ai_generated` 标记（用于统计和管理员查询），但**前台不显示此标记**。

管理员可在 Admin 内容列表中：
- 查看所有 AI 生成的内容
- 编辑内容（改文案、换图、重新分配虚拟人）
- 删除不合适的内容
- 手动发布"紧急"内容（不通过调度器）

## 四、配图方案

### 4.1 Unsplash API

使用 Unsplash API 按关键词搜索并缓存图片 URL：

| 内容类型 | 搜索关键词 |
|----------|-----------|
| 文章 | interior design, living room, bedroom, kitchen |
| 案例 | modern home, apartment, renovation, decoration |
| 头像 | 不使用 Unsplash，用随机色块+首字母，或预设头像池 |

**缓存策略：** API 返回的图片 URL 一次获取、存入数据库，后续不再请求 API。图片 URL 是永久有效的。

### 4.2 头像

虚拟人头像有两种方案：
- **色块+首字母**：类似当前系统中的用户头像（`background: linear-gradient(135deg, hsl(...))`），色相根据用户 ID 计算
- **预设头像池**：管理员可以上传一批真人头像作为虚拟人头像池

## 五、发布时间调度器

### 5.1 调度规则

```
每次生成时，系统确定内容发布时间：
  - Phase 1 初始化 → 过去30天内随机分布（看起来像是慢慢积累的）
  - 日常维护 → 当前时间之后，按规则分布：
    - 文章：8:00-9:00 / 12:00-13:00 / 19:00-20:00 三个时段
    - 提问：10:00-11:00 / 15:00-16:00 / 21:00-22:00
    - 评论：跟随目标内容的发布时间 + 10-30 分钟随机偏移
    - 评价：随机分散在一天内
  - 虚拟人活跃时段限制：内容只在其活跃时段内发布
    - "晚上"活跃的虚拟人，内容在 19:00-23:00 发布
    - "周末"活跃的虚拟人，内容只在周六日发布
```

### 5.2 人工触发

管理员可以点击"立即发布"跳过调度器，内容马上出现在前台。

## 六、Admin 页面改动

### 6.1 Tab 栏新增

Admin 底栏从 4 个 Tab 变为 5 个：

| 顺序 | 标签 | 页面 | 说明 |
|------|------|------|------|
| 1 | 内容管理 | `/admin` | AI 内容生成 + 手动创建（现有） |
| 2 | 入驻审核 | `/admin/applications` | 现有一级页面 |
| 3 | 点评审核 | `/admin/reviews` | 现有一级页面 |
| 4 | 虚拟用户 | `/admin/virtual-users` | **新增** |
| 5 | 奖励规则 | `/admin/rewards` | 现有一级页面 |

### 6.2 内容管理页面增强

在现有"AI 生成"和"手动创建"基础上增加：

```
【批量生成区域】

生成策略选择：
  [●] 初始化（快速填充内容库）
  [○] 日常维护（按调度规则发布）
  [○] 自定义

内容类型（可多选）：
  ☑ 文章  ☑ 案例  ☑ 提问  ☑ 评论  ☑ 评价

生成数量：____（仅初始化模式可用）

[一键生成] 按钮
```

### 6.3 虚拟用户管理页面

全新页面，见 2.4 节。

## 七、数据库变更

### 7.1 新建 `virtual_users` 表

```sql
CREATE TABLE virtual_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nickname TEXT NOT NULL UNIQUE,
  avatar_url TEXT,
  role TEXT NOT NULL CHECK (role IN ('owner', 'designer', 'worker', 'company')),
  city TEXT,
  age_group TEXT CHECK (age_group IN ('25-35', '35-45', '45+')),
  decoration_stage TEXT CHECK (decoration_stage IN ('not_started', 'ongoing', 'completed')),
  active_periods TEXT[] NOT NULL DEFAULT '{}',
  interest_tags TEXT[] NOT NULL DEFAULT '{}',
  tone_style TEXT NOT NULL DEFAULT 'casual' CHECK (tone_style IN ('professional', 'casual', 'enthusiastic', 'concise')),
  speak_frequency TEXT NOT NULL DEFAULT 'normal' CHECK (speak_frequency IN ('active', 'normal', 'occasional')),
  specialty TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  content_count INT NOT NULL DEFAULT 0,
  last_active_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 7.2 为内容表加标记字段

```sql
ALTER TABLE articles ADD COLUMN IF NOT EXISTS virtual_user_id UUID REFERENCES virtual_users(id);
ALTER TABLE cases ADD COLUMN IF NOT EXISTS virtual_user_id UUID REFERENCES virtual_users(id);
ALTER TABLE comments ADD COLUMN IF NOT EXISTS virtual_user_id UUID REFERENCES virtual_users(id);
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS virtual_user_id UUID REFERENCES virtual_users(id);
```

—— 内容作者仍是 `user_id`（指向虚拟用户在 `users` 表中的影子账号），`virtual_user_id` 供后台管理用。

实际上更简洁的做法：**虚拟用户也创建对应的 `auth.users` 影子账号和 `users` 表记录**，这样已有评论/评价/提问等 API 不用改造，直接用现有 `user_id` 字段。`virtual_users` 表作为扩展属性表。

### 7.3 `virtual_users` ↔ `users` 的关联

```sql
ALTER TABLE virtual_users ADD COLUMN user_id UUID REFERENCES users(id) ON DELETE CASCADE;
```

### 7.4 AI 生成内容标记

所有 AI 生成的内容不加标记——前台完全透明。Admin 后台可以通过 `virtual_user_id IS NOT NULL` 识别。

## 八、API 新增/改动

### 8.1 Admin API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/admin/virtual-users | 获取虚拟用户列表，支持分页/搜索/筛选 |
| POST | /api/admin/virtual-users | 批量生成虚拟用户 |
| GET | /api/admin/virtual-users/[id] | 获取单个虚拟人详情（含内容统计）|
| PUT | /api/admin/virtual-users/[id] | 编辑单个虚拟人 |
| DELETE | /api/admin/virtual-users/[id] | 删除单个虚拟人 |
| POST | /api/admin/virtual-users/batch | 批量操作（启用/禁用/删除/生成内容）|
| POST | /api/admin/generate-content | **核心**：AI 批量生成内容 |
| GET | /api/admin/generate-content/status | 查询生成任务状态 |

### 8.2 `POST /api/admin/generate-content`

**请求体：**
```json
{
  "strategy": "init" | "daily" | "custom",
  "types": ["article", "case", "question", "comment", "review"],
  "counts": {
    "articles": 10,
    "comments": 30
  }
}
```

**处理流程：**
1. 根据策略确定虚拟人候选池
2. 为每个虚拟人读取最近内容作为上下文
3. 调用 DeepSeek API 并行生成内容（带重试）
4. 调用 Unsplash API 获取配图（文章/案例）
5. 写入数据库，设置调度时间
6. 更新虚拟人的 `content_count` 和 `last_active_at`
7. 返回生成统计

> 生成任务异步执行，通过 `/status` 轮询进度。

### 8.3 前端 API 无需改动

已有前端接口（首页 Feed、案例列表、文章详情、评论列表等）直接使用 `users` 表数据，虚拟人的 shadow users 和真实用户在数据层面完全一致。

## 九、实施计划

### Phase 1：基础设施（2-3 天）

| 任务 | 说明 |
|------|------|
| 数据库迁移 | 建 `virtual_users` 表，为现有内容表加 `virtual_user_id` 字段 |
| shadow user 同步 | 虚拟人创建时自动在 `auth.users` + `users` 表建影子账号 |
| Admin API | 虚拟用户 CRUD + 批量操作 API |
| Admin 前端 | 虚拟用户管理页面（列表/编辑/批量） |

### Phase 2：AI 内容生成（2-3 天）

| 任务 | 说明 |
|------|------|
| DeepSeek API 集成 | 配置 + prompt 模板 + 上下文记忆机制 |
| Unsplash API 集成 | 图片搜索 + 缓存 |
| 内容生成 API | `/api/admin/generate-content` + 异步任务队列 |
| 发布调度器 | 时间分配 + 活跃时段约束 |

### Phase 3：Admin 增强 + 上线准备（1-2 天）

| 任务 | 说明 |
|------|------|
| Admin 内容管理增强 | 生成策略配置、生成记录查看 |
| Admin Tab 栏更新 | 虚拟用户 Tab |
| 测试：生成一批内容，检查前台展示 | 确保评论/评价能在前台正确显示 |
| 测试：虚拟人行为逻辑 | 检查上下文记忆效果 |

## 十、风险与注意事项

| 风险 | 缓解措施 |
|------|---------|
| DeepSeek API 调用失败 | 加入重试机制，失败告警到 Admin 页面 |
| AI 生成内容质量差 | 初始阶段管理员抽查，可手动编辑/删除 |
| 内容重复/模板化 | Prompt 中增加多样性和否定指令 |
| 虚拟人之间的互动逻辑 | 暂不实现跨虚拟人对话，后期可加 |
| 影子用户被真实用户看到 | 虚拟用户不在注册、搜索用户等接口中暴露 |
| 图片侵权/版权问题 | Unsplash 图片遵循免费商用许可，不会过期 |
