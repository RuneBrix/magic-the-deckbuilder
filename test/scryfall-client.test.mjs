import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createScryfallClient} from '../scryfall-client.mjs';

test('all upstream requests share conservative pacing and duplicate pending lookups coalesce',async()=>{
  let time=0;const starts=[];
  const client=createScryfallClient({now:()=>time,sleep:async ms=>{time+=ms;},fetchImpl:async()=>{starts.push(time);return {ok:true,json:async()=>({data:[]})};}});
  await Promise.all([client('/cards/collection',{identifiers:[{name:'Forest'}]}),client('/cards/collection',{identifiers:[{name:'Forest'}]}),client('/cards/search?q=Island')]);
  assert.deepEqual(starts,[0,600]);await client('/cards/search?q=Island');assert.equal(starts.length,2);
});

test('429 stops queued and new upstream traffic until Retry-After expires',async()=>{
  let time=0,calls=0;
  const client=createScryfallClient({now:()=>time,sleep:async ms=>{time+=ms;},fetchImpl:async()=>{calls++;return calls===1?{status:429,headers:{get:()=> '90'}}:{ok:true,json:async()=>({data:[]})};}});
  const results=await Promise.allSettled([client('/first'),client('/queued'),client('/queued-again')]);
  assert.equal(calls,1);for(const result of results){assert.equal(result.status,'rejected');assert.equal(result.reason.status,429);assert.equal(result.reason.retryAfter,90);}
  time=89_000;await assert.rejects(client('/new'),{status:429,retryAfter:1});assert.equal(calls,1);
  time=90_000;await client('/resume');assert.equal(calls,2);
});

test('429 without headers still enforces at least a 60-second cooldown',async()=>{
  const client=createScryfallClient({now:()=>0,fetchImpl:async()=>({status:429})});
  await assert.rejects(client('/first'),{status:429,retryAfter:60});
});
