import { spawn } from 'node:child_process';
import { once } from 'node:events';

if (Number(process.versions.node.split('.')[0]) < 22) {
  console.error('Arcana needs Node.js 22 or later. Install a supported Node version, then launch again.');
  process.exit(1);
}
const args=process.argv.slice(2);
if(args.some(arg=>!['--check','--no-open'].includes(arg))){console.error('Usage: node scripts/start.mjs [--check | --no-open]');process.exit(1);}
if(args.includes('--check')){
  console.log('Arcana launcher ready with Node '+process.version);
}else{
  console.log('Keep this window open while using Arcana. Press Ctrl+C to stop.');
  console.log('If the port is already in use, stop your earlier Arcana server. No other process will be stopped.');
  const {server}=await import('../server.mjs');
  if(!server.listening)await once(server,'listening');
  const url='http://127.0.0.1:'+server.address().port;
  console.log('Open '+url+' in the same browser/profile each time to keep your decks.');
  if(!args.includes('--no-open')){
    const command=process.platform==='win32'?'cmd.exe':process.platform==='darwin'?'open':'xdg-open';
    const commandArgs=process.platform==='win32'?['/d','/c','start','',url]:[url];
    const browser=spawn(command,commandArgs,{stdio:'ignore',detached:true,windowsHide:true});
    const fallback=()=>console.error('Could not open your browser automatically. Open '+url+' manually; the server is still running.');
    browser.on('error',fallback);
    browser.on('exit',code=>{if(code)fallback();});
    browser.unref();
  }
}
