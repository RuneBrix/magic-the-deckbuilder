import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import * as core from '../public/core.js';
import { workspace, editorCard, editorDeck, formValues, chooseWorkspaceFile, startCardDrag, dropCard } from '../test-support/workspace.mjs';

test('search disclosures start closed and preserve the opened state and selected filters across renders', () => {
  const w = workspace();
  assert.doesNotMatch(w.node('#app').innerHTML, /id="search-filters"[^>]*\bopen\b/);
  assert.doesNotMatch(w.node('#app').innerHTML, /id="function-tags"[^>]*\bopen\b/);
  w.node('#search-filters').toggle({ target: { open: true, isConnected: true } });
  w.node('#function-tags').toggle({ target: { open: true, isConnected: true } });
  w.node('#guided-form').toggle({ target: { open: true, isConnected: true, dataset:{guidedFamily:'oracle'} } });
  vm.runInContext("filters=parseQuery('o:\"draw a card\" otag:ramp'); render()", w.context);
  const html = w.node('#app').innerHTML;
  assert.match(html, /id="search-filters"[^>]*\bopen\b/);
  assert.match(html, /id="function-tags"[^>]*\bopen\b/);
  assert.match(html, /data-guided-family="oracle" open/);
  assert.match(html, /id="applied-filter-summary">Oracle phrase · Function tags/);
  assert.match(html, /name="oracle-0" value="draw a card"/);
  assert.match(html, /aria-label="Remove ramp filter"/);
  assert.doesNotMatch(html, /data-action="backup"|data-action="restore"/);
});

test('tag discovery renders aliases, verified relationships, visible counts and inline unlisted tags', () => {
  const w = workspace();
  vm.runInContext("tagSearch = 'blink'; browsedTag = 'flicker'; filters=parseQuery('otag:unknown-arcana-tag'); render()", w.context);
  const html = w.node('#app').innerHTML;
  assert.match(html, /Add flicker filter/);
  assert.match(html, /Aliases: blink/);
  assert.match(html, /Broader tags/);
  assert.match(html, /Narrower tags/);
  assert.match(html, /data-browse-tag="flicker-creature"/);
  assert.match(html, /outside this snapshot/);
  assert.match(html, /id="tag-match-count"[^>]*>[\d,.]+ matching tags?/);
  assert.match(html, /Matching all \(AND\)/);
  assert.match(html, /otag:unknown-arcana-tag/);
  w.node('#tag-search').input({target:{value:'unknown arcana function'}});
  assert.equal(w.node('#tag-match-count').textContent,'0 matching tags');
  assert.match(w.node('#tag-options').innerHTML,/data-tag="unknown-arcana-function"[^>]*>Add “unknown arcana function” as an unlisted function/);
  assert.doesNotMatch(w.node('#tag-options').innerHTML,/Tag relationships/);
  w.node('#tag-search').input({target:{value:'tag:unexpected'}});
  assert.doesNotMatch(w.node('#tag-options').innerHTML,/data-tag=/);
  assert.match(w.node('#tag-options').innerHTML,/Use up to 80 letters/);
  w.node('#tag-search').input({target:{value:'a'}});
  assert.match(w.node('#tag-options').innerHTML,/Show next \d+ matching tags/);
});

test('upstream no-match responses explain recovery and possible unsupported custom tags', async () => {
  const w = workspace();
  w.context.fetch = async () => ({ ok: false, json: async () => ({ error: 'Your query didn’t match any cards. Adjust your search terms.' }) });
  await vm.runInContext("filters=parseQuery('otag:unknown-arcana-tag'); search()", w.context);
  assert.match(w.node('#app').innerHTML, /No cards matched these filters/);
  assert.match(w.node('#app').innerHTML, /custom tag may be unsupported/);
  assert.match(w.node('#app').innerHTML, /switch to Match any/);
  assert.match(w.node('#app').innerHTML, /otag:unknown-arcana-tag/);
});

