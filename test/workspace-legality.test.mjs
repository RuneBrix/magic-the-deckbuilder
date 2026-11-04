import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import * as core from '../public/core.js';
import { workspace, editorCard, editorDeck, formValues, chooseWorkspaceFile, startCardDrag, dropCard } from '../test-support/workspace.mjs';

test('automatic refresh schedules only the tracked/open deck, deduplicates printing ids and preserves live edits and printing',async()=>{
  const d=editorDeck();d.cards.push({...structuredClone(d.cards[1]),zone:'sideboard'});
  const w=workspace({savedDecks:JSON.stringify([d,{...editorDeck(),id:'other'}])});
  assert.equal(vm.runInContext('legalityStates.size',w.context),1);
  assert.match(w.node('#app').innerHTML,/Refreshing legality/);
  let release;const request=new Promise(resolve=>release=resolve);let names;
  w.context.fetch=async(url,opts)=>{names=JSON.parse(opts.body).ids;await request;return {ok:true,json:async()=>({data:d.cards.map(e=>({...e.card,legalities:{commander:'banned'}}))})};};
  const task=vm.runInContext('refresh()',w.context);
  assert.equal(vm.runInContext('refresh()',w.context),task);
  await Promise.resolve();await Promise.resolve();
  vm.runInContext("decks[0].cards[1].qty=7;decks[0].cards[1].tags=['New role'];decks[0].cards[1].zone='command';",w.context);
  release();await task;
  assert.equal(names.length,2);
  const entry=vm.runInContext('decks[0].cards[1]',w.context);
  assert.equal(entry.qty,7);assert.equal(entry.tags[0],'New role');assert.equal(entry.zone,'command');
  assert.equal(entry.card.id,'Ramp spell');assert.equal(entry.card.legalities.commander,'banned');
  vm.runInContext("view='deck';deckTab='checks';render()",w.context);
  assert.match(w.node('#app').innerHTML,/check-failure/);
  assert.match(w.node('#app').innerHTML,/Ramp spell/);
  assert.match(w.node('#app').innerHTML,/Legality refreshed this session/);
  assert.equal(vm.runInContext('legalityStates.size',w.context),1);
  vm.runInContext("openDeck('other')",w.context);
  assert.equal(vm.runInContext('legalityStates.size',w.context),2);
});

test('failed/partial refresh retains all usable data, exposes retry and cannot claim a fresh pass',async()=>{
  for(const response of ['offline','partial','invalid']) {
    const w=workspace({savedDecks:JSON.stringify([editorDeck()])});
    w.context.fetch=async()=>{if(response==='offline')throw Error('Offline');return {ok:true,json:async()=>({data:response==='partial'?[]:[{name:'Leader',legalities:null}]})};};
    const before=vm.runInContext('JSON.stringify(decks)',w.context);
    await vm.runInContext('refresh()',w.context);
    assert.equal(vm.runInContext('JSON.stringify(decks)',w.context),before);
    assert.equal(w.writes.length,0);
    vm.runInContext("view='deck';deckTab='checks';render()",w.context);
    const html=w.node('#app').innerHTML;
    assert.match(html,/Legality refresh unavailable/);assert.match(html,/Retry legality refresh/);
    assert.doesNotMatch(html,/Supported checks passed/);
    assert.match(html,/check-warning/);assert.match(html,/check-info/);
  }
});

test('in-flight refresh never revives removed entries or deleted decks and serializes deck requests',async()=>{
  const a=editorDeck(),b={...editorDeck(),id:'second'};
  const w=workspace({savedDecks:JSON.stringify([a,b])});
  let release;const wait=new Promise(resolve=>release=resolve);let calls=0;
  w.context.fetch=async()=>{calls++;if(calls===1)await wait;return {ok:true,json:async()=>({data:a.cards.map(e=>({...e.card,legalities:{commander:'banned'}}))})};};
  const first=vm.runInContext('refresh(decks[0])',w.context),second=vm.runInContext('refresh(decks[1])',w.context);
  await Promise.resolve();await Promise.resolve();assert.equal(calls,1);
  vm.runInContext('decks.shift()',w.context);release();await first;await second;
  assert.equal(calls,2);assert.equal(vm.runInContext('decks.length',w.context),1);
  assert.equal(vm.runInContext('decks[0].id',w.context),'second');
});

