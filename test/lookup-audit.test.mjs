import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { workspaceFile } from '../public/core.js';
import { workspace, editorCard, editorDeck, formValues } from '../test-support/workspace.mjs';

const event={preventDefault(){}};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const read=w=>JSON.parse(vm.runInContext('JSON.stringify({decks,collection})',w.context));

test('manual Collection add defaults to a supported finish and rejected writes apply nothing',()=>{
  for(const [finishes,expected] of [[['nonfoil','foil'],'regular'],[['foil'],'foil'],[['etched'],'etched']]){
    const card={...editorCard('New'),finishes},deck=editorDeck();
    const w=workspace({savedWorkspace:JSON.stringify(workspaceFile([deck],[]))});w.context.card=card;w.node('#owned-finish').value='regular';
    vm.runInContext('collectionLotDialog(card)',w.context);
    assert.equal(w.node('#owned-finish').value,expected);
    w.node('#owned-qty').value=2;
    const persist=w.context.localStorage.setItem;
    w.context.localStorage.setItem=()=>{throw Error('Quota exceeded');};
    w.node('#owned-form').onsubmit(event);
    assert.deepEqual(read(w),{decks:[deck],collection:[]});
    assert.match(w.node('#owned-error').textContent,/unchanged/);
    w.context.localStorage.setItem=persist;w.node('#owned-form').onsubmit(event);
    assert.equal(read(w).collection[0].finish,expected);
    assert.equal(read(w).collection[0].qty,2);
  }
});

test('manual Collection editor rejects unsupported finishes and unrelated printing responses',async()=>{
  const card={...editorCard('Original'),finishes:['foil']},lot={card,qty:3,finish:'foil'};
  const w=workspace({savedWorkspace:JSON.stringify(workspaceFile([],[lot]))});
  w.context.fetch=async()=>({ok:true,json:async()=>({data:[editorCard('Unrelated')],has_more:false})});
  vm.runInContext('collectionLotDialog(null,0)',w.context);await tick();
  assert.doesNotMatch(w.node('#owned-version').innerHTML,/Unrelated/);
  assert.match(w.node('#owned-status').textContent,/identity/);
  w.node('#owned-finish').value='regular';w.node('#owned-form').onsubmit(event);
  assert.deepEqual(read(w).collection,[lot]);assert.equal(w.writes.length,0);
});

test('reviewed deck text import preserves the workspace on failed save and applies once on retry',async()=>{
  for(const existing of [false,true]){
    const deck=editorDeck(),w=workspace({savedWorkspace:JSON.stringify(workspaceFile([deck],[]))});
    formValues(w,{name:'Imported',format:'commander',list:'2 New'});
    w.context.fetch=async()=>({ok:true,json:async()=>({data:[editorCard('New')],not_found:[]})});
    vm.runInContext(existing?'importDialog(decks[0])':'importDialog(null)',w.context);
    const submit=w.node('#import-form').onsubmit;await submit(event);
    const persist=w.context.localStorage.setItem;w.context.localStorage.setItem=()=>{throw Error('Quota exceeded');};
    await submit(event);assert.deepEqual(read(w),{decks:[deck],collection:[]});
    assert.match(w.node('#import-error').textContent,/unchanged/);
    w.context.localStorage.setItem=persist;await submit(event);await submit(event);
    const saved=read(w);assert.equal(saved.decks.length,existing?1:2);
    assert.equal(saved.decks.at(-1).cards.find(e=>e.card.id==='New').qty,2);
  }
});

test('Collection upload honors an edition and collector suffix beyond the first page',async()=>{
  const w=workspace(),card={...editorCard('Exact'),set:'tst',finishes:['nonfoil'],collector_number:'12a'};
  formValues(w,{list:'Quantity,Name,Edition Name,Collector Number\n2,Exact,TEST’S   SET,12a'});
  w.context.fetch=async url=>({ok:true,json:async()=>url==='/api/collection-sets'?[{code:'tst',name:"Test's Set"}]:{data:[{...card,id:url.includes('page=2')?'right':'wrong',collector_number:url.includes('page=2')?'12a':'12'}],has_more:!url.includes('page=2')}});
  vm.runInContext('collectionImport()',w.context);const submit=w.node('#collection-import').onsubmit;await submit(event);await submit(event);
  assert.equal(read(w).collection[0]?.card.id,'right',w.node('#collection-import-error').textContent+' '+w.node('#collection-import-preview').textContent);
});

