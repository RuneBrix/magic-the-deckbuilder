import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { TAG_CATALOG, TAGS, tagById, findTags, resolveTag, queryFor } from '../public/core.js';
import { buildTagCatalog } from '../scripts/update-tags.mjs';
import { addDeckCopies, assignEntryFunction, broadFunctionTags, copyEntryToDeck, entryKey, functionMemberships, renameFunctionGroup, suggestedFunctions, unassignedFunctionSuggestions, primaryRole, stats, deckEntries, workspaceFile, readWorkspaceFile } from '../public/core.js';

test('bundled taxonomy has unique canonical tags and resolvable relationships', () => {
  assert.ok(TAG_CATALOG.tags.length > 1000);
  assert.equal(tagById.size, TAG_CATALOG.tags.length);
  assert.equal(new Set(TAG_CATALOG.tags.map(t => t.uuid)).size, TAG_CATALOG.tags.length);
  assert.ok(Number.isFinite(Date.parse(TAG_CATALOG.updated)));
  for (const t of TAG_CATALOG.tags) {
    assert.match(t.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(Number.isSafeInteger(t.cardCount) && t.cardCount >= 0, `${t.id}: ${t.cardCount}`);
    for (const id of [...t.parents, ...t.children]) assert.ok(tagById.has(id), `${t.id}: ${id}`);
  }
  for (const [id] of TAGS) assert.ok(tagById.has(id), `Starting point ${id} exists`);
  assert.ok(tagById.get('sweeper').parents.includes('removal'));
  assert.ok(tagById.get('removal').children.includes('sweeper'));
  assert.ok(tagById.get('ramp').cardCount > 0);
  assert.ok(TAG_CATALOG.tags.some(tag => tag.cardCount === 0));
});

test('discovery searches aliases, names and curated labels with exact matches first', () => {
  assert.equal(findTags('  BLINK ')[0].id, 'flicker');
  assert.equal(findTags('mana rock')[0].id, 'mana-rock');
  assert.equal(findTags('Card draw')[0].id, 'draw');
  assert.equal(findTags('Board wipes')[0].id, 'sweeper');
  assert.equal(resolveTag('resurrect').id, 'reanimate');
  assert.equal(resolveTag('unknown-arcana-tag'), undefined);
  assert.deepEqual(findTags('unknown-arcana-tag'), []);
});

test('taxonomy discovery preserves explicit all/any and custom query terms', () => {
  const f = { raw: 'usd<5', name: '', oracle: '', type: '', mv: '', cost: '', colors: [], tags: ['mana-rock','unknown-arcana-tag'], match: 'all' };
  assert.equal(queryFor(f), 'usd<5 (otag:mana-rock otag:unknown-arcana-tag)');
  f.match = 'any';
  assert.equal(queryFor(f), 'usd<5 (otag:mana-rock OR otag:unknown-arcana-tag)');
});

test('the offline snapshot retains distinct, valid direct memberships for every recorded card', () => {
  assert.ok(Object.keys(TAG_CATALOG.memberships).length>30000);
  for(const [id,indexes] of Object.entries(TAG_CATALOG.memberships)) {
    assert.match(id,/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/);
    assert.equal(new Set(indexes).size,indexes.length);
    assert.ok(indexes.every(index=>Number.isInteger(index) && TAG_CATALOG.tags[index]));
  }
});

test('catalog conversion keeps all memberships, stable sorted indexes and rejects incomplete updates', () => {
  const oracle_id='00000000-0000-4000-8000-000000000001';
  const rows=[
    {id:'z',slug:'zebra',type:'oracle',parent_ids:['a'],taggings:[{oracle_id},{oracle_id}]},
    {id:'a',slug:'answer',type:'oracle',child_ids:['z'],taggings:[]},
    {id:'b',slug:'bird',type:'oracle',taggings:[{oracle_id}]},
  ];
  const bulk={updated_at:'2026-11-11T10:00:00Z'};
  const catalog=buildTagCatalog(rows,bulk);
  assert.deepEqual(catalog.memberships,{[oracle_id]:[1,2]});
  assert.deepEqual(catalog.tags.map(t=>[t.id,t.cardCount]),[['answer',0],['bird',1],['zebra',1]]);
  assert.deepEqual(buildTagCatalog([...rows].reverse(),bulk),catalog);
  assert.throws(()=>buildTagCatalog([{...rows[0],taggings:undefined}],bulk),/taggings/);
  assert.throws(()=>buildTagCatalog([{...rows[1],taggings:[{oracle_id:'invalid'}]}],bulk),/taggings/);
  assert.throws(()=>buildTagCatalog([rows[0]],bulk),/Missing relationship/);
  assert.throws(()=>buildTagCatalog(rows,{updated_at:'invalid'}),/Invalid tag catalog/);
});

const beast={id:'beast-printing',oracle_id:'7735eeba-693b-47e2-bd51-414379cf1016',name:'Beast Within',type_line:'Instant',cmc:3,color_identity:['G'],colors:['G']};
const karona=JSON.parse(await readFile(new URL('./fixtures/karona-functions.json',import.meta.url),'utf8')).cards;
test('broad functions rank recorded roots, deduplicate paths, and handle missing parents and cycles', () => {
  const tags = new Map(Object.entries({
    child:['middle','branch','root-b'], middle:['root-a'], branch:['root-a'], sibling:['root-b'],
    extra:['root-b'], ramp:[],
    'root-a':[], 'root-b':[], orphan:['missing'],
    'closed-a':['closed-b'], 'closed-b':['closed-a'],
    'open-a':['open-b'], 'open-b':['open-a','root-a'],
    'cycle-child':['cycle'], cycle:[],
    'counterspell-child':['counterspell'], counterspell:['blue-effect'], 'blue-effect':[],
  }).map(([id,parents])=>[id,{parents}]));
  assert.deepEqual(broadFunctionTags(['child'],tags),['root-a','root-b']);
  assert.deepEqual(broadFunctionTags(['child','sibling','child'],tags),['root-b','root-a']);
  assert.deepEqual(broadFunctionTags(['ramp','child','sibling','extra'],tags),['root-b','ramp','root-a']);
  assert.deepEqual(broadFunctionTags(['sibling','middle'],tags),['root-a','root-b']);
  assert.deepEqual(broadFunctionTags(['orphan','root-a','unknown'],tags),['orphan','root-a']);
  assert.deepEqual(broadFunctionTags(['open-a'],tags),['root-a']);
  assert.deepEqual(broadFunctionTags(['closed-a'],tags),['closed-a']);
  assert.deepEqual(broadFunctionTags(['cycle-child','root-b'],tags),['root-b','cycle']);
  assert.deepEqual(broadFunctionTags(['counterspell-child','blue-effect'],tags),['counterspell','blue-effect']);
});

test('newly supported recorded families and root tags can initialize assignments', () => {
  const counter={oracle_id:'f31bb2b4-061c-4ba6-9f91-374f40fe6b05'};
  assert.equal(suggestedFunctions(counter)[0],'Counterspells');
  const wipe={oracle_id:'07876f4b-5370-4cd7-9f44-9878608195dd'};
  assert.deepEqual(functionMemberships(wipe).map(tag=>tag.id),['sweeper']);
  assert.deepEqual(suggestedFunctions(wipe),['Removal']);
  const evasion={oracle_id:'3e7707df-54e3-4307-9695-2de4e3edcf89'};
  assert.deepEqual(functionMemberships(evasion).map(tag=>tag.id),['evasion']);
  assert.deepEqual(suggestedFunctions(evasion),['Evasion']);
});

test('the ten reported Karona cards receive broad functions from their actual bundled memberships',()=>{
  assert.ok(karona.every(({card})=>functionMemberships(card).length>0));
  assert.deepEqual(karona.map(({card})=>[card.name,suggestedFunctions(card)[0] || 'Unassigned']),karona.map(({card,expectedFunction})=>[card.name,expectedFunction]));
  const deck={id:'karona',name:'Karona',format:'commander',cards:[]};
  for(const {card} of karona)addDeckCopies(deck,card,1,'main');
  assert.deepEqual(deck.cards.map(primaryRole),karona.map(row=>row.expectedFunction));
  assert.deepEqual({...stats(deck).tags},{'Untap':1,'Card advantage':2,'Combat control':3,Protection:2,Ramp:2});
  assert.deepEqual(readWorkspaceFile(JSON.parse(JSON.stringify(workspaceFile([deck],[])))).decks,[deck]);
});
test('ordinary lands default to Land while double-faced cards retain tag-based functions', () => {
  assert.deepEqual(suggestedFunctions({type_line:'Basic Land — Forest',layout:'normal'}),['Land']);
  assert.deepEqual(suggestedFunctions({type_line:'Artifact Land'}),['Land']);
  assert.equal(suggestedFunctions({...beast,type_line:'Land // Instant',layout:'modal_dfc',card_faces:[{type_line:'Land'},{type_line:'Instant'}]})[0],'Removal');
  assert.deepEqual(suggestedFunctions({type_line:'Land // Land',layout:'modal_dfc'}),[]);
  const deck={id:'lands',name:'Lands',format:'commander',cards:[]};
  const land={...beast,id:'forest',oracle_id:'forest',type_line:'Basic Land — Forest',finishes:['nonfoil','foil']};
  const entry=addDeckCopies(deck,land,1,'main');
  assert.equal(primaryRole(entry),'Land');
  assert.equal(entry.finish,'regular');
  assignEntryFunction(deck,entryKey(entry),'');
  addDeckCopies(deck,land,1,'main');
  assert.equal(primaryRole(entry),'Unassigned');
});
test('Beast Within receives Removal from actual memberships, independently of search context', () => {
  assert.ok(functionMemberships(beast).some(t=>t.id==='removal-permanent'));
  assert.equal(suggestedFunctions(beast)[0],'Removal');
  assert.deepEqual(suggestedFunctions({...beast,id:'reprint'}),suggestedFunctions(beast));
  assert.deepEqual(suggestedFunctions({name:'Beast Within'}),[]);
  assert.deepEqual(suggestedFunctions({oracle_id:'unknown'}),[]);
  assert.deepEqual(suggestedFunctions({oracle_id:'constructor'}),[]);
  assert.deepEqual(suggestedFunctions({oracle_id:42}),[]);
  const deck={id:'auto',name:'Automatic',format:'commander',cards:[]};
  const entry=addDeckCopies(deck,beast,2,'main');
  assert.equal(primaryRole(entry),'Removal');
  assert.equal(stats(deck).tags.Removal,2);
  assert.equal(deckEntries(deck,{role:'Removal'}).length,1);
  assert.deepEqual(readWorkspaceFile(JSON.parse(JSON.stringify(workspaceFile([deck],[])))).decks,[deck]);
});

test('later additions and deck copies preserve manual and legacy assignments', () => {
  const deck={id:'source',name:'Source',format:'commander',cards:[]};
  const entry=addDeckCopies(deck,beast,1,'main',undefined,'My answer');
  assignEntryFunction(deck,entryKey(entry),'Keep this');
  addDeckCopies(deck,beast,1,'main');
  assert.deepEqual(entry.tags,['Keep this','My answer','Removal']);
  assignEntryFunction(deck,entryKey(entry),'');
  addDeckCopies(deck,beast,1,'main');
  assert.equal(primaryRole(entry),'Unassigned');
  const target={...deck,id:'target',cards:[]};
  copyEntryToDeck(deck,entryKey(entry),target,1,'sideboard');
  assert.deepEqual(target.cards[0].tags,entry.tags);
  const legacy={...beast,id:'unknown-printing',oracle_id:'not-in-snapshot'};
  const unknown=addDeckCopies(deck,legacy,1,'main');
  assert.equal(primaryRole(unknown),'Unassigned');
  assignEntryFunction(deck,entryKey(unknown),'');
  assert.deepEqual(unknown.tags,['']);
  assert.equal(functionMemberships(beast).some(t=>t.id==='removal-permanent'),true);
  const older={card:beast,qty:1,zone:'main',tags:[]};
  const olderDeck={...deck,cards:[older]};
  addDeckCopies(olderDeck,beast,1,'main');
  assert.deepEqual(older.tags,[]);
  assert.deepEqual(unassignedFunctionSuggestions(olderDeck),[{key:entryKey(older),name:beast.name,primary:'Removal',zone:'main',qty:2}]);
});

test('renaming replaces only the scoped primary and keeps future Ramp defaults independent', () => {
  const [glimmer,back]=['Inquisitive Glimmer','Strong Back'].map(name=>karona.find(({card})=>card.name===name).card);
  const deck={id:'rename',name:'Garden',format:'commander',cards:[]};
  const main=addDeckCopies(deck,glimmer,2,'main');
  const alternate=addDeckCopies(deck,{...glimmer,id:'other-printing',finishes:['foil']},3,'main','foil');
  const side=addDeckCopies(deck,glimmer,4,'sideboard');
  const named=addDeckCopies(deck,beast,1,'main',undefined,'Interaction');
  main.tags.push('Draw','Mana rock','Untap');
  const before=structuredClone(deck);
  for (const invalid of ['', 'A,B', 'x'.repeat(81), ' unassigned ', 'LANDS', ' interaction ', 'Ramp']){
    assert.throws(()=>renameFunctionGroup(deck,'main','Ramp',invalid));
    assert.deepEqual(deck,before);
  }
  assert.throws(()=>renameFunctionGroup(deck,'main','Unassigned','New'));
  assert.throws(()=>renameFunctionGroup(deck,'command','Ramp','New'));
  assert.equal(renameFunctionGroup(structuredClone(deck),'main','Ramp','RAMP'),'RAMP');
  assert.equal(renameFunctionGroup(deck,'main','Ramp',' Mana rock '),'Mana rock');
  assert.deepEqual(main,{...before.cards[0],tags:['Mana rock','Draw','Untap']});
  assert.deepEqual(alternate,{...before.cards[1],tags:['Mana rock']});
  assert.deepEqual(side,before.cards[2]);
  assert.deepEqual(named,before.cards[3]);
  addDeckCopies(deck,glimmer,1,'main');
  assert.equal(primaryRole(main),'Mana rock');
  assert.equal(primaryRole(addDeckCopies(deck,back,1,'main')),'Ramp');
  assert.equal(stats(deck).tags['Mana rock'],6);
  assert.equal(stats(deck).tags.Ramp,1);
  assert.deepEqual(readWorkspaceFile(JSON.parse(JSON.stringify(workspaceFile([deck],[])))).decks,[deck]);
});
