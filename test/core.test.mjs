import { test } from 'node:test';
import assert from 'node:assert/strict';
import { queryFor, stats, legality, parseImport, exportDeckText, resolveImport, validateBackup, safeUrl, primaryRole, deckEntries, deckIdentity } from '../public/core.js';
const card=(name,type,cmc,identity=[],extra={})=>({id:name,oracle_id:name,name,type_line:type,cmc,color_identity:identity,colors:identity,oracle_text:'',legalities:{commander:'legal',modern:'legal',vintage:'legal'},...extra});
const entry=(c,qty=1,extra={})=>({card:c,qty,tags:[],...extra});

test('deck views filter every role and type, sort without mutation, and use command identity for Commander',()=>{
  const d={format:'commander',cards:[entry(card('Leader','Legendary Creature',4,['G']),1,{zone:'command'}),entry(card('B','Artifact Creature',2,['U']),3,{zone:'main',tags:['Draw','Ramp']}),entry(card('A','Sorcery',1,['R']),2,{zone:'main',tags:['Ramp']})]};
  const before=JSON.stringify(d);
  assert.equal(primaryRole(d.cards[1]),'Draw');
  assert.deepEqual(deckEntries(d,{role:'Ramp'}).map(e=>e.card.name),['A','B']);
  assert.deepEqual(deckEntries(d,{type:'Artifact'}).map(e=>e.card.name),['B']);
  assert.deepEqual(deckEntries(d,{order:'quantity'}).map(e=>e.qty),[3,2,1]);
  assert.deepEqual(deckEntries(d,{order:'mana'}).map(e=>e.card.cmc),[1,2,4]);
  assert.deepEqual(deckIdentity(d),['G']);assert.equal(JSON.stringify(d),before);
  assert.deepEqual(deckIdentity({...d,format:'modern'}),['U','R']);
  assert.deepEqual(validateBackup([{...d,id:'d',name:'Deck'}])[0].cards[1].tags,['Draw','Ramp']);
});
test('guided filters compose without losing advanced syntax',()=>{
  const f={raw:'usd<5',name:'A "name"',oracle:'draw a card',type:'instant',mv:'3',mvOp:'<=',cost:'{U}',colors:['U'],tags:['ramp','card-draw'],match:'any',legal:true};
  assert.equal(queryFor(f,{format:'modern'}),'usd<5 name:"A \\"name\\"" o:"draw a card" t:instant mv<=3 m:{U} id<=U (otag:ramp OR otag:card-draw) f:modern'.replaceAll('\\\\','\\'));
});
test('stats weight quantities and omit lands from average and curve',()=>{
  const s=stats({cards:[entry(card('Forest','Basic Land — Forest',0,['G']),10),entry(card('Spell','Creature',3,['G']),2,{tags:['Ramp']}),entry(card('Big','Artifact',9),1)]});
  assert.equal(s.total,13);assert.equal(s.lands,10);assert.equal(s.average,5);assert.equal(s.curve[3],2);assert.equal(s.curve[7],1);assert.equal(s.tags.Ramp,2);
});
test('Commander flags missing commander, duplicate copies, bans, size and identity',()=>{
  const c=card('Leader','Legendary Creature',3,['G']);
  const d={format:'commander',cards:[entry(c,1,{commander:true}),entry(card('Blue','Instant',1,['U']),2),entry(card('Banned','Artifact',0,[],{legalities:{commander:'banned'}}))]};
  const issues=legality(d).join(' ');assert.match(issues,/100 cards/);assert.match(issues,/outside/);assert.match(issues,/maximum 1/);assert.match(issues,/banned/);
  d.cards[0].commander=false;assert.match(legality(d).join(' '),/Choose a commander/);
});
test('basic lands and explicit copy exceptions work; restricted cards limited',()=>{
  const d={format:'vintage',cards:[entry(card('Forest','Basic Land — Forest',0,['G']),60),entry(card('Restricted','Artifact',1,[],{legalities:{vintage:'restricted'}}),2)]};
  assert.equal(legality(d).length,1);assert.match(legality(d)[0],/restricted/);
  d.cards=[entry(card('Rats','Creature',3,[],{oracle_text:'A deck can have any number of cards named Rats.'}),60)];assert.deepEqual(legality(d),[]);
});
test('imports combine duplicate names and reject malformed quantities',()=>{
  assert.deepEqual(parseImport('1 Sol Ring\n2x Forest\n3 forest'),[{name:'Sol Ring',qty:1},{name:'forest',qty:5}]);
  assert.throws(()=>parseImport('0 Sol Ring'));assert.throws(()=>parseImport('Commander'));assert.throws(()=>parseImport('501 Forest'));
});
test('backups reject duplicate identities and invalid quantities',()=>{
  const d={id:'deck',name:'Test',format:'modern',cards:[entry(card('A','Creature',2))]};assert.equal(validateBackup([d])[0],d);
  assert.throws(()=>validateBackup([{...d,cards:[entry(card('A','Creature',2),-1)]}]));assert.throws(()=>validateBackup([d,d]));
});
test('backup links only allow Scryfall HTTPS destinations',()=>{
  assert.equal(safeUrl('javascript:alert(1)'), '');
  assert.equal(safeUrl('https://scryfall.com.evil.example/card'), '');
  assert.equal(safeUrl('https://cards.scryfall.io/normal/a.jpg',true), 'https://cards.scryfall.io/normal/a.jpg');
  assert.equal(safeUrl('https://scryfall.com/card/a'), 'https://scryfall.com/card/a');
});


