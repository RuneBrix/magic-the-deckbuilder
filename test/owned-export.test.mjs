import test from 'node:test';
import assert from 'node:assert/strict';
import { ownedPrintingPlan, exportDeckText, collectionReport, workspaceFile, readWorkspaceFile } from '../public/core.js';

const card=(id,extra={})=>({id,oracle_id:'rules',name:'Fire // Ice',type_line:'Instant',cmc:2,color_identity:['U','R'],finishes:['nonfoil','foil'],lang:'en',...extra});
const entry=(id,qty,zone='main',extra={})=>({card:card(id),qty,zone,tags:['Manual','Other'],finish:'regular',...extra});
const deck=cards=>({id:'test',name:'Owned test',format:'commander',cards});

test('owned printing matching splits quantities deterministically across zones, finishes and languages without changing inventory',()=>{
  const d=deck([entry('old',4),entry('old',2,'sideboard'),entry('old',5,'maybeboard')]);
  const inventory=[{card:card('b',{lang:'ja',finishes:['foil']}),qty:2,finish:'foil'},
    {card:card('a'),qty:1,finish:'regular',condition:'near_mint'},
    {card:card('a'),qty:2,finish:'regular',condition:'damaged'}];
  const before=JSON.stringify({d,inventory}),plan=ownedPrintingPlan(d,inventory);
  assert.equal(JSON.stringify({d,inventory}),before);
  assert.deepEqual(plan.deck.cards.map(e=>[e.card.id,e.qty,e.zone,e.finish,e.card.lang]),[
    ['a',3,'main','regular','en'],['b',1,'main','foil','ja'],['b',1,'sideboard','foil','ja'],['old',1,'sideboard','regular','en'],['old',5,'maybeboard','regular','en']]);
  assert.equal(plan.changed,5);assert.equal(plan.unmatched,1);
  assert.ok(plan.deck.cards.every(e=>e.tags.join('|')==='Manual|Other'));
  const restored=readWorkspaceFile(workspaceFile([plan.deck],inventory));
  assert.deepEqual(restored.decks[0],plan.deck);assert.deepEqual(restored.collection,inventory);
  plan.deck.cards[0].card.name='Changed independently';assert.equal(inventory[1].card.name,'Fire // Ice');
});

test('owned matching prefers an existing variant and preserves unmatched identities and unsupported finishes',()=>{
  const d=deck([entry('z',3),entry('no-identity',1,'command',{card:card('no-identity',{oracle_id:undefined})})]);
  const inventory=[{card:card('a'),qty:5,finish:'etched'},{card:card('b',{oracle_id:'different'}),qty:5,finish:'regular'},
    {card:card('z'),qty:1,finish:'regular'},{card:card('zz',{finishes:['etched']}),qty:1,finish:'etched'}];
  const plan=ownedPrintingPlan(d,inventory);
  assert.equal(plan.already,1);assert.equal(plan.changed,1);assert.equal(plan.unmatched,2);
  assert.deepEqual(plan.deck.cards.map(e=>[e.card.id,e.qty,e.finish]),[['z',2,'regular'],['zz',1,'etched'],['no-identity',1,'regular']]);
});

test('owned matching merges converging variants with ordered functions, latest legality and one companion designation',()=>{
  const d=deck([entry('old',1,'sideboard',{companion:true,card:card('old',{legalityUpdatedAt:'2026-11-18T00:00:00Z',legalities:{commander:'legal'}})}),
    entry('owned',1,'sideboard',{tags:['Second']})]);
  const plan=ownedPrintingPlan(d,[{card:card('owned'),qty:2,finish:'regular'}]);
  assert.equal(plan.deck.cards.length,1);assert.equal(plan.deck.cards[0].qty,2);
  assert.deepEqual(plan.deck.cards[0].tags,['Manual','Other','Second']);
  assert.equal(plan.deck.cards[0].companion,true);assert.equal(plan.deck.cards[0].card.legalities.commander,'legal');
  const split=ownedPrintingPlan(deck([entry('old',3,'sideboard',{companion:true})]),[{card:card('owned'),qty:1,finish:'regular'}]);
  assert.equal(split.deck.cards.filter(e=>e.companion).length,1);
});

