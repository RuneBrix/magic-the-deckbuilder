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
    for (const query of ['oracle=invalid', 'oracle=00000000-0000-0000-0000-000000000000&page=0', 'oracle=00000000-0000-0000-0000-000000000000&page=1.5', 'oracle=https://example.com']) assert.equal((await fetch(base+'/api/printings?'+query)).status,400);
    assert.equal((await fetch(base + '/api/nope')).status, 404);
  } finally { child.kill(); }
});


test('printing proxy fixes upstream identity/scope, supports pagination and shares the response cache',async()=>{
  const oracle='00000000-0000-0000-0000-000000000001';
  const stub=`let calls=0;globalThis.fetch=async(url,options)=>{
    const u=new URL(url);
    if(u.origin!=='https://api.scryfall.com'||u.pathname!=='/cards/search'||u.searchParams.get('q')!=='oracleid:${oracle} game:paper'||u.searchParams.get('unique')!=='prints'||u.searchParams.get('order')!=='released'||u.searchParams.get('dir')!=='desc')throw Error('Unexpected upstream request');
    if(!options.headers['User-Agent']||options.method!=='GET')throw Error('Missing request policy');
    calls++;return {ok:true,json:async()=>({data:[{id:'printing-'+u.searchParams.get('page')}],has_more:u.searchParams.get('page')==='1',calls})};
  };await import('./server.mjs');`;
  const child=spawn(process.execPath,['--input-type=module','--eval',stub],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:'0'},stdio:['ignore','pipe','pipe']});
  try {
    const [output]=await once(child.stdout,'data',{signal:AbortSignal.timeout(5000)});
    const base='http://127.0.0.1:'+output.toString().match(/localhost:(\d+)/)[1];
    const response=await fetch(base+'/api/printings?oracle='+oracle);assert.equal(response.status,200);
    const first=await response.json();assert.equal(first.data[0].id,'printing-1');assert.equal(first.has_more,true);assert.equal(first.calls,1);
    const cached=await (await fetch(base+'/api/printings?oracle='+oracle)).json();assert.equal(cached.calls,1);
    const second=await (await fetch(base+'/api/printings?oracle='+oracle+'&page=2')).json();assert.equal(second.data[0].id,'printing-2');assert.equal(second.calls,2);
  }finally{child.kill();}
});
