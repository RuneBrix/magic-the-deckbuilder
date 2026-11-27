import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import * as core from '../public/core.js';
import { workspace, editorCard, editorDeck, formValues, chooseWorkspaceFile, startCardDrag, dropCard } from '../test-support/workspace.mjs';

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
  assert.doesNotMatch(w.node('#app').innerHTML,/Data unavailable/);
  assert.doesNotMatch(w.node('#app').innerHTML,/Manual review ·|coverage is partial/);
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

test('only removing the last command-zone copy asks first and confirms for that entry alone',async()=>{
  const d=editorDeck(),leader=d.cards[0];leader.qty=2;
  d.cards.push({...leader,zone:'main'}, {card:editorCard('Partner'),qty:1,tags:[],zone:'command'});
  const w=workspace({savedDecks:JSON.stringify([d]),initialView:null});
  vm.runInContext("openDeck('editor')",w.context);
  const dialog=w.node('#commander-removal');let openCount=0;
  dialog.showModal=()=>{openCount++;};
  const clickMinus=()=>w.node('#app').click({target:{closest:()=>({dataset:{zoneMinus:core.entryKey(leader)}})}});
  await clickMinus();
  assert.equal(vm.runInContext('decks[0].cards[0].qty',w.context),1);
  assert.equal(openCount,0);
  const writes=w.writes.length;
  await clickMinus();
  assert.equal(openCount,1);
  assert.match(w.node('#commander-removal-title').textContent,/Remove Leader/);
  assert.equal(w.writes.length,writes);
  w.node('#confirm-commander-removal').onclick();
  assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(decks[0].cards)',w.context)),d.cards.slice(1));
});

test('the full deck editor retains its tab and query through page navigation',async()=>{
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
  await click({tab:'checks'});assert.match(w.node('#app').innerHTML,/Deck legality checks/);
  await click({tab:'stats'});assert.match(w.node('#app').innerHTML,/Mana curve/);
  await click({view:'collection'});
  await click({view:'decks'});
  assert.equal(vm.runInContext('view',w.context),'deck');
  assert.equal(vm.runInContext('deckTab',w.context),'stats');
  assert.equal(vm.runInContext('filters.query',w.context),'draw');
  assert.equal(vm.runInContext('tracker.id',w.context),'editor');
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
    w.node('#dialog').open=true;
    const input=w.node('#commander-name');
    input.removeAttribute=()=>{};
    w.document.activeElement=input;
    let searched;
    w.context.fetch=async url=>{
      searched=new URL(url,'http://localhost').searchParams.get('q');
      return {ok:true,json:async()=>({data:[editorCard('Leader','Legendary Creature')]})};
    };
    vm.runInContext('deckForm()',w.context);
    input.value='Lead';
    input.oninput({});
    assert.equal(searched,undefined);
    assert.equal(w.timers.at(-1).ms,250);
    await w.timers.at(-1).fn();
    assert.equal(searched,'game:paper is:commander f:commander name:/Lead/');
    w.node('#commander-matches').onclick({target:{closest:()=>({dataset:{commanderOption:'0'}})}});
    assert.equal(input.value,'Leader');
    assert.equal(vm.runInContext('decks.length',w.context),0);
    if(format==='modern')w.node('#deck-format').onchange({target:{value:format}});
    w.node('#deck-form').onsubmit({preventDefault(){},target:{}});
    assert.equal(vm.runInContext('view',w.context),'deck');
    assert.equal(vm.runInContext('decks[0].cards.length',w.context),format==='commander'?1:0);
    if(format==='commander')assert.equal(vm.runInContext('decks[0].cards[0].zone',w.context),'command');
  }
  const w=workspace();formValues(w,{name:'Incomplete',format:'commander'});vm.runInContext('deckForm()',w.context);
  w.node('#deck-form').onsubmit({preventDefault(){},target:{}});assert.equal(vm.runInContext('decks[0].cards.length',w.context),0);
});

