import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deckExport,parseCollectionImport,prepareCollectionUpload} from '../public/core.js';

test('Archidekt CSV reads quoted names, finish and condition and retains duplicate quantities',()=>{
  const rows=parseCollectionImport('\uFEFFQuantity,Name,Finish,Condition\r\n1,"Aang, Air Nomad",Normal,NM\r\n2,"Aang, Swift Savior // Aang and La, Ocean\'s Fury",Foil,LP\r\n1,Abyssal Specter,Normal,NM\r\n1,Abyssal Specter,Normal,NM');
  assert.equal(rows.length,4);assert.equal(rows[0].name,'Aang, Air Nomad');assert.equal(rows[0].condition,'near_mint');assert.equal(rows[1].qty,2);assert.equal(rows[1].finish,'foil');assert.equal(rows[1].condition,'lightly_played');
});
test('CSV maps only relevant optional fields regardless of column order',()=>{
  const [row]=parseCollectionImport('Name,Quantity,Foil,Condition,Language,Edition Name,Purchase Price,Tags,Date Added\n"Name with ""quotes""",3,true,MP,Japanese,Example Set,100,private,2020-01-01');
  assert.deepEqual(row,{name:'Name with "quotes"',qty:3,finish:'foil',condition:'moderately_played',language:'ja',set:'Example Set'});
  assert.deepEqual(parseCollectionImport('Quantity,Card Name\n2,Forest'),[{name:'Forest',qty:2,finish:'regular'}]);
  assert.deepEqual(parseCollectionImport('2 Forest'),[{name:'Forest',qty:2,finish:'regular'}]);
});
test('invalid CSV rejects malformed quotes, quantities, values and conflicting columns',()=>{
  for(const csv of ['Quantity,Name\n0,Forest','Quantity,Name\n1,"Forest','Quantity,Name\n1,Forest,extra','Quantity,Name,Finish\n1,Forest,Shiny','Quantity,Name,Condition\n1,Forest,Unknown','Quantity,Name,Language\n1,Forest,Unknown','Quantity,Name,Foil,Finish\n1,Forest,true,Foil'])assert.throws(()=>parseCollectionImport(csv));
});

test('upload syntax identifies ignored columns and unsupported zones without dropping valid cards',()=>{
  const csv=prepareCollectionUpload('Quantity,Name,Purchase Price,Tags\n1,Forest,5,mine');assert.deepEqual(csv.accepted,['Quantity','Name']);assert.deepEqual(csv.ignored,['Purchase Price','Tags']);assert.equal(csv.rows[0].qty,1);
  const txt=prepareCollectionUpload('Main deck\n2 Sol Ring\nCommand zone\n1 Tatyova, Benthic Druid');assert.deepEqual(txt.skipped,['Main deck','Command zone']);assert.equal(txt.rows.length,2);
});

test('headerless CSV requires mapping and keeps the first card as data',()=>{
  const text='1,"Aang, Air Nomad",Normal,NM\n2,Forest,Foil,LP';assert.equal(prepareCollectionUpload(text).needsMapping,true);
  const result=prepareCollectionUpload(text,{header:false,columns:['Quantity','Name','Finish','Condition']});assert.equal(result.rows.length,2);assert.equal(result.rows[0].name,'Aang, Air Nomad');assert.equal(result.rows[1].finish,'foil');
  assert.throws(()=>prepareCollectionUpload(text,{header:false,columns:['Name','Name','Finish','Condition']}));
  const padded=prepareCollectionUpload('Forest,\t2,Nonfoil',{header:false,columns:['Name','Quantity','Finish']});
  assert.deepEqual(padded.rows,[{name:'Forest',qty:2,finish:'regular'}]);
});

