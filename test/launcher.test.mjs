import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {once} from 'node:events';
import {createServer} from 'node:net';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';

const launcher=fileURLToPath(new URL('../scripts/start.mjs',import.meta.url));
const wrapper=fileURLToPath(new URL('../Start Arcana.cmd',import.meta.url));
test('launcher checks Node and rejects unsupported arguments without starting a server',()=>{
  const result=spawnSync(process.execPath,[launcher,'--check'],{cwd:tmpdir(),encoding:'utf8'});
  assert.equal(result.status,0);assert.match(result.stdout,/launcher ready with Node/);assert.doesNotMatch(result.stdout,/Arcana is ready at/);
  const invalid=spawnSync(process.execPath,[launcher,'--typo'],{encoding:'utf8'});assert.equal(invalid.status,1);assert.match(invalid.stderr,/Usage:/);
});
test('launcher serves the real app from another directory and retains the requested origin',async()=>{
  const child=spawn(process.execPath,[launcher,'--no-open'],{cwd:tmpdir(),env:{...process.env,PORT:'0'},stdio:['ignore','pipe','pipe']});
  try{
    let output='';
    const url=await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('Launcher readiness timeout')),5000);
      child.stdout.on('data',chunk=>{output+=chunk;const match=output.match(/Open (http:\/\/127\.0\.0\.1:\d+) in the same browser/);if(match){clearTimeout(timer);resolve(match[1]);}});
      child.once('exit',code=>{clearTimeout(timer);reject(Error('Early launcher exit '+code));});
    });
    assert.match(output,/Keep this window open/);
    const response=await fetch(url);assert.equal(response.status,200);assert.match(await response.text(),/Arcana/);
  }finally{const stopped=once(child,'exit');child.kill();await stopped;}
});
test('an occupied port fails without stopping the existing listener or selecting a new origin',async()=>{
  const occupied=createServer();await new Promise(resolve=>occupied.listen(0,'127.0.0.1',resolve));
  try{
    const result=spawnSync(process.execPath,[launcher,'--no-open'],{env:{...process.env,PORT:String(occupied.address().port)},encoding:'utf8',timeout:5000});
    assert.equal(result.status,1);assert.match(result.stderr,/EADDRINUSE/);assert.doesNotMatch(result.stdout,/Open http/);assert.equal(occupied.listening,true);
  }finally{await new Promise(resolve=>occupied.close(resolve));}
});
test('Windows double-click wrapper handles spaces and missing Node', {skip:process.platform!=='win32'},()=>{
  const result=spawnSync(process.env.ComSpec,['/d','/s','/c','""'+wrapper+'" --check"'],{cwd:tmpdir(),encoding:'utf8',timeout:5000,windowsHide:true,windowsVerbatimArguments:true});
  assert.equal(result.status,0);assert.match(result.stdout,/launcher ready with Node/);
  const missing=spawnSync(process.env.ComSpec,['/d','/s','/c','""'+wrapper+'" --check"'],{cwd:tmpdir(),env:{...process.env,PATH:''},input:'\n',encoding:'utf8',timeout:5000,windowsHide:true,windowsVerbatimArguments:true});
  assert.equal(missing.status,1);assert.match(missing.stdout,/needs Node.js 22/);
});