test('broadening always starts from original settings and restoration survives upstream failure', async () => {
  const w=workspace(), queries=[];
  w.context.FormData=class {get(key){return vm.runInContext(`filters[${JSON.stringify(key)}]`,w.context);}};
  w.context.fetch=async url=>{queries.push(String(url));return {ok:false,json:async()=>({error:'Offline test'})};};
  vm.runInContext("filters=parseQuery('usd<5 t:creature mv<=3 otag:ramp');",w.context);
  await vm.runInContext("broaden('mv')",w.context);
  let html=w.node('#app').innerHTML;
  assert.match(html,/Ignored Mana values/);
  assert.match(html,/Original query: <code>usd&lt;5 t:creature mv&lt;=3 otag:ramp/);
  assert.match(html,/Return to original search/);
  await vm.runInContext("broaden('type')",w.context);
  assert.equal(vm.runInContext('filters.values[0].value',w.context),'3');
  assert.equal(vm.runInContext('filters.types.length',w.context),0);
  await vm.runInContext('restoreSearch()',w.context);
  assert.equal(vm.runInContext('filters.types[0]',w.context),'creature');
  assert.equal(vm.runInContext('filters.values[0].value',w.context),'3');
  assert.equal(vm.runInContext('broadening',w.context),null);
  assert.ok(decodeURIComponent(queries[0]).includes('t:creature'));
  assert.ok(decodeURIComponent(queries[1]).includes('mv<=3'));
  assert.equal(w.writes.length,0);
});

test('stale alternative responses cannot overwrite restored results or their query context',async()=>{
  const w=workspace();let finish;
  w.context.fetch=()=>new Promise(resolve=>{finish=resolve;});
  const stale=vm.runInContext("filters=parseQuery('otag:ramp'); search()",w.context);
  w.context.fetch=async()=>({ok:true,json:async()=>({data:[],total_cards:0,has_more:false})});
  await vm.runInContext("filters=parseQuery('otag:draw'); search()",w.context);
  finish({ok:true,json:async()=>({data:[],total_cards:99,has_more:true})});
  await stale;
  assert.equal(vm.runInContext('total',w.context),0);
  assert.equal(vm.runInContext('resultContext.query',w.context),'otag:draw');
});

test('price pagination uses the completed result query and direction rather than unsent filter edits',async()=>{
  const w=workspace(), queries=[];
  w.context.fetch=async url=>{queries.push(Object.fromEntries(new URL(url,'http://localhost').searchParams));return {ok:true,json:async()=>({data:[],total_cards:300,has_more:true})};};
  await vm.runInContext("filters=parseQuery('otag:ramp'); order='usd-desc'; search()",w.context);
  await vm.runInContext("filters=parseQuery('otag:draw'); search(true)",w.context);
  assert.deepEqual(queries,[1,2].map(page=>({q:'otag:ramp',page:String(page),order:'usd',dir:'desc'})));
});

test('a late ascending price response cannot replace descending results', async () => {
  const w = workspace();
  let finish;
  const response = data => ({ ok: true, json: async () => ({ data, total_cards: data.length, has_more: false }) });
  w.context.fetch = () => new Promise(resolve => { finish = resolve; });
  const stale = vm.runInContext("filters=parseQuery('otag:ramp'); order='usd-asc'; search()", w.context);
  w.context.fetch = async () => response([editorCard('Expensive'), editorCard('Cheap')]);
  await vm.runInContext("order='usd-desc'; search()", w.context);
  finish(response([editorCard('Cheap'), editorCard('Expensive')]));
  await stale;
  assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(results.map(card => card.name))', w.context)), ['Expensive', 'Cheap']);
});

test('applying unsent changes while sorting clears an obsolete relaxation explanation',async()=>{
  const w=workspace();
  w.context.FormData=class {get(key){return vm.runInContext(`filters[${JSON.stringify(key)}]`,w.context);}};
  w.context.fetch=async()=>({ok:true,json:async()=>({data:[],total_cards:0,has_more:false})});
  await vm.runInContext("filters=parseQuery('otag:ramp mv<=3'); broaden('mv')",w.context);
  assert.ok(vm.runInContext('broadening',w.context));
  await vm.runInContext("filters=parseQuery('usd<5'); search(false,true)",w.context);
  assert.equal(vm.runInContext('broadening',w.context),null);
  assert.equal(vm.runInContext('resultContext.query',w.context),'usd<5');
  assert.doesNotMatch(w.node('#app').innerHTML,/Why these results/);
});

