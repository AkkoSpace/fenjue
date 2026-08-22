# 作品上传

焚诀采用一套通用的作品投稿流程。访客仍然可以直接浏览和复制提示词；登录并完成邮箱验证的用户可以进入 `/submit` 提交作品。管理员没有单独的上传实现，只额外拥有全站审核与内容管理权限。

## 投稿范围

- 每组作品需要标题、完整提示词、作者名称与链接、来源链接。
- 每组作品必须选择一个主分类，并从受控词表选择 1-6 个标签；分类用于一级发现，标签用于风格、形式和主题交叉检索。
- 每组作品必须标记为原创、转载或改编；已有网络收集内容默认记为转载。
- 每组作品可以多选实际生成或验证过的工具；未验证时留空，不把“可能可用”标记为“已验证”。
- 每组作品支持 1-8 张 JPG、PNG、WebP 或 AVIF 图片。
- 每组作品可以标记为 NSFW；公开图片默认模糊，访客主动点击后才在当前页面显示。
- 单张图片不超过 10 MB，图片可以预览、删除和调整顺序。
- 投稿默认进入待审核，只有管理员审核通过后才会公开；驳回时会给出原因，当前不做授权确认和举报工作流。
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
      "http://localhost:42486",
      "https://fenjue.akko.space"
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

按时间顺序执行 `supabase/migrations/` 中的迁移，包括最新的 `20260822090000_add_prompt_engagement.sql`。它们会：

1. 给已有作品补充 `user_id`，优先归给最早创建的管理员账号。
2. 允许登录用户创建自己的作品，作者只能读取、修改和删除自己的作品。
3. 保留管理员全站管理权限。
4. 创建 `create_prompt_with_images` 事务函数，确保作品和图片记录一起写入。
5. 增加作品级 `is_nsfw` 标记，并为新上传函数保留旧签名兼容入口。
6. 增加 `content_relation` 字段，已有内容默认为转载，并保留旧上传函数签名。
7. 增加工具目录与作品—工具多对多关系，让一条作品可以点亮多个已验证工具。
8. 增加单选主分类和多选标签目录，精确回填已有作品，并要求新作品选择 1-6 个有效标签。
9. 将标签读取策略按匿名与已登录角色拆分，避免同一次查询重复评估多条宽松策略。
10. 增加待审核、已通过和已驳回状态；新投稿默认待审核，只有审核通过内容可被公开读取。
11. 记录每次管理员审核结论，并在普通投稿者修改内容时强制重新进入审核。
12. 增加作品级浏览、复制、喜欢和天地玄黄 Reaction，并限制底层互动表只能通过受控 RPC 写入。

迁移执行后，配置四个 R2 服务端变量并重启本地服务，再访问 `/submit` 进行首次真实上传。

## 已知限制

用户拿到预签名地址后如果中途关闭页面，会留下 R2 孤儿对象。当前接受这个小概率成本，后续可用 R2 生命周期规则或定时任务清理未被 `prompt_images` 引用的对象；限流和举报流程仍留到后续版本。
