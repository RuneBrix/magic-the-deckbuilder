import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createScryfallClient } from './scryfall-client.mjs';

const root = path.resolve(fileURLToPath(new URL('./public/', import.meta.url)));
const scryfall = createScryfallClient();

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
        const payload=JSON.parse(raw), key=payload && Object.hasOwn(payload,'ids')?'ids':'names', values=payload?.[key];
        if ((payload?.names!==undefined && payload?.ids!==undefined) || !Array.isArray(values) || !values.length || values.length>75 || values.some(value=>typeof value!=='string' || (key==='ids'?!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value):!value.trim() || value.length>200))) throw Object.assign(new Error('Send 1–75 card names or printing UUIDs, using exactly one list.'), {status:400});
        data = await scryfall('/cards/collection', { identifiers: values.map(value => key==='ids'?{id:value}:{name:value}) });
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
    if(error.retryAfter)res.setHeader('Retry-After',String(error.retryAfter));
    res.writeHead(error.status || (error.code === 'ENOENT' ? 404 : 502), { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: error.message === 'fetch failed' ? 'Cannot reach Scryfall. Check your internet connection, then try again.' : error.message,...(error.retryAfter?{retryAfter:error.retryAfter}:{}) }));
  }
}).listen(Number(process.env.PORT || 3000), '127.0.0.1', () => console.log('Arcana is ready at http://localhost:' + server.address().port));