test('fresh supported Modern checks pass and aged data becomes stale without a false pass',async()=>{
  const c={...editorCard('Forest','Basic Land — Forest'),cmc:0,oracle_text:'',legalities:{modern:'legal'}};
  const d={id:'modern',name:'Modern',format:'modern',cards:[{card:c,qty:60,tags:[],zone:'main'}]};
  const w=workspace({savedDecks:JSON.stringify([d])});
  w.context.fetch=async()=>({ok:true,json:async()=>({data:[c]})});
  await vm.runInContext('refresh()',w.context);
  vm.runInContext("view='deck';deckTab='checks';render()",w.context);
  assert.match(w.node('#app').innerHTML,/Supported checks passed/);
  assert.match(w.node('#app').innerHTML,/check-summary check-success/);
  assert.match(w.node('#app').innerHTML,/<h2>Deck legality checks<\/h2>/);
  assert.doesNotMatch(w.node('#app').innerHTML,/Failed checks|Data unavailable|Manual review|None found/);
  vm.runInContext("legalityStates.get('modern').time-=300_001;render()",w.context);
  assert.match(w.node('#app').innerHTML,/Legality data is stale/);
  assert.match(w.node('#app').innerHTML,/Checks incomplete/);
  assert.match(w.node('#app').innerHTML,/Retry legality refresh/);
});

