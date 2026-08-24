# 统计明细保留与归档

焚诀不会定期丢弃作品统计。浏览与复制采用“近期明细在线、每日汇总永久、历史明细压缩归档”的生命周期；喜欢、表情 Reaction 和实测心得始终保留在 Supabase，不进入这条归档链路。

## 保留口径

| 数据 | 在线保留 | 长期结果 |
|---|---:|---|
| 浏览、复制原始去重事件 | 默认 180 天 | 压缩后转存私有 R2 |
| 作品每日浏览、复制汇总 | 永久 | 保留在 Supabase |
| 作品全周期累计值 | 永久 | 保留在 Supabase |
| 喜欢、Reaction、心得 | 永久 | 保留在 Supabase |

原始事件只包含作品 ID、事件类型、UTC 日期、写入时间和匿名访客摘要。系统不采集原始 Cookie、IP、User-Agent 或邮箱。

底层事件、每日汇总、批次清单和存储计数都不向客户端开放直接表权限。管理总览通过管理员校验后的只读 RPC 获取汇总，因此数据库 Advisor 对该 `SECURITY DEFINER` RPC 和“RLS 已启用但没有直接策略”的提示属于有意的最小暴露设计。

## 归档流程

Vercel 每天在 UTC 03:17 请求 `/api/cron/archive-analytics`。一次任务默认处理同一月份内最旧的 10,000 条到期事件：

1. Supabase 在事务中领取一批事件，写入批次 ID 和 15 分钟租约。
2. Next.js 使用特权服务端客户端分页读取该批次，序列化为 NDJSON 并用 Gzip 压缩。
3. 文件上传到私有 R2，并通过对象长度、事件数元数据和 SHA-256 摘要重新校验。
4. 数据库 RPC 再次核对事件数量，在同一事务中删除已归档原始行、完成批次清单并更新存储计数。

任何步骤失败，数据库不会完成原始事件删除。失败批次保留原领取关系并释放租约；下次任务读取相同事件、覆盖相同 R2 object key 后重试，因此重复执行不会重复计数或产生大量孤立文件。

归档对象格式：

```text
analytics/prompt-metrics/v1/YYYY/MM/{batch-id}.ndjson.gz
```

每行是一条独立 JSON 事件。数据库中的 `prompt_metric_archive_batches` 保存 object key、事件数、压缩字节数、SHA-256、尝试次数和完成时间，作为恢复与校验清单。

## 必需配置

在本地 `.env.local` 和 Vercel Production 环境配置：

```dotenv
SUPABASE_SECRET_KEY=sb_secret_...
CRON_SECRET=一段足够长的随机值

R2_ANALYTICS_ACCOUNT_ID=...
R2_ANALYTICS_ACCESS_KEY_ID=...
R2_ANALYTICS_SECRET_ACCESS_KEY=...
R2_ANALYTICS_BUCKET_NAME=fenjue-analytics-private

ANALYTICS_HOT_RETENTION_DAYS=180
ANALYTICS_ARCHIVE_BATCH_SIZE=10000
```

`SUPABASE_SERVICE_ROLE_KEY` 仅作为旧项目兼容变量；新配置优先使用 `SUPABASE_SECRET_KEY`。R2 账户 ID 和凭据可以回退到图片配置，但推荐为归档桶创建只读写该桶的独立令牌。

归档桶必须与 `R2_BUCKET_NAME` 不同，并保持私有：不要绑定公开自定义域名，也不要启用 `r2.dev` 公共访问。当前图片桶通过 `R2_PUBLIC_BASE_URL` 对外提供图片，不适合存放匿名事件归档。

## 调整与恢复

- 在线保留期允许 30-3650 天，默认 180 天。
- 单批允许 100-25,000 条，默认 10,000 条；一次定时请求只完成一个批次，控制 Vercel 函数内存和执行时间。
- 如果过期速度持续高于每天一个批次，应先适当调大批量，再增加 Cron 频率；不要跳过 R2 校验直接清表。
- 管理总览会显示在线事件、已归档事件、文件体积、最近归档时间和等待重试批次。
- 恢复时根据批次清单校验 SHA-256，解压 `.ndjson.gz` 后逐行读取；每日汇总和全周期累计仍可直接服务线上页面，无需先恢复历史文件。
