import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(fileURLToPath(new URL('./public/', import.meta.url)));
const cache = new Map();
let queue = Promise.resolve();
// Every request, including imports and refreshes, shares Scryfall's rate limit.
function scryfall(route, body) {
  const key = route + JSON.stringify(body ?? '');
  const hit = cache.get(key);
  if (hit && Date.now() - hit.time < 300_000) return Promise.resolve(hit.data);
  const task = queue.then(async () => {
    const response = await fetch('https://api.scryfall.com' + route, {
      headers: { 'User-Agent': 'ArcanaDeckbuilder/0.1 (local deckbuilding app)', Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      method: body ? 'POST' : 'GET', body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
    const data = await response.json();
    if (!response.ok) throw Object.assign(new Error(data.details || 'Scryfall is unavailable.'), { status: response.status });
    cache.set(key, { time: Date.now(), data });
    if (cache.size > 100) cache.delete(cache.keys().next().value);
    return data;
  });
  queue = task.catch(() => {}).then(() => new Promise(resolve => setTimeout(resolve, 120)));
  return task;
}

export const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (url.pathname.startsWith('/api/')) {
      res.setHeader('Content-Type', 'application/json');
      let data;
      if (url.pathname === '/api/search' && req.method === 'GET') {
        const q = url.searchParams.get('q')?.trim();
        const page = Number(url.searchParams.get('page') || 1);
        const order = url.searchParams.get('order') || 'edhrec';
        if (!q || q.length > 1500 || !Number.isInteger(page) || page < 1 || page > 1000 || !['name', 'cmc', 'edhrec', 'usd'].includes(order)) throw Object.assign(new Error('Invalid search parameters.'), { status: 400 });
        data = await scryfall('/cards/search?' + new URLSearchParams({ q, page, order, unique: 'cards' }));
      } else if (url.pathname === '/api/printings' && req.method === 'GET') {
        const oracle = url.searchParams.get('oracle');
        const page = Number(url.searchParams.get('page') || 1);
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(oracle || '') || !Number.isInteger(page) || page < 1 || page > 1000) throw Object.assign(new Error('Invalid printing parameters.'), { status: 400 });
        data = await scryfall('/cards/search?' + new URLSearchParams({ q: 'oracleid:' + oracle + ' game:paper', page, unique: 'prints', order: 'released', dir: 'desc' }));
      } else if (url.pathname === '/api/collection' && req.method === 'POST') {
        let raw = '';
        for await (const chunk of req) { raw += chunk; if (raw.length > 32_000) throw Object.assign(new Error('Import is too large.'), { status: 413 }); }
        const { names } = JSON.parse(raw);
        if (!Array.isArray(names) || !names.length || names.length > 75 || names.some(n => typeof n !== 'string' || n.length > 200)) throw Object.assign(new Error('Send between 1 and 75 card names.'), { status: 400 });
        data = await scryfall('/cards/collection', { identifiers: names.map(name => ({ name })) });
      } else throw Object.assign(new Error('Endpoint not found.'), { status: 404 });
      res.end(JSON.stringify(data));
      return;
    }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
    const file = path.resolve(root, '.' + decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    const content = await readFile(file);
    res.setHeader('Content-Type', ({ '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.ttf': 'font/ttf' })[path.extname(file)] || 'application/octet-stream');
    res.end(req.method === 'HEAD' ? undefined : content);
  } catch (error) {
    res.writeHead(error.status || (error.code === 'ENOENT' ? 404 : 502), { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message === 'fetch failed' ? 'Cannot reach Scryfall. Check your internet connection, then try again.' : error.message }));
  }
}).listen(Number(process.env.PORT || 3000), '127.0.0.1', () => console.log('Arcana is ready at http://localhost:' + server.address().port));