test('legality results distinguish stored violations, missing data and unsupported Commander rules',()=>{
  const d=editorDeck();
  d.cards.push({card:{...editorCard('<Unknown>','Instant'),color_identity:['U'],legalities:{}},qty:1,tags:[],zone:'main'});
  d.cards.push({card:{...editorCard('Banned spell','Instant'),legalities:{commander:'banned'}},qty:1,tags:[],zone:'main'});
  const w=workspace({savedDecks:JSON.stringify([d])});
  const before=vm.runInContext('JSON.stringify(decks)',w.context);
  vm.runInContext("view='deck';deckTab='checks';render()",w.context);
  const html=w.node('#app').innerHTML;
  assert.match(html,/Deck legality issues found/);
  assert.match(html,/Failed checks · [1-9]/);
  assert.match(html,/Banned spell \(Main deck\): banned in commander according to stored card legality/);
  assert.match(html,/&lt;Unknown&gt; \(Main deck\) is outside your commander&#39;s color identity \(Leader\)/);
  assert.match(html,/Data unavailable · 1/);
  assert.match(html,/does not mean the affected cards are banned/);
  assert.match(html,/Manual review · 1/);
  assert.match(html,/basic-land types allowed by commander color identity/);
  assert.match(html,/issues\/13/);
  assert.match(html,/Sideboard and Maybeboard are excluded/);
  assert.ok(html.indexOf('Failed checks')<html.indexOf('Commander bracket discussion'));
  assert.doesNotMatch(html,/check-summary check-success|None found|<Unknown>/);
  assert.equal(vm.runInContext('JSON.stringify(decks)',w.context),before);
  assert.equal(w.writes.length,0);
});

test('fresh Commander results keep supported passes separate from manual review',()=>{
  const d=editorDeck();d.cards[1]={card:editorCard('Forest','Basic Land — Forest'),qty:99,tags:[],zone:'main'};
  const w=workspace({savedDecks:JSON.stringify([d])});
  vm.runInContext("legalityStates.set('editor',{status:'fresh',time:Date.now(),signature:legalitySignature(decks[0])});view='deck';deckTab='checks';render()",w.context);
  const html=w.node('#app').innerHTML;
  assert.match(html,/Supported checks passed · manual review needed/);
  assert.match(html,/check-summary check-info/);
  assert.match(html,/Manual review · 1/);
  assert.doesNotMatch(html,/Failed checks|Data unavailable|check-summary check-success/);
});

test('startup timer runs bounded collection batches and card-set edits schedule a follow-up',async()=>{
  const d=editorDeck();d.cards=Array.from({length:80},(_,i)=>({card:editorCard('Card '+i),qty:1,tags:[],zone:'main'}));
  const w=workspace({savedDecks:JSON.stringify([d])}), batches=[];
  w.context.fetch=async(url,opts)=>{const names=JSON.parse(opts.body).ids;batches.push(names);return {ok:true,json:async()=>({data:names.map(name=>editorCard(name))})};};
  await w.timers.find(t=>t.ms===0).fn();
  assert.deepEqual(batches.map(b=>b.length),[75,5]);
  assert.equal(new Set(batches.flat()).size,80);
  assert.equal(vm.runInContext("legalityStates.get(decks[0].id).status",w.context),'fresh');
  vm.runInContext("decks[0].cards[0].qty=2;render()",w.context);
  assert.equal(w.timers.filter(t=>t.ms===0).length,1);
  vm.runInContext("decks[0].cards.push({card:decks[0].cards[0].card,qty:1,tags:[],zone:'sideboard'});render()",w.context);
  assert.equal(w.timers.filter(t=>t.ms===0).length,1);
  vm.runInContext("decks[0].cards.push({card:{...decks[0].cards[0].card,id:'New',oracle_id:'New',name:'New'},qty:1,tags:[],zone:'main'});render()",w.context);
  assert.equal(w.timers.filter(t=>t.ms===0).length,2);
});

test('an import replacing entry objects during refresh keeps newer facts and schedules fresh coverage',async()=>{
  const d=editorDeck(),w=workspace({savedDecks:JSON.stringify([d])});
  let release;const gate=new Promise(resolve=>release=resolve);
  w.context.fetch=async()=>{await gate;return {ok:true,json:async()=>({data:d.cards.map(e=>({...e.card,legalities:{commander:'banned'}}))})};};
  const task=vm.runInContext('refresh()',w.context);
  vm.runInContext("decks[0].cards=structuredClone(decks[0].cards);decks[0].cards[0].card.legalities.commander='restricted';",w.context);
  release();await task;
  assert.equal(vm.runInContext('decks[0].cards[0].card.legalities.commander',w.context),'restricted');
  assert.equal(vm.runInContext('legalityStates.get(decks[0].id).status',w.context),'refreshing');
  assert.ok(w.timers.filter(t=>t.ms===0).length>=2);
});

test('manual bracket assignment is explicit, preserved by duplication/backups and displayed separately from discussion ranges',()=>{
  const w=workspace({savedDecks:JSON.stringify([editorDeck()])});
  w.context.bracketReport=d=>core.bracketReport(d,core.COMMANDER_BRACKETS,Date.parse('2026-10-29T12:00:00Z'));
  vm.runInContext("view='deck';deckTab='checks';render()",w.context);
  w.node('#assigned-bracket').change({target:{value:'2'}});
  assert.equal(vm.runInContext('decks[0].bracket',w.context),2);
  assert.match(w.node('#app').innerHTML,/Player assigned:<\/strong> Bracket 2/);
  vm.runInContext("decks[0].cards[1].card.name='Farewell';render();duplicateDeck(decks[0])",w.context);
  assert.equal(vm.runInContext('decks[0].bracket',w.context),2);assert.equal(vm.runInContext('decks[1].bracket',w.context),2);
  assert.match(w.node('#app').innerHTML,/Discussion range: Brackets 3–5/);
  assert.match(w.node('#app').innerHTML,/below this count-based range/);
  assert.doesNotThrow(()=>core.validateBackup(JSON.parse(vm.runInContext('JSON.stringify(decks)',w.context))));
  vm.runInContext("view='decks';render()",w.context);assert.match(w.node('#app').innerHTML,/Bracket 2 · Core/);assert.doesNotMatch(w.node('#app').innerHTML,/Player assigned:/);
  vm.runInContext("view='deck';render()",w.context);w.node('#assigned-bracket').change({target:{value:''}});
  assert.equal(vm.runInContext('decks[0].bracket',w.context),undefined);
});

test('stale and missing bracket data stay visibly unavailable rather than producing a suggested bracket',()=>{
  const d=editorDeck();d.cards[1].card.name='Farewell';d.bracket=2;
  const w=workspace({savedDecks:JSON.stringify([d])});
  w.context.bracketReport=d=>core.bracketReport(d,null,Date.parse('2026-10-29'));
  vm.runInContext("view='deck';deckTab='checks';render()",w.context);
  assert.match(w.node('#app').innerHTML,/Guidance unavailable: app bracket data is missing/);
  assert.doesNotMatch(w.node('#app').innerHTML,/Discussion range:/);
  w.context.bracketReport=d=>core.bracketReport(d,core.COMMANDER_BRACKETS,Date.parse('2027-02-01'));
  vm.runInContext('render()',w.context);assert.match(w.node('#app').innerHTML,/Guidance is outdated/);
  assert.match(w.node('#app').innerHTML,/Player assigned:<\/strong> Bracket 2/);
  assert.equal(vm.runInContext('decks[0].bracket',w.context),2);
});

test('bracket guidance gives one truthful update date and preserves assignments through data-quality limits',()=>{
  const d=editorDeck();d.bracket=2;d.cards[1].card.name='Farewell';
  const w=workspace({savedDecks:JSON.stringify([d])});
  w.context.bracketReport=deck=>core.bracketReport(deck,core.COMMANDER_BRACKETS,Date.parse('2026-10-29'));
  const before=vm.runInContext('JSON.stringify(decks)',w.context);
  const panel=()=>vm.runInContext('bracketPanel(decks[0])',w.context);
  const html=panel();
  assert.match(html,/Player assigned:<\/strong> Bracket 2/);
  assert.match(html,/Discussion range: Brackets 3–5/);
  assert.match(html,/Last updated: <time datetime="2026-10-29">2026-10-29<\/time>/);
  assert.match(html,/Developer-maintained/);
  assert.match(html,/last developer review of the bundled list and guidance/);
  assert.match(html,/there is no live refresh/);
  assert.match(html,/Card-legality refresh does not update bracket data/);
  assert.match(html,/href="https:\/\/magic.wizards.com\/en\/formats\/commander"/);
  assert.doesNotMatch(html,/Suggestions never change|February 2026|English rules names|front name|list update|90 days|news\/announcements/);
  assert.match(html,/Sideboard and Maybeboard excluded/);
  w.context.bracketReport=deck=>core.bracketReport(deck,core.COMMANDER_BRACKETS,Date.parse('2027-02-01'));
  assert.match(panel(),/Guidance is outdated/);assert.doesNotMatch(panel(),/Discussion range:/);
  w.context.bracketReport=deck=>core.bracketReport(deck,null);
  assert.match(panel(),/app bracket data is missing/);assert.match(panel(),/count unavailable/);
  w.context.bracketReport=deck=>core.bracketReport({...deck,cards:[{card:{},qty:1,zone:'main'}]});
  assert.match(panel(),/stored card data is incomplete/);assert.doesNotMatch(panel(),/Discussion range:/);
  assert.equal(vm.runInContext('JSON.stringify(decks)',w.context),before);assert.equal(w.writes.length,0);
});

test('Maybeboard-only decks do not request legality and Maybeboard failures cannot poison active-deck refresh', async () => {
  const d=editorDeck();d.cards=d.cards.map(e=>({...e,zone:'maybeboard'}));
  const w=workspace({savedDecks:JSON.stringify([d])});assert.equal(w.timers.length,0);
  const active=editorDeck();active.cards.push({...structuredClone(active.cards[1]),zone:'maybeboard',card:{...structuredClone(active.cards[1].card),id:'maybe',oracle_id:'maybe',name:'Maybe missing'}});
  const v=workspace({savedDecks:JSON.stringify([active])});let requested=[];
  v.context.fetch=async(url,options)=>{requested=JSON.parse(options.body).ids;return {ok:true,json:async()=>({data:active.cards.filter(e=>e.zone!=='maybeboard').map(e=>e.card),not_found:[]})};};
  await vm.runInContext('refresh()',v.context);assert.deepEqual(requested,['Leader','Ramp spell']);assert.equal(vm.runInContext("legalityStates.get('editor').status",v.context),'fresh');
});

test('legacy stored printing without an Oracle id can refresh repeatedly without mismatched-data notices',async()=>{
  const card={...editorCard('Forest','Basic Land — Forest'),id:'stored-print',cmc:0,legalities:{}};delete card.oracle_id;
  const deck={id:'legacy',name:'Legacy',format:'modern',cards:[{card,qty:60,tags:[],zone:'main'}]};
  const w=workspace({savedDecks:JSON.stringify([deck])});let calls=0;
  w.context.fetch=async()=>{calls++;return {ok:true,json:async()=>({data:[{...card,name:'Forest // Forest',oracle_id:'forest-rules',legalities:{modern:'legal'}}]})};};
  await vm.runInContext('refresh()',w.context);
  assert.equal(vm.runInContext("legalityStates.get('legacy').status",w.context),'fresh');
  assert.equal(vm.runInContext('decks[0].cards[0].card.legalities.modern',w.context),'legal');
  assert.equal(vm.runInContext('decks[0].cards[0].card.id',w.context),'stored-print');
  vm.runInContext("view='deck';deckTab='checks';render()",w.context);
  assert.match(w.node('#app').innerHTML,/Supported checks passed/);
  await vm.runInContext('refresh()',w.context);
  assert.equal(vm.runInContext("legalityStates.get('legacy').status",w.context),'fresh');assert.equal(calls,2);
});

test('same-name rules variants refresh without permanently returning mismatched legality data',async()=>{
  const first={...editorCard('Shared name'),id:'printing-a',oracle_id:'rules-a',legalities:{}}, second={...editorCard('Shared name'),id:'printing-b',oracle_id:'rules-b',legalities:{}};
  const d={id:'variants',name:'Variants',format:'commander',cards:[{card:first,qty:1,tags:[],zone:'main'},{card:second,qty:1,tags:[],zone:'sideboard'}]};
  const w=workspace({savedDecks:JSON.stringify([d])});
  w.context.fetch=async()=>({ok:true,json:async()=>({data:[{...first,legalities:{commander:'not_legal'}},{...second,legalities:{commander:'not_legal'}}]})});
  for(let i=0;i<2;i++){
    await vm.runInContext('refresh()',w.context);
    assert.equal(vm.runInContext("legalityStates.get('variants').status",w.context),'fresh');
    assert.equal(vm.runInContext('decks[0].cards[0].card.legalities.commander',w.context),'not_legal');
  }
});

test('empty selected-format legality is a named retryable failure instead of a fresh unavailable loop',async()=>{
  const w=workspace({savedDecks:JSON.stringify([editorDeck()])});
  w.context.fetch=async()=>({ok:true,json:async()=>({data:editorDeck().cards.map(e=>({...e.card,legalities:{}}))})});
  const before=vm.runInContext('JSON.stringify(decks)',w.context);await vm.runInContext('refresh()',w.context);
  assert.equal(vm.runInContext("legalityStates.get('editor').status",w.context),'failed');
  assert.match(vm.runInContext("legalityStates.get('editor').error",w.context),/Leader/);
  assert.equal(vm.runInContext('JSON.stringify(decks)',w.context),before);
});

test('exact-printing refresh skips replaced and removed snapshots and recovers with the next request',async()=>{
  const w=workspace({savedDecks:JSON.stringify([editorDeck()])});let release;
  w.context.fetch=()=>new Promise(r=>release=r);
  const pending=vm.runInContext('refresh()',w.context);await Promise.resolve();await Promise.resolve();
  vm.runInContext("decks[0].cards.shift();decks[0].cards[0].card={...decks[0].cards[0].card,id:'new-print',legalities:{commander:'legal'}}",w.context);
  release({ok:true,json:async()=>({data:[]})});await pending;
  assert.equal(vm.runInContext('decks[0].cards[0].card.legalities.commander',w.context),'legal');
  w.context.fetch=async(url,opts)=>{assert.deepEqual(JSON.parse(opts.body),{ids:['new-print']});return {ok:true,json:async()=>({data:[{...editorCard('Ramp spell'),id:'new-print',legalities:{commander:'banned'}}]})};};
  await vm.runInContext('refresh()',w.context);
  assert.equal(vm.runInContext('decks[0].cards[0].card.legalities.commander',w.context),'banned');
  assert.equal(vm.runInContext("legalityStates.get('editor').status",w.context),'fresh');
});

test('retry repairs missing format data and a format change requests its own coverage',async()=>{
  const w=workspace({savedDecks:JSON.stringify([editorDeck()])});
  w.context.fetch=async()=>({ok:true,json:async()=>({data:[]})});await vm.runInContext('refresh()',w.context);
  assert.equal(vm.runInContext("legalityStates.get('editor').status",w.context),'failed');
  w.context.fetch=async()=>({ok:true,json:async()=>({data:editorDeck().cards.map(e=>({...e.card,legalities:{commander:'legal',modern:'legal'}}))})});
  await vm.runInContext('refresh()',w.context);
  const timers=w.timers.filter(t=>t.ms===0).length;
  vm.runInContext("decks[0].format='modern';render()",w.context);
  assert.equal(w.timers.filter(t=>t.ms===0).length,timers+1);
  await vm.runInContext('refresh()',w.context);assert.equal(vm.runInContext("legalityStates.get('editor').status",w.context),'fresh');
});

test('exact-id refresh retains rules-identity guards including normalized reversible printings',async()=>{
  for(const mode of ['mismatched-root','mismatched-face','matching-faces']){
    const d=editorDeck(),w=workspace({savedDecks:JSON.stringify([d])});
    w.context.fetch=async()=>({ok:true,json:async()=>({data:d.cards.map(e=>mode==='mismatched-root'?{...e.card,oracle_id:'other',legalities:{commander:'banned'}}:{...e.card,oracle_id:undefined,layout:'reversible_card',card_faces:[{oracle_id:e.card.oracle_id},{oracle_id:mode==='mismatched-face'?'other':e.card.oracle_id}],legalities:{commander:'banned'}})})});
    await vm.runInContext('refresh()',w.context);
    assert.equal(vm.runInContext("legalityStates.get('editor').status",w.context),mode==='matching-faces'?'fresh':'failed');
    assert.equal(vm.runInContext('decks[0].cards[0].card.legalities.commander',w.context),mode==='matching-faces'?'banned':'legal');
    if(mode!=='matching-faces')assert.match(vm.runInContext("legalityStates.get('editor').error",w.context),/Leader: returned rules identity/);
  }
});
