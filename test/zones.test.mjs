import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zoneFor, zoneCount, entryKey, moveEntry, editEntry, setEntryPrinting, stats, legalityReport, validateBackup, exportDeckText, parseImport } from '../public/core.js';

const card = (name, extra={}) => ({id:name,oracle_id:name,name,type_line:'Creature',cmc:1,colors:['G'],color_identity:['G'],oracle_text:'',legalities:{modern:'legal',commander:'legal',vintage:'legal'},...extra});
const entry = (name,qty,zone='main',extra={}) => ({card:card(name),qty,zone,tags:[],...extra});
const modern = () => ({id:'example',name:'Mono green example',format:'modern',cards:[
  entry('Forest',24,'main',{card:card('Forest',{type_line:'Basic Land — Forest',cmc:0})}),
  ...['Llanowar Elves','Elvish Mystic','Grizzly Bears','Rancor','Giant Growth','Naturalize','Rampant Growth','Cultivate','Garruk’s Companion'].map(name=>entry(name,4)),
  entry('Island',15,'sideboard',{card:card('Island',{type_line:'Basic Land — Island',cmc:0,colors:[],color_identity:['U']})}),
]});

test('complete 60 + 15 Modern example passes supported rules and statistics exclude sideboard',()=>{
  const d=modern(), report=legalityReport(d);
  assert.equal(zoneCount(d,'main'),60); assert.equal(zoneCount(d,'sideboard'),15);
  assert.deepEqual(report,{failed:[],unavailable:[],manual:[]});
  assert.equal(stats(d).total,60);assert.equal(stats(d).lands,24);assert.equal(stats(d).colors.U,0);
  d.cards[0].qty=59;d.cards=d.cards.filter(e=>e.card.name==='Forest'||e.zone==='sideboard');
  assert.match(legalityReport(d).failed.join(' '),/59\/60/);
});

test('sideboard size, combined English-name copy limits and sideboard legality are checked',()=>{
  const d=modern();d.cards.push(entry('Llanowar Elves',1,'sideboard',{card:card('Llanowar Elves',{id:'other-print',oracle_id:'different-id',legalities:{modern:'banned'}})}));
  const messages=legalityReport(d).failed.join(' ');
  assert.match(messages,/maximum 15/);assert.match(messages,/maximum 4 copies across main deck and sideboard/);assert.match(messages,/Sideboard.*banned/);
  d.cards.push(entry('Commander',1,'command'));assert.match(legalityReport(d).failed.join(' '),/no command zone/);
  const isolated=modern();isolated.cards.push(entry('Llanowar Elves',1,'command'));
  assert.deepEqual(legalityReport(isolated).failed,['This constructed format has no command zone. Move those cards to the main deck or sideboard.']);
});

test('restricted cards and explicit any-number/limited copy exceptions aggregate across zones',()=>{
  const d=modern();d.format='vintage';
  d.cards.push(entry('Restricted',1,'main',{card:card('Restricted',{legalities:{vintage:'restricted'}})}),entry('Restricted',1,'sideboard',{card:card('Restricted',{legalities:{vintage:'restricted'}})}));
  assert.match(legalityReport(d).failed.join(' '),/restricted to one copy across zones/);
  const rats=card('Rat Colony',{oracle_text:'A deck can have any number of cards named Rat Colony.'});
  d.format='modern';d.cards=[entry('Rat Colony',60,'main',{card:rats}),entry('Rat Colony',15,'sideboard',{card:rats})];
  assert.deepEqual(legalityReport(d).failed,[]);
  const nazgul=card('Nazgûl',{oracle_text:'A deck can have up to nine cards named Nazgûl.'});
  d.cards.push(entry('Nazgûl',9,'main',{card:nazgul}),entry('Nazgûl',1,'sideboard',{card:nazgul}));
  assert.match(legalityReport(d).failed.join(' '),/maximum 9 copies/);
});

test('unknown data and companion rules are not mislabeled as confirmed violations',()=>{
  const d=modern();d.cards.push(entry('Missing',1,'sideboard',{card:card('Missing',{legalities:{},oracle_text:undefined,card_faces:[]})}));
  let report=legalityReport(d);assert.ok(report.unavailable.length);assert.doesNotMatch(report.failed.join(' '),/Missing/);
  d.cards=d.cards.filter(e=>e.card.name!=='Missing');d.cards[1].card.oracle_text='Companion — Your starting deck contains only cards with even mana values.';
  report=legalityReport(d);assert.deepEqual(report.failed,[]);assert.match(report.manual.join(' '),/companion designation/);
});

test('legacy commander mapping, main + command size and identity remain explicit and partial',()=>{
  const leader={card:card('Leader',{type_line:'Legendary Creature'}),qty:1,tags:['Leader'],commander:true};
  const land=entry('Forest',99,'main',{card:card('Forest',{type_line:'Basic Land — Forest',cmc:0})});
  const d={id:'old',name:'Legacy example',format:'commander',cards:[leader,land]};
  assert.equal(zoneFor(leader),'command');assert.equal(zoneCount(d,'command'),1);
  assert.deepEqual(legalityReport(d).failed,[]);assert.match(legalityReport(d).manual.join(' '),/coverage is partial/);
  d.cards.push(entry('Blue',1,'main',{card:card('Blue',{color_identity:['U']})}));
  assert.match(legalityReport(d).failed.join(' '),/outside your commander/);
  assert.equal(validateBackup([d])[0].cards[0].commander,true);
});

