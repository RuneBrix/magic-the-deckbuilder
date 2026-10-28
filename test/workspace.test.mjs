import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
import * as core from '../public/core.js';

const source = (await readFile(new URL('../public/app.js', import.meta.url), 'utf8')).replace(/^import .*;\r?\n/, '');

// Exercise the browser module's preferences and rendering without a DOM dependency.
function workspace({ savedTheme = null, savedDecks = null, dark = false, blocked = false } = {}) {
  const writes = [], nodes = new Map();
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, {
      innerHTML: '', content: '', addEventListener(type, fn) { this[type] = fn; },
      contains() { return false; }, querySelector: node,
      setAttribute() {}, showModal() {}, focus() {}, close() {},
      classList: { add() {}, remove() {} },
    });
    return nodes.get(selector);
  };
  const media = { matches: dark, addEventListener(type, fn) { this[type] = fn; } };
  const document = { querySelector: node, documentElement: { dataset: {} }, activeElement: null };
  const context = vm.createContext({ ...core, document, matchMedia: () => media,
    localStorage: {
      getItem(key) { if (blocked) throw Error('Storage blocked'); return key === 'arcana.theme.v1' ? savedTheme : savedDecks; },
      setItem(key, value) { if (blocked) throw Error('Storage blocked'); writes.push([key, value]); },
    },
    setTimeout: () => 1, clearTimeout() {}, URLSearchParams, structuredClone, crypto: { randomUUID },
  });
  vm.runInContext(source, context);
  return { context, document, media, node, writes };
}

test('appearance honors saved choice, follows system only in system mode, and never writes deck data', () => {
  const w = workspace({ savedTheme: 'dark' });
  assert.equal(w.document.documentElement.dataset.theme, 'dark');
  vm.runInContext('settings()', w.context);
  w.node('#theme').onchange({ target: { value: 'light' } });
  assert.equal(w.document.documentElement.dataset.theme, 'light');
  assert.deepEqual(w.writes, [['arcana.theme.v1', 'light']]);
  w.media.matches = true;
  w.media.change();
  assert.equal(w.document.documentElement.dataset.theme, 'light');
  w.node('#theme').onchange({ target: { value: 'system' } });
  assert.equal(w.document.documentElement.dataset.theme, 'dark');
  w.media.matches = false;
  w.media.change();
  assert.equal(w.document.documentElement.dataset.theme, 'light');
});

test('invalid or unavailable appearance storage falls back to system and remains usable', () => {
  for (const options of [{ savedTheme: 'invalid', dark: true }, { blocked: true, dark: true }]) {
    const w = workspace(options);
    assert.equal(w.document.documentElement.dataset.theme, 'dark');
    vm.runInContext('settings()', w.context);
    assert.doesNotThrow(() => w.node('#theme').onchange({ target: { value: 'light' } }));
    assert.equal(w.document.documentElement.dataset.theme, 'light');
  }
});

test('search disclosures start closed and preserve the opened state and selected filters across renders', () => {
  const w = workspace();
  assert.doesNotMatch(w.node('#app').innerHTML, /id="search-filters"[^>]*\bopen\b/);
  assert.doesNotMatch(w.node('#app').innerHTML, /id="function-tags"[^>]*\bopen\b/);
  w.node('#search-filters').toggle({ target: { open: true } });
  w.node('#function-tags').toggle({ target: { open: true } });
  vm.runInContext("filters=parseQuery('o:\"draw a card\" otag:ramp'); render()", w.context);
  const html = w.node('#app').innerHTML;
  assert.match(html, /id="search-filters"[^>]*\bopen\b/);
  assert.match(html, /id="function-tags"[^>]*\bopen\b/);
  assert.match(html, /name="oracle" value="draw a card"/);
  assert.match(html, /aria-label="Remove ramp filter"/);
  assert.doesNotMatch(html, /data-action="backup"|data-action="restore"/);
});

