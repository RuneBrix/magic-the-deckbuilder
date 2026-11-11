import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TAG_CATALOG, TAGS, tagById, findTags, resolveTag, queryFor } from '../public/core.js';
import { buildTagCatalog } from '../scripts/update-tags.mjs';
import { addDeckCopies, assignEntryFunction, copyEntryToDeck, entryKey, functionMemberships, suggestedFunctions, primaryRole, stats, deckEntries, workspaceFile, readWorkspaceFile } from '../public/core.js';

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
    {id:'a',slug:'answer',type:'oracle',child_ids:['z'],taggings:[{oracle_id}]},
  ];
  const bulk={updated_at:'2026-11-11T10:00:00Z'};
  const catalog=buildTagCatalog(rows,bulk);
  assert.deepEqual(catalog.memberships,{[oracle_id]:[0,1]});
  assert.deepEqual(catalog.tags.map(t=>[t.id,t.cardCount]),[['answer',1],['zebra',1]]);
  assert.deepEqual(buildTagCatalog([...rows].reverse(),bulk),catalog);
  assert.throws(()=>buildTagCatalog([{...rows[0],taggings:undefined}],bulk),/taggings/);
  assert.throws(()=>buildTagCatalog([{...rows[1],taggings:[{oracle_id:'invalid'}]}],bulk),/taggings/);
  assert.throws(()=>buildTagCatalog([rows[0]],bulk),/Missing relationship/);
  assert.throws(()=>buildTagCatalog(rows,{updated_at:'invalid'}),/Invalid tag catalog/);
});

const beast={id:'beast-printing',oracle_id:'7735eeba-693b-47e2-bd51-414379cf1016',name:'Beast Within',type_line:'Instant',cmc:3,color_identity:['G'],colors:['G']};
test('Beast Within receives Removal from actual memberships, independently of search context', () => {
  assert.ok(functionMemberships(beast).some(t=>t.id==='removal-permanent'));
  assert.equal(suggestedFunctions(beast)[0],'Removal');
  assert.deepEqual(suggestedFunctions({...beast,id:'reprint'}),suggestedFunctions(beast));
  assert.deepEqual(suggestedFunctions({name:'Beast Within'}),[]);
  assert.deepEqual(suggestedFunctions({oracle_id:'unknown'}),[]);
  // A wipe can also be removal; the more specific function wins deterministically.
  const wipe=Object.keys(TAG_CATALOG.memberships).find(id=>{
    const functions=suggestedFunctions({oracle_id:id});
    return functions.includes('Board wipes') && functions.includes('Removal');
  });
  assert.ok(wipe);
  assert.equal(suggestedFunctions({oracle_id:wipe})[0],'Board wipes');
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
});
