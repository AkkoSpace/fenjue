# 焚诀设计文档

## 设计概述

焚诀服务使用豆包、Gemini、ChatGPT、Grok 等工具生成图片的普通用户。核心闭环是：浏览图片，判断是否喜欢，复制完整提示词，前往自己的工具生成。

V0.1 只做纯文生图案例展示与账户基础，不做投稿、搜索、筛选、收藏、Reaction、授权审核或图片编辑。公开浏览、查看详情和复制提示词始终不要求登录。

## 设计方向

- 现代中文编辑风：柔白、炭黑、中性灰，少量朱红强调。
- 古代元素只用于印记、章节和等级，不使用仿古纸张、火焰背景或暗黑游戏界面。
- 图片是视觉主体，提示词是核心操作对象。
- 「天地玄黄」规划为后续版本的用户 Reaction，不由编辑预设，也不进入 V0.1 内容模型。

## 架构设计

```text
Next.js Server Component
        |
        +-- getPrompts()
        |     +-- Supabase + R2 config -> published prompts
        |     +-- missing config        -> local seed fallback
        |
        +-- 首页 PromptEntry -> PromptGallery
        |
        +-- 详情页 PromptGallery + PromptCopyButton
                                      |
                                      +-- shadcn/ui Button

Supabase Auth
        |
        +-- 邮箱 + 密码注册 / 登录
        +-- Resend SMTP -> 邮箱确认 / 密码重置
        +-- Proxy 刷新会话 -> 账户页 / 后续管理页
        +-- profiles + RLS -> user / admin
```

## 核心组件

- `src/lib/content/queries.ts`: 服务端内容查询和本地 fallback。
- `src/content/prompts.ts`: 首批 3 条可直接开发验证的 seed 数据。
- `src/components/prompt-entry.tsx`: 首页瀑布流中的单条作品，只展示图片、标题、多图数量与详情页入口。
- `src/components/prompt-gallery.tsx`: 保持图片比例的响应式画廊；首页多图封面堆叠最多三张真实图片，详情页展示完整集合。
- `src/components/prompt-copy-button.tsx`: 浏览器端复制和成功/失败反馈。
- `src/lib/supabase/*`: Supabase 浏览器、服务端和 Proxy 会话客户端。
- `src/lib/auth/actions.ts`: 邮箱密码注册、登录、找回密码、更新密码和退出的 Server Actions。
- `src/app/(login|register|forgot-password|reset-password|account)`: 访客优先的完整认证与账户流程。
- `src/app/prompts/[slug]/page.tsx`: 作品详情、作者来源、完整提示词和复制操作。

## 设计决策

| 日期 | 决策 | 理由 | 影响 |
|------|------|------|------|
| 2026-07-30 | Next.js 16.2.12 + App Router | 保留 SSR、ISR、Streaming、Cache Components 和后续动态能力 | 需要 Node.js Runtime 与 Vercel 部署 |
| 2026-07-30 | Tailwind CSS + shadcn/ui + Lucide | 复用可访问的交互基础，同时完整定制焚诀视觉 | 不直接采用 shadcn 默认主题 |
| 2026-07-30 | Supabase 元数据 + R2 object key | 图片和内容职责分离，支持后续扩展 | V0.1 仍提供本地 seed fallback |
| 2026-07-30 | 首页发现 + 独立详情页 | 首页只服务连续看图，避免任何元信息遮挡或拉长作品流 | 首页只显示图片、标题和多图数量；详情页承接作者、来源、提示词和复制操作 |
| 2026-07-30 | 克制瀑布流 + 多图堆叠封面 | 提高同屏图片密度，同时让多图作品一眼可辨 | 手机单列、常规桌面双列、超宽桌面三列；封面最多露出三张真实图片并标注总数 |
| 2026-07-30 | 访客优先的 Supabase Auth | 浏览不应被登录阻断，但管理与未来 Reaction 需要稳定身份 | 邮箱密码、邮箱验证、密码重置与 RBAC；SMTP 由 Supabase 统一接入，当前使用 Resend |
| 2026-07-30 | 天地玄黄延后为用户 Reaction | 品阶应来自真实用户反馈，不应由编辑预设 | V0.1 删除 rank 字段和等级 UI，后续版本单独设计投票与聚合模型 |

## 已知限制

- V0.1 已包含用户登录与账户基础，但没有 Reaction 或投票；天地玄黄仅保留在后续 Roadmap。
- 当前首批图片保留本地开发副本，生产环境通过 R2 自定义域名提供同一批资源。
- 暂不提供图片压缩、裁剪或格式转换服务。
- Resend 发件域名、DNS 与 Supabase SMTP 仍需在各自控制台完成配置；仓库只保存通用参数和邮件模板，不保存凭据。

## 安全考量

- 公开内容页只读取 `published = true` 的数据，也不读取用户会话；认证故障不会阻断访客浏览与复制。
- Supabase Publishable Key 可以进入浏览器，权限由 RLS 约束；Service Role Key、Resend API Key 和 R2 写入凭据不得进入客户端、源码或 Git。
- 密码由 Supabase Auth 托管，应用数据库不保存密码或密码哈希；应用仅校验 10-128 字符并通过 TLS 调用 Supabase。
- 找回密码始终返回相同结果，不暴露邮箱是否注册；登录失败默认使用统一提示。
- 注册确认、密码重置和登录后的 `next` 仅允许站内绝对路径，阻止开放重定向。
- 新用户只能获得 `user` 角色；`profiles.role` 不允许普通用户更新，内容写入策略还会调用 `is_admin()` 二次校验。
- 外部作者和来源链接统一 `target="_blank"` + `rel="noreferrer"`。
- 提示词只作为文本渲染，不使用 `dangerouslySetInnerHTML`。

### 威胁模型与边界

- 防护对象：账户会话、管理员角色、未发布内容、SMTP/R2/Supabase 高权限凭据。
- 信任边界：浏览器只持有 Publishable Key 与 HttpOnly 会话 Cookie；Supabase Auth 校验身份，PostgreSQL RLS 校验数据权限，Resend 只负责邮件投递。
- 已知风险：邮件可达率与域名声誉依赖 Resend/DNS 配置；上线前必须验证 SPF、DKIM、确认邮件和密码重置全链路。

## 变更历史

### 2026-07-30 - 引入访客优先账户系统

**变更内容**：加入邮箱密码注册、邮箱确认、登录、找回/重置密码、账户页、会话刷新、`profiles` 与管理员 RBAC，并为 Resend 提供通用 SMTP 配置和邮件模板。

**变更理由**：公开浏览仍保持零门槛，同时为后续 Reaction、收藏和站内内容管理建立可信用户身份。

**影响范围**：认证路由、站点页头、Supabase 客户端与 Proxy、数据库迁移、环境变量、邮件模板和部署配置。
