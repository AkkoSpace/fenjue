# 焚诀

焚诀是一个面向大众的 AI 文生图提示词精选站：看到喜欢的图片，复制提示词，去豆包、Gemini、ChatGPT 或 Grok 重新生成。

## V0.1

- Next.js 16.2.12 + TypeScript + App Router
- Tailwind CSS 4 + shadcn/ui 4 + Lucide
- Supabase PostgreSQL 保存内容元数据与 R2 object key
- Supabase Auth 提供邮箱密码、邮箱验证和密码重置；访客浏览无需登录
- Cloudflare R2 保存生产图片，Vercel 部署
- 首批 3 条纯文生图案例，当前提供本地 seed fallback 以便开发
- 首页仅用于浏览作品，独立详情页提供提示词复制、作者和来源
- 天地玄黄 Reaction 规划在后续版本，V0.1 不预设等级或投票数据

## 本地开发

```bash
npm install
npm run dev
```

复制 `.env.example` 为 `.env.local`，填入 Supabase 和 R2 公共域名后，服务端会优先读取 Supabase；未配置时使用 `src/content/prompts.ts` 的本地 seed。

认证、通用 SMTP、Resend 和邮件模板配置见 [`docs/AUTH.md`](docs/AUTH.md)。

## 校验

```bash
npm run lint
npm run build
```
