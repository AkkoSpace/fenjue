# 内容批量导入

批量导入只用于可信来源的结构化内容。公开页面仍只读取 Supabase 与 R2，不会把 CSV 或本地检查点作为运行时数据源。

## Nano Banana Pro 数据集

`scripts/import-nano-banana-pro.mjs` 将 CSV 逐批转换为焚诀内容模型：

- `id` 作为 `external_id`，与 `import_source` 组成幂等业务键；重复执行不会新增副本。
- 原始提示词、作者与来源链接保持不变，内容关系标记为“转载”。
- 图片下载后最长边限制为 4096 像素，转换为 WebP，再写入 R2；object key 由外部 ID 与图片顺序确定，可断点续传。
- 自动映射一个主分类、最多 6 个受控标签，并点亮 Nano Banana。
- 没有图片或来源字段异常的记录仍会进入 Supabase，但保持下架，并在管理后台标注“待补图片”或“待复核”。
- NSFW 不在本轮自动识别范围内，所有导入记录默认 `is_nsfw = false`，后续由人工管理。

导入 RPC 是一次性维护入口，使用随机高强度密钥保护；完成全量导入后应立即撤销并删除。密钥只保存在被 `.gitignore` 排除的 `.env.import.local` 中。

先检查转换结果：

```bash
npm run import:nano-banana -- --file "C:\path\prompts.csv" --dry-run
```

小批量验证：

```bash
npm run import:nano-banana -- --file "C:\path\prompts.csv" --limit 10 --concurrency 2
```

全量执行：

```bash
npm run import:nano-banana -- --file "C:\path\prompts.csv" --concurrency 4
```

仅重试此前因图片处理失败进入“待复核”的记录：

```bash
npm run import:nano-banana -- --file "C:\path\prompts.csv" --retry-incomplete
```
