import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { addDeckCopies, copyEntryToDeck, deckCardCopies, deckPrintingPrice, entryKey, exportDeckText, moveEntry, readWorkspaceFile, setEntryPrinting, workspaceFile } from '../public/core.js';
import { editorDeck, workspace } from '../test-support/workspace.mjs';

const tick = () => new Promise(resolve=>setImmediate(resolve));
const finishCard = card=>({...card,finishes:['nonfoil','foil'],prices:{usd:'1.25',usd_foil:'5.00'}});

test('text rows show stored edition metadata without requiring an explicit finish, including legacy and double-faced cards',()=>{
  const deck=editorDeck(),entry=deck.cards[1];
  entry.card={...finishCard(entry.card),set:'tst',set_name:'Test release',collector_number:'42'};
  const w=workspace({savedDecks:JSON.stringify([deck])});
  vm.runInContext("openDeck('editor');editorOptions.layout='text-horizontal'",w.context);
  let html=vm.runInContext('deckEntry(decks[0].cards[1],false)',w.context);
  assert.match(html,/class="deck-card-variant">TST · #42<\/small>/);
  assert.match(html,/Test release.*Nonfoil/);
  assert.doesNotMatch(html,/>[^<]*regular[^<]*</);
  vm.runInContext("decks[0].cards[1].card.card_faces=[{type_line:'Creature',mana_cost:'{G}'},{type_line:'Land'}];decks[0].cards[1].finish='foil'",w.context);
  html=vm.runInContext('deckEntry(decks[0].cards[1],false)',w.context);
  assert.match(html,/TST · #42 · Foil/);
  vm.runInContext('delete decks[0].cards[1].finish;delete decks[0].cards[1].card.finishes;delete decks[0].cards[1].card.set;delete decks[0].cards[1].card.set_name;delete decks[0].cards[1].card.collector_number',w.context);
  html=vm.runInContext('deckEntry(decks[0].cards[1],false)',w.context);
  assert.match(html,/Set unknown · Finish unknown/);
  assert.doesNotMatch(html,/TST|#42|Nonfoil/);
});

test('ordinary additions retain the resolved printing and default finish through JSON without rewriting old entries',()=>{
  for(const [finishes,finish] of [[['nonfoil','foil'],'regular'],[['foil'],'foil'],[['foil','etched'],'foil']]){
    const deck=editorDeck(),before=JSON.stringify(deck.cards);
    const card={...finishCard(deck.cards[1].card),id:'new-printing',oracle_id:'new-identity',finishes};
    const added=addDeckCopies(deck,card,1,'main');
    assert.equal(added.finish,finish);
    assert.equal(added.card.id,'new-printing');
    assert.equal(JSON.stringify(deck.cards.slice(0,2)),before);
    const restored=readWorkspaceFile(JSON.parse(JSON.stringify(workspaceFile([deck],[]))));
    assert.deepEqual(restored.decks[0].cards.at(-1),added);
  }
});

test('details open the exact row printing, expose stored legality and owned copies, and browse without mutating decks',async()=>{
  const d=editorDeck(), base=d.cards[1];
  base.card={...finishCard(base.card),set_name:'Stored release',lang:'ja',legalityUpdatedAt:'2026-11-10T08:00:00.000Z'};
  const other={...base.card,id:'other-printing',set_name:'Second release',legalityUpdatedAt:undefined,scryfall_uri:'https://scryfall.com/card/other'};
  const w=workspace({savedWorkspace:JSON.stringify(workspaceFile([d],[{card:base.card,finish:'regular',qty:3}]))});
  let calls=[];
  w.context.fetch=async url=>{calls.push(url);return {ok:true,json:async()=>({data:[other],has_more:false})};};
  vm.runInContext("results=[{...decks[0].cards[1].card,set_name:'Search release'}];inspect('Ramp spell',entryKey(decks[0].cards[1]))",w.context);
  await tick();
  assert.equal(calls.length,1);
  assert.match(calls[0],/\/api\/printings\?.*page=1/);
  assert.match(w.node('#detail-facts').innerHTML,/Stored release/);
  assert.match(w.node('#detail-facts').innerHTML,/2026-11-10/);
  assert.doesNotMatch(w.node('#detail-facts').innerHTML,/Mana value|Language| · JA/);
  assert.match(w.node('#detail-ownership').textContent,/3 copies owned/);
  w.node('#view-printing').value=other.id;
  w.node('#view-printing').onchange();
  assert.match(w.node('#detail-facts').innerHTML,/Second release/);
  assert.doesNotMatch(w.node('#detail-facts').innerHTML,/Last updated/);
  assert.match(w.node('#detail-scryfall').innerHTML,/View this printing on Scryfall/);
  assert.match(w.node('#detail-ownership').textContent,/No copies owned/);
  assert.equal(w.writes.length,0);
});

test('automatic printing lookup supports retry and pagination; detached dialog ignores late results',async()=>{
  const d=editorDeck(),w=workspace({savedDecks:JSON.stringify([d])});
  const other={...d.cards[1].card,id:'alternate'};
  w.context.fetch=async()=>{throw Error('Temporarily unavailable');};
  vm.runInContext("inspect('Ramp spell')",w.context);
  await tick();
  assert.match(w.node('#load-printings').textContent,/Retry/);
  assert.match(w.node('#printing-status').textContent,/Temporarily unavailable/);
  w.context.fetch=async url=>({ok:true,json:async()=>({data:[other],has_more:url.includes('page=1')})});
  await w.node('#load-printings').onclick();
  assert.match(w.node('#view-printing').innerHTML,/alternate/);
  assert.equal(w.node('#load-printings').hidden,false);
  let complete;
  w.context.fetch=()=>new Promise(resolve=>{complete=resolve;});
  const pending=w.node('#load-printings').onclick();
  w.node('#view-printing').isConnected=false;
  complete({ok:true,json:async()=>({data:[{...other,id:'late'}],has_more:false})});
  await pending;
  assert.doesNotMatch(w.node('#view-printing').innerHTML,/late/);
  assert.equal(w.writes.length,0);
});

test('add form is staged; existing copies span zones and the chosen finish has its own price and entry',()=>{
  const d=editorDeck(),base=d.cards[1];
  d.currency='USD';
  base.card=finishCard(base.card);
  d.cards.push({...base,qty:1,zone:'maybeboard'});
  const w=workspace({savedDecks:JSON.stringify([d])});
  w.node('#add-destination').value='editor';
  vm.runInContext("openDeck('editor');inspect('Ramp spell',entryKey(current().cards[1]))",w.context);
  w.node('#detail-add').onclick();
  assert.match(w.node('#dialog').innerHTML,/value="editor" selected/);
  assert.match(w.node('#add-existing').textContent,/across all zones and printings: 3/);
  w.node('#deck-card-finish').value='foil';
  w.node('#deck-card-finish').onchange();
  assert.match(w.node('#deck-card-price').textContent,/\$5\.00/);
  w.node('#add-zone').value='main';
  w.node('#add-quantity').value='2';
  w.node('#add-primary').value='Draw';
  assert.equal(w.writes.length,0);
  w.node('#deck-card-form').onsubmit({preventDefault(){}});
  const entries=JSON.parse(vm.runInContext('JSON.stringify(current().cards.slice(1))',w.context));
  assert.deepEqual(entries.map(e=>[e.qty,e.zone,e.finish,e.tags]),[
    [2,'main',undefined,['Removal','Ramp']],
    [1,'maybeboard',undefined,['Removal','Ramp']],
    [2,'main','foil',['Draw']],
  ]);
});

test('printing dialog follows the selected destination deck currency without changing saved data',()=>{
  const dollar=editorDeck();dollar.currency='USD';
  dollar.cards[1].card.prices={usd:'5.00',eur:'2.00'};
  const euro={...structuredClone(dollar),id:'euro',name:'Euro deck',currency:'EUR'};
  const w=workspace({savedDecks:JSON.stringify([dollar,euro])});
  w.node('#add-destination').value='editor';
  vm.runInContext("openDeck('editor');deckCardDialog(current().cards[1].card,{deck:current()})",w.context);
  assert.match(w.node('#deck-card-price').textContent,/\$5\.00/);
  w.node('#add-destination').value='euro';w.node('#add-destination').onchange();
  assert.equal(w.node('#deck-card-price').textContent,w.context.money(200,'EUR')+' per copy');
  assert.equal(w.writes.length,0);
});

test('in-deck editor cancel preserves all data; save changes only the targeted variant',()=>{
  const d=editorDeck(),base=d.cards[1];
  base.card=finishCard(base.card);
  const w=workspace({savedDecks:JSON.stringify([d])});
  const open="openDeck('editor');const deck=current(),entry=deck.cards[1],key=entryKey(entry);deckCardDialog(entry.card,{zone:zoneFor(entry),edit:{deck,entry,key}})";
  vm.runInContext(open,w.context);
  w.node('#deck-card-finish').value='foil';
  w.node('#deck-card-cancel').onclick();
  assert.equal(w.writes.length,0);
  vm.runInContext("deckCardDialog(entry.card,{zone:zoneFor(entry),edit:{deck,entry,key}})",w.context);
  w.node('#deck-card-finish').value='foil';
  w.node('#deck-card-form').onsubmit({preventDefault(){}});
  const saved=JSON.parse(vm.runInContext('JSON.stringify(current())',w.context));
  assert.deepEqual(saved.cards,[d.cards[0],{...base,finish:'foil'}]);
});

test('variant quantities, copies, finishes and function data round-trip while limits and conflicts stay atomic',()=>{
  const deck=editorDeck(),legacy=deck.cards[1], card=legacy.card=finishCard(legacy.card);
  const other={...card,id:'reprint',set_name:'Reprint',prices:{usd:'0.50'}};
  addDeckCopies(deck,card,1,'main','regular','Draw');
  assert.deepEqual(legacy.tags,['Draw','Removal','Ramp']);
  const foil=addDeckCopies(deck,card,2,'main','foil');
  const reprint=addDeckCopies(deck,other,1,'sideboard','foil','Sideboard');
  moveEntry(deck,entryKey(reprint),'main');
  assert.equal(deck.cards.length,4);
  assert.equal(deckCardCopies(deck,card,'main'),6);
  assert.equal(deckPrintingPrice(reprint.card,reprint.finish).cents,null);
  const snapshot=structuredClone(deck);
  assert.throws(()=>addDeckCopies(deck,other,495,'main','regular'),/500/);
  assert.throws(()=>setEntryPrinting(deck,entryKey(foil),other,'etched'),/finish available/);
  assert.throws(()=>setEntryPrinting(deck,entryKey(foil),other,'foil'),/already has an entry/);
  assert.deepEqual(deck,snapshot);
  const updated=setEntryPrinting(deck,entryKey(foil),other,'regular');
  assert.equal(updated.qty,2);
  assert.equal(deckPrintingPrice(updated.card,updated.finish).cents,50);
  assert.deepEqual(readWorkspaceFile(JSON.parse(JSON.stringify(workspaceFile([deck],[])))).decks,[deck]);
  assert.match(exportDeckText(deck),/Main deck\n6 Ramp spell/);
});


test('adding and copying variants retain an Unassigned primary and hidden memberships',()=>{
  const source=editorDeck(),entry=source.cards[1];
  entry.card=finishCard(entry.card);
  entry.tags=['','Legacy secondary'];
  addDeckCopies(source,entry.card,1,'main','regular');
  assert.deepEqual(entry.tags,['','Legacy secondary']);
  const target={...editorDeck(),id:'target',cards:[]};
  copyEntryToDeck(source,entryKey(entry),target,1,'main',{finish:'foil',primary:''});
  assert.deepEqual(target.cards[0].tags,['','Legacy secondary']);
  addDeckCopies(target,entry.card,1,'main','foil','Draw');
  assert.deepEqual(target.cards[0].tags,['Draw','Legacy secondary']);
});
