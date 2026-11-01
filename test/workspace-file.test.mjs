import {test} from 'node:test';
import assert from 'node:assert/strict';
import {workspaceFile,readWorkspaceFile} from '../public/core.js';

const deck={id:'d',name:'Portable',format:'commander',updated:'2026-11-01T12:00:00.000Z',bracket:3,cards:[{qty:2,tags:['Draw','Ramp'],zone:'maybeboard',card:{id:'print',oracle_id:'rules',name:'Example',type_line:'Creature',cmc:2,color_identity:['G'],card_faces:[{name:'Front',oracle_text:'Draw a card.',image_uris:{normal:'https://cards.scryfall.io/normal/front.jpg'}}],set:'tst',collector_number:'4'}}]};
test('versioned and legacy workspace files retain every stored field without mutation',()=>{
  const original=structuredClone(deck),json=JSON.stringify(workspaceFile([deck]));
  const file=JSON.parse(json);assert.equal(file.version,1);assert.equal(file.format,'arcana-workspace');
  assert.deepEqual(readWorkspaceFile(file),[original]);assert.deepEqual(readWorkspaceFile([deck]),[original]);assert.deepEqual(deck,original);
});
test('unsupported, malformed and partially invalid workspace files reject the entire file',()=>{
  const file=workspaceFile([deck]);
  for(const value of [null,{}, {...file,format:'other'}, {...file,version:2},{...file,version:'1'},{...file,exportedAt:null},{...file,decks:[deck,{...deck,id:'bad',cards:[{...deck.cards[0],qty:0}]}]}])assert.throws(()=>readWorkspaceFile(value));
  assert.throws(()=>readWorkspaceFile({...file,decks:[deck,deck]}));
  assert.deepEqual(readWorkspaceFile(workspaceFile([])),[]);
});
