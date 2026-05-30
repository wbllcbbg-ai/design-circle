# 设计圈

> 家居设计点评社区 —— 连接业主与设计师的装修平台

设计圈是一个面向重庆地区的家居装修垂直社区，业主可以浏览装修案例、阅读装修攻略、咨询设计师；设计师可以展示作品、积累口碑、获取客户。

## 核心功能

- **装修案例库** — 浏览真实装修案例，按风格/面积筛选
- **装修攻略文章** — AI 生成 + 人工发布的装修知识内容
- **设计师生态** — 设计师入驻、作品展示、评价体系、在线咨询
- **社区互动** — 点赞、收藏、评论、评价、提问
- **AI 内容工厂** — 虚拟用户 + AI 内容生成，营造活跃社区氛围

## 快速开始

```bash
# 安装依赖
npm install

# 本地开发（注意：需用 webpack 模式）
npm run dev -- --webpack

# 生产构建
npm run build -- --webpack
```

## 技术栈

Next.js 16.2.6 + React 19 + TypeScript + Tailwind CSS + Supabase + DeepSeek API + Unsplash API

## 项目文档

完整开发者指南见 [`DEVELOPER_GUIDE.md`](./DEVELOPER_GUIDE.md)，设计文档见 [`docs/`](./docs) 目录。