test('zone moves merge roles/quantities atomically; overflow never deletes cards',()=>{
  const d={cards:[entry('A',4,'main',{tags:['Ramp']}),entry('A',2,'sideboard',{tags:['Value']})]};
  moveEntry(d,entryKey(d.cards[0]),'sideboard');
  assert.equal(d.cards.length,1);assert.equal(d.cards[0].qty,6);assert.deepEqual(d.cards[0].tags,['Value','Ramp']);
  d.cards.push(entry('A',500,'main'));const before=structuredClone(d);
  assert.throws(()=>moveEntry(d,entryKey(d.cards[0]),'main'));assert.deepEqual(d,before);
  assert.throws(()=>moveEntry(d,entryKey(d.cards[0]),'__proto__'));assert.deepEqual(d,before);
});

test('JSON backups allow cross-zone identities but reject same-zone duplicates and invalid zones',()=>{
  const d=modern();d.cards.push(entry('Llanowar Elves',1,'sideboard',{tags:['Role']}));
  assert.equal(validateBackup([d])[0],d);
  const roundtrip=validateBackup(JSON.parse(JSON.stringify([d])))[0];assert.deepEqual(roundtrip,d);
  assert.throws(()=>validateBackup([{...d,cards:[...d.cards,entry('Llanowar Elves',1)]}]));
  for(const zone of ['elsewhere','__proto__',null,['main'],{zone:'main'}])assert.throws(()=>validateBackup([{...d,cards:[entry('A',1,zone)]}]));
});

test('zone headings round-trip quantities without merging the same name across zones',()=>{
  const d={cards:[entry('Sol Ring',1,'command'),entry('Forest',60),entry('Forest',15,'sideboard')]};
  assert.deepEqual(parseImport(exportDeckText(d)),[
    {name:'Forest',qty:60,zone:'main'},{name:'Forest',qty:15,zone:'sideboard'},{name:'Sol Ring',qty:1,zone:'command'},
  ]);
  assert.throws(()=>parseImport('Sideboard\nnot a card line'));
});


test('validated detail edits and printing changes preserve rules identity and data through JSON round trips',()=>{
  const d={id:'details',name:'Details',format:'modern',cards:[entry('Card',2),entry('Card',3,'sideboard')]};
  d.cards[0].tags=['Old'];d.cards[1].tags=['Destination'];
  const key=entryKey(d.cards[0]);
  const before=structuredClone(d);assert.throws(()=>editEntry(d,key,'x'.repeat(81),'sideboard'));assert.deepEqual(d,before);
  const moved=editEntry(d,key,'New, New','sideboard');assert.equal(moved.qty,5);assert.deepEqual(moved.tags,['Destination','New']);
  const valid={...moved.card,id:'new-print',set_name:'New set',collector_number:'12'};
  setEntryPrinting(d,entryKey(moved),valid);assert.equal(d.cards.length,1);assert.equal(moved.card.id,'new-print');assert.equal(moved.qty,5);
  const saved=structuredClone(d);assert.throws(()=>setEntryPrinting(d,entryKey(moved),{...valid,oracle_id:'other'}));assert.deepEqual(d,saved);
  assert.throws(()=>setEntryPrinting(d,entryKey(moved),{...valid,cmc:'invalid'}));assert.deepEqual(d,saved);
  assert.deepEqual(validateBackup(JSON.parse(JSON.stringify([d]))),[d]);
  assert.doesNotMatch(exportDeckText(d),/new-print|New set/);
});


test('same-identity reversible printings normalize face rules while retaining both artwork faces',()=>{
  const d={id:'reversible',name:'Reversible',format:'modern',cards:[entry('Sol Ring',1)]};
  const original=d.cards[0].card;
  const face={name:'Sol Ring',oracle_id:original.oracle_id,type_line:'Artifact',cmc:1,oracle_text:'Add mana.',image_uris:{normal:'https://cards.scryfall.io/front.jpg'}};
  const printing={id:'reversible',layout:'reversible_card',name:'Sol Ring // Sol Ring',cmc:null,type_line:null,color_identity:[],card_faces:[face,{...face,image_uris:{normal:'https://cards.scryfall.io/back.jpg'}}]};
  setEntryPrinting(d,entryKey(d.cards[0]),printing);
  assert.equal(d.cards[0].card.oracle_id,original.oracle_id);assert.equal(d.cards[0].card.type_line,'Artifact');assert.equal(d.cards[0].card.card_faces.length,2);
  assert.doesNotThrow(()=>validateBackup([d]));
  assert.throws(()=>setEntryPrinting(d,entryKey(d.cards[0]),{...printing,card_faces:[face,{...face,oracle_id:'other'}]}));
});
