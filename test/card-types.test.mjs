import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {category,isLand,deckEntries,stats} from '../public/core.js';
const fixture=JSON.parse(await readFile(new URL('./fixtures/card-types.json',import.meta.url),'utf8'));
const get=name=>fixture.cards.find(c=>c.name.startsWith(name));
const entry=card=>({card,qty:1,tags:[],zone:'main'});
test('type groups use the front of Battle, modal and adventure cards and retain established multitype priorities',()=>{
  const before=JSON.stringify(fixture);
  for(const [name,expected] of [['Invasion of Alara','Battle'],['Backup Plan','Conspiracy'],['Dryad Arbor','Land'],["Urza's Saga",'Land'],['Bonecrusher Giant','Creature'],['Bala Ged Recovery','Sorcery'],['Fire // Ice','Instant']])assert.equal(category(get(name)),expected,name);
  assert.equal(isLand(get('Bala Ged Recovery')),false);assert.equal(isLand(get('Dryad Arbor')),true);
  assert.equal(category({type_line:'Artifact Creature — Golem'}),'Creature');
  assert.equal(JSON.stringify(fixture),before);
});
test('deck filters and primary type statistics share front-face semantics without changing records',()=>{
  const deck={format:'modern',cards:fixture.cards.slice(0,7).map(entry)},before=JSON.stringify(deck);
  assert.equal(deckEntries(deck,{type:'Sorcery'}).length,1);
  assert.equal(deckEntries(deck,{search:'sorcery'}).length,1);
  assert.deepEqual(deckEntries(deck,{type:'Battle'}).map(e=>e.card.name),[get('Invasion of Alara').name]);
  const report=stats(deck);assert.equal(report.types.Battle,1);assert.equal(report.types.Conspiracy,1);assert.equal(report.lands,2);
  assert.equal(Object.values(report.types).reduce((a,b)=>a+b,0),report.total);
  assert.equal(JSON.stringify(deck),before);
});

test('all recognized card types are explicit and type names are not inferred from subtype substrings',()=>{
  for(const type of ['Artifact','Battle','Conspiracy','Creature','Dungeon','Enchantment','Instant','Kindred','Land','Phenomenon','Plane','Planeswalker','Scheme','Sorcery','Vanguard'])assert.equal(category({type_line:type}),type);
  assert.equal(category({type_line:'Tribal'}),'Kindred');assert.equal(category({type_line:'Unknown'}),'Other');
  assert.equal(category({type_line:'Legendary Enchantment — Landfall'}),'Enchantment');
  assert.equal(category({layout:'split',type_line:'Sorcery // Instant',card_faces:[{type_line:'Sorcery'},{type_line:'Instant'}]}),'Instant');
  assert.equal(category({layout:'transform',type_line:'Battle — Siege // Sorcery'}),'Battle');
});
