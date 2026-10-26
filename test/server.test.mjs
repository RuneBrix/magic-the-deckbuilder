import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

test('server serves the app, rejects traversal and validates API requests', async () => {
  const child = spawn(process.execPath, ['server.mjs'], { cwd: new URL('../', import.meta.url), env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    const [output] = await once(child.stdout, 'data', { signal: AbortSignal.timeout(5000) });
    const port = output.toString().match(/localhost:(\d+)/)?.[1];
    assert.ok(port);
    const base = 'http://127.0.0.1:' + port;
    const home = await fetch(base);
    assert.equal(home.status, 200);
    assert.match(await home.text(), /Arcana/);
    assert.match((await fetch(base + '/app.js')).headers.get('content-type'), /javascript/);
    const font = await fetch(base + '/fonts/PublicSans.ttf');
    assert.equal(font.status, 200);
    assert.equal(font.headers.get('content-type'), 'font/ttf');
    assert.equal((await fetch(base + '/%2e%2e%2fpackage.json')).status, 403);
    assert.equal((await fetch(base + '/api/search?q=&page=-1')).status, 400);
    assert.equal((await fetch(base + '/api/collection', { method: 'POST', body: JSON.stringify({ names: [] }) })).status, 400);
    assert.equal((await fetch(base + '/api/nope')).status, 404);
  } finally { child.kill(); }
});
