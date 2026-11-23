import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { addEntriesToCollection, entryKey, moveEntry, validateBackup } from '../public/core.js';
import { editorCard, editorDeck, formValues, workspace } from '../test-support/workspace.mjs';

test('batch moves merge exact variants, keep alternate legacy printings and retain function order', () => {
  const card=editorCard('Source'), other={...card,id:'Other printing',oracle_id:card.oracle_id};
  const source={card,qty:2,tags:['Draw','Ramp'],zone:'main'};
  const alternate={card:other,qty:1,tags:['Other'],zone:'sideboard'};
  const same={...source,qty:1,tags:['Interaction'],zone:'maybeboard',finish:'regular'};
  const deck={...editorDeck(),cards:[source,alternate,same]};
  moveEntry(deck,entryKey(source),'sideboard',{preservePrinting:true});
  moveEntry(deck,entryKey(same),'sideboard',{preservePrinting:true});
  assert.deepEqual(deck.cards.map(e=>[e.card.id,e.qty,e.finish,e.tags]),[
    ['Source',3,'regular',['Draw','Ramp','Interaction']],['Other printing',1,undefined,['Other']]]);
  assert.doesNotThrow(()=>validateBackup([deck]));
});

test('selection Collection additions retain exact lots and reject ambiguous finishes and overflow without mutation', () => {
  const card={...editorCard('Same card'),finishes:['nonfoil','foil'],lang:'ja'};
  const collection=[{card,qty:2,finish:'regular',condition:'near_mint'}, {card,qty:9998,finish:'foil'}];
  const entry={card,qty:1,finish:'foil'};
  const before=JSON.stringify(collection);
  assert.throws(()=>addEntriesToCollection(collection,[entry,entry]),/9,999/);
  assert.throws(()=>addEntriesToCollection(collection,[{card:{...card,finishes:['foil','etched']},qty:1}]),/Choose a finish/);
  const result=addEntriesToCollection(collection,[entry,{card,qty:3}, {card:{...card,id:'old',finishes:undefined},qty:1,finish:'foil'}]);
  assert.deepEqual(result.map(l=>[l.card.id,l.finish,l.qty,l.condition]),[
    ['Same card','regular',2,'near_mint'],['Same card','foil',9999,undefined],['Same card','regular',3,undefined],['old','foil',1,undefined]]);
  assert.equal(JSON.stringify(collection),before);
});

test('batch dialog rejects stale selections and rolls back a late move limit failure', async () => {
  const d=editorDeck(), limited=editorCard('Z limit');
  d.cards.push({card:limited,qty:2,tags:[],zone:'main'}, {card:limited,qty:500,tags:[],zone:'sideboard'});
  const w=workspace({savedDecks:JSON.stringify([d])});
  const run=code=>vm.runInContext(code,w.context);
  run("openDeck('editor'); setDeckSelectionMode(true)");
  async function selectMain() {
    for(const entry of run("current().cards.filter(entry=>zoneFor(entry)==='main')")) {
      const target={closest:()=>({dataset:{selectEntry:entryKey(entry)}})};
      await w.node('#app').click({target});
    }
  }
  await selectMain();
  await run("useBatchAction('move')");
  const submit=values=>{
    formValues(w,values);
    w.node('#batch-action-form').onsubmit({preventDefault(){}});
  };
  const before=run('JSON.stringify(decks)');
  submit({zone:'invalid'});
  assert.match(w.node('#batch-action-error').textContent,/destination zone/);
  submit({zone:'sideboard'});
  assert.match(w.node('#batch-action-error').textContent,/500 copies/);
  assert.equal(run('JSON.stringify(decks)'),before);
  assert.equal(w.writes.length,0);
  await run("useBatchAction('remove')");
  run("current().cards.find(entry=>entry.card.name==='Z limit' && zoneFor(entry)==='main').qty++");
  const changed=run('JSON.stringify(decks)');
  submit({});
  assert.match(w.node('#batch-action-error').textContent,/selection changed/);
  assert.equal(run('JSON.stringify(decks)'),changed);
  assert.equal(w.writes.length,0);
});
