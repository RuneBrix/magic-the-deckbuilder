import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
import * as core from '../public/core.js';

const source = (await readFile(new URL('../public/app.js', import.meta.url), 'utf8')).replace(/^import .*;\r?\n/, '');

// Exercise the browser module's preferences and rendering without a DOM dependency.
function workspace({ savedTheme = null, savedDecks = null, savedTracker = null, savedPalette = null, dark = false, blocked = false, initialView = 'explore' } = {}) {
  const writes = [], nodes = new Map(), timers=[], events={};
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, {
      innerHTML: '', content: '', addEventListener(type, fn) { this[type] = fn; },
      contains() { return false; }, querySelector: node, querySelectorAll:()=>[], scrollIntoView() {}, dataset:{}, isConnected:true,
      matches(){return Boolean(this.popoverOpen);}, showPopover(){this.popoverOpen=true;}, hidePopover(){this.popoverOpen=false;}, getBoundingClientRect(){return {right:300,bottom:100,height:400,width:250};},
      setAttribute() {}, showModal() {}, focus() {}, close() {},
      classList: { add() {}, remove() {}, toggle() {} }, style: { setProperty() {} },
    });
    return nodes.get(selector);
  };
  const media = { matches: dark, addEventListener(type, fn) { this[type] = fn; } };
  const document = { querySelector: node, querySelectorAll:()=>[], scrollIntoView() {}, documentElement: { dataset: {} }, activeElement: null };
  const context = vm.createContext({ ...core, document, addEventListener:(type,fn)=>{events[type]=fn;}, matchMedia: () => media,
    localStorage: {
      getItem(key) { if (blocked) throw Error('Storage blocked'); return key === 'arcana.palette.v1' ? savedPalette : key === 'arcana.theme.v1' ? savedTheme : key === 'arcana.explorer.v1' ? savedTracker : savedDecks; },
      setItem(key, value) { if (blocked) throw Error('Storage blocked'); writes.push([key, value]); },
    },
    innerWidth:1280,innerHeight:900,
    setTimeout: (fn,ms) => {timers.push({fn,ms});return timers.length;}, clearTimeout() {}, URLSearchParams, structuredClone, crypto: { randomUUID },
  });
  vm.runInContext(source, context);
  // Most tests exercise exploration; initialView: null leaves the real startup untouched.
  if (initialView) vm.runInContext(`view=${JSON.stringify(initialView)};render()`, context);
  return { context, document, media, node, writes, timers, events };
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
  assert.equal(vm.runInContext('resultContext.query',w.context),'usd<5');
  assert.doesNotMatch(w.node('#app').innerHTML,/Why these results/);
});