test('tag discovery renders aliases, verified relationships, limits and custom tag guidance', () => {
  const w = workspace();
  vm.runInContext("tagSearch = 'blink'; browsedTag = 'flicker'; filters=parseQuery('otag:unknown-arcana-tag'); render()", w.context);
  const html = w.node('#app').innerHTML;
  assert.match(html, /Add flicker filter/);
  assert.match(html, /Aliases: blink/);
  assert.match(html, /Broader tags/);
  assert.match(html, /Narrower tags/);
  assert.match(html, /data-browse-tag="flicker-creature"/);
  assert.match(html, /outside this snapshot/);
  assert.match(html, /Snapshot \d{4}-\d{2}-\d{2}/);
  assert.match(html, /All selected functions \(AND\)/);
  assert.match(html, /otag:unknown-arcana-tag/);
  vm.runInContext("tagSearch = 'unknown-arcana-tag'; render()", w.context);
  assert.match(w.node('#app').innerHTML, /No matching name or alias/);
  vm.runInContext("tagSearch = ''; allTags = true; render()", w.context);
  assert.match(w.node('#app').innerHTML, /Browsing the full bundled catalog/);
  assert.match(w.node('#app').innerHTML, /Show next 30 catalog tags/);
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

test('comparison retains result provenance across unsent edits and subsequent searches', async () => {
  const w = workspace();
  const card = name => ({id:name,oracle_id:name,name,type_line:'Instant',cmc:2,mana_cost:'{1}{U}',colors:['U'],color_identity:['U'],oracle_text:'Draw a card.'});
  w.context.fetch = async () => ({ok:true,json:async()=>({data:[card('First')],total_cards:1,has_more:false})});
  await vm.runInContext("filters=parseQuery('mv<=2 otag:draw'); search();",w.context);
  vm.runInContext("filters=parseQuery('otag:removal'); toggleComparison('First');",w.context);
  let html=w.node('#app').innerHTML;
  assert.match(html,/Searched for all: draw/);
  assert.match(html,/mv&lt;=2 otag:draw/);
  assert.doesNotMatch(html,/Searched for all: removal/);
  w.context.fetch = async () => ({ok:true,json:async()=>({data:[card('Second'),card('Third')],total_cards:2,has_more:false})});
  await vm.runInContext('search()',w.context);
  vm.runInContext("toggleComparison('Second'); toggleComparison('Third');",w.context);
  assert.equal(vm.runInContext('comparison.length',w.context),2);
  assert.equal(vm.runInContext("findCard('First').name",w.context),'First');
  html=w.node('#app').innerHTML;
  assert.match(html,/Your comparison/);
  assert.match(html,/Individual tag membership is not verified/);
  assert.match(html,/Oracle text/);
  assert.match(html,/Selected from query/);
  assert.match(html,/No personal roles recorded/);
  assert.equal(w.writes.length,0);
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

test('stale alternative responses cannot overwrite restored results or their comparison context',async()=>{
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

test('pagination uses the completed result query rather than unsent filter edits',async()=>{
  const w=workspace(), queries=[];
  w.context.fetch=async url=>{queries.push(String(url));return {ok:true,json:async()=>({data:[],total_cards:300,has_more:true})};};
  await vm.runInContext("filters=parseQuery('otag:ramp'); search()",w.context);
  await vm.runInContext("filters=parseQuery('otag:draw'); search(true)",w.context);
  assert.equal(new URLSearchParams(queries[1].split('?')[1]).get('q'),'otag:ramp');
  assert.equal(new URLSearchParams(queries[1].split('?')[1]).get('page'),'2');
});

test('applying unsent changes while sorting clears an obsolete relaxation explanation',async()=>{
  const w=workspace();
  w.context.FormData=class {get(key){return vm.runInContext(`filters[${JSON.stringify(key)}]`,w.context);}};
  w.context.fetch=async()=>({ok:true,json:async()=>({data:[],total_cards:0,has_more:false})});
  await vm.runInContext("filters=parseQuery('otag:ramp mv<=3'); broaden('mv')",w.context);
  assert.ok(vm.runInContext('broadening',w.context));
  await vm.runInContext("filters=parseQuery('usd<5'); search(false,true)",w.context);
  assert.equal(vm.runInContext('broadening',w.context),null);
  assert.doesNotMatch(vm.runInContext('resultContext.reason',w.context),/ignored/);
});

test('legacy saved decks get explicit in-memory zones without writing storage',()=>{
  const c={id:'leader',name:'Leader',type_line:'Legendary Creature',cmc:1,color_identity:['G'],colors:['G'],oracle_text:'',legalities:{commander:'legal'}};
  const d={id:'old',name:'Old deck',format:'commander',cards:[{card:c,qty:1,tags:['Role'],commander:true}]};
  const w=workspace({savedDecks:JSON.stringify([d])});
  assert.equal(vm.runInContext('decks[0].cards[0].zone',w.context),'command');
  assert.equal(vm.runInContext('decks[0].cards[0].tags[0]',w.context),'Role');
  assert.equal(w.writes.length,0);
  assert.match(w.node('#app').innerHTML,/Command zone: 1/);
  vm.runInContext("deckTab='checks'; render()",w.context);
  assert.match(w.node('#app').innerHTML,/Failed checks/);
  assert.match(w.node('#app').innerHTML,/Data unavailable/);
  assert.match(w.node('#app').innerHTML,/Manual review/);
  assert.match(w.node('#app').innerHTML,/coverage is partial/);
});

test('zone row quantity buttons target only their entry and sideboard does not inflate deck progress',async()=>{
  const c={id:'land',oracle_id:'land',name:'Forest',type_line:'Basic Land — Forest',cmc:0,color_identity:['G'],colors:[],oracle_text:'',legalities:{modern:'legal'}};
  const d={id:'zones',name:'Zones',format:'modern',cards:[{card:c,qty:60,tags:[],zone:'main'},{card:c,qty:15,tags:[],zone:'sideboard'}]};
  const w=workspace({savedDecks:JSON.stringify([d])});
  const button={dataset:{zonePlus:core.entryKey(d.cards[1])}};
  w.context.FormData=class {get(key){return vm.runInContext(`filters[${JSON.stringify(key)}]`,w.context);}};
  await w.node('#app').click({target:{closest:()=>button}});
  assert.equal(vm.runInContext('decks[0].cards[0].qty',w.context),60);
  assert.equal(vm.runInContext('decks[0].cards[1].qty',w.context),16);
  assert.match(w.node('#app').innerHTML,/<strong>60<span> \/ 60\+/);
  vm.runInContext("deckTab='checks'; render()",w.context);
  assert.match(w.node('#app').innerHTML,/Sideboard has 16/);
});

const editorCard=(id,type='Creature')=>({id,oracle_id:id,name:id,type_line:type,cmc:2,color_identity:['G'],colors:['G'],mana_cost:'{1}{G}',oracle_text:'',legalities:{commander:'legal'}});
const editorDeck=()=>({id:'editor',name:'Garden',format:'commander',cards:[{card:editorCard('Leader','Legendary Creature'),qty:1,tags:['Draw'],zone:'command'},{card:editorCard('Ramp spell','Sorcery'),qty:2,tags:['Removal','Ramp'],zone:'main'}]});
function formValues(w,values){w.context.FormData=class{get(key){return Object.hasOwn(values,key)?values[key]:'';}};}

test('top navigation opens a full deck destination and retains the explorer search',async()=>{
  const w=workspace({savedDecks:JSON.stringify([editorDeck()])});vm.runInContext("filters=parseQuery('draw')",w.context);
  const click=dataset=>w.node('#app').click({target:{closest:()=>({dataset})}});
  await click({view:'decks'});
  assert.doesNotMatch(w.node('#app').innerHTML,/class="sidebar"|YOUR DECKS|class="deck-nav"/);
  assert.match(w.node('#app').innerHTML,/class="workspace-nav"/);
  await click({deck:'editor'});
  assert.match(w.node('#app').innerHTML,/class="deck-workspace"/);
  assert.match(w.node('#app').innerHTML,/data-view="decks" class="nav-item selected" aria-current="location"/);
  assert.doesNotMatch(w.node('#app').innerHTML,/class="deck-panel"/);
  assert.match(w.node('#app').innerHTML,/Command-zone identity/);
  w.node('#editor-role').change({target:{value:'Ramp'}});
  assert.match(w.node('#app').innerHTML,/Ramp spell/);
  assert.doesNotMatch(w.node('#app').innerHTML,/data-inspect="Leader"/);
  await click({tab:'checks'});assert.match(w.node('#app').innerHTML,/Manual review/);
  await click({tab:'stats'});assert.match(w.node('#app').innerHTML,/Mana curve/);
  await click({view:'explore'});assert.equal(vm.runInContext('filters.query',w.context),'draw');
});

test('duplicate is a deep independent backup-compatible copy; delete requires explicit confirmation',()=>{
  const w=workspace({savedDecks:JSON.stringify([editorDeck()])});
  vm.runInContext('duplicateDeck(decks[0]); decks[1].cards[1].qty++; decks[1].cards[1].tags.push("New role")',w.context);
  assert.equal(vm.runInContext('decks[0].cards[1].qty',w.context),2);
  assert.equal(vm.runInContext('decks[0].cards[1].tags.length',w.context),2);
  assert.notEqual(vm.runInContext('decks[1].id',w.context),'editor');
  core.validateBackup(JSON.parse(vm.runInContext('JSON.stringify(decks)',w.context)));
  vm.runInContext('deleteDeck(decks[1])',w.context);
  assert.equal(vm.runInContext('decks.length',w.context),2);
  w.node('#cancel-delete').onclick();assert.equal(vm.runInContext('decks.length',w.context),2);
  vm.runInContext('deleteDeck(decks[1])',w.context);w.node('#confirm-delete').onclick();
  assert.equal(vm.runInContext('decks.length',w.context),1);
});

test('new Commander decks designate an optional selected card and other formats omit it',async()=>{
  for(const format of ['commander','modern']){
    const w=workspace();formValues(w,{name:'New deck',format});
    w.context.fetch=async()=>({ok:true,json:async()=>({data:[editorCard('Leader','Legendary Creature')]})});
    vm.runInContext('deckForm()',w.context);w.node('#commander-name').value='Leader';
    await w.node('#find-commander').onclick();w.node('#commander-card').value='Leader';
    w.node('#deck-form').onsubmit({preventDefault(){},target:{}});
    assert.equal(vm.runInContext('view',w.context),'deck');
    assert.equal(vm.runInContext('decks[0].cards.length',w.context),format==='commander'?1:0);
    if(format==='commander')assert.equal(vm.runInContext('decks[0].cards[0].zone',w.context),'command');
  }
  const w=workspace();formValues(w,{name:'Incomplete',format:'commander'});vm.runInContext('deckForm()',w.context);
  w.node('#deck-form').onsubmit({preventDefault(){},target:{}});assert.equal(vm.runInContext('decks[0].cards.length',w.context),0);
});

test('library imports create a deck only after successful resolution, and cancelled forms cannot mutate decks',async()=>{
  const w=workspace({savedDecks:JSON.stringify([editorDeck()])});formValues(w,{name:'Imported',format:'modern',list:'2 Ramp spell'});
  w.context.fetch=async()=>({ok:true,json:async()=>({data:[],not_found:[{name:'Ramp spell'}]})});
  vm.runInContext('importDialog(null)',w.context);
  const form=w.node('#import-form');
  await form.onsubmit({preventDefault(){},target:form});
  assert.equal(vm.runInContext('decks.length',w.context),1);assert.match(w.node('#import-error').textContent,/Not imported/);
  w.context.fetch=async()=>({ok:true,json:async()=>({data:[editorCard('Ramp spell','Sorcery')]})});
  form.isConnected=false;await form.onsubmit({preventDefault(){},target:form});assert.equal(vm.runInContext('decks.length',w.context),1);
  form.isConnected=true;w.node('#dialog').open=false;await form.onsubmit({preventDefault(){},target:form});assert.equal(vm.runInContext('decks.length',w.context),1);
  w.node('#dialog').open=true;
  form.isConnected=true;await form.onsubmit({preventDefault(){},target:form});
  assert.equal(vm.runInContext('decks.length',w.context),2);assert.equal(vm.runInContext('current().cards[0].qty',w.context),2);
  assert.equal(vm.runInContext('decks[0].cards[1].qty',w.context),2);
});

test('targeted imports preserve edits made while resolving and roll back quantity overflow',async()=>{
  const w=workspace({savedDecks:JSON.stringify([editorDeck()])});formValues(w,{list:'2 Ramp spell'});
  let finish;w.context.fetch=()=>new Promise(resolve=>{finish=resolve;});
  vm.runInContext('importDialog(decks[0])',w.context);const form=w.node('#import-form');
  const pending=form.onsubmit({preventDefault(){},target:form});
  vm.runInContext('decks[0].cards[1].qty=4; decks[0].cards[1].tags.push("Edited while loading")',w.context);
  finish({ok:true,json:async()=>({data:[editorCard('Ramp spell','Sorcery')]})});await pending;
  assert.equal(vm.runInContext('decks[0].cards[1].qty',w.context),6);
  assert.equal(vm.runInContext('decks[0].cards[1].tags[2]',w.context),'Edited while loading');
  vm.runInContext('decks[0].cards[1].qty=499; importDialog(decks[0])',w.context);
  w.context.fetch=async()=>({ok:true,json:async()=>({data:[editorCard('Ramp spell','Sorcery')]})});
  const before=vm.runInContext('JSON.stringify(decks)',w.context);
  await form.onsubmit({preventDefault(){},target:form});
  assert.equal(vm.runInContext('JSON.stringify(decks)',w.context),before);
  assert.match(w.node('#import-error').textContent,/Maximum 500/);
});

test('typed query projects controls without replacing the focused search input; typed tags can be removed',async()=>{
  const w=workspace(),raw=w.node('#raw'),shell=w.node('#app').innerHTML;
  raw.selectionStart=12;raw.selectionEnd=12;
  raw.input({target:{value:'(t:instant OR t:sorcery) (otag:ramp OR otag:draw) usd<5'}});
  assert.equal(w.node('#raw'),raw);assert.equal(raw.selectionStart,12);assert.equal(raw.selectionEnd,12);
  assert.equal(w.node('#app').innerHTML,shell);
  assert.match(w.node('#guided-controls').innerHTML,/value="instant, sorcery"/);
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
  form.input({target:{closest:()=>({dataset:{family:'symbols'}})}});
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
