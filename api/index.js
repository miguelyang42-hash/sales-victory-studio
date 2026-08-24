const memory = global.__SVS_MEMORY || (global.__SVS_MEMORY = {
  employees: [
    { id: 'sample', name: 'Bella Ling', image: '', positionY: 0.61 },
    { id: 'employee-msyrq5m7-miguel-yang-n40un', name: 'Miguel Yang', image: '', positionY: 0.07 },
    { id: 'employee-msyrqshk-leon-ling-clrri', name: 'Leon Ling', image: '', positionY: 0.05 },
    { id: 'employee-msyrr33r-penny-yang-0abio', name: 'Penny Yang', image: '', positionY: 0.05 },
    { id: 'employee-mt2phx86-bella-3712s', name: 'Bella', image: '', positionY: 0.05 }
  ], reports: [], copies: []
});
const tables = { employees: process.env.SUPABASE_EMPLOYEES_TABLE || 'employees', reports: process.env.SUPABASE_REPORTS_TABLE || 'reports', copies: process.env.SUPABASE_COPIES_TABLE || 'copies' };
const configured = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const adminOk = req => Boolean(process.env.ADMIN_API_KEY && (req.headers['x-admin-key'] === process.env.ADMIN_API_KEY || String(req.headers.cookie || '').split(';').some(v => v.trim() === `svs_admin=${process.env.ADMIN_API_KEY}`)));
const json = (res, code, value) => { res.statusCode = code; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Content-Type-Options', 'nosniff'); res.end(JSON.stringify(value)); };
const body = req => new Promise((resolve, reject) => { let raw = ''; req.on('data', chunk => { raw += chunk; if (raw.length > 35 * 1024 * 1024) reject(new Error('请求内容过大')); }); req.on('end', () => { try { resolve(raw ? JSON.parse(raw) : {}); } catch { reject(new Error('JSON 格式错误')); } }); req.on('error', reject); });
async function db(path, options = {}) { const r = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, { ...options, headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation', ...(options.headers || {}) } }); const text = await r.text(); if (!r.ok) throw new Error(`Supabase ${r.status}: ${text.slice(0, 500)}`); return text ? JSON.parse(text) : []; }
function dataImage(value) { const match = /^data:image\/(png|jpe?g|webp);base64,([a-z0-9+/=\r\n]+)$/i.exec(String(value || '')); if (!match) throw Object.assign(new Error('图片格式仅支持 PNG、JPG、WebP'), { statusCode: 400 }); return { type: match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase(), bytes: Buffer.from(match[2], 'base64') }; }
async function storagePut(bucket, path, bytes, contentType) { const r = await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/${bucket}/${path}`, { method: 'POST', headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': contentType, 'x-upsert': 'true' }, body: bytes }); if (!r.ok) throw new Error(`Storage ${r.status}: ${(await r.text()).slice(0, 500)}`); return `${process.env.SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`; }
async function storageDelete(bucket, path) { if (!path) return; const r = await fetch(`${process.env.SUPABASE_URL}/storage/v1/object/${bucket}`, { method: 'DELETE', headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [path] }) }); if (!r.ok && r.status !== 404) throw new Error(`Storage delete ${r.status}`); }
function storagePath(url, bucket) { const marker = `/storage/v1/object/public/${bucket}/`; const i = String(url || '').indexOf(marker); return i >= 0 ? String(url).slice(i + marker.length) : ''; }
async function list(kind) { return configured() ? db(`${tables[kind]}?select=*&order=createdAt.desc`) : memory[kind]; }
async function insert(kind, item) { if (configured()) { const rows = await db(tables[kind], { method: 'POST', body: JSON.stringify(item) }); return rows[0] || item; } memory[kind].unshift(item); return item; }
async function remove(kind, id) { if (configured()) { const rows = await db(`${tables[kind]}?id=eq.${encodeURIComponent(id)}&select=*`, { method: 'DELETE' }); return rows[0]; } const old = memory[kind].find(x => x.id === id); memory[kind] = memory[kind].filter(x => x.id !== id); return old; }
function makeId(prefix) { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`; }
module.exports = async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost'); const path = url.pathname.replace(/^\/api\/?/, '').replace(/\/$/, ''); const parts = path.split('/').filter(Boolean); const kind = parts[0];
  try {
    if (path === 'health') return json(res, 200, { status: 'ok', service: 'sales-victory-studio', persistence: configured() ? 'supabase' : 'memory', storage: configured() ? 'supabase-storage' : 'memory' });
    if (!['employees', 'reports', 'copies', 'summary'].includes(kind)) return json(res, 404, { error: '接口不存在' });
    if (req.method === 'GET') {
      if (kind === 'summary') { const [e, r, c] = await Promise.all([list('employees'), list('reports'), list('copies')]); return json(res, 200, { employees: e.length, reports: r.length, copies: c.length, totalAmountRmb: r.reduce((sum, item) => sum + Number(item.amountRmb || 0), 0) }); }
      return json(res, 200, (await list(kind)).slice(0, Number(url.searchParams.get('limit') || 500)));
    }
    if (!adminOk(req)) return json(res, 401, { error: '需要管理员授权' });
    if (req.method === 'DELETE' && parts[1]) { const old = await remove(kind, parts[1]); if (old?.image) await storageDelete(kind === 'reports' ? 'reports' : 'assets', storagePath(old.image, kind === 'reports' ? 'reports' : 'assets')); return json(res, 200, { ok: true }); }
    const input = await body(req);
    if (kind === 'employees' && req.method === 'PATCH' && parts[1]) { const current = (await list('employees')).find(item => item.id === parts[1]); if (!current) return json(res, 404, { error: '员工不存在' }); const updated = { ...current, ...input, id: parts[1] }; if (input.imageData) { const image = dataImage(input.imageData); updated.image = await storagePut('assets', `employees/${parts[1]}.${image.type}`, image.bytes, `image/${image.type}`); delete updated.imageData; } await remove('employees', parts[1]); return json(res, 200, await insert('employees', updated)); }
    if (req.method !== 'POST') return json(res, 405, { error: '方法不允许' });
    if (kind === 'employees') { if (!input.name || !input.imageData) return json(res, 400, { error: '员工姓名和图片不能为空' }); const image = dataImage(input.imageData); const employeeId = input.id || makeId('employee'); const item = { id: employeeId, name: String(input.name).slice(0, 30), image: await storagePut('assets', `employees/${employeeId}.${image.type}`, image.bytes, `image/${image.type}`), positionY: Number.isFinite(Number(input.positionY)) ? Number(input.positionY) : 0.2, createdAt: new Date().toISOString() }; return json(res, 201, await insert('employees', item)); }
    if (kind === 'reports') { const image = dataImage(input.imageData); const reportId = input.id || makeId('report'); const imageUrl = await storagePut('reports', `${reportId}.png`, image.bytes, 'image/png'); const item = { ...input, id: reportId, image: imageUrl, imageData: undefined, createdAt: input.createdAt || new Date().toISOString() }; delete item.imageData; return json(res, 201, await insert('reports', item)); }
    if (kind === 'copies' && !input.copyText) return json(res, 400, { error: '文案不能为空' });
    const item = { ...input, id: input.id || makeId('copy'), createdAt: input.createdAt || new Date().toISOString() }; return json(res, 201, await insert('copies', item));
  } catch (error) { console.error('[SVS API]', error); return json(res, error.statusCode || 500, { error: error.message || '服务器错误' }); }
};
