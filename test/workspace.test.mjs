import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
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
    setTimeout: () => 1, clearTimeout() {}, URLSearchParams, structuredClone,
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
  vm.runInContext("filters.oracle = 'draw a card'; filters.tags = ['ramp']; render()", w.context);
  const html = w.node('#app').innerHTML;
  assert.match(html, /id="search-filters"[^>]*\bopen\b/);
  assert.match(html, /id="function-tags"[^>]*\bopen\b/);
  assert.match(html, /name="oracle" value="draw a card"/);
  assert.match(html, /aria-label="Remove ramp filter"/);
  assert.doesNotMatch(html, /data-action="backup"|data-action="restore"/);
});

test('tag discovery renders aliases, verified relationships, limits and custom tag guidance', () => {
  const w = workspace();
  vm.runInContext("tagSearch = 'blink'; browsedTag = 'flicker'; filters.tags = ['unknown-arcana-tag']; render()", w.context);
  const html = w.node('#app').innerHTML;
  assert.match(html, /Add flicker filter/);
  assert.match(html, /Aliases: blink/);
  assert.match(html, /Broader tags/);
  assert.match(html, /Narrower tags/);
  assert.match(html, /data-browse-tag="flicker-creature"/);
  assert.match(html, /outside this snapshot/);
  assert.match(html, /Snapshot \d{4}-\d{2}-\d{2}/);
  assert.match(html, /Match all requires every tag/);
  assert.match(html, /otag:unknown-arcana-tag/);
  vm.runInContext("tagSearch = 'unknown-arcana-tag'; render()", w.context);
  assert.match(w.node('#app').innerHTML, /No matching name or alias/);
  vm.runInContext("tagSearch = ''; allTags = true; render()", w.context);
  assert.match(w.node('#app').innerHTML, /showing 30/);
  assert.match(w.node('#app').innerHTML, /Show more tags/);
});

test('upstream no-match responses explain recovery and possible unsupported custom tags', async () => {
  const w = workspace();
  w.context.fetch = async () => ({ ok: false, json: async () => ({ error: 'Your query didn’t match any cards. Adjust your search terms.' }) });
  await vm.runInContext("filters.tags = ['unknown-arcana-tag']; search()", w.context);
  assert.match(w.node('#app').innerHTML, /No cards matched these filters/);
  assert.match(w.node('#app').innerHTML, /custom tag may be unsupported/);
  assert.match(w.node('#app').innerHTML, /switch to Match any/);
  assert.match(w.node('#app').innerHTML, /otag:unknown-arcana-tag/);
});

test('comparison retains result provenance across unsent edits and subsequent searches', async () => {
  const w = workspace();
  const card = name => ({id:name,oracle_id:name,name,type_line:'Instant',cmc:2,mana_cost:'{1}{U}',colors:['U'],color_identity:['U'],oracle_text:'Draw a card.'});
  w.context.fetch = async () => ({ok:true,json:async()=>({data:[card('First')],total_cards:1,has_more:false})});
  await vm.runInContext("filters.tags=['draw']; filters.mv='2'; search();",w.context);
  vm.runInContext("filters.tags=['removal']; toggleComparison('First');",w.context);
  let html=w.node('#app').innerHTML;
  assert.match(html,/Searched for all: draw/);
  assert.match(html,/mv&lt;=2 \(otag:draw\)/);
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
  vm.runInContext("filters.raw='usd<5'; filters.tags=['ramp']; filters.mv='3'; filters.type='creature';",w.context);
  await vm.runInContext("broaden('mv')",w.context);
  let html=w.node('#app').innerHTML;
  assert.match(html,/Ignored Mana value: &lt;=3/);
  assert.match(html,/Original query: <code>usd&lt;5 t:creature mv&lt;=3 \(otag:ramp\)/);
  assert.match(html,/Return to original search/);
  await vm.runInContext("broaden('type')",w.context);
  assert.equal(vm.runInContext('filters.mv',w.context),'3');
  assert.equal(vm.runInContext('filters.type',w.context),'');
  await vm.runInContext('restoreSearch()',w.context);
  assert.equal(vm.runInContext('filters.type',w.context),'creature');
  assert.equal(vm.runInContext('filters.mv',w.context),'3');
  assert.equal(vm.runInContext('broadening',w.context),null);
  assert.ok(decodeURIComponent(queries[0]).includes('t:creature'));
  assert.ok(decodeURIComponent(queries[1]).includes('mv<=3'));
  assert.equal(w.writes.length,0);
});

test('stale alternative responses cannot overwrite restored results or their comparison context',async()=>{
  const w=workspace();let finish;
  w.context.fetch=()=>new Promise(resolve=>{finish=resolve;});
  const stale=vm.runInContext("filters.tags=['ramp']; search()",w.context);
  w.context.fetch=async()=>({ok:true,json:async()=>({data:[],total_cards:0,has_more:false})});
  await vm.runInContext("filters.tags=['draw']; search()",w.context);
  finish({ok:true,json:async()=>({data:[],total_cards:99,has_more:true})});
  await stale;
  assert.equal(vm.runInContext('total',w.context),0);
  assert.equal(vm.runInContext('resultContext.query',w.context),'(otag:draw)');
});

test('pagination uses the completed result query rather than unsent filter edits',async()=>{
  const w=workspace(), queries=[];
  w.context.fetch=async url=>{queries.push(String(url));return {ok:true,json:async()=>({data:[],total_cards:300,has_more:true})};};
  await vm.runInContext("filters.tags=['ramp']; search()",w.context);
  await vm.runInContext("filters.tags=['draw']; search(true)",w.context);
  assert.equal(new URLSearchParams(queries[1].split('?')[1]).get('q'),'(otag:ramp)');
  assert.equal(new URLSearchParams(queries[1].split('?')[1]).get('page'),'2');
});

test('applying unsent changes while sorting clears an obsolete relaxation explanation',async()=>{
  const w=workspace();
  w.context.FormData=class {get(key){return vm.runInContext(`filters[${JSON.stringify(key)}]`,w.context);}};
  w.context.fetch=async()=>({ok:true,json:async()=>({data:[],total_cards:0,has_more:false})});
  await vm.runInContext("filters.tags=['ramp']; filters.mv='3'; broaden('mv')",w.context);
  assert.ok(vm.runInContext('broadening',w.context));
  await vm.runInContext("filters.raw='usd<5'; search(false,true)",w.context);
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