test('legacy saved decks get explicit in-memory zones without writing storage',()=>{
  const c={id:'leader',name:'Leader',type_line:'Legendary Creature',cmc:1,color_identity:['G'],colors:['G'],oracle_text:'',legalities:{commander:'legal'}};
  const d={id:'old',name:'Old deck',format:'commander',cards:[{card:c,qty:1,tags:['Role'],commander:true}]};
  const w=workspace({savedDecks:JSON.stringify([d])});
  assert.equal(vm.runInContext('decks[0].cards[0].zone',w.context),'command');
  assert.equal(vm.runInContext('decks[0].cards[0].tags[0]',w.context),'Role');
  assert.equal(w.writes.length,0);
  assert.match(w.node('#app').innerHTML,/Command zone: 1/);
  vm.runInContext("view='deck'; deckTab='checks'; render()",w.context);
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
  assert.match(w.node('#app').innerHTML,/<strong>60<\/strong> in playing deck/);
  vm.runInContext("view='deck'; deckTab='checks'; render()",w.context);
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
  assert.match(w.node('#app').innerHTML,/Color identity: Green/);
  w.node('#editor-search').input({target:{value:'Ramp'}});
  assert.match(w.node('#editor-card-area').outerHTML,/Ramp spell/);
  assert.doesNotMatch(w.node('#editor-card-area').outerHTML,/data-inspect="Leader"/);
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
  assert.equal(vm.runInContext('decks.length',w.context),1);assert.match(w.node('#import-error').textContent,/Nothing imported/);
  w.context.fetch=async()=>({ok:true,json:async()=>({data:[editorCard('Ramp spell','Sorcery')]})});
  form.isConnected=false;await form.onsubmit({preventDefault(){},target:form});assert.equal(vm.runInContext('decks.length',w.context),1);
  form.isConnected=true;w.node('#dialog').open=false;await form.onsubmit({preventDefault(){},target:form});assert.equal(vm.runInContext('decks.length',w.context),1);
  w.node('#dialog').open=true;
  form.isConnected=true;await form.onsubmit({preventDefault(){},target:form});
  assert.equal(vm.runInContext('decks.length',w.context),1);
  assert.match(w.node('#import-preview').innerHTML,/Nothing has been imported/);
  await form.onsubmit({preventDefault(){},target:form});
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
  assert.equal(vm.runInContext('decks[0].cards[1].qty',w.context),4);
  await form.onsubmit({preventDefault(){},target:form});
  assert.equal(vm.runInContext('decks[0].cards[1].qty',w.context),6);
  assert.equal(vm.runInContext('decks[0].cards[1].tags[2]',w.context),'Edited while loading');
  vm.runInContext('decks[0].cards[1].qty=499; importDialog(decks[0])',w.context);
  w.context.fetch=async()=>({ok:true,json:async()=>({data:[editorCard('Ramp spell','Sorcery')]})});
  const before=vm.runInContext('JSON.stringify(decks)',w.context);
  await form.onsubmit({preventDefault(){},target:form});
  assert.equal(vm.runInContext('JSON.stringify(decks)',w.context),before);
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
  await click({view:'explore'});
  assert.equal(vm.runInContext('current()',w.context),undefined);
  await click({deck:'second'});await click({action:'find-cards'});
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
  assert.match(w.node('#app').innerHTML,/data-state="initial"/);
  assert.doesNotMatch(w.node('#app').innerHTML,/id="sort"|What does your deck need/);
  let complete;
  w.context.fetch=()=>new Promise(resolve=>complete=resolve);
  const pending=vm.runInContext("filters=parseQuery('otag:ramp'); search()",w.context);
  assert.match(w.node('#app').innerHTML,/data-state="loading"/);
  vm.runInContext("setCondition('tags',{...filters,tags:[]},false)",w.context);
  assert.match(w.node('#results-area').outerHTML,/data-state="initial"/);
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


test('all dark palettes persist independently and work with device/light appearance and blocked storage',()=>{
  for(const palette of ['green','blue','white','orange']) {
    const w=workspace({savedPalette:palette,savedTheme:'dark'});
    assert.equal(w.document.documentElement.dataset.palette,palette);
    assert.equal(w.document.documentElement.dataset.theme,'dark');
    vm.runInContext('settings()',w.context);
    w.node('#dark-palette').onchange({target:{value:palette}});
    assert.deepEqual(w.writes,[['arcana.palette.v1',palette]]);
    w.node('#theme').onchange({target:{value:'light'}});
    assert.equal(w.document.documentElement.dataset.theme,'light');
    w.media.matches=true;w.node('#theme').onchange({target:{value:'system'}});
    assert.equal(w.document.documentElement.dataset.theme,'dark');
    assert.equal(w.document.documentElement.dataset.palette,palette);
  }
  const w=workspace({blocked:true});vm.runInContext('settings()',w.context);
  assert.doesNotThrow(()=>w.node('#dark-palette').onchange({target:{value:'orange'}}));
  assert.match(w.node('#toast').textContent,/session/);
  assert.equal(workspace({savedPalette:'invalid'}).document.documentElement.dataset.palette,'green');
});

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
  vm.runInContext("legalityStates.get('modern').time-=300_001;render()",w.context);
  assert.match(w.node('#app').innerHTML,/Legality data is stale/);
  assert.match(w.node('#app').innerHTML,/Checks incomplete/);
  assert.match(w.node('#app').innerHTML,/Retry legality refresh/);
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


test('card details bind the named deck and row printing; roles autosave without replacing raw text',()=>{
  const d=editorDeck();d.cards[1].card.set_name='Stored release';
  const w=workspace({savedDecks:JSON.stringify([d,{...editorDeck(),id:'other',name:'Other'}])});
  vm.runInContext("results=[{...decks[0].cards[1].card,set_name:'Search release'}];inspect('Ramp spell',entryKey(decks[0].cards[1]));",w.context);
  assert.match(w.node('#detail-facts').innerHTML,/Stored release/);
  assert.match(w.node('#detail-deck').innerHTML,/Deck: Garden/);
  assert.doesNotMatch(w.node('#dialog').innerHTML,/Save zone and roles/);
  const input=w.node('#detail-roles');input.value='Draw, Ramp, ';
  input.input();
  assert.equal(input.value,'Draw, Ramp, ');
  assert.equal(vm.runInContext('decks[0].cards[1].tags.join(",")',w.context),'Draw,Ramp');
  vm.runInContext("trackDeck('other')",w.context);
  input.value='Removal';input.input();
  assert.equal(vm.runInContext('decks[0].cards[1].tags[0]',w.context),'Removal');
  assert.equal(vm.runInContext('decks[1].cards[1].tags[0]',w.context),'Removal');
  assert.match(w.node('#detail-save-status').textContent,/Saved to Garden/);
});

test('invalid roles remain visible across printing preview and prevent Escape/close until fixed or explicitly discarded',()=>{
  const w=workspace({savedDecks:JSON.stringify([editorDeck()])});
  vm.runInContext("inspect('Ramp spell')",w.context);
  const input=w.node('#detail-roles');input.value='x'.repeat(81);input.input();
  assert.match(w.node('#detail-save-status').textContent,/80 characters/);
  assert.equal(w.node('#discard-roles').hidden,false);
  let warned=false;w.events.beforeunload({preventDefault(){warned=true;}});assert.equal(warned,true);
  assert.equal(vm.runInContext('closeDialog()',w.context),false);
  let prevented=false;w.node('#dialog').cancel({preventDefault(){prevented=true;}});assert.equal(prevented,true);
  vm.runInContext("detail.printings.push({...detail.card,id:'preview',set_name:'Other release'});detail.loaded=true;renderPrintings()",w.context);
  w.node('#view-printing').change({target:{value:'preview'}});
  assert.equal(input.value,'x'.repeat(81));
  assert.equal(vm.runInContext('decks[0].cards[1].card.id',w.context),'Ramp spell');
  w.node('#discard-roles').onclick();assert.equal(vm.runInContext('detail',w.context),null);
});

test('zone autosave merges quantities and ordered roles, retains destination printing and rejects overflow atomically',()=>{
  const d=editorDeck();d.cards.push({...structuredClone(d.cards[1]),qty:3,tags:['Destination'],zone:'sideboard',card:{...d.cards[1].card,id:'side-print'}});
  const w=workspace({savedDecks:JSON.stringify([d])});vm.runInContext("inspect('Ramp spell')",w.context);
  w.node('#detail-roles').value='Ramp, Draw';w.node('#detail-roles').input();
  w.node('#detail-zone').change({target:{value:'sideboard'}});
  assert.equal(vm.runInContext('decks[0].cards.length',w.context),2);
  assert.equal(vm.runInContext('decks[0].cards[1].qty',w.context),5);
  assert.equal(vm.runInContext('decks[0].cards[1].card.id',w.context),'side-print');
  assert.equal(vm.runInContext('decks[0].cards[1].tags.join(",")',w.context),'Destination,Ramp,Draw');
  assert.match(w.node('#detail-deck').innerHTML,/Sideboard/);
  const over=editorDeck();over.cards.push({...structuredClone(over.cards[1]),qty:500,zone:'sideboard'});
  const v=workspace({savedDecks:JSON.stringify([over])});vm.runInContext("inspect('Ramp spell')",v.context);v.node('#detail-roles').value='New role';
  const before=vm.runInContext('JSON.stringify(decks)',v.context);v.node('#detail-zone').change({target:{value:'sideboard'}});
  assert.equal(vm.runInContext('JSON.stringify(decks)',v.context),before);
  assert.match(v.node('#detail-save-status').textContent,/Nothing moved/);
  assert.equal(v.node('#detail-roles').value,'New role');
});

test('printing browsing paginates safely, ignores dismissed responses, and preview/apply preserves entry metadata and backup',async()=>{
  const d=editorDeck(),w=workspace({savedDecks:JSON.stringify([d])});vm.runInContext("inspect('Ramp spell')",w.context);
  w.node('#detail-roles').value='Removal, Ramp';let calls=[];
  w.context.fetch=async url=>{calls.push(url);return {ok:true,json:async()=>({data:[{...d.cards[1].card,id:'new-print',set_name:'New release',collector_number:'123',prices:{usd:'2.50'}}],has_more:calls.length===1})};};
  await w.node('#load-printings').onclick();
  assert.equal(calls.length,1);assert.match(calls[0],/page=1/);
  assert.match(w.node('#load-printings').textContent,/Load more/);
  w.node('#view-printing').change({target:{value:'new-print'}});
  assert.match(w.node('#detail-facts').innerHTML,/New release/);
  assert.equal(vm.runInContext('decks[0].cards[1].card.id',w.context),'Ramp spell');
  w.node('#apply-printing').click();
  const entry=vm.runInContext('decks[0].cards[1]',w.context);
  assert.equal(entry.card.id,'new-print');assert.equal(entry.qty,2);assert.equal(entry.zone,'main');assert.equal(entry.tags.join(','),'Removal,Ramp');
  assert.equal(core.validateBackup(JSON.parse(vm.runInContext('JSON.stringify(decks)',w.context)))[0].cards[1].card.id,'new-print');
  await w.node('#load-printings').onclick();assert.match(calls[1],/page=2/);
  assert.equal(vm.runInContext('detail.printings.length',w.context),2);
  let resolve;w.context.fetch=()=>new Promise(r=>resolve=r);
  vm.runInContext("inspect('Leader',entryKey(decks[0].cards[0]))",w.context);
  const pending=w.node('#load-printings').onclick();
  vm.runInContext("inspect('new-print')",w.context);
  resolve({ok:true,json:async()=>({data:[d.cards[0].card]})});await pending;
  assert.equal(vm.runInContext('detail.card.id',w.context),'new-print');
});

test('printing failures retain viewed/stored cards and show retry; invalid identity cannot be applied',async()=>{
  const d=editorDeck(),w=workspace({savedDecks:JSON.stringify([d])});vm.runInContext("inspect('Ramp spell')",w.context);
  for(const mode of ['offline','empty','mismatch']) {
    w.context.fetch=async()=>{if(mode==='offline')throw Error('Offline');return {ok:true,json:async()=>({data:mode==='empty'?[]:[d.cards[0].card]})};};
    await w.node('#load-printings').onclick();
    assert.match(w.node('#load-printings').textContent,/Retry/);
    assert.equal(vm.runInContext('detail.card.id',w.context),'Ramp spell');
    assert.equal(vm.runInContext('decks[0].cards[1].card.id',w.context),'Ramp spell');
  }
  vm.runInContext("detail.card={...detail.card,oracle_id:'different'}",w.context);w.node('#detail-roles').value='Removal, Ramp';w.node('#apply-printing').click();
  assert.match(w.node('#detail-save-status').textContent,/rules identity/);
  assert.equal(vm.runInContext('decks[0].cards[1].card.id',w.context),'Ramp spell');
});

test('no-tracker details preview leaves decks unchanged; adding the viewed printing requires a named destination',()=>{
  const c=editorCard('Preview'),w=workspace({savedDecks:JSON.stringify([editorDeck()]),savedTracker:JSON.stringify({id:''})});
  w.context.preview=c;vm.runInContext('results=[preview];inspect(preview.id)',w.context);
  assert.match(w.node('#detail-deck').innerHTML,/No deck is tracked/);
  assert.equal(w.node('#detail-roles-section').innerHTML,'');
  assert.equal(w.writes.length,0);
  vm.runInContext("detail.card={...detail.card,id:'specific-print'}",w.context);
  w.node('#detail-add').onclick();assert.match(w.node('#dialog').innerHTML,/Choose the destination/);
  w.node('#add-destination').value='editor';w.node('#add-destination-form').onsubmit({preventDefault(){}});
  assert.equal(vm.runInContext('decks[0].cards.at(-1).card.id',w.context),'specific-print');
  assert.equal(vm.runInContext('tracker.id',w.context),'');

});


test('legacy cards without Oracle identity remain inspectable with a clear printing limitation',()=>{
  const w=workspace(),card={...editorCard('Legacy')};delete card.oracle_id;
  w.context.legacy=card;vm.runInContext('results=[legacy];inspect(legacy.id)',w.context);
  assert.match(w.node('#detail-facts').innerHTML,/Legacy/);
  assert.equal(w.node('#load-printings').disabled,true);
  assert.match(w.node('#printing-status').textContent,/Find the card again in search/);
  assert.equal(w.writes.length,0);
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
  assert.match(w.node('#app').innerHTML,/Suggested discussion range: Brackets 3–5/);
  assert.match(w.node('#app').innerHTML,/below this standard count-based range/);
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
  assert.match(w.node('#app').innerHTML,/Suggestion unavailable: bundled list data is missing/);
  assert.doesNotMatch(w.node('#app').innerHTML,/Suggested discussion range/);
  w.context.bracketReport=d=>core.bracketReport(d,core.COMMANDER_BRACKETS,Date.parse('2027-02-01'));
  vm.runInContext('render()',w.context);assert.match(w.node('#app').innerHTML,/overdue for review/);
  assert.match(w.node('#app').innerHTML,/Player assigned:<\/strong> Bracket 2/);
  assert.equal(vm.runInContext('decks[0].bracket',w.context),2);
});


test('startup and reload open My decks, including an empty library, without changing stored decks', () => {
  for (const savedDecks of [null, JSON.stringify([editorDeck()])]) {
    const w=workspace({savedDecks,initialView:null});
    assert.equal(vm.runInContext('view',w.context),'decks');
    assert.match(w.node('#app').innerHTML,/id="library-title"/);
    assert.match(w.node('#app').innerHTML,/data-view="decks" aria-label="Arcana home — My decks"/);
    assert.match(w.node('#app').innerHTML,/data-view="decks" class="nav-item selected"[^>]*aria-current="page"/);
    assert.match(w.node('#app').innerHTML,savedDecks?/Garden/:/No decks yet/);
    assert.equal(w.writes.length,0);
    assert.equal(w.timers.length,0); // Library startup must not refresh every stored deck.
    const reload=workspace({savedDecks,initialView:null});
    assert.equal(vm.runInContext('view',reload.context),'decks');
  }
});

test('home navigation preserves exploration results, filters, ordering, pagination and broadening', async () => {
  const w=workspace({savedDecks:JSON.stringify([editorDeck()]),initialView:null});
  const navigate=async view=>w.node('#app').click({preventDefault(){},target:{closest:()=>({dataset:{view}})}});
  await navigate('explore');
  w.context.fetch=async()=>({ok:true,json:async()=>({data:[editorCard('Found')],total_cards:100,has_more:true})});
  vm.runInContext("filters=parseQuery('t:instant mv<=3');order='name';filtersOpen=true;tagsOpen=true",w.context);
  await vm.runInContext("broaden('mv')",w.context);
  vm.runInContext('page=2;visibleLimit=48',w.context);
  const before=vm.runInContext('JSON.stringify({filters,results,resultContext,page,more,order,visibleLimit,broadening,tracker})',w.context);
  await navigate('decks');
  assert.match(w.node('#app').innerHTML,/id="library-title"/);
  await navigate('explore');
  assert.equal(vm.runInContext('JSON.stringify({filters,results,resultContext,page,more,order,visibleLimit,broadening,tracker})',w.context),before);
  assert.match(w.node('#app').innerHTML,/Ignored Mana values/);
  assert.match(w.node('#app').innerHTML,/id="search-filters"[^>]*open/);
  assert.match(w.node('#app').innerHTML,/id="function-tags"[^>]*open/);
  assert.equal(w.writes.length,0);
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


test('library prioritizes designated commander art, keeps legacy fallback and opens by artwork/title without statistics', async () => {
  const d=editorDeck();d.bracket=3;d.cards.reverse();
  d.cards[0].card.image_uris={normal:'https://cards.scryfall.io/normal/main.jpg',art_crop:'https://cards.scryfall.io/art_crop/main.jpg'};
  d.cards[1].card.image_uris={normal:'https://cards.scryfall.io/normal/leader.jpg',art_crop:'https://cards.scryfall.io/art_crop/leader.jpg'};
  const w=workspace({savedDecks:JSON.stringify([d]),initialView:null});
  const before=vm.runInContext('JSON.stringify(decks)',w.context),html=w.node('#app').innerHTML;
  assert.match(html,/src="https:\/\/cards.scryfall.io\/art_crop\/leader.jpg"/);
  assert.doesNotMatch(html,/main.jpg|average MV|Player assigned|Command-zone identity|Open deck/);
  assert.match(html,/Bracket 3 · Upgraded/);
  assert.match(html,/Color identity: Green/);
  assert.equal((html.match(/data-deck="editor"/g)||[]).length,2);
  assert.match(html,/Deck actions for Garden/);
  for(const action of ['rename','import','export','duplicate','delete'])assert.match(html,new RegExp('data-manage="'+action+'" data-target="editor"'));
  assert.equal(vm.runInContext('JSON.stringify(decks)',w.context),before);assert.equal(w.writes.length,0);
  vm.runInContext('delete decks[0].cards[1].card.image_uris.art_crop;render()',w.context);
  assert.match(w.node('#app').innerHTML,/deck-cover cover-portrait/);
  assert.match(w.node('#app').innerHTML,/normal\/leader.jpg/);
  vm.runInContext("decks[0].cards[1].card.image_uris.art_crop='https://untrusted.example/art.jpg';render()",w.context);
  assert.doesNotMatch(w.node('#app').innerHTML,/untrusted.example/);
  await w.node('#app').click({target:{closest:()=>({dataset:{deck:'editor'}})}});
  assert.equal(vm.runInContext('view',w.context),'deck');
});

test('compact editor exposes named management, format and identity; guidance opens and focuses Checks without changing decks', async () => {
  const w=workspace({savedDecks:JSON.stringify([editorDeck()])});vm.runInContext("openDeck('editor')",w.context);
  let html=w.node('#app').innerHTML;
  assert.match(html,/class="deck-editor-header"/);assert.match(html,/Commander<\/span>/);
  assert.match(html,/Color identity: Green/);
  assert.doesNotMatch(html,/Command-zone identity|Your choice; never assigned|deck-management|data-action="rename"/);
  assert.match(html,/Commander bracket<select/);assert.match(html,/href="#bracket-discussion" data-action="bracket-guidance"/);
  const before=vm.runInContext('JSON.stringify(decks)',w.context);let scrolled=0,focused=0,prevented=false;
  w.node('#bracket-discussion').scrollIntoView=()=>scrolled++;
  w.node('#bracket-discussion').focus=()=>focused++;
  await w.node('#app').click({preventDefault(){prevented=true;},target:{closest:()=>({dataset:{action:'bracket-guidance'}})}});
  assert.equal(vm.runInContext('deckTab',w.context),'checks');assert.equal(scrolled,1);assert.equal(focused,1);assert.equal(prevented,true);
  html=w.node('#app').innerHTML;assert.match(html,/id="bracket-discussion" tabindex="-1"/);
  assert.match(html,/not a power rating or bracket certification/);assert.match(html,/Sources and update limits/);
  assert.equal(vm.runInContext('JSON.stringify(decks)',w.context),before);assert.equal(w.writes.length,0);
});

test('deck action menus support arrow navigation, Escape return and outside dismissal', () => {
  const w=workspace();let focused=-1;
  const buttons=[0,1,2,3,4].map(i=>({focus(){focused=i;w.document.activeElement=this;}}));
  const summary={focus(){focused=-1;w.document.activeElement=this;}};
  const menu={open:false,querySelectorAll:()=>buttons,querySelector:()=>summary,contains:()=>false};
  const target={closest:()=>menu};
  const press=key=>w.node('#app').keydown({key,target,preventDefault(){}});
  press('ArrowDown');assert.equal(menu.open,true);assert.equal(focused,0);
  press('ArrowUp');assert.equal(focused,4);
  press('Home');assert.equal(focused,0);press('End');assert.equal(focused,4);
  press('Escape');assert.equal(menu.open,false);assert.equal(focused,-1);
  menu.open=true;w.document.querySelectorAll=()=>[menu];w.events.click({target:{}});assert.equal(menu.open,false);
});

test('menu actions target their named deck and close before a dialog; cancel deletion preserves every deck', async () => {
  const a=editorDeck(),b={...editorDeck(),id:'other',name:'Other'};
  const w=workspace({savedDecks:JSON.stringify([a,b]),initialView:null});
  let returned=false;const menu={open:true,querySelector:()=>({focus(){returned=true;}})};
  const click=action=>w.node('#app').click({target:{closest:()=>({dataset:{manage:action,target:'other'},closest:()=>menu})}});
  await click('export');assert.match(w.node('#dialog').innerHTML,/Export Other/);assert.equal(menu.open,false);assert.equal(returned,true);assert.equal(w.writes.length,0);
  await click('delete');assert.match(w.node('#dialog').innerHTML,/Delete Other/);w.node('#cancel-delete').onclick();
  assert.equal(vm.runInContext('decks.length',w.context),2);assert.equal(w.writes.length,0);
  await click('duplicate');assert.equal(vm.runInContext('decks[2].name',w.context),'Other (copy)');
  assert.equal(vm.runInContext('decks[0].name',w.context),'Garden');
  assert.doesNotThrow(()=>core.validateBackup(JSON.parse(vm.runInContext('JSON.stringify(decks)',w.context))));
});


test('deck controls compose live text filtering, grouping and sorting without replacing the input or writing deck data', async () => {
  const w=workspace({savedDecks:JSON.stringify([editorDeck()])});vm.runInContext("openDeck('editor')",w.context);
  const shell=w.node('#app').innerHTML,field=w.node('#editor-search'),before=vm.runInContext('JSON.stringify(decks)',w.context);
  assert.match(shell,/Group by/);assert.match(shell,/>Type<\/option>/);assert.match(shell,/>Function<\/option>/);
  assert.match(shell,/Sort by/);assert.match(shell,/Price USD \(high first\)/);assert.match(shell,/Power \(low first\)/);assert.match(shell,/Toughness \(high first\)/);
  assert.doesNotMatch(shell,/Order by|editor-type|editor-role|role-help/);
  field.input({target:{value:'SORCERY ramp'}});
  assert.equal(w.node('#app').innerHTML,shell);assert.equal(w.node('#editor-search'),field);
  assert.match(w.node('#editor-card-area').outerHTML,/Ramp spell/);assert.doesNotMatch(w.node('#editor-card-area').outerHTML,/data-inspect="Leader"/);
  w.node('#editor-group').change({target:{value:'role'}});w.node('#editor-order').change({target:{value:'price-desc'}});
  assert.match(w.node('#app').innerHTML,/<h4>Removal<\/h4>/);assert.match(w.node('#app').innerHTML,/2 shown/);
  field.input({target:{value:'not in this deck'}});assert.match(w.node('#editor-card-area').outerHTML,/No cards match these filters/);
  await w.node('#app').click({target:{closest:()=>({dataset:{action:'clear-deck-filters'}})}});
  assert.equal(vm.runInContext('editorOptions.search',w.context),'');assert.equal(vm.runInContext('editorOptions.order',w.context),'price-desc');
  assert.equal(vm.runInContext('JSON.stringify(decks)',w.context),before);assert.equal(w.writes.length,0);
});

test('left preview follows pointer and focus by zone, survives rerender and clears when filtered out without mutating cards', () => {
  const d=editorDeck();d.cards[1].card.image_uris={normal:'https://cards.scryfall.io/normal/ramp.jpg'};
  d.cards.push({...structuredClone(d.cards[1]),zone:'sideboard',qty:1});
  const w=workspace({savedDecks:JSON.stringify([d])});vm.runInContext("openDeck('editor')",w.context);
  const before=vm.runInContext('JSON.stringify(decks)',w.context),key=core.entryKey(d.cards[2]);
  assert.match(w.node('#app').innerHTML,/class="deck-hover-preview"/);assert.doesNotMatch(w.node('#app').innerHTML,/row-preview/);
  const row={dataset:{previewEntry:key}};
  w.node('#app').pointerover({pointerType:'touch',target:{closest:()=>row}});assert.equal(vm.runInContext('previewKey',w.context),'');
  w.node('#app').pointerover({pointerType:'mouse',target:{closest:()=>row}});
  assert.match(w.node('#deck-card-preview').innerHTML,/normal\/ramp.jpg/);assert.match(w.node('#deck-card-preview').innerHTML,/Ramp spell · Sideboard/);
  vm.runInContext('render()',w.context);assert.match(w.node('#app').innerHTML,/deck-entry visual-card is-previewed/);
  const leader={dataset:{previewEntry:core.entryKey(d.cards[0])}};
  w.node('#app').focusin({target:{closest:()=>leader}});assert.match(w.node('#deck-card-preview').innerHTML,/Artwork unavailable/);assert.match(w.node('#deck-card-preview').innerHTML,/Leader · Command zone/);
  w.node('#editor-search').input({target:{value:'Ramp'}});assert.equal(vm.runInContext('previewKey',w.context),'');
  assert.match(w.node('#editor-card-area').outerHTML,/Point to a card or focus its name/);
  vm.runInContext("previewEntry('missing')",w.context);assert.equal(vm.runInContext('previewKey',w.context),'');
  assert.equal(vm.runInContext('JSON.stringify(decks)',w.context),before);assert.equal(w.writes.length,0);
  vm.runInContext("editorOptions.search='';previewEntry(entryKey(decks[0].cards[1]));decks.push({...structuredClone(decks[0]),id:'restored'});active='restored';render()",w.context);
  assert.equal(vm.runInContext('previewKey',w.context),''); // Same card identity in a different deck must not inherit the old selection.
});


test('all four deck views share filters, grouping, quantities, printing and menus; horizontal visual stacks are the default', () => {
  const d=editorDeck();d.cards.push({...structuredClone(d.cards[1]),zone:'maybeboard',qty:3});
  const w=workspace({savedDecks:JSON.stringify([d])});vm.runInContext("openDeck('editor')",w.context);
  assert.equal(vm.runInContext('editorOptions.layout',w.context),'visual-horizontal');
  const before=vm.runInContext('JSON.stringify(decks)',w.context);
  for(const layout of ['visual-horizontal','visual-vertical','text-horizontal','text-vertical']){
    w.node('#editor-layout').change({target:{value:layout}});
    assert.match(w.node('#app').innerHTML,new RegExp('deck-zones '+layout));
    const headings=[...w.node('#app').innerHTML.matchAll(/<h3>(Command zone|Main deck|Sideboard|Maybeboard) ·/g)].map(m=>m[1]);
    assert.deepEqual(headings,['Command zone','Main deck','Maybeboard']);
    if(layout.startsWith('text'))assert.match(w.node('#app').innerHTML,/class="deck-card-name" title="Leader"/);
    else {
      assert.match(w.node('#app').innerHTML,/<span class="entry-quantity"[^>]*>\d+<\/span><div class="card-side-controls">[\s\S]*?<\/div><button class="card-art"/);
      assert.doesNotMatch(w.node('#app').innerHTML,/card-toolbar/);
    }
    assert.equal((w.node('#app').innerHTML.match(/class="card-slot"/g)||[]).length,layout.startsWith('visual')?3:0);
    assert.equal((w.node('#app').innerHTML.match(/data-card-menu=/g)||[]).length,3);
    const largeQuantity=vm.runInContext('deckEntry({...decks[0].cards[0],qty:500})',w.context);
    if(layout.startsWith('visual'))assert.match(largeQuantity,/class="entry-quantity three-digits" aria-label="500 copies">500<\/span>/);
    else assert.doesNotMatch(largeQuantity,/three-digits/);
    assert.match(w.node('#app').innerHTML,/Maybeboard · 3/);
    if(layout.startsWith('text'))assert.match(w.node('#app').innerHTML,/class="row-mana"/);
    else assert.match(w.node('#app').innerHTML,/class="entry-quantity"/);
    w.node('#editor-group').change({target:{value:'role'}});assert.match(w.node('#app').innerHTML,/<h4>Removal<\/h4>/);
    w.node('#editor-search').input({target:{value:'sorcery ramp'}});assert.doesNotMatch(w.node('#editor-card-area').outerHTML,/data-inspect="Leader"/);
    assert.match(w.node('#editor-card-area').outerHTML,/Maybeboard · 3 · 3 shown/);
    vm.runInContext("editorOptions.search='';editorOptions.group='none';render()",w.context);assert.doesNotMatch(w.node('#app').innerHTML,/<h4>/);
  }
  assert.equal(vm.runInContext('JSON.stringify(decks)',w.context),before);assert.equal(w.writes.length,0);
});

test('horizontal stack slots follow visible group entries without changing quantities or saved data', () => {
  const d=editorDeck();
  for(let i=0;i<20;i++)d.cards.push({card:{...structuredClone(d.cards[1].card),id:'stack-'+i,oracle_id:'stack-'+i,name:'Stack card '+i},qty:1,tags:[],zone:'main'});
  const w=workspace({savedDecks:JSON.stringify([d])});vm.runInContext("openDeck('editor');editorOptions.group='none';render()",w.context);
  const before=vm.runInContext('JSON.stringify(decks)',w.context);
  assert.equal((w.node('#app').innerHTML.match(/class="card-slot"/g)||[]).length,22);
  assert.match(w.node('#app').innerHTML,/--stack-divisor:19/);
  w.node('#editor-search').input({target:{value:'Stack card'}});
  assert.equal((w.node('#editor-card-area').outerHTML.match(/class="card-slot"/g)||[]).length,20);
  assert.match(w.node('#editor-card-area').outerHTML,/--stack-divisor:18/);
  w.node('#editor-search').input({target:{value:'Stack card 19'}});
  assert.equal((w.node('#editor-card-area').outerHTML.match(/class="card-slot"/g)||[]).length,1);
  assert.equal(vm.runInContext('JSON.stringify(decks)',w.context),before);assert.equal(w.writes.length,0);
});

test('optional viewing zones follow stored entries rather than filter matches in every layout and tracker', () => {
  const d=editorDeck();d.cards[1].commander=false;
  const w=workspace({savedDecks:JSON.stringify([d])});
  const before=vm.runInContext('JSON.stringify(decks)',w.context);
  for(const layout of ['visual-horizontal','visual-vertical','text-horizontal','text-vertical']){
    w.context.layout=layout;
    vm.runInContext("editorOptions.layout=layout;editorOptions.search='';",w.context);
    assert.doesNotMatch(vm.runInContext('deckList(decks[0],true)',w.context),/<h3>(Sideboard|Maybeboard) ·/);
    for(const zone of ['sideboard','maybeboard']){
      w.context.zone=zone;
      vm.runInContext("moveEntry(decks[0],entryKey(decks[0].cards[1]),zone)",w.context);
      const label=core.ZONES[zone];
      assert.match(vm.runInContext('deckList(decks[0],true)',w.context),new RegExp('<h3>'+label+' ·'));
      assert.match(vm.runInContext('deckList(decks[0])',w.context),new RegExp('<h3>'+label+' ·'));
      vm.runInContext("editorOptions.search='no-such-match'",w.context);
      const filtered=vm.runInContext('deckList(decks[0],true)',w.context);
      assert.match(filtered,new RegExp(label+' · 2 · 0 shown'));
      assert.match(filtered,/No cards match these filters/);
      vm.runInContext("moveEntry(decks[0],entryKey(decks[0].cards[1]),'main');editorOptions.search=''",w.context);
      assert.doesNotMatch(vm.runInContext('deckList(decks[0],true)',w.context),/<h3>(Sideboard|Maybeboard) ·/);
    }
  }
  assert.equal(vm.runInContext('JSON.stringify(decks)',w.context),before);
  assert.equal(w.writes.length,0);
  vm.runInContext("openDeck('editor');openCardActions(entryKey(decks[0].cards[1]),$('.card-menu-trigger'))",w.context);
  assert.match(w.node('#card-actions').innerHTML,/Sideboard/);
  assert.match(w.node('#card-actions').innerHTML,/Maybeboard/);
});

test('statistics tool board renders existing weighted playing-deck values and escapes personal roles', () => {
  const d=editorDeck();
  d.cards[1].tags=['<custom>'];
  d.cards.push({...structuredClone(d.cards[1]),zone:'sideboard',qty:50},{...structuredClone(d.cards[1]),zone:'maybeboard',qty:50});
  const w=workspace({savedDecks:JSON.stringify([d])}),s=core.stats(d);
  const html=vm.runInContext('statPanel(stats(decks[0]))',w.context);
  assert.match(html,/<section class="stat-tool"><h3>Mana curve<\/h3>/);
  assert.match(html,/<div class="stat-tools"><section class="stat-tool"><h3>Card types/);
  assert.match(html,new RegExp('Average mana value</span><b>'+s.average.toFixed(2).replace('.','\\.')));
  assert.match(html,/<span>&lt;custom&gt;<\/span><b>2<\/b>/);
  assert.match(html,new RegExp('aria-label="Mana curve: '+s.curve.map((n,i)=>`${i===7?'7\\+':i} mana: ${n}`).join(', ')+'"'));
  assert.equal(w.writes.length,0);
});

test('navigation height tracks wrapped header dimensions without touching deck storage', () => {
  const w=workspace();const sizes=[];
  w.document.documentElement.style={setProperty:(key,value)=>sizes.push([key,value])};
  w.node('.workspace-nav').getBoundingClientRect=()=>({height:124.5});
  vm.runInContext('updateNavigationHeight()',w.context);
  w.node('.workspace-nav').getBoundingClientRect=()=>({height:76});
  vm.runInContext('render()',w.context);
  assert.deepEqual(sizes,[['--nav-height','125px'],['--nav-height','76px']]);
  assert.equal(w.writes.length,0);
});

test('card action menu scopes moves and details to the chosen entry and supports keyboard dismissal', async () => {
  const w=workspace({savedDecks:JSON.stringify([editorDeck()])});vm.runInContext("openDeck('editor')",w.context);
  const key=core.entryKey(editorDeck().cards[1]);w.context.key=key;let returned=false;
  const trigger={isConnected:true,setAttribute(){},focus(){returned=true;},getBoundingClientRect(){return {right:500,bottom:600};}};w.context.trigger=trigger;
  vm.runInContext('openCardActions(key,trigger)',w.context);
  assert.match(w.node('#card-actions').innerHTML,/Move to Maybeboard/);assert.match(w.node('#card-actions').innerHTML,/Remove all copies · all zones/);
  w.node('#card-actions').keydown({key:'Escape',preventDefault(){}});assert.equal(returned,true);assert.equal(w.node('#card-actions').popoverOpen,false);
  vm.runInContext('openCardActions(key,trigger)',w.context);
  await w.node('#card-actions').click({target:{closest:()=>({dataset:{cardAction:'move:maybeboard'}})}});
  assert.equal(vm.runInContext('decks[0].cards[1].zone',w.context),'maybeboard');assert.equal(vm.runInContext('decks[0].cards[1].qty',w.context),2);
  assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(decks[0].cards[1].tags)',w.context)),['Removal','Ramp']);
  assert.match(w.node('#app').innerHTML,/Maybeboard · 2/);
});

test('card function creation is deck scoped, cross-deck copying requires a target, and all-zone removal can be cancelled', () => {
  const d=editorDeck(),other={...editorDeck(),id:'other',name:'Other',cards:[]};
  const w=workspace({savedDecks:JSON.stringify([d,other])});w.context.key=core.entryKey(d.cards[1]);
  vm.runInContext('assignFunctionDialog(decks[0],key)',w.context);formValues(w,{'function':'','new-function':'Graveyard setup'});w.node('#function-form').onsubmit({preventDefault(){}});
  assert.equal(vm.runInContext('decks[0].cards[1].tags[0]',w.context),'Graveyard setup');assert.equal(vm.runInContext('decks[1].cards.length',w.context),0);
  vm.runInContext('copyEntryDialog(decks[0],key)',w.context);formValues(w,{deck:'',quantity:'2',zone:'maybeboard'});w.node('#copy-entry-form').onsubmit({preventDefault(){}});assert.match(w.node('#copy-entry-error').textContent,/destination/);
  formValues(w,{deck:'other',quantity:'2',zone:'maybeboard'});w.node('#copy-entry-form').onsubmit({preventDefault(){}});
  assert.equal(vm.runInContext('decks[1].cards[0].zone',w.context),'maybeboard');assert.equal(vm.runInContext('decks[1].cards[0].tags[0]',w.context),'Graveyard setup');
  vm.runInContext('removeCopiesDialog(decks[0],key)',w.context);assert.match(w.node('#dialog').innerHTML,/across all zones, including Maybeboard/);
  w.node('#keep-copies').onclick();assert.equal(vm.runInContext('decks[0].cards[1].qty',w.context),2);
});

test('Maybeboard-only decks do not request legality and Maybeboard failures cannot poison active-deck refresh', async () => {
  const d=editorDeck();d.cards=d.cards.map(e=>({...e,zone:'maybeboard'}));
  const w=workspace({savedDecks:JSON.stringify([d])});assert.equal(w.timers.length,0);
  const active=editorDeck();active.cards.push({...structuredClone(active.cards[1]),zone:'maybeboard',card:{...structuredClone(active.cards[1].card),id:'maybe',oracle_id:'maybe',name:'Maybe missing'}});
  const v=workspace({savedDecks:JSON.stringify([active])});let requested=[];
  v.context.fetch=async(url,options)=>{requested=JSON.parse(options.body).ids;return {ok:true,json:async()=>({data:active.cards.filter(e=>e.zone!=='maybeboard').map(e=>e.card),not_found:[]})};};
  await vm.runInContext('refresh()',v.context);assert.deepEqual(requested,['Leader','Ramp spell']);assert.equal(vm.runInContext("legalityStates.get('editor').status",v.context),'fresh');
});


test('exploration destination chooser adds directly to Maybeboard without changing tracking or playing totals', () => {
  const w=workspace({savedDecks:JSON.stringify([editorDeck()]),savedTracker:JSON.stringify({id:''})});w.context.card=editorCard('Bench idea');
  vm.runInContext("results=[card];chooseDestination(card.id)",w.context);assert.match(w.node('#dialog').innerHTML,/id="add-zone"/);assert.match(w.node('#dialog').innerHTML,/Maybeboard/);
  w.node('#add-destination').value='editor';w.node('#add-zone').value='maybeboard';w.node('#add-destination-form').onsubmit({preventDefault(){}});
  assert.equal(vm.runInContext('decks[0].cards.at(-1).zone',w.context),'maybeboard');assert.equal(vm.runInContext('tracker.id',w.context),'');assert.equal(vm.runInContext('stats(decks[0]).total',w.context),3);
  assert.doesNotThrow(()=>core.validateBackup(JSON.parse(vm.runInContext('JSON.stringify(decks)',w.context))));
});

test('card-name copying uses only the selected card name, without editing deck data', async () => {
  const w=workspace({savedDecks:JSON.stringify([editorDeck()])});vm.runInContext("openDeck('editor')",w.context);let copied='';
  w.context.navigator={clipboard:{writeText:async text=>{copied=text;}}};w.node('#card-actions').dataset={deck:'editor',entry:core.entryKey(editorDeck().cards[1])};
  await w.node('#card-actions').click({target:{closest:()=>({dataset:{cardAction:'copy-name'}})}});
  assert.equal(copied,'Ramp spell');assert.equal(w.writes.length,0);
});


test('editing an import invalidates review and in-flight lookup; ambiguity never applies a partial list',async()=>{
  const w=workspace({savedDecks:JSON.stringify([editorDeck()])}), values={list:'Mainboard\n2 Ramp spell'};
  formValues(w,values);vm.runInContext('importDialog(decks[0])',w.context);
  const form=w.node('#import-form'),before=vm.runInContext('JSON.stringify(decks)',w.context);
  let release;w.context.fetch=()=>new Promise(r=>release=r);
  const task=form.onsubmit({preventDefault(){}});values.list='Mainboard\n3 Ramp spell';form.oninput();
  release({ok:true,json:async()=>({data:[editorCard('Ramp spell','Sorcery')]})});await task;
  assert.match(w.node('#import-error').textContent,/changed during lookup/);
  w.context.fetch=async()=>({ok:true,json:async()=>({data:[editorCard('Ramp spell','Sorcery')]})});
  await form.onsubmit({preventDefault(){}});assert.match(w.node('#import-preview').innerHTML,/3 Ramp spell/);
  values.list='Mainboard\n4 Ramp spell';form.oninput();assert.equal(w.node('#import-preview').innerHTML,'');
  await form.onsubmit({preventDefault(){}});assert.match(w.node('#import-preview').innerHTML,/4 Ramp spell/);
  assert.equal(vm.runInContext('JSON.stringify(decks)',w.context),before);
});


async function chooseWorkspaceFile(w,data,{size=100}={}){
  const input=w.node('#backup-file');
  await input.onchange({target:{files:[{size,text:async()=>JSON.stringify(data)}]}});
}
test('portable open stages independent copies and failed writes preserve the complete live workspace',async()=>{
  const original=editorDeck(),w=workspace({savedDecks:JSON.stringify([original])});
  vm.runInContext('restore()',w.context);
  await chooseWorkspaceFile(w,core.workspaceFile([original]));
  assert.equal(vm.runInContext('decks.length',w.context),1);assert.equal(w.writes.length,0);
  assert.match(w.node('#restore-preview').innerHTML,/independent deck copy/);
  const before=vm.runInContext('JSON.stringify(decks)',w.context);
  const persist=w.context.localStorage.setItem;w.context.localStorage.setItem=()=>{throw Error('Quota exceeded');};
  w.node('#restore-apply').onclick();
  assert.equal(vm.runInContext('JSON.stringify(decks)',w.context),before);assert.match(w.node('#restore-error').textContent,/Nothing added/);
  assert.equal(w.node('#restore-recovery').hidden,false);
  w.context.localStorage.setItem=persist;w.node('#restore-apply').onclick();
  assert.equal(vm.runInContext('decks.length',w.context),2);
  assert.notEqual(vm.runInContext('decks[0].id',w.context),vm.runInContext('decks[1].id',w.context));
  assert.equal(vm.runInContext('JSON.stringify(decks[0].cards)===JSON.stringify(decks[1].cards)',w.context),true);
  assert.equal(w.writes.filter(([key])=>key==='arcana.decks.v1').length,1);
  w.node('#restore-apply').onclick();assert.equal(vm.runInContext('decks.length',w.context),2);
});
test('portable open rejects unsupported files, limits and stale selection without writes',async()=>{
  const w=workspace({savedDecks:JSON.stringify([editorDeck()])});vm.runInContext('restore()',w.context);
  const before=vm.runInContext('JSON.stringify(decks)',w.context);
  await chooseWorkspaceFile(w,{...core.workspaceFile([editorDeck()]),version:9});assert.match(w.node('#restore-error').textContent,/Unsupported/);
  await chooseWorkspaceFile(w,[editorDeck()],{size:15_000_001});assert.match(w.node('#restore-error').textContent,/too large/);
  let release;const input=w.node('#backup-file');
  const pending=input.onchange({target:{files:[{size:10,text:()=>new Promise(r=>release=r)}]}});
  await input.onchange({target:{files:[]}});release(JSON.stringify([editorDeck()]));await pending;
  assert.equal(w.node('#restore-apply').disabled,true);
  input.isConnected=false;await chooseWorkspaceFile(w,[editorDeck()]);
  assert.equal(vm.runInContext('JSON.stringify(decks)',w.context),before);assert.equal(w.writes.length,0);
});
test('portable download writes a versioned complete file and reports initiation failures',()=>{
  const w=workspace({savedDecks:JSON.stringify([editorDeck()])});let content;
  w.context.Blob=class{constructor(parts){content=parts[0];this.size=content.length;}};
  w.context.URL={createObjectURL:()=> 'blob:test',revokeObjectURL(){}};
  w.document.createElement=()=>({click(){}});
  assert.equal(vm.runInContext('saveWorkspaceCopy()',w.context),true);
  assert.deepEqual(core.readWorkspaceFile(JSON.parse(content)),[editorDeck()]);
  assert.match(w.node('#toast').textContent,/download requested/);
  w.document.createElement=()=>({click(){throw Error('Download blocked');}});
  assert.equal(vm.runInContext('saveWorkspaceCopy()',w.context),false);assert.match(w.node('#toast').textContent,/Could not request/);
});


test('file status tracks full-workspace requests without confusing them with browser saves or per-deck exports',()=>{
  const w=workspace({savedDecks:JSON.stringify([editorDeck()])});
  w.context.Blob=class{constructor(parts){this.size=parts[0].length;}};
  vm.runInContext('download=()=>{};settings()',w.context);
  assert.match(w.node('#backup-status').textContent,/No workspace file requested/);
  vm.runInContext('saveWorkspaceCopy()',w.context);assert.match(w.node('#backup-status').textContent,/No further workspace changes/);
  vm.runInContext("decks[0].name='Edited';save()",w.context);assert.match(w.node('#backup-status').textContent,/Workspace changed/);
  vm.runInContext('saveWorkspaceCopy([decks[0]])',w.context);assert.match(w.node('#backup-status').textContent,/Workspace changed/);
  vm.runInContext('saveWorkspaceCopy()',w.context);assert.match(w.node('#backup-status').textContent,/No further workspace changes/);
  vm.runInContext("decks[0].name='Edited again';download=()=>{throw Error('Cancelled or blocked')};saveWorkspaceCopy()",w.context);
  assert.match(w.node('#backup-status').textContent,/Workspace changed/);assert.match(w.node('#backup-download-error').textContent,/Could not request/);
  assert.match(w.node('#app').innerHTML,/Saved in this browser/);
});
test('failed browser saving retains in-memory edits and permits a portable recovery request',()=>{
  const w=workspace({savedDecks:JSON.stringify([editorDeck()])});
  w.context.Blob=class{constructor(parts){this.size=parts[0].length;}};
  w.context.localStorage.setItem=()=>{throw Error('Storage full');};
  vm.runInContext("download=()=>{};decks[0].name='Recover me';save();render();settings()",w.context);
  assert.match(w.node('#app').innerHTML,/Unsaved changes/);
  assert.equal(vm.runInContext('saveWorkspaceCopy()',w.context),true);
  assert.match(w.node('#backup-status').textContent,/No further workspace changes/);
  assert.equal(vm.runInContext('decks[0].name',w.context),'Recover me');
  assert.match(vm.runInContext('storageError',w.context),/full or unavailable/);
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
