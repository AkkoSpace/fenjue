# 焚诀

焚诀是一个面向大众的 AI 文生图提示词精选站：看到喜欢的图片，复制提示词，去豆包、Gemini、ChatGPT 或 Grok 重新生成。

## V0.1

- Next.js 16.3.0 + TypeScript + App Router
- Tailwind CSS 4 + shadcn/ui 4 + Lucide
- Supabase PostgreSQL 保存内容元数据与 R2 object key
- Supabase Auth 提供邮箱密码、邮箱验证和密码重置；首个已验证账户成为唯一超管，访客浏览无需登录
- 登录用户通过统一的 `/submit` 页面上传作品；管理员通过 `/admin` 搜索、上下架和删除全站作品
- Cloudflare R2 保存生产图片，Vercel 部署并通过 Web Analytics 与 Speed Insights 观察匿名访问和真实用户性能
- Supabase 是作品内容的唯一数据源；数据库为空时首页不展示作品
- 首页仅用于浏览作品，独立详情页提供提示词复制、作者和来源
- 天地玄黄 Reaction 规划在后续版本，V0.1 不预设等级或投票数据

## 本地开发

```bash
npm install
npm run dev
```

复制 `.env.example` 为 `.env.local`，填入 Supabase 和 R2 公共域名。两项配置都是内容读取的必要条件，项目不提供本地数据回退。

认证、通用 SMTP、Resend 和邮件模板配置见 [`docs/AUTH.md`](docs/AUTH.md)。
作品上传、R2 服务端凭据、CORS 和 Supabase 迁移见 [`docs/UPLOADS.md`](docs/UPLOADS.md)。
管理员授权、内容管理和永久删除边界见 [`docs/ADMIN.md`](docs/ADMIN.md)。

## 校验

```bash
npm run lint
npm run build
```
