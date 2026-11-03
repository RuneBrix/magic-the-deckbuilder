import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseCollectionImport} from '../public/core.js';

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
