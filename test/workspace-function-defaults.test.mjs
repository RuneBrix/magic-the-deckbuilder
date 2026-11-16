import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { workspace } from '../test-support/workspace.mjs';
import { unassignedFunctionSuggestions, workspaceFile } from '../public/core.js';

const reported=JSON.parse(await readFile(new URL('./fixtures/karona-functions.json',import.meta.url),'utf8')).cards;
function setup(){
  const deck={id:'karona',name:'Karona',format:'commander',cards:reported.map(({card})=>({card,qty:1,tags:[],zone:'main'}))};
  deck.cards.push({card:reported[0].card,qty:3,tags:['My function','Secondary'],zone:'sideboard'});
  deck.cards.push({card:reported[1].card,qty:2,tags:['','Secondary'],zone:'maybeboard'});
  deck.cards.push({card:{...reported[0].card,id:'uncovered',oracle_id:'00000000-0000-4000-8000-000000000099'},qty:1,tags:[],zone:'main'});
  const w=workspace({savedWorkspace:JSON.stringify(workspaceFile([deck],[]))});
  vm.runInContext("openDeck('karona')",w.context);
  return {...w,deck};
}
const snapshot=w=>vm.runInContext('JSON.stringify(decks)',w.context);

test('missing-function plans cover the reported cards and exclude manual and explicit Unassigned choices',()=>{
  const {deck}=setup(),before=JSON.stringify(deck);
  const plan=unassignedFunctionSuggestions(deck);
  assert.equal(plan.length,10);
  assert.deepEqual(plan.map(row=>row.primary),reported.map(row=>row.expectedFunction));
  assert.equal(JSON.stringify(deck),before);
});

test('reviewed missing functions save atomically, retry once and retain quantities, zones, printings and manual labels',()=>{
  const w=setup(),before=snapshot(w),persist=w.context.localStorage.setItem;
  vm.runInContext('assignMissingFunctionsDialog(current())',w.context);
  assert.match(w.node('#dialog').innerHTML,/10 unassigned card entries \(10 copies\)/);
  assert.match(w.node('#dialog').innerHTML,/Card advantage|Combat control|Untap/);
  assert.equal(w.writes.length,0);
  w.context.localStorage.setItem=()=>{throw Error('Quota');};
  w.node('#apply-function-suggestions').onclick();
  assert.match(w.node('#function-suggestions-error').textContent,/storage is full or unavailable/);
  assert.equal(snapshot(w),before);
  w.context.localStorage.setItem=persist;
  w.node('#apply-function-suggestions').onclick();
  const after=JSON.parse(snapshot(w))[0].cards,original=JSON.parse(before)[0].cards;
  assert.deepEqual(after.slice(0,10).map(entry=>entry.tags[0]),reported.map(row=>row.expectedFunction));
  assert.deepEqual(after.slice(10),original.slice(10));
  assert.deepEqual(after.map(({tags,...entry})=>entry),original.map(({tags,...entry})=>entry));
  assert.equal(w.writes.length,1);
  w.node('#apply-function-suggestions').onclick();
  assert.equal(w.writes.length,1);
});

test('cancelled or stale reviews never rewrite assignments',()=>{
  const w=setup(),before=snapshot(w);let closed=false;
  w.node('#dialog').close=()=>{closed=true;};
  vm.runInContext('assignMissingFunctionsDialog(current())',w.context);
  w.node('#cancel-function-suggestions').onclick();
  assert.equal(closed,true);assert.equal(snapshot(w),before);assert.equal(w.writes.length,0);
  vm.runInContext("decks[0].cards[0].tags=['Keep this']",w.context);
  const changed=snapshot(w);
  w.node('#apply-function-suggestions').onclick();
  assert.match(w.node('#function-suggestions-error').textContent,/Unassigned cards changed/);
  assert.equal(snapshot(w),changed);assert.equal(w.writes.length,0);
});