test('typed query projects controls without replacing the focused search input; typed tags can be removed',async()=>{
  const w=workspace(),raw=w.node('#raw'),shell=w.node('#app').innerHTML;
  raw.selectionStart=12;raw.selectionEnd=12;
  raw.input({target:{value:'(t:instant OR t:sorcery) (otag:ramp OR otag:draw) usd<5'}});
  assert.equal(w.node('#raw'),raw);assert.equal(raw.selectionStart,12);assert.equal(raw.selectionEnd,12);
  assert.equal(w.node('#app').innerHTML,shell);
  assert.match(w.node('#guided-controls').innerHTML,/data-remove-chip="instant"/);
  assert.match(w.node('#guided-controls').innerHTML,/data-remove-chip="sorcery"/);
  assert.equal(w.node('#applied-filter-summary').textContent,'Types · Function tags · 1 query-only expression');
  assert.match(w.node('#selected-functions').innerHTML,/Remove ramp filter/);
  w.context.fetch=async()=>({ok:true,json:async()=>({data:[],total_cards:0,has_more:false})});
  await w.node('#app').click({target:{closest:()=>({dataset:{tag:'ramp'}})}});
  assert.doesNotMatch(vm.runInContext('filters.query',w.context),/otag:ramp/);
  assert.match(vm.runInContext('filters.query',w.context),/otag:draw/);
  assert.match(vm.runInContext('filters.query',w.context),/usd<5/);
});

test('typing and clearing invalidate pending requests; incomplete queries are never sent',async()=>{
  const w=workspace();let finish,calls=0;
  w.context.fetch=()=>{calls++;return new Promise(resolve=>{finish=resolve;});};
  const pending=vm.runInContext("filters=parseQuery('otag:ramp'); search()",w.context);
  w.node('#raw').input({target:{value:'(t:creature'}});
  await vm.runInContext('search()',w.context);assert.equal(calls,1);
  finish({ok:true,json:async()=>({data:[],total_cards:99,has_more:true})});await pending;
  assert.equal(vm.runInContext('total',w.context),0);assert.equal(vm.runInContext('loading',w.context),false);
  w.node('#raw').input({target:{value:''}});
  assert.equal(vm.runInContext('searched',w.context),false);assert.equal(vm.runInContext('results.length',w.context),0);
  assert.equal(vm.runInContext('resultContext',w.context),null);assert.equal(calls,1);
});

test('inactive matching preferences survive choosing a mode before its first color/type/value',()=>{
  const w=workspace();
  vm.runInContext("setCondition('color',{...filters,color:{mode:'exact',values:[]}})",w.context);
  assert.equal(vm.runInContext('filters.color.mode',w.context),'exact');
  assert.equal(vm.runInContext('filters.query',w.context),'');
  vm.runInContext("setCondition('type',{...filters,typeMatch:'any',types:[]})",w.context);
  assert.equal(vm.runInContext('filters.typeMatch',w.context),'any');
  vm.runInContext("setCondition('mv',{...filters,valueMatch:'any',values:[{op:'=',value:''}]})",w.context);
  assert.equal(vm.runInContext('filters.valueMatch',w.context),'any');
  assert.equal(vm.runInContext('filters.color.mode',w.context),'exact');
  assert.equal(vm.runInContext('filters.typeMatch',w.context),'any');
});

test('guided numeric input updates the same query without replacing its active form',()=>{
  const w=workspace(),form=w.node('#guided-form'),shell=w.node('#app').innerHTML;
  formValues(w,{'symbol-U':'2','symbol-C':'1'});
  form.input({target:{hasAttribute:()=>false,closest:()=>({dataset:{family:'symbols'}})}});
  assert.equal(vm.runInContext('filters.query',w.context),'m>={U}{U}{C}');
  assert.equal(w.node('#raw').value,'m>={U}{U}{C}');
  assert.equal(w.node('#guided-form'),form);assert.equal(w.node('#app').innerHTML,shell);
  assert.equal(vm.runInContext('loading',w.context),false);
});

