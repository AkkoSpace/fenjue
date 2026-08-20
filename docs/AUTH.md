# 认证与邮件配置

焚诀采用访客优先模型：公开浏览和复制提示词无需登录；Supabase Auth 负责邮箱密码账户、邮箱验证、密码重置和会话。SMTP 由 Supabase 调用，应用不依赖具体邮件服务商。

## 应用环境变量

```dotenv
NEXT_PUBLIC_SITE_URL=http://localhost:42486
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
6. Redirect URLs 添加 `http://localhost:42486/**` 和正式站点的 `/**`。

注册和密码重置邮件均携带一次性 `token_hash` 回到 `/auth/callback`，由服务端调用 `verifyOtp` 建立会话；确认链接不依赖注册时浏览器中的 PKCE Cookie，并且只接受站内 `next` 路径，防止开放重定向。回调继续兼容使用 `code` 的 OAuth/PKCE 流程。

登录页提供重新发送注册确认邮件的入口。接口对不存在、已确认和发送失败的邮箱返回相同的提示，避免暴露邮箱注册状态；Resend 或 Supabase 的发送频率限制仍然生效。

应用中的密码登录不是 passwordless：注册使用邮箱和密码，登录校验同一密码；确认邮件只用于证明邮箱归属，不代替密码。密码及其哈希均由 Supabase Auth 托管，不进入 `public.profiles`。

重复提交已注册邮箱不会创建第二个账户，也不会覆盖已有密码。启用邮箱确认后，Supabase 会对已确认账户返回模糊结果以防止邮箱枚举；应用不根据邮箱是否存在显示不同提示，而是统一引导新用户检查验证邮件、已有用户直接登录或找回密码。

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

Resend 使用已验证的根域 `akko.space`，发件地址使用简短的 `noreply@akko.space`。发送所需的 SPF、DKIM 与 MX 记录由 Resend 生成并托管在对应的 `send` 和 `_domainkey` 子域，不替换根域现有的收件 MX 配置。

| Supabase 字段 | Resend 值 |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | Resend API Key，格式为 `re_...` |
| Sender name | `焚诀` |
| Sender email | `noreply@akko.space` |

Resend API Key 不应发送到聊天、写入源码或截图保存。若使用其他 SMTP 服务商，只替换上表字段，应用代码无需修改。

### 配置顺序

1. 在 Resend 的 Domains 中添加 `akko.space`，把页面给出的 SPF/DKIM/MX DNS 记录添加到域名解析并等待状态变为 Verified。
2. 在 Resend 创建仅用于焚诀发信的 API Key；不要复用其他项目的 Key。
3. 在 Supabase 的 Authentication > SMTP Settings 启用 Custom SMTP，按上表填写并保存。
4. 在 Supabase 的 Authentication > Email Templates 中配置确认注册和重置密码模板。
5. 用一个非管理员邮箱完整测试注册确认、退出登录、密码登录、忘记密码和更新密码。

SMTP 是部署外配置，因此仓库不会假装它已经生效。上线验收以 Supabase 发信成功、Resend Logs 显示 Delivered、收件箱中的确认/重置链接能回到正确站点为准。

## 邮件模板

- 邮箱确认：`supabase/templates/confirmation.html`
- 密码重置：`supabase/templates/recovery.html`

将模板内容分别粘贴到 Supabase 的 Confirm signup 和 Reset password 邮件模板。模板必须保留 `{{ .RedirectTo }}` 与 `{{ .TokenHash }}`：`RedirectTo` 来自应用注册或找回密码时传入的站点回调地址，生产环境读取 `NEXT_PUBLIC_SITE_URL`，本地开发使用 `http://localhost:42486`。Supabase 的 Redirect URLs 必须同时允许这些地址。

按钮与其下方的可复制地址使用同一个一次性 `token_hash`，由应用服务端验证；不要改回依赖原浏览器 PKCE Cookie 的 `{{ .ConfirmationURL }}`。仓库中的模板不会自动同步到托管的 Supabase 项目，每次修改后都要重新粘贴并保存对应的 Dashboard 邮件模板。

建议邮件主题分别使用：

- Confirm signup：`确认你的焚诀邮箱`
- Reset password：`重置你的焚诀密码`

## 管理员授权

焚诀区分普通用户、管理员和唯一超级管理员：

- 普通用户的 `profiles.role` 为 `user`。
- 管理员的 `profiles.role` 为 `admin`，可以进入内容管理后台。
- 超级管理员同时满足 `role = 'admin'` 与 `is_super_admin = true`。

全新数据库执行 `20260730010000_create_profiles.sql` 后，第一个完成邮箱验证的账户会自动成为超级管理员。数据库使用事务级 advisory lock 和部分唯一索引，保证并发情况下最多只有一个超级管理员。当前开发库不保留历史兼容逻辑；重新初始化数据库后，需要重新注册并验证站点所有者账户。

普通管理员目前由数据库所有者在 SQL Editor 中显式授权；后续增加用户管理功能时，该操作只能开放给超级管理员：

```sql
update public.profiles
set role = 'admin'
where id = (
  select id from auth.users where email = 'your-admin-email@example.com'
)
and is_super_admin = false;
```

超级管理员转移必须在同一事务块中完成；目标邮箱不存在或尚未验证时整个操作会回滚：

```sql
do $$
declare
  target_user_id uuid;
begin
  select id
  into strict target_user_id
  from auth.users
  where lower(email) = lower('new-super-admin@example.com')
    and email_confirmed_at is not null;

  update public.profiles
  set is_super_admin = false
  where is_super_admin;

  update public.profiles
  set role = 'admin', is_super_admin = true
  where id = target_user_id;

  if not found then
    raise exception 'Target user profile does not exist';
  end if;
end;
$$;
```

管理员角色和超管标记都不能由普通用户自行修改。RLS 只允许用户读取自己的 profile，并仅能更新 `display_name`。新部署必须由站点所有者先完成首个账户的邮箱验证，再开放公开注册，避免陌生用户抢先成为初始化超管。

执行迁移后可以用下面的查询核对唯一超管：

```sql
select users.email, profiles.role, profiles.is_super_admin
from public.profiles as profiles
inner join auth.users as users on users.id = profiles.id
where profiles.is_super_admin;
```

查询应只返回一行，且 `role = 'admin'`、`is_super_admin = true`。
