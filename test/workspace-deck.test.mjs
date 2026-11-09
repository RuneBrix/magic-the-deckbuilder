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

test('the full deck editor can return to the current search with its deck tracked',async()=>{
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
  await click({action:'find-cards'});
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
  assert.match(shell,/Sort by/);assert.match(shell,/Price USD \(high first\)/);assert.match(shell,/Power \(low first\)/);assert.match(shell,/Toughness \(high first\)/);
  assert.doesNotMatch(shell,/Order by|editor-type|editor-role|role-help/);
  field.input({target:{value:'SORCERY ramp'}});
  assert.equal(w.node('#app').innerHTML,shell);assert.equal(w.node('#editor-search'),field);
  assert.match(w.node('#editor-card-area').outerHTML,/Ramp spell/);assert.doesNotMatch(w.node('#editor-card-area').outerHTML,/data-inspect="Leader"/);
  w.node('#editor-group').change({target:{value:'role'}});w.node('#editor-order').change({target:{value:'price-desc'}});
  assert.match(w.node('#app').innerHTML,/<h4>Removal <span>· 2 shown<\/span><\/h4>/);
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
    w.node('#editor-group').change({target:{value:'role'}});assert.match(w.node('#app').innerHTML,/<h4>Removal <span>· 2 cards<\/span><\/h4>/);
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

test('deck prices and preview follow visible quantities, primary functions and stored printing finishes', async () => {
  const d = editorDeck();
  const ramp = d.cards[1];
  ramp.card.set = 'one';
  ramp.card.prices = { usd: '1.10', usd_foil: '10.00', eur: '5.00' };
  ramp.card.finishes = ['nonfoil', 'foil'];
  d.cards.push({ card: editorCard('Other spell', 'Sorcery'), qty: 3, zone: 'main', tags: ['Removal'] });
  const key = core.entryKey(ramp);
  const w = workspace({ savedDecks: JSON.stringify([d]) });
  vm.runInContext("openDeck('editor')", w.context);
  const html = () => w.node('#app').innerHTML;
  assert.match(html(), /Sorcery <span>· 5 cards<\/span><\/h4><p[^>]+>2\.20 USD known · 3 copies unpriced/);
  assert.match(html(), /Main deck · 5<span[^>]+> · 2\.20 USD known · 3 copies unpriced/);
  assert.match(html(), /Ramp spell<\/span><span>ONE · 1\.10 USD/);
  assert.match(html(), /Other spell<\/span><span>Set unknown · Price unavailable/);

  w.node('#editor-search').input({ target: { value: 'Ramp' } });
  assert.match(w.node('#editor-card-area').outerHTML, /Main deck · 5 · 2 shown<span[^>]+> · 2\.20 USD for shown cards/);
  assert.match(w.node('#editor-card-area').outerHTML, /Sorcery <span>· 2 shown/);
  w.node('#app').focusin({ target: { closest: () => ({ dataset: { previewEntry: key } }) } });
  assert.match(w.node('#deck-card-preview').innerHTML, /Function: Removal<\/span><span>1\.10 USD per copy · regular/);
  await w.node('#app').click({ target: { closest: () => ({ dataset: { zonePlus: key } }) } });
  assert.match(html(), /3\.30 USD for shown cards/);

  w.context.replacement = { ...ramp.card, id: 'foil-version', set: 'two', finishes: ['foil'], prices: { usd: '99.00', usd_foil: '0.75' } };
  vm.runInContext(`setEntryPrinting(current(), ${JSON.stringify(key)}, replacement);render()`, w.context);
  assert.match(html(), /2\.25 USD for shown cards/);
  assert.match(html(), /TWO · 0\.75 USD/);
  assert.match(html(), /0\.75 USD per copy · foil/);
  assert.deepEqual(core.deckPrintingPrice({ finishes: ['etched'], prices: { usd_etched: '0.00' } }), { finish: 'etched', cents: 0 });
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