test('sequential ANY choices keep their intent after the first operand and an unrelated edit',()=>{
  const w=workspace();
  for(const family of ['color','identity']){
    vm.runInContext(`filters=parseQuery(''); setCondition('${family}',{...filters,${family}:{mode:'any',values:[]}},false); setCondition('${family}',{...filters,${family}:{...filters.${family},values:['W']}},false)`,w.context);
    assert.equal(vm.runInContext(`filters.${family}.mode`,w.context),'any');
    vm.runInContext("setCondition('legal',{...filters,legal:'modern'},false)",w.context);
    vm.runInContext(`setCondition('${family}',{...filters,${family}:{...filters.${family},values:['W','U']}},false)`,w.context);
    assert.match(vm.runInContext('filters.query',w.context),/ OR /);
  }
  for(const [family,key,mode,one,two] of [['type','types','typeMatch',['instant'],['instant','sorcery']],['tags','tags','match',['draw'],['draw','ramp']],['mv','values','valueMatch',[{op:'=',value:'2'}],[{op:'=',value:'2'},{op:'=',value:'4'}]]]){
    vm.runInContext(`filters=parseQuery(''); setCondition('${family}',{...filters,${mode}:'any',${key}:${JSON.stringify(one)}},false)`,w.context);
    assert.equal(vm.runInContext(`filters.${mode}`,w.context),'any');
    vm.runInContext(`setCondition('${family}',{...filters,${key}:${JSON.stringify(two)}},false)`,w.context);
    assert.match(vm.runInContext('filters.query',w.context),/ OR /);
  }
});

test('an explicit blank search exposes its effective broad query in the primary input',async()=>{
  const w=workspace(),queries=[];
  w.context.fetch=async url=>{queries.push(new URLSearchParams(String(url).split('?')[1]).get('q'));return {ok:true,json:async()=>({data:[],total_cards:0,has_more:false})};};
  await vm.runInContext('search()',w.context);
  assert.deepEqual(queries,['game:paper']);assert.equal(vm.runInContext('filters.query',w.context),'game:paper');
  assert.match(w.node('#app').innerHTML,/id="raw"[^>]*value="game:paper"/);
});

test('tracker visibility and selection preserve the search, editor destination and stored decks',async()=>{
  const a=editorDeck(),b={...editorDeck(),id:'second',name:'Second deck'};
  const w=workspace({savedDecks:JSON.stringify([a,b])});
  w.context.fetch=async()=>({ok:true,json:async()=>({data:[editorCard('Result')],total_cards:1,has_more:false})});
  await vm.runInContext("filters=parseQuery('otag:ramp f:modern'); search()",w.context);
  const original=vm.runInContext('JSON.stringify({decks,filters,results,resultContext,page})',w.context);
  const click=dataset=>w.node('#app').click({target:{closest:()=>({dataset})}});
  await click({action:'toggle-tracker'});
  assert.doesNotMatch(w.node('#app').innerHTML,/<aside/);
  assert.match(w.node('#app').innerHTML,/Show tracker/);
  assert.match(w.node('#app').innerHTML,/Add Result to Garden · Main deck/);
  assert.equal(vm.runInContext('JSON.stringify({decks,filters,results,resultContext,page})',w.context),original);
  w.node('#tracked-deck').change({target:{value:''}});
  assert.equal(vm.runInContext('current()',w.context),undefined);
  assert.match(w.node('#app').innerHTML,/Add Result to a chosen deck/);
  assert.doesNotMatch(w.node('#app').innerHTML,/<aside|data-action="jump-deck"/);
  await click({deck:'second'});
  assert.equal(vm.runInContext('current().id',w.context),'second');
  await click({action:'find-cards'});
  assert.equal(vm.runInContext('tracker.id',w.context),'second');
  assert.equal(vm.runInContext('filters.query',w.context),'otag:ramp f:modern');
  assert.equal(vm.runInContext('results[0].name',w.context),'Result');
  assert.ok(w.writes.every(([key])=>key==='arcana.explorer.v1'));
  const saved=w.writes.at(-1)[1];
  const reloaded=workspace({savedDecks:JSON.stringify([a,b]),savedTracker:saved});
  assert.equal(vm.runInContext('tracker.id',reloaded.context),'second');
  assert.equal(reloaded.writes.length,0);
});

