const memory = global.__SVS_MEMORY || (global.__SVS_MEMORY = {
  employees: [
    { id: 'bella-ling', name: 'Bella Ling', image: '', positionY: 0.5 },
    { id: 'miguel-yang', name: 'Miguel Yang', image: '', positionY: 0.5 },
    { id: 'leon-ling', name: 'Leon Ling', image: '', positionY: 0.5 },
    { id: 'penny-yang', name: 'Penny Yang', image: '', positionY: 0.5 },
    { id: 'bella', name: 'Bella', image: '', positionY: 0.5 }
  ], reports: [], copies: []
});
const tables = { employees: process.env.SUPABASE_EMPLOYEES_TABLE || 'employees', reports: process.env.SUPABASE_REPORTS_TABLE || 'reports', copies: process.env.SUPABASE_COPIES_TABLE || 'copies' };
const configured = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const adminOk = req => Boolean(process.env.ADMIN_API_KEY && req.headers['x-admin-key'] === process.env.ADMIN_API_KEY);
const json = (res, code, body) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(body)); };
const body = req => new Promise((resolve, reject) => { let raw=''; req.on('data', c => { raw += c; if (raw.length > 12 * 1024 * 1024) reject(new Error('请求体过大')); }); req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('JSON 格式错误')); } }); req.on('error', reject); });
async function db(path, options = {}) { const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, { ...options, headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(options.headers || {}) } }); const text = await r.text(); if (!r.ok) throw new Error(`Supabase ${r.status}: ${text.slice(0, 500)}`); return text ? JSON.parse(text) : []; }
async function list(kind) { return configured() ? db(`${tables[kind]}?select=*&order=createdAt.desc`) : memory[kind]; }
async function insert(kind, item) { if (configured()) { const rows = await db(tables[kind], { method: 'POST', body: JSON.stringify(item) }); return rows[0] || item; } memory[kind].unshift(item); return item; }
async function remove(kind, id) { if (configured()) { await db(`${tables[kind]}?id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' }); return; } memory[kind] = memory[kind].filter(x => x.id !== id); }
function id(prefix) { return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`; }
module.exports = async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost'); const path = url.pathname.replace(/^\/api\/?/, '').replace(/\/$/, ''); const parts = path.split('/').filter(Boolean); const kind = parts[0];
  try {
    if (path === 'health') return json(res, 200, { status: 'ok', service: 'sales-victory-studio', persistence: configured() ? 'supabase' : 'memory' });
    if (!['employees','reports','copies','summary'].includes(kind)) return json(res, 404, { error: '接口不存在' });
    if (req.method === 'GET') {
      if (kind === 'summary') { const [e,r,c] = await Promise.all([list('employees'), list('reports'), list('copies')]); return json(res, 200, { employees: e.length, reports: r.length, copies: c.length, totalAmountRmb: r.reduce((s,x) => s + Number(x.amountRmb || 0), 0) }); }
      const rows = await list(kind); return json(res, 200, rows.slice(0, Number(url.searchParams.get('limit') || 500)));
    }
    if (!adminOk(req)) return json(res, 401, { error: '需要管理员授权' });
    if (req.method === 'DELETE' && parts[1]) { await remove(kind, parts[1]); return json(res, 200, { ok: true }); }
    const input = await body(req);
    if (kind === 'employees' && req.method === 'PATCH' && parts[1]) { const current = (await list('employees')).find(x => x.id === parts[1]); if (!current) return json(res, 404, { error: '员工不存在' }); const updated = { ...current, ...input, id: parts[1] }; await remove('employees', parts[1]); return json(res, 200, await insert('employees', updated)); }
    if (req.method !== 'POST') return json(res, 405, { error: '方法不允许' });
    if (kind === 'employees' && !input.name) return json(res, 400, { error: '员工姓名不能为空' });
    if (kind === 'reports' && (!input.imageData || !/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(input.imageData))) return json(res, 400, { error: '图片格式仅支持 PNG、JPG、WebP' });
    if (kind === 'copies' && !input.copyText) return json(res, 400, { error: '文案不能为空' });
    const item = { ...input, id: input.id || id(kind.slice(0, -1)), createdAt: input.createdAt || new Date().toISOString() }; return json(res, 201, await insert(kind, item));
  } catch (e) { console.error('[SVS API]', e); return json(res, 500, { error: e.message || '服务器错误' }); }
};
