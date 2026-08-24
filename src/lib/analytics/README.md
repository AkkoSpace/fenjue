# 统计归档服务模块

该模块负责将超过在线保留期的浏览与复制匿名事件从 Supabase 安全转存到私有 Cloudflare R2，同时保证累计指标和每日汇总继续在线可用。

## 职责

- `config.ts`：约束 30-3650 天在线保留期、100-25,000 条批量大小，并检查定时任务、Supabase 特权客户端和私有 R2 配置。
- `archive.ts`：领取数据库批次、分页读取事件、生成 NDJSON + Gzip、上传并校验 R2、确认或标记失败。
- `/api/cron/archive-analytics`：验证 Vercel `CRON_SECRET` 后触发一次归档批次。

模块只处理 `prompt_metric_events`。喜欢、Reaction、心得、累计值和每日汇总不由这里删除。数据库结构、RPC 和权限位于 `supabase/migrations/20260824120000_add_analytics_retention.sql`，部署配置和恢复方法见 `docs/ANALYTICS_RETENTION.md`。