test('lookup endpoint failures do not become ordinary no-match messages',async()=>{
  for(const path of ['quick','owned','commander']){
    const w=workspace({savedDecks:JSON.stringify([editorDeck()])});
    w.node('#dialog').open=true;
    w.context.fetch=async()=>({ok:false,status:404,json:async()=>({error:'Endpoint not found.'})});
    let input,status;
    if(path==='quick'){vm.runInContext("openDeck('editor')",w.context);input='#quick-add-name';status='#quick-add-status';}
    if(path==='owned'){vm.runInContext('collectionLotDialog()',w.context);input='#owned-search';status='#owned-search-status';}
    if(path==='commander'){vm.runInContext('deckForm()',w.context);input='#commander-name';status='#commander-status';}
    w.node(input).value='Exact';w.node(input).oninput({});await w.timers.at(-1).fn();
    assert.doesNotMatch(w.node(status).textContent||'',/^No .*match/);
    assert.match(w.node(status).textContent||'',/try again|Endpoint|server/i);
  }
});

test('printing changes in a deck are atomic on save failure and retain finish and functions on retry',()=>{
  const d=editorDeck(),entry=d.cards[1];entry.finish='foil';entry.card.finishes=['nonfoil','foil'];
  const w=workspace({savedDecks:JSON.stringify([d])});
  vm.runInContext("openDeck('editor');deckCardDialog(current().cards[1].card,{edit:{deck:current(),entry:current().cards[1],key:entryKey(current().cards[1])}})",w.context);
  w.node('#deck-card-finish').value='regular';
  const persist=w.context.localStorage.setItem;w.context.localStorage.setItem=()=>{throw Error('Quota');};
  w.node('#deck-card-form').onsubmit(event);assert.deepEqual(read(w).decks,[d]);
  w.context.localStorage.setItem=persist;w.node('#deck-card-form').onsubmit(event);
  assert.equal(read(w).decks[0].cards[1].finish,'regular');
  assert.deepEqual(read(w).decks[0].cards[1].tags,entry.tags);
});

test('new deck creation keeps the library unchanged on a rejected write',()=>{
  const d=editorDeck(),w=workspace({savedDecks:JSON.stringify([d])});
  formValues(w,{name:'New',format:'commander'});vm.runInContext('deckForm()',w.context);
  w.context.localStorage.setItem=()=>{throw Error('Quota');};
  w.node('#deck-form').onsubmit({...event,target:w.node('#deck-form')});
  assert.deepEqual(read(w).decks,[d]);assert.match(w.node('#deck-form-error').textContent,/save|storage/i);
});

test('exact-id price refresh rejects mismatched rules identities',async()=>{
  const d=editorDeck();d.cards.forEach(e=>e.card.prices={eur:'1.00'});
  const w=workspace({savedDecks:JSON.stringify([d])});
  w.context.fetch=async()=>({ok:true,json:async()=>({data:d.cards.map(e=>({...e.card,oracle_id:'unrelated',prices:{eur:'0.01'}}))})});
  await vm.runInContext('refreshPrices(decks[0])',w.context);
  assert.deepEqual(read(w).decks,[d]);assert.match(vm.runInContext('priceStates.get(decks[0]).error',w.context),/identity/);
});

test('legality and price refresh keep saved card facts when persistence fails',async()=>{
  for(const path of ['prices','legality']){
    const d=editorDeck(),w=workspace({savedDecks:JSON.stringify([d])});
    w.context.fetch=async()=>({ok:true,json:async()=>({data:d.cards.map(e=>({...e.card,prices:{eur:'0.01'},legalities:{commander:'banned'}}))})});
    w.context.localStorage.setItem=()=>{throw Error('Quota');};
    await vm.runInContext(path==='prices'?'refreshPrices(decks[0])':'refresh(decks[0])',w.context);
    assert.deepEqual(read(w).decks,[d]);
  }
});

test('fallback Collection lookup accepts omitted foil/etched finishes but rejects ambiguous identities across pages',async()=>{
  for(const mode of ['foil','etched','ambiguous']){
    const w=workspace();formValues(w,{list:'Quantity,Name\n2,Exact'});
    const first={...editorCard('Exact'),id:'first',finishes:[mode==='etched'?'etched':'foil']};
    w.context.fetch=async url=>({ok:true,json:async()=>url==='/api/collection'?{data:[]}:{data:[url.includes('page=2')?{...first,id:'second',oracle_id:'other'}:first],has_more:mode==='ambiguous'&&!url.includes('page=2')}});
    vm.runInContext('collectionImport()',w.context);const submit=w.node('#collection-import').onsubmit;await submit(event);
    if(mode==='ambiguous'){
      assert.equal(w.writes.length,0);assert.match(w.node('#collection-upload-review').innerHTML,/Card name · 1/);
    }else{
      await submit(event);assert.equal(read(w).collection[0]?.finish,mode);
    }
  }
});