test('owned matching validates reversible rules identities and never substitutes a same-name different identity',()=>{
  const reversible=card('reverse',{oracle_id:undefined,layout:'reversible_card',card_faces:[{oracle_id:'rules',name:'Fire // Ice',type_line:'Instant',cmc:2},{oracle_id:'rules',name:'Fire // Ice',type_line:'Instant',cmc:2}]});
  const plan=ownedPrintingPlan(deck([entry('old',2)]),[{card:reversible,qty:1,finish:'regular'},{card:card('wrong',{oracle_id:'other'}),qty:5,finish:'regular'}]);
  assert.equal(plan.changed,1);assert.equal(plan.unmatched,1);assert.equal(plan.deck.cards[0].card.oracle_id,'rules');
  const fromReversible=ownedPrintingPlan(deck([entry('reverse',1,'main',{card:reversible})]),[{card:card('normal'),qty:1,finish:'regular'}]);
  assert.equal(fromReversible.changed,1);assert.equal(fromReversible.deck.cards[0].card.id,'normal');
  const ambiguous={...reversible,card_faces:[{oracle_id:'rules'},{oracle_id:'other'}]};
  assert.equal(ownedPrintingPlan(deck([entry('old',1)]),[{card:ambiguous,qty:5,finish:'regular'}]).unmatched,1);
});

test('owned printing splits cannot bypass the deck entry limit or mutate the source on rejection',()=>{
  const d=deck([entry('old',2),...Array.from({length:999},(_,i)=>entry('unique-'+i,1,'main',{card:card('unique-'+i,{oracle_id:'unique-'+i})}))]);
  const before=JSON.stringify(d);
  assert.throws(()=>ownedPrintingPlan(d,[{card:card('owned'),qty:1,finish:'regular'}]),/Invalid deck backup/);
  assert.equal(JSON.stringify(d),before);
});

test('text export selects independent zones, headings and quantities while sharing ownership allocation',()=>{
  const d=deck([entry('old',3),entry('other',2,'command'),entry('old',2,'sideboard'),entry('old',1,'maybeboard')]);
  const inventory=[{card:card('owned'),qty:4,finish:'regular'}],before=JSON.stringify(d);
  assert.equal(exportDeckText(d), 'Main deck\n3 Fire // Ice\n\nSideboard\n2 Fire // Ice\n\nCommand zone\n2 Fire // Ice\n\nMaybeboard\n1 Fire // Ice');
  assert.equal(exportDeckText(d,{headings:false}), '8 Fire // Ice');
  assert.equal(exportDeckText(d,{headings:false,quantities:false}), 'Fire // Ice');
  assert.equal(exportDeckText(d,{zones:['sideboard','maybeboard'],quantities:false}), 'Sideboard\nFire // Ice\n\nMaybeboard\nFire // Ice');
  const zones=['main','command','sideboard','maybeboard'];
  assert.equal(collectionReport({...d,budgetZones:zones},inventory).missing,4);
  assert.equal(exportDeckText(d,{zones,missingOnly:true,collection:inventory}), 'Sideboard\n2 Fire // Ice\n\nCommand zone\n1 Fire // Ice\n\nMaybeboard\n1 Fire // Ice');
  assert.equal(exportDeckText(d,{zones:['sideboard'],missingOnly:true,collection:inventory}), '');
  assert.equal(exportDeckText({...d,ownershipMatch:'printing'},{headings:false,missingOnly:true,collection:inventory}), '8 Fire // Ice');
  assert.equal(exportDeckText(d,{zones:[]}), '');assert.equal(JSON.stringify(d),before);
  assert.deepEqual(readWorkspaceFile(workspaceFile([d],inventory)).decks[0],d);
});
