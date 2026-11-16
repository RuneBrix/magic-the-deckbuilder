import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cheapestPrintings, cheapestDeckPlan } from '../public/deck-prices.js';

const identity = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const printing = (id, eur, fields) => ({ oracle_id: identity(id), games: ['paper'], lang: 'en', finishes: ['nonfoil'], prices: { eur }, ...fields });

test('a verified minimum includes page five instead of remaining scan incomplete',async()=>{
  const quotes=await cheapestPrintings([printing(1,null)],async(_q,page)=>({data:[printing(1,page===5?'0.01':'9.00')],has_more:page<5}));
  assert.equal(quotes.get(identity(1)).cents,1);
});

test('cheapest printing uses exact rules identities and the lowest eligible quote across completed pages', async () => {
  const requests = [];
  const candidates = [printing(1,'2.50'), printing(2,null), printing(2,'10000000.01'), printing(1,'0.01',{lang:'ja'}),
    printing(1,'0.02',{games:['arena']}), printing(1,'0.03',{finishes:['foil']}), printing(3,'0.01')];
  const winner = printing(1,'0.33',{collector_number:'42'});
  const quotes = await cheapestPrintings([printing(1,null), printing(2,null), printing(1,null), {name:'No rules ID'}], async (query,page) => {
    requests.push({query,page});
    return page === 1 ? {data:candidates,has_more:true} : {data:[winner],has_more:false};
  });
  assert.deepEqual(requests.map(request => request.page),[1,2,1,2]);
  assert.equal(requests[0].query,`game:paper lang:en is:nonfoil unique:prints (oracleid:${identity(1)})`);
  assert.deepEqual([...quotes],[[identity(1),{cents:33,card:winner}],[identity(2),null]]);
});

test('one failed identity does not discard completed results and retry scans only unfinished cards', async () => {
  const cards=Array.from({length:9},(_,i)=>printing(i+1,'0.00'));
  const state={},calls=[];
  await cheapestPrintings(cards,async query=>{
    const id=query.match(/oracleid:([^ )]+)/)[1];calls.push(id);
    if(id===identity(1))throw Error('Offline');
    return {data:cards,has_more:false};
  },'EUR',{state});
  assert.equal(state.completed.size,8);
  assert.equal(state.errors.get(identity(1)),'Offline');
  assert.equal(state.quotes.get(identity(1)).incomplete,true);
  assert.equal(state.quotes.get(identity(9)).cents,0);
  calls.length=0;
  await cheapestPrintings(cards,async query=>{calls.push(query);return {data:[cards[0]],has_more:false};},'EUR',{state});
  assert.equal(calls.length,1);assert.match(calls[0],new RegExp(identity(1)));
  assert.equal(state.errors.size,0);assert.equal(state.completed.size,9);
});

test('scans cover more than 200 identities and deterministic ties, and distinguish no quote',async()=>{
  const cards=Array.from({length:205},(_,i)=>printing(i+1,'1.00'));
  const state={};let requests=0;
  await cheapestPrintings(cards,async query=>{
    requests++;
    const id=query.match(/oracleid:([^ )]+)/)[1],card=cards.find(card=>card.oracle_id===id);
    return {data:[{...card,id:'b'},{...card,id:'a'},...(id===identity(1)?[{...card,id:'cheaper',prices:{eur:'0.25'}}]:[])],has_more:false};
  },'EUR',{state});
  assert.equal(requests,205);assert.equal(state.quotes.size,205);
  assert.equal(state.quotes.get(identity(1)).cents,25);assert.equal(state.quotes.get(identity(205)).card.id,'a');
  const empty=await cheapestPrintings([cards[0]],async()=>({data:[],has_more:false}));
  assert.equal(empty.get(identity(1)),null);
});

test('cancellation retains complete cards, never exposes a partial minimum and resumes the interrupted card',async()=>{
  const cards=[printing(1,'1.00'),printing(2,'2.00')],controller=new AbortController(),state={};
  await assert.rejects(cheapestPrintings(cards,async query=>{
    if(query.includes(identity(1)))return {data:[cards[0]],has_more:false};
    controller.abort();return {data:[cards[1]],has_more:true};
  },'EUR',{state,signal:controller.signal}),{name:'AbortError'});
  assert.equal(state.quotes.size,1);assert.equal(state.quotes.get(identity(1)).cents,100);
  let requests=0;
  await cheapestPrintings(cards,async()=>{requests++;return {data:[cards[1]],has_more:false};},'EUR',{state});
  assert.equal(requests,1);assert.equal(state.quotes.get(identity(2)).cents,200);
});

