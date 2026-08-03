# 认证与邮件配置

焚诀采用访客优先模型：公开浏览和复制提示词无需登录；Supabase Auth 负责邮箱密码账户、邮箱验证、密码重置和会话。SMTP 由 Supabase 调用，应用不依赖具体邮件服务商。

## 应用环境变量

```dotenv
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
R2_PUBLIC_BASE_URL=https://fenjue-images.akko.space
```

生产环境将 `NEXT_PUBLIC_SITE_URL` 改为正式站点，例如 `https://fenjue.akko.space`。

## Supabase Auth

在 Supabase Dashboard 的 Authentication 配置中：

1. 启用 Email provider。
2. 开启 Confirm email。
3. 最小密码长度设置为 10。
4. 可用时开启 Leaked password protection。
5. Site URL 设置为正式站点地址。
6. Redirect URLs 添加 `http://localhost:3000/**` 和正式站点的 `/**`。

注册和密码重置均回到 `/auth/callback`，应用只接受站内 `next` 路径，防止开放重定向。

应用中的密码登录不是 passwordless：注册使用邮箱和密码，登录校验同一密码；确认邮件只用于证明邮箱归属，不代替密码。密码及其哈希均由 Supabase Auth 托管，不进入 `public.profiles`。

## 通用 SMTP

Supabase Dashboard 的 Authentication > SMTP Settings 接受任何标准 SMTP 服务：

| 字段 | 含义 |
|---|---|
| Host | SMTP 主机名 |
| Port | TLS/SSL 端口，通常为 465 或 587 |
| Username | SMTP 用户名 |
| Password | SMTP 密码或 API Key |
| Sender name | `焚诀` |
| Sender email | 已由邮件服务商验证的发件地址 |

这些凭据只保存在 Supabase，不写入 `.env.local`，也不进入浏览器或 GitHub。

## Resend

建议在 Resend 验证专用发送子域 `fenjue-mail.akko.space`，发件地址使用 `noreply@fenjue-mail.akko.space`。邮件子域与网站、R2 图片域名隔离，后续更换邮件服务时不会影响主域名。

| Supabase 字段 | Resend 值 |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | Resend API Key，格式为 `re_...` |
| Sender name | `焚诀` |
| Sender email | `noreply@fenjue-mail.akko.space` |

Resend API Key 不应发送到聊天、写入源码或截图保存。若使用其他 SMTP 服务商，只替换上表字段，应用代码无需修改。

### 配置顺序

1. 在 Resend 的 Domains 中添加 `fenjue-mail.akko.space`，把页面给出的 SPF/DKIM DNS 记录添加到域名解析并等待状态变为 Verified。
2. 在 Resend 创建仅用于焚诀发信的 API Key；不要复用其他项目的 Key。
3. 在 Supabase 的 Authentication > SMTP Settings 启用 Custom SMTP，按上表填写并保存。
4. 在 Supabase 的 Authentication > Email Templates 中配置确认注册和重置密码模板。
5. 用一个非管理员邮箱完整测试注册确认、退出登录、密码登录、忘记密码和更新密码。

SMTP 是部署外配置，因此仓库不会假装它已经生效。上线验收以 Supabase 发信成功、Resend Logs 显示 Delivered、收件箱中的确认/重置链接能回到正确站点为准。

## 邮件模板

- 邮箱确认：`supabase/templates/confirmation.html`
- 密码重置：`supabase/templates/recovery.html`

将模板内容分别粘贴到 Supabase 的 Confirm signup 和 Reset password 邮件模板。模板保留 `{{ .ConfirmationURL }}`，由 Supabase 生成一次性安全链接。

建议邮件主题分别使用：

- Confirm signup：`确认你的焚诀邮箱`
- Reset password：`重置你的焚诀密码`

## 管理员授权

所有新账户默认角色均为 `user`。完成首个管理员注册和邮箱验证后，在 SQL Editor 显式提升该账户：

```sql
update public.profiles
set role = 'admin'
where id = (
  select id from auth.users where email = 'your-admin-email@example.com'
);
```

管理员角色不能由用户自行修改。RLS 只允许用户读取自己的 profile，并仅能更新 `display_name`。