test('deck import batches 151 names and preserves double-faced identity, finish and zones through reload',async()=>{
  const d=editorDeck(),w=workspace({savedDecks:JSON.stringify([d])});
  const double={...editorCard('Dawn, Keeper // Dusk, Watcher'),finishes:['etched'],card_faces:[{name:'Dawn, Keeper',type_line:'Creature'},{name:'Dusk, Watcher',type_line:'Creature'}]};
  const names=[double.name,...Array.from({length:150},(_,i)=>'Import '+i)];
  formValues(w,{list:'Sideboard\n'+names.map(name=>'1 '+name).join('\n')});
  const requests=[];
  w.context.fetch=async(_url,options)=>{const batch=JSON.parse(options.body).names;requests.push(batch.length);return {ok:true,json:async()=>({data:batch.map(name=>name===double.name?double:editorCard(name)),not_found:[]})};};
  vm.runInContext('importDialog(decks[0])',w.context);const submit=w.node('#import-form').onsubmit;await submit(event);
  assert.deepEqual(requests,[75,75,1]);assert.deepEqual(read(w).decks,[d]);
  await submit(event);
  const saved=w.writes.findLast(([key])=>key==='arcana.workspace.v2')[1],reloaded=workspace({savedWorkspace:saved});
  assert.deepEqual(read(reloaded),read(w));
  const added=read(w).decks[0].cards.find(e=>e.card.name===double.name);
  assert.equal(added.zone,'sideboard');assert.equal(added.finish,'etched');assert.deepEqual(added.card,double);
});

test('partial deck lookup, ambiguity, cancellation and stale lists never apply staged cards',async()=>{
  for(const mode of ['partial','ambiguous','cancel','changed']){
    const d=editorDeck(),w=workspace({savedDecks:JSON.stringify([d])});
    formValues(w,{list:'2 Exact'});
    w.context.fetch=async()=>{
      if(mode==='cancel')w.node('#dialog').open=false;
      if(mode==='changed')w.node('#import-form').oninput();
      return {ok:true,json:async()=>({data:mode==='partial'?[]:mode==='ambiguous'?[editorCard('Exact'),{...editorCard('Exact'),id:'other',oracle_id:'other'}]:[editorCard('Exact')],not_found:[]})};
    };
    vm.runInContext('importDialog(decks[0])',w.context);await w.node('#import-form').onsubmit(event);
    assert.deepEqual(read(w).decks,[d]);assert.equal(w.writes.length,0);
    assert.notEqual(w.node('#import-form').querySelector('button').textContent,'Import reviewed cards');
  }
});

test('omitted-finish fallback cannot satisfy a later explicit unsupported nonfoil request',async()=>{
  const w=workspace();formValues(w,{list:'Quantity,Name,Finish\n2,Exact,\n3,Exact,Normal'});
  w.context.fetch=async url=>({ok:true,json:async()=>url==='/api/collection'?{data:[]}:{data:[{...editorCard('Exact'),finishes:['foil']}],has_more:false}});
  vm.runInContext('collectionImport()',w.context);await w.node('#collection-import').onsubmit(event);
  assert.equal(w.writes.length,0);assert.match(w.node('#collection-upload-review').innerHTML,/Finish · 1/);
  assert.match(w.node('#collection-upload-review').innerHTML,/2 copies ready/);
});

test('failed later printing pages retain the upload and retry without repeating completed pages',async()=>{
  const w=workspace();formValues(w,{list:'Quantity,Name\n2,Exact'});const pages=[];let fail=true;
  const card={...editorCard('Exact'),finishes:['foil']};
  w.context.fetch=async url=>{
    if(url==='/api/collection')return {ok:true,json:async()=>({data:[]})};
    const page=Number(new URL(url,'http://localhost').searchParams.get('page'));pages.push(page);
    if(page===2&&fail)return {ok:false,status:404,json:async()=>({error:'No cards found.'})};
    return {ok:true,json:async()=>({data:page===1?[card]:[{...card,id:'regular',finishes:['nonfoil']}],has_more:page===1})};
  };
  vm.runInContext('collectionImport()',w.context);const submit=w.node('#collection-import').onsubmit;await submit(event);
  assert.match(w.node('#collection-import-error').textContent,/before all pages/);assert.equal(w.writes.length,0);
  fail=false;await submit(event);await submit(event);
  assert.deepEqual(pages,[1,2,2]);assert.equal(read(w).collection[0].card.id,'regular');assert.equal(read(w).collection[0].finish,'regular');
});
