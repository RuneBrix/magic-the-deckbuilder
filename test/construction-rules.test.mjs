import { test } from 'node:test';
import assert from 'node:assert/strict';
import { legalityReport, setCompanion, entryKey, moveEntry, workspaceFile, readWorkspaceFile, validateBackup, copyEntryToDeck } from '../public/core.js';

const card = (name, extra={}) => ({id:name,oracle_id:name,name,type_line:'Legendary Creature — Beast',cmc:2,color_identity:['G'],oracle_text:'',mana_cost:'{1}{G}',legalities:{commander:'legal',modern:'legal'},...extra});
const entry = (c, qty=1, zone='main') => ({card:c,qty,zone,tags:['Private']});
const forest = qty => entry(card('Forest',{type_line:'Basic Land — Forest',cmc:0,mana_cost:'',color_identity:[]}),qty);
const commanderDeck = (...leaders) => ({id:'deck',name:'Construction fixture',format:'commander',cards:[...leaders.map(c=>entry(c,1,'command')),forest(100-leaders.length)]});
const failed = deck => legalityReport(deck).failed.join('\n');

test('complete paired Commander decks combine identities, exclude outside zones and round trip',()=>{
  const a=card('First',{oracle_text:'Partner'}),b=card('Second',{oracle_text:'Partner',color_identity:['U']});
  const d=commanderDeck(a,b);d.cards[2].qty--;
  d.cards.push(entry(card('Blue spell',{type_line:'Instant',color_identity:['U']})));
  d.cards.push(entry(card('Ignored',{color_identity:['R'],legalities:{commander:'banned'}}),1,'maybeboard'));
  assert.equal(failed(d),'');
  assert.deepEqual(readWorkspaceFile(JSON.parse(JSON.stringify(workspaceFile([d],[])))).decks,[d]);
  d.cards.at(-2).card.color_identity=['R'];assert.match(failed(d),/outside your commander's color identity \(First \+ Second\)/);
  b.oracle_text='Partner with First';assert.match(failed(d),/compatible supported partner/);
  assert.doesNotMatch(failed(d),/outside your commander/);
});

test('partner variants require matching labels or reciprocal names; Background and Doctor pairs obey their type limits',()=>{
  const cases=[
    [card('A',{oracle_text:'Partner with B (Reminder.)'}),card('B',{oracle_text:'Partner with A (Reminder.)'})],
    [card('A',{oracle_text:'Partner—Character select'}),card('B',{oracle_text:'Partner—Character select'})],
    [card('A',{oracle_text:'Friends forever'}),card('B',{oracle_text:'Partner—Friends forever'})],
    [card('A',{oracle_text:'Choose a Background'}),card('B',{type_line:'Legendary Enchantment — Background'})],
    [card('A',{oracle_text:"Doctor's companion"}),card('B',{type_line:'Legendary Creature — Time Lord Doctor'})],
  ];
  for(const [a,b] of cases){assert.equal(failed(commanderDeck(a,b)),'',a.oracle_text);b.type_line='Creature — Human';assert.match(failed(commanderDeck(a,b)),/compatible supported partner/);}
  const doctor=card('Doctor',{type_line:'Legendary Creature — Time Lord Doctor Human'});
  assert.match(failed(commanderDeck(card('Companion',{oracle_text:"Doctor's companion"}),doctor)),/compatible supported partner/);
  assert.match(failed(commanderDeck(card('A',{oracle_text:'Partner—Survivors'}),card('B',{oracle_text:'Partner—Father & son'}))),/compatible supported partner/);
  const three=commanderDeck(...['A','B','C'].map(name=>card(name,{oracle_text:'Partner'})));assert.match(failed(three),/at most two/);
});

test('eligibility includes legendary Vehicles, Spacecraft with stats and explicit exceptions, using front-face rules',()=>{
  for(const c of [card('Vehicle',{type_line:'Legendary Artifact — Vehicle'}),card('Spacecraft',{type_line:'Legendary Artifact — Spacecraft',power:'4',toughness:'4'}),card('Walker',{type_line:'Legendary Planeswalker',oracle_text:'Walker can be your commander.'})])assert.equal(failed(commanderDeck(c)),'');
  assert.match(failed(commanderDeck(card('Rock',{type_line:'Artifact'}))),/not an eligible commander/);
  assert.match(legalityReport(commanderDeck(card('Ship',{type_line:'Legendary Artifact — Spacecraft'}))).unavailable.join(' '),/eligibility data unavailable/);
  const double=card('Front // Back',{type_line:'Creature // Legendary Creature',card_faces:[{type_line:'Creature',oracle_text:''},{type_line:'Legendary Creature',oracle_text:'Back can be your commander.'}]});
  assert.match(failed(commanderDeck(double)),/not an eligible commander/);
});

test('basic land types are checked even for colorless data and special identity choices remain manual',()=>{
  const d=commanderDeck(card('Leader'));d.cards[1].qty--;
  d.cards.push(entry(card('Dual',{type_line:'Land — Forest Island',color_identity:[],cmc:0,mana_cost:''})));
  assert.match(failed(d),/basic land type Island/);
  d.cards[0].card.oracle_text='Before the game begins, choose a color.';
  const report=legalityReport(d);assert.doesNotMatch(report.failed.join(' '),/basic land type|outside your commander/);assert.match(report.manual.join(' '),/pregame choice/);
  d.cards[0].card.oracle_text=undefined;assert.match(legalityReport(d).unavailable.join(' '),/Oracle text/);
});

const withCompanion=(name,main)=>{
  const d={id:'companion',name:'Companion fixture',format:'modern',cards:[forest(59),entry(main),entry(card(name,{keywords:['Companion'],oracle_text:'Companion — Starting deck condition.'}),1,'sideboard')]};
  setCompanion(d,entryKey(d.cards.at(-1)));return d;
};
test('supported companion predicates accept complete valid decks and identify invalid starting cards',()=>{
  const cases=[
    ['Gyruda, Doom of Depths',{cmc:2},{cmc:3}],
    ['Jegantha, the Wellspring',{mana_cost:'{1}{G}'},{mana_cost:'{G}{G}'}],
    ['Kaheera, the Orphanguard',{type_line:'Creature — Beast'},{type_line:'Creature — Human'}],
    ['Keruga, the Macrosage',{cmc:3},{cmc:2}],
    ['Lurrus of the Dream-Den',{cmc:2},{cmc:3}],
    ['Obosh, the Preypiercer',{cmc:3},{cmc:2}],
  ];
  for(const [name,good,bad] of cases){const d=withCompanion(name,card('Starting card',good));assert.equal(failed(d),'',name);d.cards[1].card={...d.cards[1].card,...bad};assert.match(failed(d),/starting-deck restriction/,name);}
  const umori=withCompanion('Umori, the Collector',card('Creature'));assert.equal(failed(umori),'');umori.cards[0].qty--;umori.cards.push(entry(card('Spell',{type_line:'Instant'})));assert.match(failed(umori),/do not share a card type/);
  const lutri=withCompanion('Lutri, the Spellchaser',card('Creature'));assert.equal(failed(lutri),'');lutri.cards[1].qty=2;assert.match(failed(lutri),/distinct names/);
  const yorion=withCompanion('Yorion, Sky Nomad',card('Creature'));assert.match(failed(yorion),/at least 20/);yorion.cards[0].qty+=20;assert.equal(failed(yorion),'');
});

test('designation is explicit, changeable and versioned; moves/removal/copies do not leave dangling designations',()=>{
  const d=withCompanion('Gyruda, Doom of Depths',card('Creature'));
  d.cards.push(entry(card('Keruga, the Macrosage',{keywords:['Companion']}),1,'sideboard'));
  const original=structuredClone(d.cards);setCompanion(d,entryKey(d.cards.at(-1)));
  assert.equal(d.cards[2].companion,undefined);assert.equal(d.cards[3].companion,true);
  assert.deepEqual(d.cards.map(e=>e.qty),original.map(e=>e.qty));
  for(const file of [workspaceFile([d],[]),workspaceFile([d]),[d]])assert.equal(readWorkspaceFile(JSON.parse(JSON.stringify(file))).decks[0].cards[3].companion,true);
  const other={...d,id:'other',cards:[]};copyEntryToDeck(d,entryKey(d.cards[3]),other,1,'sideboard');assert.equal(other.cards[0].companion,undefined);
  moveEntry(d,entryKey(d.cards[3]),'main');assert.equal(d.cards[3].companion,undefined);
  setCompanion(d,entryKey(d.cards[2]));setCompanion(d,null);assert.equal(d.cards.some(e=>e.companion),false);
  assert.throws(()=>setCompanion(d,entryKey(d.cards[0])));
  d.cards[0].companion=true;assert.throws(()=>validateBackup([d]),/Invalid companion/);
});

test('companion zone accounting includes commanders, legality, identity and constructed sideboard limits',()=>{
  const d=commanderDeck(card('Leader',{cmc:3}));const c=entry(card('Gyruda, Doom of Depths',{keywords:['Companion']}),1,'sideboard');d.cards.push(c);setCompanion(d,entryKey(c));
  assert.match(failed(d),/Leader: does not meet/);assert.doesNotMatch(failed(d),/100 cards/);
  d.cards[0].card.cmc=2;assert.equal(failed(d),'');
  c.card.color_identity=['U'];c.card.legalities.commander='banned';assert.match(failed(d),/outside your commander/);assert.match(failed(d),/banned/);
  const modern=withCompanion('Gyruda, Doom of Depths',card('Even'));
  modern.cards.push(...Array.from({length:14},(_,i)=>entry(card('Sideboard odd '+i,{cmc:3}),1,'sideboard')));assert.equal(failed(modern),'');modern.cards.at(-1).qty++;assert.match(failed(modern),/Sideboard has 16/);
});

test('unsupported predicates, special layouts and missing data never silently pass',()=>{
  const d=withCompanion('Zirda, the Dawnwaker',card('Creature'));assert.match(legalityReport(d).manual.join(' '),/predicate is unsupported/);
  d.cards[2].card.name='Gyruda, Doom of Depths';d.cards[1].card.card_faces=[{type_line:'Creature',cmc:2}];assert.match(legalityReport(d).manual.join(' '),/special card layout/);
  delete d.cards[1].card.card_faces;delete d.cards[1].card.oracle_text;assert.match(legalityReport(d).unavailable.join(' '),/data unavailable for Gyruda/);
  setCompanion(d,null);assert.doesNotMatch(legalityReport(d).failed.join(' '),/starting-deck restriction/);
});
