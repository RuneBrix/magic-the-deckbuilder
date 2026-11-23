import {test} from 'node:test';
import assert from 'node:assert/strict';
import {workspaceFile,readWorkspaceFile,compactStoredWorkspace,readStoredWorkspace,validateCollection,parseEuroCents,collectionReport} from '../public/core.js';

const deck={id:'d',name:'Portable',format:'commander',updated:'2026-11-01T12:00:00.000Z',bracket:3,cards:[{qty:2,tags:['Draw','Ramp'],zone:'maybeboard',card:{id:'print',oracle_id:'rules',name:'Example',type_line:'Creature',cmc:2,color_identity:['G'],card_faces:[{name:'Front',oracle_text:'Draw a card.',image_uris:{normal:'https://cards.scryfall.io/normal/front.jpg'}}],set:'tst',collector_number:'4'}}]};
test('versioned and legacy workspace files retain every stored field without mutation',()=>{
  const original=structuredClone(deck),json=JSON.stringify(workspaceFile([deck]));
  const file=JSON.parse(json);assert.equal(file.version,1);assert.equal(file.format,'arcana-workspace');
  assert.deepEqual(readWorkspaceFile(file),{decks:[original],collection:null});assert.deepEqual(readWorkspaceFile([deck]),{decks:[original],collection:null});assert.deepEqual(deck,original);
});
test('unsupported, malformed and partially invalid workspace files reject the entire file',()=>{
  const file=workspaceFile([deck]);
  for(const value of [null,{}, {...file,format:'other'}, {...file,version:3},{...file,version:'1'},{...file,exportedAt:null},{...file,decks:[deck,{...deck,id:'bad',cards:[{...deck.cards[0],qty:0}]}]}])assert.throws(()=>readWorkspaceFile(value));
  assert.throws(()=>readWorkspaceFile({...file,decks:[deck,deck]}));
  assert.deepEqual(readWorkspaceFile(workspaceFile([])),{decks:[],collection:null});
});

test('packed local storage preserves complete UTF-16 workspace data and reads old packing',()=>{
  const text='Æther 🐉 \n \t \u0000 \\ " '+String.fromCharCode(0xd800);
  const collection=Array.from({length:64},(_,i)=>({
    card:{...deck.cards[0].card,id:'lot-'+i,oracle_text:text.repeat(80)+i},qty:2,finish:'foil',
  }));
  const file=workspaceFile([deck],collection),plain=JSON.stringify(file),packed=compactStoredWorkspace(plain);
  assert.ok(packed.length<plain.length/2);
  assert.deepEqual(readStoredWorkspace(packed),readWorkspaceFile(file));
  const old='arcana-packed-v1\t'+JSON.stringify(['"arcana-workspace"'])+'\n'+plain.replace('"arcana-workspace"','\t0\t');
  assert.deepEqual(readStoredWorkspace(old),readWorkspaceFile(file));
  assert.throws(()=>readStoredWorkspace('arcana-packed-v2\t\u0000\u0001\u0005'),/Invalid compressed workspace/);
});

test('version 2 files preserve validated owned-card lots while older files leave collection unchanged',()=>{
  const lot={card:deck.cards[0].card,finish:'foil',condition:'lightly_played',qty:3};
  const file=workspaceFile([deck],[lot]);
  assert.equal(file.version,2);assert.deepEqual(readWorkspaceFile(file),{decks:[deck],collection:[lot]});
  for(const invalid of [[{...lot,qty:0}],[{...lot,finish:'glossy'}],[lot,{...lot}]])assert.throws(()=>validateCollection(invalid));
});

test('collection planning allocates deterministically and keeps unknown EUR prices explicit',()=>{
  const priced={...deck.cards[0].card,prices:{eur:'1.25'}},unknown={...priced,id:'other-print',prices:{eur:null}};
  const planned={...deck,ownershipMatch:'rules',cards:[
    {card:priced,qty:2,tags:[],zone:'main'},
    {card:unknown,qty:2,tags:[],zone:'sideboard'},
    {card:{...priced,id:'maybe'},qty:4,tags:[],zone:'maybeboard'},
  ]};
  const mixedInventory=[{card:{...priced,id:'owned-print'},finish:'regular',qty:2},{card:priced,finish:'foil',qty:1}];
  const report=collectionReport(planned,mixedInventory);
  assert.deepEqual(report.rows.map(row=>[row.zone,row.included,row.owned,row.missing]),[['main',true,2,0],['sideboard',true,1,1],['maybeboard',false,null,null]]);
  assert.deepEqual(report.rows.slice(0,2).map(row=>[row.exactOwned,row.otherOwned]),[[1,1],[0,1]]);
  const exact=collectionReport({...planned,ownershipMatch:'printing'},mixedInventory);
  assert.deepEqual(exact.rows.slice(0,2).map(row=>[row.owned,row.exactOwned,row.otherOwned,row.missing]),[[1,1,0,1],[0,0,0,2]]);
  assert.equal(report.demand,4);assert.equal(report.owned,3);assert.equal(report.missing,1);assert.equal(report.fullCents,250);assert.equal(report.fullUnpriced,2);assert.equal(report.missingUnpriced,1);
  const scoped={...planned,budgetZones:['sideboard','maybeboard']};
  const inventory=[{card:priced,finish:'regular',qty:3}];
  const adjusted=collectionReport(scoped,inventory);
  assert.deepEqual(adjusted.rows.map(row=>[row.zone,row.included,row.owned,row.missing]),[['main',false,null,null],['sideboard',true,2,0],['maybeboard',true,1,3]]);
  assert.equal(adjusted.demand,6);assert.equal(adjusted.owned,3);assert.equal(adjusted.missingCents,375);assert.equal(adjusted.fullUnpriced,2);assert.equal(adjusted.missingUnpriced,0);
  const empty=collectionReport({...scoped,budgetZones:[]},inventory);
  assert.equal(empty.demand,0);assert.equal(empty.rows.length,3);
  assert.deepEqual(readWorkspaceFile(workspaceFile([scoped],inventory)).decks,[scoped]);
  for(const budgetZones of [null,'main',['main','main'],['unknown'],['__proto__']])assert.throws(()=>workspaceFile([{...planned,budgetZones}]),/Invalid budget zones/);
  assert.equal(parseEuroCents('12.3'),1230);assert.equal(parseEuroCents('12,30'),1230);assert.equal(parseEuroCents('0.01'),1);assert.equal(parseEuroCents('12.345'),null);assert.equal(parseEuroCents(null),null);
});