test('CSV mapping suggestions retain recognized fields and flag uneven rows for correction',()=>{
  const source='Quantity Owned,Item,Edition-Name,Notes\n2,"Aang, Air Nomad",Example Set,note';
  const suggestion=prepareCollectionUpload(source);
  assert.deepEqual(suggestion.suggestedColumns,['Quantity','','Edition Name','']);
  const result=prepareCollectionUpload(source,{header:true,columns:['Quantity','Name','Edition Name','']});
  assert.equal(result.rows[0].name,'Aang, Air Nomad');
  assert.equal(result.rows[0].set,'Example Set');
  assert.deepEqual(result.ignored,['Notes']);
  assert.throws(()=>prepareCollectionUpload(source+'\n1,Forest',{header:true,columns:['Quantity','Name','Edition Name','']}),/CSV row 3.*expected 4 columns, found 2/);
});

test('Collection upload round-trips Arcana TXT exports across zones',()=>{
  const card={name:'Aang, Air Nomad',set:'soc',collector_number:'12a',lang:'ja'};
  const deck={cards:[{card,qty:2,zone:'main',finish:'foil'},{card,qty:1,zone:'sideboard',finish:'regular'}]};
  const text=deckExport(deck,{fields:['quantity','name','set','number','finish','language']}).text;
  const upload=prepareCollectionUpload('\uFEFF'+text.replaceAll('\n','\r\n'));
  assert.deepEqual(upload.accepted,['Quantity','Card name','Set','Collector number','Finish','Language']);
  assert.deepEqual(upload.skipped,[]);
  assert.deepEqual(upload.rows,[
    {name:card.name,qty:2,finish:'foil',language:'ja',set:'SOC',collectorNumber:'12a'},
    {name:card.name,qty:1,finish:'regular',language:'ja',set:'SOC',collectorNumber:'12a'},
  ]);
  deck.cards[0].tags=['Search, draw or filter'];deck.cards[1].tags=['Another function'];
  const byFunction=deckExport(deck,{section:'role',fields:['quantity','name','set']}).text;
  assert.deepEqual(prepareCollectionUpload(byFunction).rows.map(({name,qty,set})=>({name,qty,set})),[
    {name:card.name,qty:1,set:'SOC'},{name:card.name,qty:2,set:'SOC'},
  ]);
  const plain=prepareCollectionUpload(deckExport(deck,{section:'none'}).text);
  assert.deepEqual(plain.rows.map(({name,qty})=>({name,qty})),[{name:card.name,qty:3}]);
  assert.equal(prepareCollectionUpload('2\tAang, Air Nomad\t').rows[0].name,card.name);
});

test('tab-separated mapping retains headerless rows and reports malformed rows and ignored fields',()=>{
  const headerless='1\tArcane Signet\tSOC\t12a\tFoil\t';
  assert.equal(prepareCollectionUpload(headerless).needsMapping,true);
  assert.equal(prepareCollectionUpload(headerless).suggestHeaders,false);
  const columns=['Quantity','Name','Edition Name','Collector Number','Finish',''];
  const mapped=prepareCollectionUpload(headerless,{header:false,columns});
  assert.deepEqual(mapped.rows,[{qty:1,name:'Arcane Signet',set:'SOC',collectorNumber:'12a',finish:'foil'}]);
  const source='Count\tCard name\tSet\tCollector number\tFinish\tNotes\r\n'+headerless+'\r\n\r\n2\tBroken row\tSOC\r\n1\tInvalid finish\tSOC\t12a\tshiny\t';
  const upload=prepareCollectionUpload(source);
  assert.deepEqual(upload.ignored,['Notes']);
  assert.deepEqual(upload.rowNumbers,[2]);
  assert.match(upload.skipped[0],/^Tab-separated row 4: expected 6 columns/);
  assert.match(upload.skipped[1],/^Tab-separated row 5: unknown finish/);
  assert.throws(()=>prepareCollectionUpload('Quantity\tCard name\tSet\r\n1\t"Unclosed name\tSOC'),/Tab-separated row 2: .*closing quote/);
});
