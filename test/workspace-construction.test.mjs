import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { workspace, editorCard, editorDeck } from '../test-support/workspace.mjs';
import { entryKey, readWorkspaceFile } from '../public/core.js';

test('card options designate, replace and clear one saved Sideboard companion',async()=>{
  const companion=(name,zone)=>({card:{...editorCard(name),keywords:['Companion']},qty:1,tags:['Private'],zone});
  const d=editorDeck();
  d.cards.push(companion('Gyruda, Doom of Depths','sideboard'),companion('Jegantha, the Wellspring','sideboard'),companion('Zirda, the Dawnwaker','main'));
  const w=workspace({savedDecks:JSON.stringify([d])});
  vm.runInContext("openDeck('editor')",w.context);
  const menu=w.node('#card-actions');
  const open=index=>{
    w.context.key=entryKey(d.cards[index]);
    vm.runInContext("openCardActions(key, document.querySelector('#trigger'))",w.context);
    return menu.innerHTML;
  };
  const press=(action,disabled=false)=>menu.click({target:{closest:()=>({dataset:{cardAction:action},getAttribute:()=>disabled?'true':null})}});
  const saved=()=>JSON.parse(w.writes.at(-1)[1]);
  const designated=()=>saved().decks[0].cards.filter(e=>e.companion).map(e=>e.card.name);
  assert.doesNotMatch(open(1),/data-card-action="companion"/);
  assert.match(open(4),/aria-disabled="true">Companion requires Sideboard/);
  await press('companion',true);
  assert.equal(w.writes.length,0);

  assert.match(open(2),/Designate as companion/);
  await press('companion');
  assert.deepEqual(designated(),['Gyruda, Doom of Depths']);
  assert.doesNotThrow(()=>readWorkspaceFile(saved()));
  const reloaded=workspace({savedWorkspace:w.writes.at(-1)[1]});
  assert.equal(vm.runInContext('decks[0].cards[2].companion',reloaded.context),true);

  const write=w.context.localStorage.setItem;
  w.context.localStorage.setItem=()=>{throw Error('Storage blocked');};
  open(3);await press('companion');
  assert.match(w.node('#toast').textContent,/storage is full or unavailable/);
  assert.equal(vm.runInContext('decks[0].cards[2].companion',w.context),true);
  assert.deepEqual(designated(),['Gyruda, Doom of Depths']);
  w.context.localStorage.setItem=write;

  open(3);await press('companion');
  assert.deepEqual(designated(),['Jegantha, the Wellspring']);
  assert.match(open(3),/Remove as companion/);
  await press('companion');
  assert.deepEqual(designated(),[]);
  assert.deepEqual(saved().decks[0].cards,d.cards);
  assert.deepEqual(saved().collection,[]);

  open(2);await press('companion');
  open(2);await press('move:main');
  assert.deepEqual(designated(),[]);
  assert.equal(saved().decks[0].cards[2].zone,'main');
  open(3);await press('companion');
  vm.runInContext('changeDeck(deck=>removeCardCopies(deck,key))',w.context);
  assert.deepEqual(designated(),[]);
  assert.equal(saved().decks[0].cards.some(e=>e.card.name==='Jegantha, the Wellspring'),false);
});