test('commander autocomplete ignores results from an earlier query',async()=>{
  const w=workspace();
  w.node('#dialog').open=true;
  const input=w.node('#commander-name');
  input.removeAttribute=()=>{};
  w.document.activeElement=input;
  let resolveEarlier;
  const earlier=new Promise(resolve=>{resolveEarlier=resolve;});
  const response=name=>({ok:true,json:async()=>({data:[editorCard(name)]})});
  w.context.fetch=async url=>url.includes('Earlier')?earlier:response('Latest result');
  vm.runInContext('deckForm()',w.context);
  input.value='Earlier';
  input.oninput({});
  const pending=w.timers.at(-1).fn();
  input.value='Latest';
  input.oninput({});
  await w.timers.at(-1).fn();
  resolveEarlier(response('Earlier result'));
  await pending;
  assert.match(w.node('#commander-matches').innerHTML,/Latest result/);
  assert.doesNotMatch(w.node('#commander-matches').innerHTML,/Earlier result/);
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
    assert.equal(w.timers.length,savedDecks?1:0);
    const reload=workspace({savedDecks,initialView:null});
    assert.equal(vm.runInContext('view',reload.context),'decks');
  }
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
  assert.match(html,/not a power rating or bracket certification/);assert.match(html,/About bracket data/);
  assert.equal(vm.runInContext('JSON.stringify(decks)',w.context),before);assert.equal(w.writes.length,0);
});