test('failed rechecks retain last-complete quotes and malformed, throttled and excessive pages remain incomplete',async()=>{
  const good=printing(1,'2.00'),state={quotes:new Map([[identity(1),{cents:200,card:good}]])};
  await cheapestPrintings([good],async()=>{throw Object.assign(Error('Wait before retrying'),{status:429});},'EUR',{state});
  assert.equal(state.quotes.get(identity(1)).cents,200);assert.match(state.errors.get(identity(1)),/429/);
  const malformed=await cheapestPrintings([good],async()=>({data:[]}));
  assert.equal(malformed.get(identity(1)).incomplete,true);
  const endless=await cheapestPrintings([good],async()=>({data:[good],has_more:true}));
  assert.match(endless.get(identity(1)).error,/pagination limit/);assert.equal(endless.get(identity(1)).cents,undefined);
});

const stored=(id,printingId,zone='main',finish='regular',tags=['Draw'],qty=1)=>({card:{...printing(id,'9.00'),id:printingId,name:'Card '+id,type_line:'Creature',cmc:1,color_identity:[],set:'old'},zone,finish,tags,qty});
const deck=cards=>({id:'deck',name:'Test',format:'commander',currency:'EUR',cards});
const quote=(id,printingId='new')=>({cents:25,card:{...stored(id,printingId).card,set:'new',prices:{eur:'0.25'}}});

test('applying verified cheapest printings stages selected regular copies and merges variants without losing functions',()=>{
  const d=deck([stored(1,'old','main','regular',['Draw','Secondary'],2),stored(1,'new','main','regular',['Ramp'],1),stored(1,'foil','main','foil'),stored(1,'maybe','maybeboard'),stored(2,'missing')]);
  d.cards[1].card.legalities={commander:'legal'};d.cards[1].card.legalityUpdatedAt='2026-11-16T00:00:00Z';
  const state={currency:'EUR',status:'done',quotes:new Map([[identity(1),quote(1)]])},before=JSON.stringify(d);
  const plan=cheapestDeckPlan(d,state);
  assert.equal(plan.changed,2);assert.equal(plan.already,1);assert.equal(plan.skipped,2);assert.equal(plan.merged,1);
  assert.equal(plan.deck.cards[0].qty,3);assert.equal(plan.deck.cards[0].card.id,'new');
  assert.deepEqual(plan.deck.cards[0].tags,['Draw','Secondary','Ramp']);
  assert.equal(plan.deck.cards[0].card.legalityUpdatedAt,'2026-11-16T00:00:00Z');
  assert.equal(plan.deck.cards[1].finish,'foil');assert.equal(plan.deck.cards[2].card.id,'maybe');
  assert.equal(JSON.stringify(d),before);
});

test('application honors empty/single-zone scope and actual dollar quotes',()=>{
  const d=deck([stored(1,'main'),stored(1,'side','sideboard')]);
  d.budgetZones=[];
  const state={currency:'EUR',status:'done',quotes:new Map([[identity(1),quote(1)]])};
  assert.equal(cheapestDeckPlan(d,state).changed,0);
  d.budgetZones=['sideboard'];
  const plan=cheapestDeckPlan(d,state);assert.equal(plan.changed,1);assert.equal(plan.deck.cards[0].card.id,'main');
  d.currency='USD';state.currency='USD';state.quotes.get(identity(1)).card.prices.usd='0.50';
  assert.equal(cheapestDeckPlan(d,state).changed,0);
  state.quotes.get(identity(1)).cents=50;
  assert.equal(cheapestDeckPlan(d,state).changed,1);
});

test('printing application preserves zones, identities and latest legality, skips incomplete/basic/etched results and validates currency',()=>{
  const d=deck([stored(1,'command','command'),stored(1,'side','sideboard'),stored(2,'basic'),stored(3,'etched','main','etched'),stored(4,'incomplete')]);
  d.cards[0].card.legalities={commander:'legal'};d.cards[0].card.legalityUpdatedAt='2026-11-16T00:00:00Z';
  d.cards[2].card.type_line='Basic Land — Forest';
  const state={currency:'EUR',status:'done',quotes:new Map([1,2,3,4].map(id=>[identity(id),quote(id,'new-'+id)])),errors:new Map([[identity(4),'Offline']])};
  const plan=cheapestDeckPlan(d,state);
  assert.equal(plan.changed,2);assert.equal(plan.skipped,3);
  assert.deepEqual(plan.deck.cards.map(e=>e.zone),d.cards.map(e=>e.zone));
  assert.deepEqual(plan.deck.cards[0].card.legalities,{commander:'legal'});
  assert.equal(plan.deck.cards[4].card.id,'incomplete');
  assert.throws(()=>cheapestDeckPlan(d,{...state,currency:'USD'}),/currency/);
  assert.throws(()=>cheapestDeckPlan(d,{...state,status:'checking'}),/Finish a price check/);
  const cancelled=cheapestDeckPlan(d,{...state,status:'cancelled',completed:new Set()});
  assert.equal(cancelled.changed,0);assert.equal(cancelled.skipped,5);
});
