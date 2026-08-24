# Sales Victory Studio

独立复刻的销售战报生成器，基于源站 `销售战报中心 · 战报生成器` 的真实页面和 API 契约实现。项目不依赖旧的 `knowledge_hub`。

## 功能

- 员工选择、USD/RMB 金额与累计金额、客户类型、日期
- 竖版 / 方形 / 横版 Canvas 画布
- 8 个视觉模板：翡翠荣耀、科技蓝光、鎏金荣耀、烈焰战魂、极光星海、紫曜银河、冰川银辉、玫瑰曜石
- 订单截图导入、cover/contain 适配
- Canvas 实时预览、生成 PNG、保存战报、复制图片、复制文案
- 员工、战报、文案、summary API 兼容层
- 写操作通过 `x-admin-key` 保护；读取接口可公开
- 可选 Supabase REST 持久化；未配置时使用实例内存，仅适合预览

## 运行

静态页面可直接打开 `public/index.html`。生产部署使用 Vercel：

```bash
npm install
npm run build
vercel --prod
```

## 环境变量

复制 `.env.example` 并在 Vercel Project Settings 配置：

- `ADMIN_API_KEY`：写操作必需，绝不能提交到仓库
- `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`：启用持久化时必填
- `SUPABASE_*_TABLE`：可选表名覆盖

Supabase 建议建立 `employees`、`reports`、`copies` 表；`reports` 至少包含 JSON 请求中的字段，`copies` 同理。生产环境应为 service role key 配置最小化访问策略，并使用独立项目。

## API

- `GET /api/health`
- `GET /api/employees`
- `POST/PATCH/DELETE /api/employees/:id`（需 `x-admin-key`）
- `GET/POST/DELETE /api/reports`（写操作需 key）
- `GET/POST/DELETE /api/copies`（写操作需 key）
- `GET /api/summary`

## 安全与维护

不要把密钥写进前端、提交到 Git 或放入截图。定期轮换 `ADMIN_API_KEY` 与 Supabase service role key；查看 Vercel Function Logs；为 Supabase 配置备份和 RLS；生产环境建议绑定自有域名并启用强制 HTTPS（Vercel 默认提供 HTTPS）。