test('adding with no tracker requires a destination and never changes the selected tracker',()=>{
  const a=editorDeck(),b={...editorDeck(),id:'second',name:'Second deck'};
  const w=workspace({savedDecks:JSON.stringify([a,b]),savedTracker:JSON.stringify({id:'',visible:false,width:340})});
  vm.runInContext("results=[{id:'new',oracle_id:'new',name:'New card',type_line:'Instant',cmc:1,color_identity:[]}]; addCard('new')",w.context);
  assert.equal(w.writes.length,0);
  assert.match(w.node('#dialog').innerHTML,/Destination deck/);
  assert.match(w.node('#dialog').innerHTML,/Main deck/);
  w.node('#add-destination').value='';
  w.node('#add-destination-form').onsubmit({preventDefault(){}});
  assert.match(w.node('#add-destination-error').textContent,/Choose a destination/);
  assert.equal(w.writes.length,0);
  w.node('#add-destination').value='second';
  w.node('#add-destination-form').onsubmit({preventDefault(){}});
  assert.equal(vm.runInContext('decks[1].cards.at(-1).qty',w.context),1);
  assert.equal(vm.runInContext('decks[1].cards.at(-1).zone',w.context),'main');
  assert.equal(vm.runInContext('decks[0].cards.length',w.context),a.cards.length);
  assert.equal(vm.runInContext('tracker.id',w.context),'');
  const before=vm.runInContext('JSON.stringify(decks)',w.context);
  vm.runInContext("chooseDestination('new')",w.context);
  assert.equal(vm.runInContext('JSON.stringify(decks)',w.context),before);
  vm.runInContext("decks[1].cards.at(-1).qty=500",w.context);
  w.node('#add-destination-form').onsubmit({preventDefault(){}});
  assert.match(w.node('#add-destination-error').textContent,/Maximum 500/);
  assert.equal(vm.runInContext('decks[1].cards.at(-1).qty',w.context),500);
  core.validateBackup(JSON.parse(vm.runInContext('JSON.stringify(decks)',w.context)));
});

test('tracker resizing is bounded, keyboard accessible and does not write deck data',()=>{
  const w=workspace({savedDecks:JSON.stringify([editorDeck()])});
  const handle=w.node('#tracker-resize');let prevented=0;
  for(const key of ['End','ArrowLeft'])handle.keydown({key,preventDefault(){prevented++;}});
  assert.equal(vm.runInContext('tracker.width',w.context),480);
  for(const key of ['Home','ArrowRight'])handle.keydown({key,preventDefault(){prevented++;}});
  assert.equal(vm.runInContext('tracker.width',w.context),280);
  handle.setPointerCapture=()=>{};
  handle.pointerdown({button:0,clientX:600,pointerId:1,preventDefault(){}});
  handle.onpointermove({clientX:520});handle.onpointerup();
  assert.equal(vm.runInContext('tracker.width',w.context),360);
  assert.equal(prevented,4);
  assert.ok(w.writes.every(([key])=>key==='arcana.explorer.v1'));
  const reloaded=workspace({savedDecks:JSON.stringify([editorDeck()]),savedTracker:w.writes.at(-1)[1]});
  assert.equal(vm.runInContext('tracker.width',reloaded.context),360);
  const invalid=workspace({savedDecks:JSON.stringify([editorDeck()]),savedTracker:JSON.stringify({id:'deleted',width:900,visible:false})});
  assert.equal(vm.runInContext('tracker.width',invalid.context),480);
  assert.equal(vm.runInContext('tracker.id',invalid.context),'');
});

test('adding the first card creates an explicit destination without starting tracking',()=>{
  const w=workspace();
  vm.runInContext("results=[{id:'new',name:'New card',type_line:'Instant',cmc:1,color_identity:[]}]; addCard('new')",w.context);
  assert.equal(w.writes.length,0);
  w.node('#create-destination').onclick();
  formValues(w,{name:'First deck',format:'modern'});
  w.node('#deck-form').onsubmit({preventDefault(){}});
  assert.equal(vm.runInContext('decks[0].cards[0].card.id',w.context),'new');
  assert.equal(vm.runInContext('decks[0].cards[0].zone',w.context),'main');
  assert.equal(vm.runInContext('view',w.context),'explore');
  assert.equal(vm.runInContext('tracker.id',w.context),'');
  core.validateBackup(JSON.parse(vm.runInContext('JSON.stringify(decks)',w.context)));
});

