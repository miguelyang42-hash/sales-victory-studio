# Sales Victory Studio

基于真实源站 `销售战报中心 · 战报生成器` 备份迁移的安全云端版。保留原 `index.html`、`admin.html` 的页面结构、Canvas 绘制、8 套模板、字段和 API 契约；不依赖局域网本地 JSON。

## 功能

- 5 名员工与原始员工头像资源
- USD/RMB 金额与累计金额，USD 汇率 6.7
- 新客户/老客户、日期、竖版/方形/横版
- 原始 8 套模板、cover/contain 截图适配、拖拽上传
- Canvas 预览、PNG 下载、战报保存、图片复制、确定性文案生成/复制
- `admin.html` 员工管理、战报/文案历史、统计
- Supabase PostgREST 表持久化和 Storage 对象存储
- 所有 POST/PATCH/PUT/DELETE 通过 `x-admin-key` 或当前会话密钥保护

## 环境变量

只在 Vercel Project Settings 配置，不要写入仓库：

- `ADMIN_API_KEY`：高熵管理员密钥；前端只通过当前浏览器 `sessionStorage` 保存会话值
- `SUPABASE_URL`：Supabase Project URL
- `SUPABASE_SERVICE_ROLE_KEY`：Supabase service role secret，绝不能暴露到前端
- 可选：`SUPABASE_EMPLOYEES_TABLE`、`SUPABASE_REPORTS_TABLE`、`SUPABASE_COPIES_TABLE`

## Supabase 建表 SQL

```sql
create table if not exists public.employees (
  id text primary key, name text not null, image text, "positionY" numeric,
  "createdAt" timestamptz default now(), "updatedAt" timestamptz default now()
);
create table if not exists public.reports (
  id text primary key, "employeeId" text, "employeeName" text, "employeeImage" text,
  amount text, currency text, "amountRmb" numeric, "cumulativeAmount" text,
  "cumulativeCurrency" text, "cumulativeRmb" numeric, customer text,
  "reportDate" date, ratio text, theme text, "screenshotName" text,
  "copyText" text, image text, "createdAt" timestamptz default now()
);
create table if not exists public.copies (
  id text primary key, "employeeId" text, "employeeName" text,
  "amountRmb" numeric, "cumulativeRmb" numeric, customer text,
  "reportDate" date, "copyText" text, "createdAt" timestamptz default now()
);
insert into public.employees (id,name,"positionY") values
('sample','Bella Ling',0.61),
('employee-msyrq5m7-miguel-yang-n40un','Miguel Yang',0.07),
('employee-msyrqshk-leon-ling-clrri','Leon Ling',0.05),
('employee-msyrr33r-penny-yang-0abio','Penny Yang',0.05),
('employee-mt2phx86-bella-3712s','Bella',0.05)
on conflict (id) do nothing;
```

Create public Storage buckets named `assets` and `reports`. Keep service-role access server-side; public read is required only for report/employee image URLs. Add Storage policies according to your organization policy, or proxy downloads through an authenticated endpoint.

## Deploy

```bash
npm install
npm run build
vercel --prod
```

Vercel rewrites `/` to `public/index.html`, `/admin.html` to `public/admin.html`, and `/api/*` to the Node serverless handler. After setting variables, redeploy and verify `/api/health` returns `persistence: supabase` and `storage: supabase-storage`.

## Verification and maintenance

- `GET /api/health`, `/api/employees`, `/api/reports`, `/api/copies`, `/api/summary` are read checks.
- Every write must carry `x-admin-key`; no-key requests return 401.
- Create a uniquely titled test report, GET it again with a cache-buster, then delete it and verify it is gone.
- Back up Supabase tables and Storage objects; rotate `ADMIN_API_KEY` and service-role credentials periodically; inspect Vercel Function Logs; never commit `.env` or secrets.
