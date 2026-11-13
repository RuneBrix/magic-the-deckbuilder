import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { workspace, editorCard, editorDeck } from '../test-support/workspace.mjs';
import { entryKey } from '../public/core.js';

test('Checks selects and clears a companion without changing zones or unrelated deck/collection data',()=>{
  const d=editorDeck();d.cards.push({card:{...editorCard('Gyruda, Doom of Depths'),keywords:['Companion'],oracle_text:'Companion — Even mana values.'},qty:1,tags:['Private'],zone:'sideboard'});
  const w=workspace({savedDecks:JSON.stringify([d])});vm.runInContext("view='deck';deckTab='checks';render()",w.context);
  assert.match(w.node('#app').innerHTML,/Designated companion/);
  w.node('#deck-companion').change({target:{value:entryKey(d.cards[2])}});
  let saved=JSON.parse(w.writes.at(-1)[1]);assert.equal(saved.decks[0].cards[2].companion,true);
  assert.deepEqual(saved.decks[0].cards.map(e=>({...e,companion:undefined})),d.cards.map(e=>({...e,companion:undefined})));
  const reloaded=workspace({savedWorkspace:w.writes.at(-1)[1]});assert.equal(vm.runInContext('decks[0].cards[2].companion',reloaded.context),true);
  w.node('#deck-companion').change({target:{value:''}});saved=JSON.parse(w.writes.at(-1)[1]);assert.equal(saved.decks[0].cards[2].companion,undefined);
});