test('deleting the tracked deck clears only that preference, and blocked preferences remain usable',()=>{
  const a=editorDeck(),b={...editorDeck(),id:'second',name:'Second deck'};
  const w=workspace({savedDecks:JSON.stringify([a,b])});
  vm.runInContext('deleteDeck(decks[0])',w.context);w.node('#confirm-delete').onclick();
  assert.equal(vm.runInContext('tracker.id',w.context),'');
  assert.equal(vm.runInContext('decks[0].id',w.context),'second');
  assert.equal(vm.runInContext('current()',w.context),undefined);
  const blocked=workspace({blocked:true});
  assert.doesNotThrow(()=>vm.runInContext("trackDeck(''); resizeTracker(400); saveTracker()",blocked.context));
  assert.equal(vm.runInContext('tracker.width',blocked.context),400);
  assert.match(blocked.node('#toast').textContent,/session/);
});

test('exploration separates initial/loading/no-match/error/results and ignores cleared pending searches',async()=>{
  const w=workspace();
  assert.doesNotMatch(w.node('#app').innerHTML,/id="results-area"|id="broadening-tools"|Discover cards|search-starts/);
  let complete;
  w.context.fetch=()=>new Promise(resolve=>complete=resolve);
  const pending=vm.runInContext("filters=parseQuery('otag:ramp'); search()",w.context);
  assert.match(w.node('#app').innerHTML,/data-state="loading"/);
  vm.runInContext("setCondition('tags',{...filters,tags:[]},false)",w.context);
  assert.equal(w.node('#search-output').innerHTML,'');
  complete({ok:true,json:async()=>({data:[editorCard('Obsolete')],total_cards:1,has_more:false})});
  await pending;assert.equal(vm.runInContext('results.length',w.context),0);
  w.context.fetch=async()=>({ok:false,json:async()=>({error:'No cards'})});
  await vm.runInContext("filters=parseQuery('impossible'); search()",w.context);
  assert.match(w.node('#app').innerHTML,/data-state="no-match"/);
  assert.doesNotMatch(w.node('#app').innerHTML,/Choose a starting point/);
  w.context.fetch=async()=>{throw Error('Offline');};
  await vm.runInContext('search()',w.context);
  assert.match(w.node('#app').innerHTML,/data-state="error"/);
  assert.match(w.node('#app').innerHTML,/Try again/);
  w.context.fetch=async()=>({ok:true,json:async()=>({data:[editorCard('Current')],total_cards:1,has_more:false})});
  await vm.runInContext('search()',w.context);
  assert.match(w.node('#app').innerHTML,/data-state="populated"/);
  assert.match(w.node('#app').innerHTML,/Sort results/);
});

test('top-navigation Explore starts fresh and invalidates a pending result page', async () => {
  const w=workspace({savedDecks:JSON.stringify([editorDeck()]),initialView:null});
  const click=dataset=>w.node('#app').click({preventDefault(){},target:{closest:()=>({dataset})}});
  const storedDecks=vm.runInContext('JSON.stringify(decks)',w.context);
  await click({deck:'editor'});
  await click({action:'find-cards'});
  assert.equal(vm.runInContext('tracker.id',w.context),'editor');
  assert.equal(vm.runInContext('filters.query',w.context),'');
  w.context.fetch=async()=>({ok:true,json:async()=>({data:[editorCard('Found')],total_cards:100,has_more:true})});
  vm.runInContext("filters=parseQuery('t:instant mv<=3 otag:ramp');order='name';filtersOpen=true;tagsOpen=true;tagSearch='ramp'",w.context);
  await vm.runInContext("broaden('mv')",w.context);
  let complete;
  w.context.fetch=()=>new Promise(resolve=>complete=resolve);
  const pending=vm.runInContext('search(true)',w.context);
  await click({view:'decks'});
  assert.match(w.node('#app').innerHTML,/id="library-title"/);
  await click({view:'explore'});
  complete({ok:true,json:async()=>({data:[editorCard('Obsolete')],total_cards:100,has_more:false})});
  await pending;
  assert.equal(vm.runInContext('filters.query',w.context),'');
  assert.equal(vm.runInContext('filters.tags.length',w.context),0);
  assert.equal(vm.runInContext('filters.types.length',w.context),0);
  assert.equal(vm.runInContext('tracker.id',w.context),'');
  assert.equal(vm.runInContext('results.length',w.context),0);
  assert.equal(vm.runInContext('broadening',w.context),null);
  assert.doesNotMatch(w.node('#app').innerHTML,/id="results-area"|id="broadening-tools"|id="(?:search-filters|function-tags)"[^>]*open/);
  assert.equal(vm.runInContext('JSON.stringify(decks)',w.context),storedDecks);
  assert.deepEqual(w.writes.map(([key])=>key),['arcana.explorer.v1']);
});

