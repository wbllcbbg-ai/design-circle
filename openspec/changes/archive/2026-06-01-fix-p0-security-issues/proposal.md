# 修复安全审计发现的 P0 问题

## 问题
安全审计报告发现 4 个 P0 问题：
1. DeepSeek API Key 日志泄露 — `ai-generator.ts:60` 打印 key 长度
2. 登录页 console.log 残留 — `login/page.tsx` 4 条 [Login] 日志
3. 通义万相同 URL 重复存储 5 次 — 生成案例时同一张图存 5 次
4. 上传接口无认证 — `/api/upload` 未调用 requireAuth()

## 修复
全部在 2026-06-01 完成。每项改动都经过编译检查。
