# 作品上传

焚诀采用一套通用的作品上传流程。访客仍然可以直接浏览和复制提示词；登录并完成邮箱验证的用户可以进入 `/submit` 发布作品。管理员没有单独的上传实现，只额外拥有全站内容管理权限。

## 发布范围

- 每组作品需要标题、完整提示词、作者名称与链接、来源链接。
- 每组作品支持 1-8 张 JPG、PNG、WebP 或 AVIF 图片。
- 单张图片不超过 10 MB，图片可以预览、删除和调整顺序。
- 第一版发布后直接公开，不做审核、授权确认、举报和下架工作流。
- 作品写入 `prompts.user_id`，普通用户只能管理自己的内容，管理员可以管理全部内容。

## 环境变量

将下面四项只配置在本地 `.env.local` 和部署平台的服务端环境变量中。它们不能使用 `NEXT_PUBLIC_` 前缀，也不能提交到 Git：

```dotenv
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=your_r2_bucket_name
```

`R2_PUBLIC_BASE_URL` 仍然只负责公开读取图片，例如 `https://fenjue-images.akko.space`。

## R2 CORS

在 R2 Bucket 的 Settings → CORS policy 中添加以下规则，并按实际正式站点域名补充 `AllowedOrigins`：

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://akko.space"
    ],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["cache-control", "content-type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

上传流程是浏览器先向 `/api/uploads/presign` 请求一个 5 分钟有效的短期 PUT 地址，再直接把文件传到 R2；Next.js 只保存 object key 和图片尺寸，不接收图片二进制。

## Supabase 迁移

在 Supabase SQL Editor 中执行 `supabase/migrations/20260806000000_enable_user_submissions.sql`。它会：

1. 给已有作品补充 `user_id`，优先归给最早创建的管理员账号。
2. 允许登录用户创建自己的作品，作者只能读取、修改和删除自己的作品。
3. 保留管理员全站管理权限。
4. 创建 `create_prompt_with_images` 事务函数，确保作品和图片记录一起写入。

迁移执行后，配置四个 R2 服务端变量并重启本地服务，再访问 `/submit` 进行首次真实上传。

## 已知限制

用户拿到预签名地址后如果中途关闭页面，会留下 R2 孤儿对象。第一版接受这个小概率成本，后续可用 R2 生命周期规则或定时任务清理未被 `prompt_images` 引用的对象；同时再加入限流、审核和举报流程。