test('results, details and help expose ordinary card actions without candidate or pair controls', async () => {
  const w=workspace({savedDecks:JSON.stringify([editorDeck()])});
  w.context.fetch=async()=>({ok:true,json:async()=>({data:[editorCard('Found')],total_cards:1,has_more:false})});
  await vm.runInContext("filters=parseQuery('t:instant mv<=3');search()",w.context);
  const html=w.node('#app').innerHTML;
  assert.doesNotMatch(html,/candidate|pair-comparison|data-compare/i);
  assert.match(html,/data-inspect="Found"/);
  assert.match(html,/data-add="Found"/);
  assert.match(html,/Broaden this search/);
  vm.runInContext("inspect('Found')",w.context);
  assert.doesNotMatch(w.node('#dialog').innerHTML,/candidate|compare/i);
  assert.match(w.node('#detail-facts').innerHTML,/Found/);
  assert.match(w.node('#detail-deck').innerHTML,/detail-add/);
  await w.node('#app').click({target:{closest:()=>({dataset:{action:'help'}})}});
  assert.doesNotMatch(w.node('#dialog').innerHTML,/candidate|compare/i);
  assert.equal(w.writes.length,0);
});

test('exploration destination chooser adds directly to Maybeboard without changing tracking or playing totals', () => {
  const w=workspace({savedDecks:JSON.stringify([editorDeck()]),savedTracker:JSON.stringify({id:''})});w.context.card=editorCard('Bench idea');
  vm.runInContext("results=[card];chooseDestination(card.id)",w.context);assert.match(w.node('#dialog').innerHTML,/id="add-zone"/);assert.match(w.node('#dialog').innerHTML,/Maybeboard/);
  w.node('#add-destination').value='editor';w.node('#add-zone').value='maybeboard';w.node('#add-destination-form').onsubmit({preventDefault(){}});
  assert.equal(vm.runInContext('decks[0].cards.at(-1).zone',w.context),'maybeboard');assert.equal(vm.runInContext('tracker.id',w.context),'');assert.equal(vm.runInContext('stats(decks[0]).total',w.context),3);
  assert.doesNotThrow(()=>core.validateBackup(JSON.parse(vm.runInContext('JSON.stringify(decks)',w.context))));
});


test('function matching precedes removable chips inside the disclosure without changing the query on collapse', () => {
  const w=workspace();
  vm.runInContext("filters=parseQuery('t:instant (otag:ramp OR otag:draw)'); render()",w.context);
  const html=w.node('#app').innerHTML;
  const panel=html.slice(html.indexOf('<details id="function-tags"'),html.indexOf('<div id="search-output"'));
  assert.match(panel, /id="selected-functions"[\s\S]*Combine functions by[\s\S]*Matching any \(OR\)[\s\S]*Remove ramp filter[\s\S]*for="tag-search"/);
  const query=vm.runInContext('filters.query',w.context);
  w.node('#function-tags').toggle({target:{open:false,isConnected:true}});
  assert.equal(vm.runInContext('filters.query',w.context),query);
  vm.runInContext("setCondition('tags',{...filters,tags:['draw']},false)",w.context);
  assert.match(vm.runInContext('filters.query',w.context),/t:instant/);
  assert.doesNotMatch(vm.runInContext('filters.query',w.context),/ramp/);
  assert.doesNotMatch(vm.runInContext('broadeningTools()',w.context), /Ignore one condition;|No guided condition to relax/);
});
