# 管理后台服务模块

该模块承载 `/admin` 的内容查询与变更操作，为管理员提供全站文生图作品维护能力。

## 为什么存在

公开浏览和普通用户上传不应直接依赖管理逻辑。管理查询、权限校验后的上下架与永久删除集中在这里，避免后台能力散落到页面组件或公开内容模块。

## 核心职责

- `queries.ts`：解析和约束筛选参数，查询管理员作品列表与状态计数。
- `actions.ts`：执行上下架和永久删除，并刷新公开作品缓存。
- 所有入口均通过 `requireAdmin()` 校验当前 Supabase 用户的管理员角色。

本模块不负责管理员授权、上传流程、用户管理、审核队列或统计系统。管理员授权由 Supabase `profiles.role` 控制，上传统一使用 `/submit`。

## 依赖关系

- 依赖 `src/lib/auth/authorization.ts` 完成服务端管理员鉴权。
- 依赖 Supabase RLS 作为数据权限的最终边界。
- 永久删除依赖 `src/lib/r2/server.ts` 清理图片对象。
- `/admin` 页面和后台表单组件调用本模块。

## 使用方式

页面读取列表：

```ts
const data = await getAdminPrompts(searchParams);
```

变更操作只作为 Next.js Server Action 绑定到后台表单，不应从客户端直接封装管理凭据。

完整的产品边界和配置说明见 `docs/ADMIN.md`。