test('deck controls compose live text filtering, grouping and sorting without replacing the input or writing deck data', async () => {
  const w=workspace({savedDecks:JSON.stringify([editorDeck()])});vm.runInContext("openDeck('editor')",w.context);
  const shell=w.node('#app').innerHTML,field=w.node('#editor-search'),before=vm.runInContext('JSON.stringify(decks)',w.context);
  assert.match(shell,/Group by/);assert.match(shell,/>Type<\/option>/);assert.match(shell,/>Function<\/option>/);
  assert.match(shell,/Sort by/);assert.match(shell,/Price € \(high first\)/);assert.match(shell,/Power \(low first\)/);assert.match(shell,/Toughness \(high first\)/);
  assert.doesNotMatch(shell,/Order by|editor-type|editor-role|role-help/);
  field.input({target:{value:'SORCERY ramp'}});
  assert.equal(w.node('#app').innerHTML,shell);assert.equal(w.node('#editor-search'),field);
  assert.match(w.node('#editor-card-area').outerHTML,/Ramp spell/);assert.doesNotMatch(w.node('#editor-card-area').outerHTML,/data-inspect="Leader"/);
  w.node('#editor-group').change({target:{value:'role'}});w.node('#editor-order').change({target:{value:'price-desc'}});
  assert.match(w.node('#app').innerHTML,/Removal <span class="deck-group-count">· 2 shown<\/span>/);
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

test('all four deck views share filters, grouping, quantities, printing and menus; horizontal visual cards are the default', () => {
  const d=editorDeck();d.cards.push({...structuredClone(d.cards[1]),zone:'maybeboard',qty:3});
  const w=workspace({savedDecks:JSON.stringify([d])});vm.runInContext("openDeck('editor')",w.context);
  assert.equal(vm.runInContext('editorOptions.layout',w.context),'visual-horizontal');
  const before=vm.runInContext('JSON.stringify(decks)',w.context);
  for(const layout of ['visual-horizontal','visual-vertical','text-horizontal','text-vertical']){
    w.node('#editor-layout').change({target:{value:layout}});
    assert.match(w.node('#app').innerHTML,new RegExp('deck-zones '+layout));
    const zones=[...w.node('#app').innerHTML.matchAll(/data-toggle-deck-zone="([^"]+)"/g)].map(m=>m[1]);
    assert.deepEqual(zones,['command','main','maybeboard']);
    if(layout.startsWith('text'))assert.match(w.node('#app').innerHTML,/class="deck-card-name" aria-label="Leader" title="Leader · Unknown set/);
    else {
      assert.match(w.node('#app').innerHTML,/<span class="entry-quantity"[^>]*>\d+<\/span><div class="card-side-controls">[\s\S]*?<\/div><button class="card-art"/);
      assert.doesNotMatch(w.node('#app').innerHTML,/card-toolbar/);
    }
    assert.equal((w.node('#app').innerHTML.match(/class="card-slot"/g)||[]).length,layout.startsWith('visual')?3:0);
    assert.equal((w.node('#app').innerHTML.match(/data-card-menu=/g)||[]).length,3);
    const largeQuantity=vm.runInContext('deckEntry({...decks[0].cards[0],qty:500})',w.context);
    assert.match(largeQuantity,/class="entry-quantity"[^>]*aria-label="500 copies">500<\/span>/);
    assert.match(w.node('#app').innerHTML,/Maybeboard · 3/);
    if(layout.startsWith('text'))assert.match(w.node('#app').innerHTML,/class="row-mana"/);
    else assert.match(w.node('#app').innerHTML,/class="entry-quantity"/);
    w.node('#editor-group').change({target:{value:'role'}});assert.match(w.node('#app').innerHTML,/Removal <span class="deck-group-count">· 2 cards<\/span>/);
    w.node('#editor-search').input({target:{value:'sorcery ramp'}});assert.doesNotMatch(w.node('#editor-card-area').outerHTML,/data-inspect="Leader"/);
    assert.match(w.node('#editor-card-area').outerHTML,/Maybeboard · 3 · 3 shown/);
    vm.runInContext("editorOptions.search='';editorOptions.group='none';render()",w.context);assert.doesNotMatch(w.node('#app').innerHTML,/<h4>/);
  }
  assert.equal(vm.runInContext('JSON.stringify(decks)',w.context),before);assert.equal(w.writes.length,0);
});

test('fixed visual card slots follow visible group entries without changing quantities or saved data', () => {
  const d=editorDeck();
  for(let i=0;i<20;i++)d.cards.push({card:{...structuredClone(d.cards[1].card),id:'stack-'+i,oracle_id:'stack-'+i,name:'Stack card '+i},qty:1,tags:[],zone:'main'});
  const w=workspace({savedDecks:JSON.stringify([d])});vm.runInContext("openDeck('editor');editorOptions.group='none';render()",w.context);
  const before=vm.runInContext('JSON.stringify(decks)',w.context);
  assert.equal((w.node('#app').innerHTML.match(/class="card-slot"/g)||[]).length,22);
  w.node('#editor-search').input({target:{value:'Stack card'}});
  assert.equal((w.node('#editor-card-area').outerHTML.match(/class="card-slot"/g)||[]).length,20);
  w.node('#editor-search').input({target:{value:'Stack card 19'}});
  assert.equal((w.node('#editor-card-area').outerHTML.match(/class="card-slot"/g)||[]).length,1);
  assert.equal(vm.runInContext('JSON.stringify(decks)',w.context),before);assert.equal(w.writes.length,0);
});

test('group headings sort A–Z per zone while cards keep their selected order', () => {
  const d = editorDeck();
  const cards = [
    [editorCard('A field', 'Land'), 'lands'],
    [editorCard('B field', 'Artifact Land'), 'Mana base'],
    [editorCard('C field // C shelter', 'Land // Creature'), 'Land'],
    [editorCard('D scout // D field', 'Creature // Land'), 'Draw'],
    [editorCard('E spell', 'Instant'), 'Lands matter'],
    [editorCard('F scout', 'Creature'), 'Draw'],
  ];
  for (const [index, [card, role]] of cards.entries()) {
    Object.assign(card, { cmc:index, power:String(index), toughness:String(index), prices:{usd:String(index)} });
    d.cards.push({ card, qty:index + 1, zone:'main', tags:[role] });
  }
  d.cards.push({ card:cards[0][0], qty:1, zone:'sideboard', tags:['lands'] });
  d.currency = 'USD';
  const w = workspace({savedDecks:JSON.stringify([d])});
  const check = (group, order, search = '') => {
    const entries = core.deckEntries(d, {order, search}).filter(entry => entry.zone === 'main');
    const nameFor = entry => group === 'role' ? core.primaryRole(entry) : core.category(entry.card);
    const groups = group === 'none' ? [] : [...new Set(entries.map(nameFor))].sort((a,b) => a.localeCompare(b,'en'));
    const html = vm.runInContext(`editorOptions=${JSON.stringify({layout:'text-horizontal', group, order, search})};deckList(decks[0],true)`,w.context);
    const main = html.split('data-drop-zone="main"><h3>')[1].split('data-drop-zone="sideboard"><h3>')[0];
    const names = markup => [...markup.matchAll(/class="deck-group-name">([^<]+) <span/g)].map(match => match[1]);
    assert.deepEqual(names(main), groups);
    const ordered = groups.length ? groups.flatMap(name => entries.filter(entry => nameFor(entry) === name)) : entries;
    assert.deepEqual([...main.matchAll(/data-inspect="([^"]+)"/g)].map(match => match[1]), ordered.map(entry => entry.card.id));
    assert.doesNotMatch(html.split('data-drop-zone="main"><h3>')[0], /data-deck-group/);
    if (!search) assert.deepEqual(names(html.split('data-drop-zone="sideboard"><h3>')[1]), group === 'none' ? [] : [group === 'role' ? 'lands' : 'Land']);
  };
  for (const order of ['name','mana','quantity','price','price-desc','power','power-desc','toughness','toughness-desc']) {
    for (const group of ['type','role','none']) check(group, order);
  }
  check('type', 'name', 'Land');
  check('role', 'name', 'scout');
  assert.equal(w.writes.length,0);
});

test('deck prices and preview follow visible quantities, primary functions and stored printing finishes', async () => {
  const d = editorDeck();
  d.currency='USD';
  const ramp = d.cards[1];
  ramp.card.set = 'one';
  ramp.card.prices = { usd: '1.10', usd_foil: '10.00', eur: '5.00' };
  ramp.card.finishes = ['nonfoil', 'foil'];
  d.cards.push({ card: editorCard('Other spell', 'Sorcery'), qty: 3, zone: 'main', tags: ['Removal'] });
  const key = core.entryKey(ramp);
  const w = workspace({ savedDecks: JSON.stringify([d]) });
  vm.runInContext("openDeck('editor')", w.context);
  const html = () => w.node('#app').innerHTML;
  assert.match(html(), /Sorcery <span class="deck-group-count">· 5 cards<\/span>/);
  assert.match(html(), /<p class="deck-group-price">\$2\.20 · 3 copies unpriced/);
  assert.match(html(), /Main deck · 5<span[^>]+> · \$2\.20 · 3 copies unpriced/);
  assert.match(html(), /class="stack-card-meta"[^>]*>\$1\.10<\/div>/);
  assert.match(html(), /class="stack-card-meta"[^>]*>Price unavailable<\/div>/);

  w.node('#editor-search').input({ target: { value: 'Ramp' } });
  assert.match(w.node('#editor-card-area').outerHTML, /Main deck · 5 · 2 shown<span[^>]+> · \$2\.20 for shown cards/);
  assert.match(w.node('#editor-card-area').outerHTML, /Sorcery <span class="deck-group-count">· 2 shown/);
  w.node('#app').focusin({ target: { closest: () => ({ dataset: { previewEntry: key } }) } });
  assert.match(w.node('#deck-card-preview').innerHTML, /Removal<\/span><span>\$1\.10<\/span>/);
  await w.node('#app').click({ target: { closest: () => ({ dataset: { zonePlus: key } }) } });
  assert.match(html(), /\$3\.30 for shown cards/);

  w.context.replacement = { ...ramp.card, id: 'foil-version', set: 'two', finishes: ['foil'], prices: { usd: '99.00', usd_foil: '0.75' } };
  vm.runInContext(`setEntryPrinting(current(), ${JSON.stringify(key)}, replacement);render()`, w.context);
  assert.match(html(), /\$2\.25 for shown cards/);
  assert.match(html(), /class="stack-card-meta"[^>]*>\$0\.75<\/div>/);
  assert.match(html(), /data-finish="foil"/);
  assert.deepEqual(core.deckPrintingPrice({ finishes: ['etched'], prices: { usd_etched: '0.00' } }), { finish: 'etched', field:'usd_etched', cents: 0 });
  assert.equal(core.deckPrintingPrice({ finishes: ['foil'], prices: { usd: '5.00' } }).cents, null);
  assert.equal(core.deckPrintingPrice({ finishes: ['foil', 'etched'], prices: { usd_foil: '5.00' } }).cents, null);
});

test('optional viewing zones follow stored entries rather than filter matches in every layout and tracker', () => {
  const d=editorDeck();d.cards[1].commander=false;
  const w=workspace({savedDecks:JSON.stringify([d])});
  const before=vm.runInContext('JSON.stringify(decks)',w.context);
  for(const layout of ['visual-horizontal','visual-vertical','text-horizontal','text-vertical']){
    w.context.layout=layout;
    vm.runInContext("editorOptions.layout=layout;editorOptions.search='';",w.context);
    assert.doesNotMatch(vm.runInContext('deckList(decks[0],true)',w.context),/data-toggle-deck-zone="(sideboard|maybeboard)"/);
    for(const zone of ['sideboard','maybeboard']){
      w.context.zone=zone;
      vm.runInContext("moveEntry(decks[0],entryKey(decks[0].cards[1]),zone)",w.context);
      const label=core.ZONES[zone];
      assert.match(vm.runInContext('deckList(decks[0],true)',w.context),new RegExp('data-toggle-deck-zone="'+zone+'"'));
      assert.match(vm.runInContext('deckList(decks[0])',w.context),new RegExp('<h3>'+label+' ·'));
      vm.runInContext("editorOptions.search='no-such-match'",w.context);
      const filtered=vm.runInContext('deckList(decks[0],true)',w.context);
      assert.match(filtered,new RegExp(label+' · 2 · 0 shown'));
      assert.match(filtered,/No cards match these filters/);
      vm.runInContext("moveEntry(decks[0],entryKey(decks[0].cards[1]),'main');editorOptions.search=''",w.context);
      assert.doesNotMatch(vm.runInContext('deckList(decks[0],true)',w.context),/data-toggle-deck-zone="(sideboard|maybeboard)"/);
    }
  }
  assert.equal(vm.runInContext('JSON.stringify(decks)',w.context),before);
  assert.equal(w.writes.length,0);
  vm.runInContext("openDeck('editor');openCardActions(entryKey(decks[0].cards[1]),$('.card-menu-trigger'))",w.context);
  vm.runInContext("showCardSubmenu('move')",w.context);
  assert.match(w.node('#card-submenu').innerHTML,/Sideboard/);
  assert.match(w.node('#card-submenu').innerHTML,/Maybeboard/);
});

test('mana symbols retain accessible colors and distinguish colorless, generic and compound costs', () => {
  const w=workspace({savedDecks:JSON.stringify([editorDeck()])});
  const html=vm.runInContext("mana('{W}{U}{B}{R}{G}{C}{2}{X}{U/B}{G/P}{<bad>}')",w.context);
  for(const color of ['White','Blue','Black','Red','Green','Colorless'])assert.match(html,new RegExp('role="img" aria-label="'+color+'"'));
  assert.equal((html.match(/mana-symbol/g)||[]).length,6);
  for(const symbol of ['2','X','U/B','G/P'])assert.match(html,new RegExp('aria-label="'+symbol+'"'));
  assert.match(html,/aria-label="&lt;bad&gt;"/);
  assert.doesNotMatch(html,/<bad>/);
  const statsHtml=vm.runInContext('statPanel(stats(decks[0], { detailed: true }), decks[0])',w.context);
  for(const color of ['White','Blue','Black','Red','Green','Colorless'])assert.match(statsHtml,new RegExp('aria-label="'+color+'"'));
  assert.match(vm.runInContext('guidedControls()',w.context),/mana-symbol/);
  assert.equal(w.writes.length,0);
});

test('statistics tool board renders existing weighted playing-deck values and escapes personal roles', () => {
  const d=editorDeck();
  d.cards[1].tags=['<custom>'];
  d.cards.push({...structuredClone(d.cards[1]),zone:'sideboard',qty:50},{...structuredClone(d.cards[1]),zone:'maybeboard',qty:50});
  const w=workspace({savedDecks:JSON.stringify([d])}),s=core.stats(d);
  const html=vm.runInContext('statPanel(stats(decks[0], { detailed: true }), decks[0])',w.context);
  assert.match(html,/<section class="stat-tool"><h3>Mana curve<\/h3>/);
  assert.match(html,/<div class="stat-tools">\s*<section class="stat-tool"><h3>Card types/);
  assert.match(html,new RegExp('Average mana value</span><b>'+s.average.toFixed(2).replace('.','\\.')));
  assert.match(html,/<span>&lt;custom&gt;<\/span><b>2<\/b>/);
  assert.match(html,new RegExp('aria-label="Mana curve: '+s.curve.map((n,i)=>`${i===7?'7\\+':i} mana: ${n}`).join(', ')+'"'));
  assert.equal(w.writes.length,0);
});

test('sticky heights track wrapped navigation and the query form without touching deck storage', () => {
  const w=workspace();const sizes=[];
  w.document.documentElement.style={setProperty:(key,value)=>sizes.push([key,value])};
  w.node('.workspace-nav').getBoundingClientRect=()=>({height:124.5});
  vm.runInContext('updateStickyHeights()',w.context);
  w.node('.workspace-nav').getBoundingClientRect=()=>({height:76});
  w.node('#search-form').offsetHeight=143;
  w.node('#search-form').parentElement={style:{setProperty:(key,value)=>sizes.push([key,value])}};
  vm.runInContext('render()',w.context);
  assert.deepEqual(sizes,[['--nav-height','125px'],['--nav-height','76px'],['--search-form-height','143px']]);
  assert.equal(w.writes.length,0);
});

test('My decks remembers only deliberately opened session decks and falls back safely after deletion',async()=>{
  const a=editorDeck(),b={...editorDeck(),id:'second',name:'Second deck'};
  const w=workspace({savedDecks:JSON.stringify([a,b]),initialView:null});
  const click=dataset=>w.node('#app').click({target:{closest:()=>({dataset})}});
  await click({view:'collection'});await click({view:'decks'});
  assert.equal(vm.runInContext('view',w.context),'decks');
  await click({deck:'editor'});await click({tab:'stats'});
  for(const destination of ['collection','explore']) {
    await click({view:destination});
    if(destination==='explore')vm.runInContext("trackDeck('second');filters=parseQuery('otag:ramp')",w.context);
    await click({view:'decks'});
    assert.equal(vm.runInContext('view',w.context),'deck');
    assert.equal(vm.runInContext('active',w.context),'editor');
    assert.equal(vm.runInContext('deckTab',w.context),'stats');
  }
  vm.runInContext('settings()',w.context);await click({view:'decks'});
  assert.equal(vm.runInContext('active',w.context),'editor');
  assert.equal(vm.runInContext('tracker.id',w.context),'second');
  assert.equal(vm.runInContext('filters.query',w.context),'otag:ramp');
  assert.match(w.node('#app').innerHTML,/data-home data-view="decks"[^>]*>.*Back to library/);
  assert.doesNotMatch(w.node('#app').innerHTML,/Find cards to add/);
  await click({view:'decks',home:''});
  assert.equal(vm.runInContext('view',w.context),'decks');
  await click({deck:'second'});await click({view:'collection'});await click({view:'decks'});
  assert.equal(vm.runInContext('active',w.context),'second');
  assert.ok(w.writes.every(([key])=>key==='arcana.explorer.v1'));
  vm.runInContext('deleteDeck(decks[1])',w.context);w.node('#confirm-delete').onclick();
  await click({view:'collection'});await click({view:'decks'});
  assert.equal(vm.runInContext('view',w.context),'decks');
  const reloaded=workspace({savedDecks:JSON.stringify([a,b]),initialView:null});
  assert.equal(vm.runInContext('rememberedDeck',reloaded.context),'');
  assert.equal(vm.runInContext('view',reloaded.context),'decks');
});

test('visual ownership markers use the existing allocation before filtering and never change stored data',()=>{
  const d=editorDeck();
  const side={...structuredClone(d.cards[1]),qty:1,zone:'sideboard'};
  d.cards.push(side,{card:editorCard('Owned'),qty:12,tags:[],zone:'main'}, {...structuredClone(d.cards[1]),qty:1,zone:'maybeboard'});
  const lots=[{card:{...editorCard('alternate'),oracle_id:'Ramp spell'},finish:'foil',qty:1},{card:editorCard('Owned'),finish:'regular',qty:12}];
  const w=workspace({savedWorkspace:JSON.stringify(core.workspaceFile([d],lots))});
  vm.runInContext("openDeck('editor')",w.context);
  const before=vm.runInContext('JSON.stringify({decks,collection})',w.context);
  assert.doesNotMatch(w.node('#app').innerHTML,/data-ownership/);
  w.node('#show-deck-ownership').change({target:{checked:true}});
  assert.match(w.node('#editor-card-area').outerHTML,/data-ownership="partial"/);
  const badge=(id,zone)=>vm.runInContext(`entryBadge(decks[0].cards.find(e=>e.card.id==='${id}'&&e.zone==='${zone}'),true,ownershipBadge(collectionReport(decks[0],collection).rows.find(r=>r.entry.card.id==='${id}'&&r.zone==='${zone}')))`,w.context);
  assert.match(badge('Leader','command'),/data-ownership="missing"/);
  assert.match(badge('Ramp spell','main'),/data-ownership="partial".*1 of 2 owned \(1 in other printings, 1 missing\)/);
  assert.match(badge('Owned','main'),/data-ownership="owned".*12 of 12 owned \(12 in the stored printing\)/);
  assert.match(badge('Ramp spell','sideboard'),/data-ownership="missing"/);
  assert.match(badge('Ramp spell','maybeboard'),/data-ownership="excluded".*Outside ownership scope/);
  w.node('#editor-search').input({target:{value:'Owned'}});
  assert.equal(vm.runInContext('JSON.stringify({decks,collection})',w.context),before);
  vm.runInContext("decks[0].ownershipMatch='printing'",w.context);
  assert.match(badge('Ramp spell','main'),/data-ownership="missing"/);
  vm.runInContext("decks[0].ownershipMatch='rules';decks[0].budgetZones=['sideboard']",w.context);
  assert.match(badge('Ramp spell','sideboard'),/data-ownership="alternate"/);
  assert.match(badge('Ramp spell','main'),/data-ownership="excluded"/);
  w.node('#show-deck-ownership').change({target:{checked:false}});
  assert.doesNotMatch(w.node('#editor-card-area').outerHTML,/data-ownership/);
  assert.equal(w.writes.length,0);
});
