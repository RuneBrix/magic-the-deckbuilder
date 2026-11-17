import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import * as core from '../public/core.js';
import { budgetPanel } from '../public/budget-view.js';
import { collectionPage } from '../public/collection-view.js';
import { workspace, editorCard, editorDeck, formValues, chooseWorkspaceFile, startCardDrag, dropCard } from '../test-support/workspace.mjs';

test('version 2 browser storage renders collection and independent deck ownership planning',()=>{
  const d=editorDeck();d.cards[0].card.prices={eur:'2.00'};d.cards[1].card.prices={eur:null};
  const owned={card:{...editorCard('alternate'),oracle_id:'Ramp spell',set_name:'Other set',collector_number:'7'},finish:'regular',qty:1};
  const w=workspace({savedWorkspace:JSON.stringify(core.workspaceFile([d],[owned])),initialView:null});
  assert.equal(vm.runInContext('collection[0].qty',w.context),1);
  vm.runInContext("view='collection';render()",w.context);
  assert.match(w.node('#app').innerHTML,/1 copy total/);assert.doesNotMatch(w.node('#app').innerHTML,/evaluated independently/);
  vm.runInContext("openDeck('editor');deckTab='planning';render()",w.context);
  const html=w.node('#app').innerHTML;
  assert.match(html,/Ownership & costs/);assert.match(html,/Covered by collection<\/th><td>1/);assert.match(html,/Still needed<\/th><td>2/);assert.match(html,/Unknown/);
  assert.match(html,/1 unpriced copy/);
  assert.doesNotMatch(html,/deck-budget|budget-basis|over budget|Stored total/);

});

test('collection defaults and saved controls preserve stable added dates and sorting',()=>{
  const w=workspace();assert.equal(vm.runInContext('collectionOptions.group',w.context),'none');assert.equal(vm.runInContext('collectionOptions.sort',w.context),'added');
  vm.runInContext("view='collection';render()",w.context);
  w.node('#collection-group').change({target:{value:'color'}});w.node('#collection-sort').change({target:{value:'updated'}});
  const saved=JSON.parse(w.writes.at(-1)[1]);assert.equal(saved.group,'color');assert.equal(saved.sort,'updated');
  assert.equal(w.writes.at(-1)[0],'arcana.collection-view.v1');
});

test('collection pages bound both views and retain original lot indices across sorting, filtering and grouping',()=>{
  const lots=Array.from({length:1100},(_,i)=>({card:{...editorCard(`Card ${String(i).padStart(4,'0')}`),set_name:i%2?'Odd':'Even'},qty:2,finish:'regular'}));
  const indices=html=>[...html.matchAll(/data-owned-row="(\d+)"/g)].map(match=>Number(match[1]));
  for(const view of ['visual','text']){
    const options={view,group:'none',sort:'name',filter:'',page:1},seen=[];
    for(let page=1;page<=23;page++){
      const html=collectionPage(lots,{...options,page}),visible=indices(html);seen.push(...visible);
      assert.equal(visible.length,page===23?44:48);
      assert.equal([...html.matchAll(/<img /g)].length,view==='visual'?visible.length:0);
    }
    assert.deepEqual(seen,Array.from({length:1100},(_,i)=>i));
    assert.deepEqual(indices(collectionPage(lots,{...options,sort:'name-desc',page:2})),Array.from({length:48},(_,i)=>1051-i));
    const grouped=collectionPage(lots,{...options,group:'set',page:12});
    assert.deepEqual(indices(grouped),[...Array.from({length:22},(_,i)=>(528+i)*2),...Array.from({length:26},(_,i)=>i*2+1)]);
    assert.match(grouped,/>Even · 1100 copies/);assert.match(grouped,/>Odd · 1100 copies/);
    const filtered=collectionPage(lots,{...options,filter:'Card 109',page:99});
    assert.deepEqual(indices(filtered),[109,...Array.from({length:10},(_,i)=>1090+i)]);
    assert.match(filtered,/data-page="1"/);assert.match(filtered,/22 copies match · 2200 copies total/);assert.match(filtered,/Lots 1–11 of 11/);
    assert.match(collectionPage(lots,{...options,page:999}),/data-page="23"/);
    assert.match(collectionPage(lots,{...options,page:-1}),/data-page="1"/);
    assert.match(collectionPage(lots,{...options,filter:'missing',page:23}),/0 copies match · 2200 copies total/);
  }
});