test('deck text matching requires every case-insensitive term across names, types, categories and all personal functions', () => {
  const d={cards:[entry(card('Elvish Mystic','Creature — Elf Druid',1),1,{tags:['Mana','Ramp']}),entry(card('Beast Within','Instant',3),2,{tags:['Removal']}),entry(card('Unknown','Artifact',2))]};
  const before=JSON.stringify(d);
  assert.deepEqual(deckEntries(d,{search:'  ELF  ramp '}).map(e=>e.card.name),['Elvish Mystic']);
  assert.deepEqual(deckEntries(d,{search:'beast removal'}).map(e=>e.card.name),['Beast Within']);
  assert.deepEqual(deckEntries(d,{search:'unassigned'}).map(e=>e.card.name),['Unknown']);
  assert.deepEqual(deckEntries(d,{search:'elf removal'}),[]);
  assert.equal(JSON.stringify(d),before);
});

test('deck numeric sorting uses stored USD printings and numeric front-face characteristics; missing values stay last in either direction', () => {
  const d={cards:[
    entry(card('Missing','Creature',0,[],{prices:{usd:null,usd_foil:'0.01'},power:'*',toughness:'1+*'})),
    entry(card('Higher','Creature',3,[],{prices:{usd:'5.00'},power:'4',toughness:'-1'})),
    entry(card('Lower','Creature',1,[],{prices:{usd:'0.50'},power:'-2',toughness:'5'})),
    entry(card('Face','Creature',2,[],{prices:{usd:'0.50'},card_faces:[{power:'2',toughness:'3'}]})),
    entry(card('Invalid','Creature',2,[],{prices:{usd:''},power:'1d4',toughness:'∞'})),
  ]};
  const before=JSON.stringify(d),names=order=>deckEntries(d,{order}).map(e=>e.card.name);
  assert.deepEqual(names('price'),['Face','Lower','Higher','Invalid','Missing']);
  assert.deepEqual(names('price-desc'),['Higher','Face','Lower','Invalid','Missing']);
  assert.deepEqual(names('power'),['Lower','Face','Higher','Invalid','Missing']);
  assert.deepEqual(names('power-desc'),['Higher','Face','Lower','Invalid','Missing']);
  assert.deepEqual(names('toughness'),['Higher','Face','Lower','Invalid','Missing']);
  assert.deepEqual(names('toughness-desc'),['Lower','Face','Higher','Invalid','Missing']);
  assert.deepEqual(deckEntries(d,{search:'creature',order:'price-desc'}).map(e=>e.card.name),names('price-desc'));
  assert.equal(JSON.stringify(d),before);
});


test('Archidekt generic headers preserve zones, and import resolution reports missing/ambiguous names',()=>{
  const parsed=parseImport('Commander\n1 Leader\n\nMainboard\n2x Forest\n3 forest\nSideboard\n1 Shared\nMaybeboard\n1 Missing');
  assert.deepEqual(parsed.map(x=>[x.qty,x.zone]),[[1,'command'],[5,'main'],[1,'sideboard'],[1,'maybeboard']]);
  const leader=card('Leader','Creature',3),forest=card('Forest','Basic Land',0);
  const a=card('A // Shared','Creature',2,[],{card_faces:[{name:'Shared'}]});
  const b=card('B // Shared','Creature',2,[],{card_faces:[{name:'Shared'}]});
  const result=resolveImport(parsed,[leader,forest,a,b]);
  assert.deepEqual(result.problems,[{name:'Shared',reason:'Ambiguous name'},{name:'Missing',reason:'Not found'}]);
  assert.equal(result.entries.length,2);
  assert.equal(resolveImport([{name:'Shared',qty:1}],[a,{...a,id:'other-print'}]).problems.length,0);
});


test('Archidekt selected text mode round trips quantities and zones through Arcana export',()=>{
  const source='Commander\n1 Leader\nMainboard\n4 Forest (M21) 274\nSideboard\n1 Spell\nMaybeboard\n2 Idea';
  const parsed=parseImport(source), cards=parsed.map(x=>card(x.name,'Artifact',1));
  const {entries,problems}=resolveImport(parsed,cards);assert.deepEqual(problems,[]);
  const sorted=xs=>xs.toSorted((a,b)=>(a.zone+a.name).localeCompare(b.zone+b.name));
  assert.deepEqual(sorted(parseImport(exportDeckText({cards:entries}))),sorted(parsed));
});
