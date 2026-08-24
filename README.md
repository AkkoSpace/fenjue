# 焚诀

焚诀是一个面向大众的 AI 文生图提示词精选站：看到喜欢的图片，复制提示词，去豆包、Gemini、ChatGPT 或 Grok 重新生成。

## V0.1

- Next.js 16.3.0 + TypeScript + App Router
- Tailwind CSS 4 + shadcn/ui 4 + Lucide
- Supabase PostgreSQL 保存内容元数据与 R2 object key
- Supabase Auth 提供邮箱密码、邮箱验证和密码重置；登录后的右上角账户菜单显示身份与常用入口，首个已验证账户成为唯一超管，访客浏览无需登录
- 登录用户通过统一的 `/submit` 页面提交作品，选择一个主分类和 1-6 个受控标签，明确标记原创、转载或改编，可多选实际验证过的 AI 工具，并可标记 NSFW；投稿默认进入审核
- 管理后台通过 `/admin` 提供总览、内容审核、评价审核、专栏、用户、分类和模型管理；生成模型的名称、说明、Logo、官网、排序与启停均来自 Supabase，可即时维护；内容可逐条编辑字段、标签、模型、精选状态、专栏归属及图片，并可单独移除图片，只有审核通过的作品才公开
- Cloudflare R2 保存生产图片；独立的私有 R2 桶长期归档压缩后的作品互动明细；Vercel 部署并通过 Web Analytics 与 Speed Insights 观察匿名访问和真实用户性能
- Supabase 是作品内容的唯一数据源；数据库为空时首页不展示作品
- 首页通过编辑精选、可分享的分类与标签筛选发现作品；独立专栏页按主题组织作品；详情页提供提示词复制、分类标签、作者、来源和已验证工具，多图作品通过轮播完整查看
- 首页采用服务端瀑布流分页：首张关键封面优先，其余图片原生懒加载；公开详情、单分类与单标签落地页进入 sitemap，组合筛选避免重复收录
- 详情页提供真实的浏览、复制、喜欢与生图语义表情 Reaction：浏览和复制按访客、作品、UTC 日期去重，喜欢与表情回应要求登录
- 登录用户可以在每条提示词下提交 10-500 字纯文字实测心得并标记使用平台；心得默认待审核，只有通过后才向访客公开

## 本地开发

```bash
npm install
npm run dev
```

复制 `.env.example` 为 `.env.local`，填入 Supabase 和 R2 公共域名。两项配置都是内容读取的必要条件，项目不提供本地数据回退。

认证、通用 SMTP、Resend 和邮件模板配置见 [`docs/AUTH.md`](docs/AUTH.md)。
作品上传、R2 服务端凭据、CORS 和 Supabase 迁移见 [`docs/UPLOADS.md`](docs/UPLOADS.md)。
管理员授权、用户角色、内容编辑、分类维护和 R2 删除边界见 [`docs/ADMIN.md`](docs/ADMIN.md)。
精选、专栏和实测心得的内容语义、审核与公开边界见 [`docs/EDITORIAL.md`](docs/EDITORIAL.md)。
作品浏览、复制、喜欢与表情 Reaction 的统计口径、权限和隐私边界见 [`docs/ENGAGEMENT.md`](docs/ENGAGEMENT.md)。
统计明细的在线保留期、私有 R2 归档、定时任务和故障恢复见 [`docs/ANALYTICS_RETENTION.md`](docs/ANALYTICS_RETENTION.md)。
可信数据集的幂等导入、R2 转存与异常记录边界见 [`docs/IMPORTS.md`](docs/IMPORTS.md)。

## 校验

```bash
npm run lint
npm run build
```