test('collection totals distinguish copies and lots, including duplicate printings and empty inventory',()=>{
  const card=editorCard('Same printing'),options={view:'text',group:'none',sort:'name',filter:''};
  const html=collectionPage([{card,qty:1,finish:'regular'},{card,qty:12,finish:'foil'}],options);
  assert.match(html,/13 copies total/);assert.match(html,/Lots 1–2 of 2/);
  assert.doesNotMatch(html,/owned copies across|Each deck is evaluated independently/);
  const empty=collectionPage([],options);assert.match(empty,/0 copies total/);assert.match(empty,/0 lots/);assert.match(empty,/No owned cards yet/);
  assert.equal([...empty.matchAll(/data-collection-page-step="[^"]+" disabled/g)].length,2);
});

test('legacy budget fields survive ownership edits and complete workspace round trips without controls',()=>{
  const d=editorDeck();d.budgetCents=10000;d.budgetBasis='full';
  for(const version of [1,2]){
    const w=workspace({savedWorkspace:JSON.stringify(version===1?core.workspaceFile([d]):core.workspaceFile([d],[]))});
    vm.runInContext("openDeck('editor');deckTab='planning';render()",w.context);
    assert.doesNotMatch(w.node('#app').innerHTML,/id="deck-budget"|id="budget-basis"|budget-comparison/);
    w.node('#budget-zone-maybeboard').change({target:{checked:true}});
    const saved=core.readWorkspaceFile(JSON.parse(w.writes.at(-1)[1]));
    assert.equal(saved.decks[0].budgetCents,10000);assert.equal(saved.decks[0].budgetBasis,'full');
    assert.deepEqual(saved.decks[0].cards,d.cards);
    const roundTrip=core.readWorkspaceFile(core.workspaceFile(saved.decks,saved.collection));
    assert.deepEqual(roundTrip,saved);
  }
});

test('ownership cost columns sort numeric quotes and counts, names and zones stably with unknown prices last',()=>{
  const d=editorDeck();
  d.cards=[
    {card:{...editorCard('Card 10'),prices:{eur:'10.00'}},qty:12,tags:[],zone:'main'},
    {card:{...editorCard('Card 2'),prices:{eur:'2.00'}},qty:2,tags:[],zone:'sideboard'},
    {card:{...editorCard('Unknown'),prices:{}},qty:1,tags:[],zone:'command'},
    {card:{...editorCard('Equal'),prices:{eur:'2.00'}},qty:2,tags:[],zone:'main'},
  ];
  d.cards.forEach((entry,i)=>entry.card.oracle_id=`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`);
  const quotes=new Map(d.cards.slice(0,2).map((e,i)=>[e.card.oracle_id,{cents:i?25:100,card:{set:'tst'}}]));
  const names=(key,direction)=>[...budgetPanel(d,[],null,{quotes},{key,direction}).matchAll(/<th scope="row">([^<]+)/g)].map(m=>m[1]);
  // Summary row headings precede the five-column detail table.
  const order=(key,direction)=>names(key,direction).slice(-4);
  assert.deepEqual(order('price','asc'),['Equal','Card 2','Card 10','Unknown']);
  assert.deepEqual(order('price','desc'),['Card 10','Equal','Card 2','Unknown']);
  assert.deepEqual(order('copies','desc'),['Card 10','Equal','Card 2','Unknown']);
  assert.deepEqual(order('card','asc'),['Card 2','Card 10','Equal','Unknown']);
  assert.deepEqual(order('zone','asc'),['Unknown','Card 10','Equal','Card 2']);
  assert.deepEqual(order('cheapest','asc'),['Card 2','Card 10','Equal','Unknown']);
  assert.deepEqual(order('cheapest','desc'),['Card 10','Card 2','Equal','Unknown']);
  const html=budgetPanel(d,[],null,{quotes,checkedAt:'2026-11-16T12:00:00Z'},{key:'price',direction:'desc'});
  assert.match(html,/aria-sort="descending"/);assert.doesNotMatch(html,/Stored each|Stored total|<th scope="col">Covered|Cheapest printings checked/);
  assert.match(html,/TST · Regular/);
});

test('owned search opens an anchored combobox after one literal character with no placeholder result',async()=>{
  const w=workspace();let query='';w.context.fetch=async url=>{query=new URLSearchParams(url.split('?')[1]).get('q');return {ok:true,json:async()=>({data:[editorCard('Alpha') ]})};};
  vm.runInContext('collectionLotDialog()',w.context);assert.match(w.node('#dialog').innerHTML,/role="combobox"/);assert.doesNotMatch(w.node('#dialog').innerHTML,/Choose a card|size="8"/);
  w.node('#owned-search').value='A';w.node('#owned-search').oninput();await w.timers.at(-1).fn();
  assert.equal(query,'game:paper name:/^A/');assert.match(w.node('#owned-matches').innerHTML,/role="option"/);
});

test('owned printing edits remain drafts until Update collection and use absolute quantities',()=>{
  const card=editorCard('Owned'),lot={card,finish:'regular',qty:3};
  const w=workspace({savedWorkspace:JSON.stringify(core.workspaceFile([], [lot]))});w.context.card=card;
  w.node('#owned-finish').value='regular';w.node('#owned-condition').value='';
  vm.runInContext('collectionLotDialog(card)',w.context);
  w.node('#owned-plus').onclick();assert.equal(w.node('#owned-qty').value,4);
  assert.equal(vm.runInContext('collection[0].qty',w.context),3);
  w.node('#owned-form').onsubmit({preventDefault(){}});
  assert.equal(vm.runInContext('collection[0].qty',w.context),4);
  assert.equal(vm.runInContext('collection.length',w.context),1);
});

test('editing an owned lot keeps its quantity when changing condition and replaces the original on save',()=>{
  const lot={card:editorCard('Owned'),finish:'regular',condition:'near_mint',qty:1,addedAt:'2026-10-01T12:00:00.000Z'};
  const w=workspace({savedWorkspace:JSON.stringify(core.workspaceFile([], [lot]))});
  w.node('#owned-finish').value='regular';w.node('#owned-condition').value='near_mint';
  vm.runInContext('collectionLotDialog(null,0)',w.context);
  w.node('#owned-condition').value='lightly_played';w.node('#owned-condition').onchange();
  assert.equal(w.node('#owned-qty').value,1);
  assert.equal(vm.runInContext('collection[0].condition',w.context),'near_mint');
  w.node('#owned-form').onsubmit({preventDefault(){}});
  const saved=JSON.parse(w.writes.at(-1)[1]);assert.equal(saved.collection.length,1);
  assert.equal(saved.collection[0].qty,1);assert.equal(saved.collection[0].condition,'lightly_played');
  assert.equal(saved.collection[0].addedAt,lot.addedAt);
});

test('editing printing, finish and condition combines only the edited lot with an existing destination',async()=>{
  const source=editorCard('Original'),target={...source,id:'other-printing',set:'other'};
  const lots=[{card:source,finish:'regular',qty:2},{card:target,finish:'foil',condition:'lightly_played',qty:5},{card:editorCard('Unrelated'),finish:'regular',qty:9}];
  const d=editorDeck(),w=workspace({savedWorkspace:JSON.stringify(core.workspaceFile([d],lots))});
  w.node('#owned-finish').value='regular';w.node('#owned-condition').value='';
  w.context.fetch=async()=>({ok:true,json:async()=>({data:[source,target],has_more:false})});
  vm.runInContext('collectionLotDialog(null,0)',w.context);for(let i=0;i<12;i++)await Promise.resolve();
  w.node('#owned-version').value=target.id;w.node('#owned-version').onchange();
  w.node('#owned-finish').value='foil';w.node('#owned-finish').onchange();
  for(const condition of ['damaged','lightly_played']){w.node('#owned-condition').value=condition;w.node('#owned-condition').onchange();assert.equal(w.node('#owned-qty').value,2);}
  assert.match(w.node('#owned-existing').textContent,/combine with 5 copies/);
  w.node('#owned-form').onsubmit({preventDefault(){}});
  const saved=JSON.parse(w.writes.at(-1)[1]);assert.deepEqual(saved.decks,[d]);assert.equal(saved.collection.length,2);
  assert.deepEqual(saved.collection[0],{...lots[1],qty:7,updatedAt:saved.collection[0].updatedAt});assert.deepEqual(saved.collection[1],lots[2]);
});

test('failed, invalid and stale owned-lot edits preserve inventory; a corrected retry and zero removal work',()=>{
  const lot={card:editorCard('Original'),finish:'regular',qty:2},w=workspace({savedWorkspace:JSON.stringify(core.workspaceFile([], [lot]))});
  w.node('#owned-finish').value='regular';w.node('#owned-condition').value='';vm.runInContext('collectionLotDialog(null,0)',w.context);
  const submit=()=>w.node('#owned-form').onsubmit({preventDefault(){}}),read=()=>JSON.parse(vm.runInContext('JSON.stringify(collection)',w.context));
  w.node('#owned-qty').value=1.5;submit();assert.equal(w.writes.length,0);assert.deepEqual(read(),[lot]);
  w.node('#owned-qty').value=1;w.node('#owned-condition').value='damaged';w.node('#owned-condition').onchange();
  const persist=w.context.localStorage.setItem;w.context.localStorage.setItem=()=>{throw Error('Quota exceeded');};submit();
  assert.match(w.node('#owned-error').textContent,/original collection is unchanged/);assert.deepEqual(read(),[lot]);
  w.context.localStorage.setItem=persist;submit();assert.equal(read().length,1);assert.equal(read()[0].qty,1);assert.equal(read()[0].condition,'damaged');
  w.node('#owned-condition').value='damaged';vm.runInContext('collectionLotDialog(null,0)',w.context);vm.runInContext('collection[0].qty=3',w.context);submit();assert.match(w.node('#owned-error').textContent,/changed while editing/);assert.equal(read()[0].qty,3);
  vm.runInContext('collectionLotDialog(null,0)',w.context);w.node('#owned-qty').value=0;submit();assert.deepEqual(read(),[]);
});

test('an owned-lot merge that exceeds the quantity limit leaves both original lots intact',()=>{
  const card=editorCard('Owned'),lots=[{card,finish:'regular',qty:2},{card,finish:'regular',condition:'damaged',qty:9999}],w=workspace({savedWorkspace:JSON.stringify(core.workspaceFile([],lots))});
  w.node('#owned-finish').value='regular';w.node('#owned-condition').value='';vm.runInContext('collectionLotDialog(null,0)',w.context);
  w.node('#owned-condition').value='damaged';w.node('#owned-condition').onchange();w.node('#owned-form').onsubmit({preventDefault(){}});
  assert.equal(w.writes.length,0);assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(collection)',w.context)),lots);
});

test('inline collection quantity validates changes and zero requests removal confirmation',()=>{
  const d=editorDeck(),lot={card:editorCard('Forest'),qty:2,finish:'regular'},w=workspace({savedWorkspace:JSON.stringify(core.workspaceFile([d],[lot]))});
  vm.runInContext('updateOwnedQuantity(0,5)',w.context);assert.equal(vm.runInContext('collection[0].qty',w.context),5);
  vm.runInContext('updateOwnedQuantity(0,1.5)',w.context);assert.equal(vm.runInContext('collection[0].qty',w.context),5);
  vm.runInContext('updateOwnedQuantity(0,0)',w.context);assert.equal(vm.runInContext('collection[0].qty',w.context),5);assert.match(w.node('#dialog').innerHTML,/Remove owned lot/);
});

test('collection deletion requires typed confirmation, persists first and preserves decks',()=>{
  const d=editorDeck(),lot={card:editorCard('Forest'),qty:2,finish:'regular'},w=workspace({savedWorkspace:JSON.stringify(core.workspaceFile([d],[lot]))});
  vm.runInContext('clearCollection()',w.context);w.node('#clear-collection-apply').onclick();assert.equal(vm.runInContext('collection.length',w.context),1);
  w.node('#clear-collection-confirm').value='DELETE';const persist=w.context.localStorage.setItem;w.context.localStorage.setItem=()=>{throw Error('Quota');};w.node('#clear-collection-apply').onclick();assert.equal(vm.runInContext('collection.length',w.context),1);
  w.context.localStorage.setItem=persist;w.node('#clear-collection-apply').onclick();assert.equal(vm.runInContext('collection.length',w.context),0);
  const saved=JSON.parse(w.writes.at(-1)[1]);assert.deepEqual(saved.decks,[d]);assert.deepEqual(saved.collection,[]);
});

test('owned versions load all pages automatically and never request beyond the final page',async()=>{
  const card=editorCard('Forest'),w=workspace();w.context.card=card;w.node('#owned-finish').value='regular';w.node('#owned-condition').value='';const pages=[];
  w.context.fetch=async url=>{const page=Number(new URLSearchParams(url.split('?')[1]).get('page'));pages.push(page);return {ok:true,json:async()=>({data:[{...card,id:'print-'+page}],has_more:page===1})};};
  vm.runInContext('collectionLotDialog(card)',w.context);for(let i=0;i<12;i++)await Promise.resolve();
  assert.deepEqual(pages,[1,2]);await w.node('#owned-load').onclick();assert.deepEqual(pages,[1,2]);assert.match(w.node('#owned-version').innerHTML,/print-2/);
});

test('collection TXT reports zones and uploads valid cards after skip confirmation',async()=>{
  const w=workspace();formValues(w,{list:'Mainboard\n2 Forest\nSideboard\n1 Forest'});
  w.context.fetch=async()=>({ok:true,json:async()=>({data:[editorCard('Forest')],not_found:[]})});
  vm.runInContext('collectionImport()',w.context);const form=w.node('#collection-import');
  await form.onsubmit({preventDefault(){}});assert.equal(vm.runInContext('collection.length',w.context),0);
  assert.match(w.node('#collection-notices').innerHTML,/Could not process the following cards/);w.node('#collection-accept-ignored').checked=true;
  await form.onsubmit({preventDefault(){}});assert.equal(vm.runInContext('collection[0].qty',w.context),3);
});

test('collection CSV upload merges matching finish and condition without a second review',async()=>{
  const w=workspace();formValues(w,{list:'Quantity,Name,Finish,Condition\n1,Forest,Normal,NM\n2,Forest,Normal,NM\n1,Forest,Foil,LP'});
  w.context.fetch=async()=>({ok:true,json:async()=>({data:[editorCard('Forest')],not_found:[]})});
  vm.runInContext('collectionImport()',w.context);const form=w.node('#collection-import');
  await form.onsubmit({preventDefault(){}});assert.equal(vm.runInContext('collection.length',w.context),2);
  assert.equal(vm.runInContext('collection[0].qty',w.context),3);assert.equal(vm.runInContext('collection[1].finish',w.context),'foil');assert.equal(vm.runInContext('collection[1].condition',w.context),'lightly_played');
});

test('CSV ignored columns require confirmation and syntax validation itself sends no requests',async()=>{
  const w=workspace();formValues(w,{list:'Quantity,Name,Purchase Price,Tags\n1,Forest,5,personal'});let calls=0;
  w.context.fetch=async()=>{calls++;return {ok:true,json:async()=>({data:[editorCard('Forest')]})};};
  vm.runInContext('collectionImport()',w.context);const form=w.node('#collection-import');form.oninput();
  assert.equal(calls,0);assert.match(w.node('#collection-notices').innerHTML,/Not counted: Purchase Price, Tags/);assert.equal(w.node('#collection-upload-submit').disabled,true);
  await form.onsubmit({preventDefault(){}});assert.equal(calls,0);
  w.node('#collection-accept-ignored').checked=true;await form.onsubmit({preventDefault(){}});assert.equal(calls,1);assert.equal(vm.runInContext('collection.length',w.context),1);
});

test('compatible stored collection printings eliminate upload network lookups',async()=>{
  const lot={card:{...editorCard('Forest'),finishes:['nonfoil']},qty:2,finish:'regular'};
  const w=workspace({savedWorkspace:JSON.stringify(core.workspaceFile([],[lot]))});formValues(w,{list:'3 Forest'});
  w.context.fetch=async()=>{throw Error('Network should not be needed');};vm.runInContext('collectionImport()',w.context);await w.node('#collection-import').onsubmit({preventDefault(){}});
  assert.equal(vm.runInContext('collection[0].qty',w.context),5);assert.equal(w.node('#collection-import-error').textContent||'','');
});

test('separate successful uploads intentionally add again but a completed operation cannot apply twice',async()=>{
  const lot={card:{...editorCard('Forest'),finishes:['nonfoil']},qty:2,finish:'regular'};
  const w=workspace({savedWorkspace:JSON.stringify(core.workspaceFile([editorDeck()],[lot]))});formValues(w,{list:'3 Forest'});
  vm.runInContext('collectionImport()',w.context);const first=w.node('#collection-import').onsubmit;
  w.node('#collection-import').oninput();assert.match(w.node('#collection-impact').textContent,/2 → 5/);assert.match(w.node('#collection-impact').textContent,/Re-uploading/);
  await first({preventDefault(){}});assert.equal(vm.runInContext('collection[0].qty',w.context),5);
  await first({preventDefault(){}});assert.equal(vm.runInContext('collection[0].qty',w.context),5);
  vm.runInContext('collectionImport()',w.context);await w.node('#collection-import').onsubmit({preventDefault(){}});assert.equal(vm.runInContext('collection[0].qty',w.context),8);
});

test('uploads never overwrite an unreadable saved workspace before explicit recovery',async()=>{
  const w=workspace({savedWorkspace:'unreadable saved data'});formValues(w,{list:'2 New'});let lookups=0;
  w.context.fetch=async()=>{lookups++;throw Error('Unexpected lookup');};
  vm.runInContext('collectionImport()',w.context);await w.node('#collection-import').onsubmit({preventDefault(){}});
  assert.equal(lookups,0);assert.equal(w.writes.length,0);assert.match(w.node('#collection-import-error').textContent,/storage warning/);
});

test('replacement needs confirmation, merges duplicate rows and persists before replacing inventory',async()=>{
  const d=editorDeck(),lot={card:{...editorCard('Forest'),finishes:['nonfoil']},qty:20,finish:'regular'},w=workspace({savedWorkspace:JSON.stringify(core.workspaceFile([d],[lot]))});
  formValues(w,{list:'Quantity,Name,Finish,Condition\n1,Forest,Normal,NM\n2,Forest,Normal,NM'});
  vm.runInContext('collectionImport()',w.context);const form=w.node('#collection-import');w.node('#collection-import-mode').value='replace';form.oninput({target:{id:'collection-import-mode'}});
  assert.match(w.node('#collection-impact').textContent,/Replace 20 current copies in 1 lots with 3/);
  assert.match(w.node('#dialog').innerHTML,/Save current workspace copy/);
  await form.onsubmit({preventDefault(){}});assert.equal(w.writes.length,0);
  w.node('#collection-confirm-replace').checked=true;
  const persist=w.context.localStorage.setItem;w.context.localStorage.setItem=()=>{assert.equal(vm.runInContext('collection[0].qty',w.context),20);throw Object.assign(Error('Quota'),{name:'QuotaExceededError'});};
  await form.onsubmit({preventDefault(){}});assert.equal(vm.runInContext('collection[0].qty',w.context),20);assert.match(w.node('#collection-import-error').textContent,/Browser storage is full/);
  w.context.localStorage.setItem=persist;await form.onsubmit({preventDefault(){}});
  const saved=JSON.parse(w.writes.at(-1)[1]);assert.deepEqual(saved.decks,[d]);assert.equal(saved.collection.length,1);assert.equal(saved.collection[0].qty,3);assert.equal(saved.collection[0].condition,'near_mint');assert.equal(saved.collection[0].finish,'regular');
});

test('cancelled and changed replacement lookups retain prior decks and inventory',async()=>{
  for(const change of ['close','list','mode','inventory']){
    const lot={card:editorCard('Owned'),qty:7,finish:'regular'},w=workspace({savedWorkspace:JSON.stringify(core.workspaceFile([editorDeck()],[lot]))});formValues(w,{list:'2 New'});
    let release;w.context.fetch=async()=>{await new Promise(resolve=>release=resolve);return {ok:true,json:async()=>({data:[editorCard('New')]})};};
    vm.runInContext('collectionImport()',w.context);const form=w.node('#collection-import');w.node('#collection-import-mode').value='replace';w.node('#collection-confirm-replace').checked=true;
    const pending=form.onsubmit({preventDefault(){}});await Promise.resolve();
    if(change==='close')w.node('#dialog').open=false;
    if(change==='list'){formValues(w,{list:'4 New'});form.oninput();}
    if(change==='mode'){w.node('#collection-import-mode').value='add';form.oninput({target:{id:'collection-import-mode'}});}
    if(change==='inventory')vm.runInContext('collection[0].qty=9',w.context);
    release();await pending;
    assert.equal(w.writes.length,0,change);assert.equal(vm.runInContext('collection[0].qty',w.context),change==='inventory'?9:7,change);assert.equal(vm.runInContext('decks.length',w.context),1);
  }
});

test('unresolved/malformed replacement and failed additive writes retain the original inventory',async()=>{
  for(const mode of ['replace','add']){
    const lot={card:editorCard('Owned'),qty:7,finish:'regular'},w=workspace({savedWorkspace:JSON.stringify(core.workspaceFile([],[lot]))});formValues(w,{list:'0 Bad'});
    vm.runInContext('collectionImport()',w.context);const form=w.node('#collection-import');w.node('#collection-import-mode').value=mode;w.node('#collection-confirm-replace').checked=true;
    await form.onsubmit({preventDefault(){}});assert.equal(w.writes.length,0);
    if(mode==='replace'){
      formValues(w,{list:'0 Bad\n2 New'});form.oninput();w.node('#collection-accept-ignored').checked=true;
      await form.onsubmit({preventDefault(){}});assert.equal(w.writes.length,0);assert.match(w.node('#collection-import-error').textContent,/every row/);
    }
    formValues(w,{list:'2 New'});form.oninput();w.context.fetch=async()=>({ok:true,json:async()=>({data:[],has_more:false})});
    await form.onsubmit({preventDefault(){}});assert.equal(w.writes.length,0);
    w.context.fetch=async()=>({ok:true,json:async()=>({data:[editorCard('New')]})});vm.runInContext('collectionImport()',w.context);w.node('#collection-import-mode').value=mode;w.node('#collection-confirm-replace').checked=true;
    w.context.localStorage.setItem=()=>{throw Error('Quota');};await w.node('#collection-import').onsubmit({preventDefault(){}});
    assert.equal(vm.runInContext('collection[0].qty',w.context),7);assert.equal(vm.runInContext('collection.length',w.context),1);
  }
});

test('collection Text is a sortable table with dates, price and contained actions',async()=>{
  const w=workspace({savedWorkspace:JSON.stringify(core.workspaceFile([],[{card:editorCard('Forest'),qty:2,finish:'regular'}]))});formValues(w,{});
  vm.runInContext("view='collection';collectionOptions.view='text';render()",w.context);const html=w.node('#app').innerHTML;
  assert.match(html,/<table class="collection-table"/);assert.match(html,/data-collection-sort="price"/);assert.match(html,/data-collection-sort="updated"/);assert.match(html,/class="collection-actions"/);assert.doesNotMatch(html,/Horizontal text|Vertical text/);
  await w.node('#app').click({target:{closest:()=>({dataset:{collectionSort:'price'}})}});assert.equal(vm.runInContext('collectionOptions.sort',w.context),'price');
  await w.node('#app').click({target:{closest:()=>({dataset:{collectionSort:'price'}})}});assert.equal(vm.runInContext('collectionOptions.sort',w.context),'price-desc');
});

test('collection captions keep only concise condition, finish and language without changing stored lots',()=>{
  const lots=['near_mint','lightly_played','moderately_played','heavily_played','damaged',undefined].map((condition,index)=>({card:{...editorCard('Owned '+index),set_name:'A very long set name',lang:'ja'},qty:2,finish:index%2?'foil':'regular',...(condition?{condition}:{})}));
  const before=structuredClone(lots),html=collectionPage(lots,{view:'visual',group:'none',sort:'name',filter:''});
  const facts=[...html.matchAll(/<div class="collection-visual-info"[^>]*>(.*?)<\/div>/g)].map(match=>match[1]);
  assert.equal(facts.length,6);
  for(const fact of facts){assert.match(fact,/aria-label="Language">JA/);assert.doesNotMatch(fact,/A very long set name|Added|Updated|EUR each/);}
  for(const label of ['NM','LP','MP','HP','DMG','—'])assert.ok(facts.some(fact=>fact.includes('>'+label+'</abbr>')));
  assert.match(html,/title="Heavily played"/);assert.match(html,/title="Condition not recorded"/);
  assert.doesNotMatch(html,/data-inspect-owned|<h3>|data-remove-owned|data-owned-quantity/);assert.match(html,/data-owned-menu="0"/);assert.deepEqual(lots,before);
});

test('collection card and non-control row activation open the exact lot as a staged edit',async()=>{
  const card=editorCard('Owned'),lots=[{card,qty:2,finish:'regular'},{card,qty:5,finish:'foil',condition:'lightly_played'}];
  for(const source of ['card','row']){
    const w=workspace({savedWorkspace:JSON.stringify(core.workspaceFile([],lots))});
    w.node('#owned-finish').value='foil';w.node('#owned-condition').value='lightly_played';
    const target={closest:selector=>source==='row'?(selector==='[data-owned-row]'?{dataset:{ownedRow:'1'}}:null):{dataset:{editOwned:'1'}}};
    await w.node('#app').click({target});
    assert.match(w.node('#dialog').innerHTML,/<h2>Update card in collection/);assert.match(w.node('#dialog').innerHTML,/value="foil" selected/);
    assert.equal(w.node('#owned-qty').value,5);w.node('#owned-plus').onclick();assert.equal(w.node('#owned-qty').value,6);
    assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(collection)',w.context)),lots);assert.equal(w.writes.length,0);
  }
});

test('Archidekt Normal rows accept Scryfall nonfoil finish for the reported three-card CSV',async()=>{
  const names=['Aang, Air Nomad',"Aang, Swift Savior // Aang and La, Ocean's Fury",'Abandoned Air Temple'];
  const csv='Quantity,Name,Finish,Condition\n1,"Aang, Air Nomad",Normal,NM\n1,"Aang, Swift Savior // Aang and La, Ocean\'s Fury",Normal,NM\n1,Abandoned Air Temple,Normal,NM';
  const w=workspace();formValues(w,{list:csv});w.context.fetch=async()=>({ok:true,json:async()=>({data:names.map(name=>({...editorCard(name),finishes:['nonfoil','foil']})),not_found:[]})});
  vm.runInContext('collectionImport()',w.context);const form=w.node('#collection-import');await form.onsubmit({preventDefault(){}});
  assert.equal(w.node('#collection-import-error').textContent||'','');assert.equal(vm.runInContext('collection.length',w.context),3);assert.equal(vm.runInContext("collection.every(l=>l.finish==='regular'&&l.condition==='near_mint')",w.context),true);
});

test('CSV falls back from a foil-only default and a missing double-faced lookup to compatible printings',async()=>{
  const w=workspace(),name='Aang, Air Nomad',double="Aang, Swift Savior // Aang and La, Ocean's Fury";formValues(w,{list:'Quantity,Name,Finish,Condition\n1,"'+name+'",Normal,NM\n1,"'+double+'",Normal,NM'});
  w.context.fetch=async url=>({ok:true,json:async()=>url==='/api/collection'?{data:[{...editorCard(name),finishes:['foil']}],not_found:[{name:double}]}:{data:[{...editorCard(url.includes('Swift')?double:name),id:url.includes('Swift')?'double-nonfoil':'air-nonfoil',finishes:['nonfoil']}],has_more:false}});
  vm.runInContext('collectionImport()',w.context);await w.node('#collection-import').onsubmit({preventDefault(){}});assert.equal(w.node('#collection-import-error').textContent||'','');assert.equal(vm.runInContext('collection.length',w.context),2);
});

test('live localhost upload resolves the reported Archidekt three-card CSV in a disposable VM', {skip:process.env.ARCANA_LIVE_CSV!=='1'},async()=>{
  const w=workspace();formValues(w,{list:'Quantity,Name,Finish,Condition\n1,"Aang, Air Nomad",Normal,NM\n1,"Aang, Swift Savior // Aang and La, Ocean\'s Fury",Normal,NM\n1,Abandoned Air Temple,Normal,NM'});
  w.context.fetch=(url,options)=>fetch('http://localhost:3000'+url,options);
  vm.runInContext('collectionImport()',w.context);await w.node('#collection-import').onsubmit({preventDefault(){}});
  assert.equal(w.node('#collection-import-error').textContent||'','');assert.equal(vm.runInContext('collection.length',w.context),3);
});

test('a missing edition catalog endpoint explains the server restart before looking up printings',async()=>{
  const w=workspace();
  formValues(w,{list:'Quantity,Name,Edition Name\n1,"Aang, Air Nomad",Avatar: The Last Airbender Eternal'});
  w.context.fetch=async url=>{
    assert.equal(url,'/api/collection-sets');
    return {ok:false,status:404,json:async()=>({error:'Endpoint not found.'})};
  };
  vm.runInContext('collectionImport()',w.context);
  await w.node('#collection-import').onsubmit({preventDefault(){}});
  assert.match(w.node('#collection-import-error').textContent,/CSV row 2 · Aang, Air Nomad .* Restart the Arcana CMD server/);
  assert.equal(w.node('#collection-import-preview').textContent,'');
  assert.equal(w.writes.length,0);
});

test('CSV set and language constraints reject mismatches and can recover from a corrected set name',async()=>{
  const w=workspace();formValues(w,{list:'Quantity,Name,Finish,Condition,Language,Edition Name\n1,Forest,Normal,NM,Japanese,Example Set'});
  const wrong={...editorCard('Forest'),lang:'en',set_name:'Other Set',set:'oth'};
  const right={...wrong,lang:'ja',set_name:'Example Set',set:'exm'};
  let fail=true, catalogRequests=0;
  w.context.fetch=async url=>{
    if(url==='/api/collection-sets'){
      catalogRequests++;
      return {ok:true,json:async()=>[{code:'exm',name:'Example Set'}]};
    }
    assert.match(new URL(url,'http://localhost').searchParams.get('q'),/set:exm lang:ja/);
    return {ok:!fail,status:fail?404:200,json:async()=>fail?{error:'Raw upstream no match'}:{data:[right]}};
  };
  vm.runInContext('collectionImport()',w.context);await w.node('#collection-import').onsubmit({preventDefault(){}});
  assert.equal(vm.runInContext('collection.length',w.context),0);assert.equal(w.writes.length,0);
  assert.match(w.node('#collection-import-error').textContent,/CSV row 2 · Forest · Example Set.*No compatible printing found/);
  assert.equal(w.node('#collection-import-preview').textContent,'');
  fail=false;
  formValues(w,{list:'Count,Card,Language,Edition Name\n1,Forest,Japanese,EXAMPLE   SET'});
  const form=w.node('#collection-import');form.oninput();await form.onsubmit({preventDefault(){}});
  assert.equal(catalogRequests,1);
  assert.equal(vm.runInContext('collection[0].card.lang',w.context),'ja');
});

test('edition rows pick the lowest compatible collector number unless the CSV specifies one',async()=>{
  const w=workspace(),name="Aang, Swift Savior // Aang and La, Ocean's Fury";
  const printings=['298','359','204','347'].map(number=>({
    ...editorCard(name),id:'tla-'+number,oracle_id:'aang',set:'tla',set_name:'Avatar: The Last Airbender',
    collector_number:number,finishes:number==='359'?['foil']:['nonfoil','foil'],
  }));
  w.context.fetch=async url=>({ok:true,json:async()=>url==='/api/collection-sets'
    ? [{code:'tla',name:'Avatar: The Last Airbender'}]
    : {data:printings}});
  formValues(w,{list:'Quantity,Name,Edition Name,Collector Number\n1,"'+name+'",tla,\n1,"'+name+'",tla,0298'});
  vm.runInContext('collectionImport()',w.context);
  await w.node('#collection-import').onsubmit({preventDefault(){}});
  assert.equal(vm.runInContext("collection.map(lot=>lot.card.collector_number).join(',')",w.context),'204,298');
});

test('large collection review resumes after cooldown without repeating completed 75-name batches',async()=>{
  const w=workspace(),names=Array.from({length:80},(_,i)=>'Card '+i);formValues(w,{list:'Quantity,Name\n'+names.map(n=>'1,'+n).join('\n')});let calls=0,time=Date.now();
  w.context.Date=class extends Date{static now(){return time;}};
  w.context.fetch=async(_url,options)=>{calls++;if(calls===2)return {ok:false,status:429,json:async()=>({error:'Paused',retryAfter:60})};return {ok:true,json:async()=>({data:JSON.parse(options.body).names.map(n=>editorCard(n)),not_found:[]})};};
  vm.runInContext('collectionImport()',w.context);const form=w.node('#collection-import');await form.onsubmit({preventDefault(){}});
  assert.equal(calls,2);assert.equal(vm.runInContext('collection.length',w.context),0);assert.equal(w.node('#collection-upload-submit').disabled,true);
  await form.onsubmit({preventDefault(){}});assert.equal(calls,2);
  time+=61_000;await form.onsubmit({preventDefault(){}});assert.equal(calls,3);assert.equal(vm.runInContext('collection.length',w.context),80);
});

test('EUR refresh keeps the last good finish quote and updates only exact stored printings',async()=>{
  const d=editorDeck();for(const entry of d.cards)entry.card.prices={eur:'1.00',usd:'9.99'};
  d.budgetZones=['maybeboard'];d.cards.push({card:{...editorCard('idea'),finishes:['foil'],prices:{eur:null,usd:'9.99'}},qty:2,tags:[],zone:'maybeboard'});
  const w=workspace({savedDecks:JSON.stringify([d]),initialView:null});vm.runInContext("openDeck('editor');deckTab='planning';render()",w.context);
  w.context.fetch=async()=>{throw Error('Offline');};
  await vm.runInContext('refreshPrices()',w.context);
  assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(decks[0].cards)',w.context)),d.cards);
  assert.match(w.node('#app').innerHTML,/last usable prices were retained/i);
  const requests=[];
  w.context.fetch=async(_url,options)=>{const ids=JSON.parse(options.body).ids;requests.push(ids);return {ok:true,json:async()=>({data:ids.map(id=>({...editorCard(id),cardmarket_id:41,prices:{eur:null,eur_foil:requests.length===1?'2.50':null,usd:'0.01'}})),not_found:[]})};};
  await vm.runInContext('refreshPrices()',w.context);
  assert.deepEqual(requests,[['idea']]);
  assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(decks[0].cards.map(e=>e.card.prices))',w.context)),[{eur:'1.00',usd:'9.99'},{eur:'1.00',usd:'9.99'},{eur:null,usd:'9.99',eur_foil:'2.50'}]);
  assert.equal(vm.runInContext('collectionReport(decks[0],collection).fullCents',w.context),500);
  assert.equal(vm.runInContext('decks[0].cards[2].card.cardmarket_id',w.context),41);
  await vm.runInContext('refreshPrices()',w.context);
  assert.match(w.node('#app').innerHTML,/Kept the saved quote for 1 entry/);
  assert.equal(vm.runInContext('decks[0].cards[2].card.prices.eur_foil',w.context),'2.50');
  assert.equal(typeof vm.runInContext('decks[0].priceUpdatedAt',w.context),'string');
});

test('EUR refresh skips a printing changed while its exact-id request is in flight',async()=>{
  const d=editorDeck();for(const entry of d.cards)entry.card.prices={eur:'1.00'};
  const w=workspace({savedDecks:JSON.stringify([d]),initialView:null});let release;
  w.context.fetch=async(_url,options)=>{const ids=JSON.parse(options.body).ids;await new Promise(resolve=>release=()=>resolve(ids));return {ok:true,json:async()=>({data:ids.map(id=>({...editorCard(id),prices:{eur:'2.50'}})),not_found:[]})};};
  const pending=vm.runInContext('refreshPrices()',w.context);await Promise.resolve();
  vm.runInContext("decks[0].cards[0].card={...decks[0].cards[0].card,id:'new-printing',prices:{eur:'8.00'}}",w.context);release();await pending;
  assert.equal(vm.runInContext("decks[0].cards[0].card.prices.eur",w.context),'8.00');assert.equal(vm.runInContext("decks[0].cards[1].card.prices.eur",w.context),'2.50');
});

test('deck currency saves atomically, clears cheapest quotes and ignores late scans and refreshes',async()=>{
  const d=editorDeck();
  for(const [index,entry] of d.cards.entries()){
    entry.card.oracle_id=`00000000-0000-4000-8000-${String(index+1).padStart(12,'0')}`;
    entry.card.prices={eur:'1.00',usd:'3.00'};
  }
  const w=workspace({savedDecks:JSON.stringify([d])});
  vm.runInContext("openDeck('editor');deckTab='planning';render()",w.context);
  const before=JSON.stringify(d.cards);
  let release;
  w.context.fetch=()=>new Promise(resolve=>{release=()=>resolve({ok:true,json:async()=>({data:d.cards.map(e=>({...e.card,games:['paper'],lang:'en',finishes:['nonfoil'],prices:{eur:'0.01'}})),has_more:false})});});
  const pending=vm.runInContext('checkCheapestPrices()',w.context);await Promise.resolve();
  w.node('#deck-currency').change({target:{value:'USD'}});
  release();await pending;
  assert.equal(vm.runInContext('cheapestPriceStates.has(current())',w.context),false);
  assert.equal(vm.runInContext('current().currency',w.context),'USD');
  assert.match(w.node('#app').innerHTML,/\$9\.00/);
  assert.equal(JSON.stringify(JSON.parse(w.writes.at(-1)[1]).decks[0].cards),before);
  assert.equal(core.readWorkspaceFile(JSON.parse(w.writes.at(-1)[1])).decks[0].currency,'USD');

  const write=w.context.localStorage.setItem;
  w.context.localStorage.setItem=()=>{throw Error('Full');};
  w.node('#deck-currency').change({target:{value:'EUR'}});
  assert.equal(vm.runInContext('current().currency',w.context),'USD');
  assert.match(w.node('#toast').textContent,/Browser storage is full/);
  w.context.localStorage.setItem=write;

  const refresh=vm.runInContext('refreshPrices()',w.context);await Promise.resolve();
  w.node('#deck-currency').change({target:{value:'EUR'}});
  w.node('#deck-currency').change({target:{value:'USD'}});
  release();await refresh;
  assert.equal(vm.runInContext('priceStates.has(current())',w.context),false);
  assert.equal(vm.runInContext('JSON.stringify(current().cards)',w.context),before);
});

test('cheapest printing application reviews scope, cancels safely and commits atomically with stale-result protection',()=>{
  const d=editorDeck();
  const oracle='00000000-0000-4000-8000-000000000001';
  d.cards[1].card.oracle_id=oracle;
  const owned={card:structuredClone(d.cards[1].card),qty:1,finish:'regular'};
  const w=workspace({savedWorkspace:JSON.stringify(core.workspaceFile([d],[owned]))});
  w.context.cheaper={...d.cards[1].card,id:'cheaper',set:'low',lang:'en',games:['paper'],finishes:['nonfoil'],prices:{eur:'0.25'}};
  vm.runInContext(`openDeck('editor');deckTab='planning';cheapestPriceStates.set(current(),{currency:'EUR',status:'done',quotes:new Map([['${oracle}',{card:cheaper,cents:25}]])});applyCheapestDialog()`,w.context);
  const before=vm.runInContext('JSON.stringify({decks,collection})',w.context);
  assert.match(w.node('#dialog').innerHTML,/Main deck, Command zone, Sideboard/);
  assert.match(w.node('#dialog').innerHTML,/2 copies to update/);
  w.node('#cancel-cheapest').onclick();
  assert.equal(vm.runInContext('JSON.stringify({decks,collection})',w.context),before);assert.equal(w.writes.length,0);

  vm.runInContext('applyCheapestDialog()',w.context);
  const write=w.context.localStorage.setItem;
  w.context.localStorage.setItem=()=>{throw Error('Quota');};
  w.node('#confirm-cheapest').onclick();
  assert.match(w.node('#apply-cheapest-error').textContent,/Browser storage is full/);
  assert.equal(vm.runInContext('JSON.stringify({decks,collection})',w.context),before);
  w.context.localStorage.setItem=write;
  w.node('#confirm-cheapest').onclick();
  const restored=core.readWorkspaceFile(JSON.parse(w.writes.at(-1)[1]));
  assert.equal(restored.decks[0].cards[1].card.id,'cheaper');
  assert.equal(restored.decks[0].cards[1].qty,2);assert.deepEqual(restored.decks[0].cards[1].tags,['Removal','Ramp']);
  assert.deepEqual(restored.collection,[owned]);

  vm.runInContext('applyCheapestDialog();current().cards[1].qty++',w.context);
  const writes=w.writes.length;w.node('#confirm-cheapest').onclick();
  assert.match(w.node('#apply-cheapest-error').textContent,/deck or price results changed/);assert.equal(w.writes.length,writes);
});
