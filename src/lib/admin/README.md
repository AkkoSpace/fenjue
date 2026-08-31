# 管理后台服务模块

该模块承载管理后台的数据查询与变更操作，为管理员提供内容、编辑推荐、评价审核、用户角色、受控分类和生成模型目录维护能力。

## 为什么存在

公开浏览和普通用户上传不应直接依赖管理逻辑。管理查询、权限校验后的编辑与授权集中在这里，避免后台能力散落到页面组件或公开内容模块。

## 核心职责

- `queries.ts`：查询总览与作品互动汇总、可组合筛选的作品列表、单条详情与相邻审核项，以及用户和分类词表。
- `analytics-queries.ts`：读取匿名事件在线量、私有归档计数和配置就绪状态，不查询事件内容。
- `actions.ts`：执行单条作品编辑、审核决策和永久删除。
- `user-actions.ts`：调整普通用户与普通管理员角色，仅允许唯一超级管理员调用。
- `taxonomy-actions.ts`：创建、编辑和停用受控分类与标签。
- `ai-tool-queries.ts` / `ai-tool-actions.ts`：读取模型引用统计，创建、编辑、停用或安全删除生成模型。
- `source-platform-queries.ts` / `source-platform-actions.ts`：维护提示词来源平台的名称、Logo、品牌色、官网、排序与启停。
- `editorial-queries.ts` / `editorial-actions.ts`：查询、创建、编辑和发布专栏。
- `comment-queries.ts` / `comment-actions.ts`：分页读取实测心得并执行通过或驳回。
- `action-utils.ts`：统一约束后台返回地址、消息参数和基础输入。
- 所有入口均通过 `requireAdmin()` 校验当前 Supabase 用户的管理员角色。

本模块不负责通用上传、举报、封禁、评价回复、互动明细或趋势分析。管理员授权由 Supabase `profiles.role` 控制，唯一超管由 `profiles.is_super_admin` 标记；投稿统一使用 `/submit`。

## 依赖关系

- 依赖 `src/lib/auth/authorization.ts` 完成服务端管理员鉴权。
- 依赖 Supabase RLS 作为数据权限的最终边界。
- 单图移除和永久删除依赖 `src/lib/r2/server.ts` 清理图片对象。
- `/admin`、`/admin/content`、`/admin/comments`、`/admin/collections`、`/admin/users`、`/admin/taxonomy`、`/admin/models`、`/admin/platforms` 页面和后台组件调用本模块。

## 使用方式

页面读取列表：

```ts
const data = await getAdminPrompts(searchParams);
```

单条作品编辑通过事务 RPC 更新多张表；审核动作会在成功后按当前筛选队列跳到下一条，并从 `prompt_reviews` 读取可审计历史。变更操作只作为 Next.js Server Action 绑定到后台表单，不应从客户端封装管理凭据。

完整的产品边界和配置说明见 `docs/ADMIN.md`。
