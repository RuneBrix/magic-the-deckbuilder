import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { workspace, editorDeck } from '../test-support/workspace.mjs';

function quickAdd() {
  const w=workspace({savedDecks:JSON.stringify([editorDeck()])});
  vm.runInContext("openDeck('editor')",w.context);
  const input=w.node('#quick-add-name');
  input.removeAttribute=()=>{};
  w.document.activeElement=input;
  const type=value=>{input.value=value;input.oninput({isComposing:false});};
  const run=()=>w.timers.filter(t=>t.ms===250).at(-1).fn();
  return {...w,input,type,run};
}
const response=data=>({ok:true,json:async()=>({data})});

test('Quick add waits for three characters, bounds suggestions and opens the shared named-deck form without adding',async()=>{
  const w=quickAdd(),calls=[];
  w.context.fetch=async url=>{calls.push(url);return response(Array.from({length:12},(_,i)=>({...editorDeck().cards[1].card,id:'choice-'+i,name:'Sol '+i})));};
  w.type('So');
  assert.equal(w.timers.filter(t=>t.ms===250).length,0);
  w.type('Sol');
  assert.match(w.node('#quick-add-status').textContent,/Searching/);
  assert.equal(calls.length,0);
  await w.run();
  assert.equal(calls.length,1);
  assert.equal(new URL(calls[0],'http://localhost').searchParams.get('q'),'game:paper name:/Sol/');
  assert.equal((w.node('#quick-add-matches').innerHTML.match(/role="option"/g)||[]).length,8);
  assert.equal(w.node('#quick-add-matches').hidden,false);
  w.node('#quick-add-matches').onclick({target:{closest:()=>({dataset:{quickAddOption:'0'}})}});
  assert.match(w.node('#dialog').innerHTML,/<h2>Add card to deck<\/h2>/);
  assert.match(w.node('#dialog').innerHTML,/value="editor" selected/);
  assert.equal(w.writes.length,0);
});

test('Quick add cancels superseded work, escapes literal names and ignores responses after navigation',async()=>{
  const w=quickAdd(),pending=[];
  w.context.fetch=(url,options)=>new Promise(resolve=>pending.push({url,options,resolve}));
  w.type('Old');const old=w.run();
  w.type('A/B+');const latest=w.run();
  assert.equal(pending[0].options.signal.aborted,true);
  assert.equal(new URL(pending[1].url,'http://localhost').searchParams.get('q'),'game:paper name:/A\\/B\\+/');
  pending[1].resolve(response([{...editorDeck().cards[1].card,name:'Current match'}]));await latest;
  pending[0].resolve(response([{...editorDeck().cards[1].card,name:'Old match'}]));await old;
  assert.match(w.node('#quick-add-matches').innerHTML,/Current match/);
  assert.doesNotMatch(w.node('#quick-add-matches').innerHTML,/Old match/);
  w.type('Late');const late=w.run();
  vm.runInContext("view='decks'",w.context);
  pending[2].resolve(response([{...editorDeck().cards[1].card,name:'Detached match'}]));await late;
  assert.doesNotMatch(w.node('#quick-add-matches').innerHTML,/Detached match/);
  assert.equal(w.writes.length,0);
});

test('Quick add separates no-match, failure and Escape dismissal; Enter alone never adds',async()=>{
  const w=quickAdd();
  w.context.fetch=async()=>response([]);
  w.type('None');await w.run();
  assert.match(w.node('#quick-add-status').textContent,/No cards match/);
  w.context.fetch=async()=>{throw Error('offline');};
  w.type('Error');await w.run();
  assert.match(w.node('#quick-add-status').textContent,/Could not search.*Edit the name/);
  w.type('Cancel');
  let prevented=0;
  w.input.onkeydown({key:'Escape',preventDefault(){prevented++;}});
  await w.run();
  assert.equal(w.node('#quick-add-matches').hidden,true);
  assert.match(w.node('#quick-add-status').textContent,/dismissed/);
  w.input.onkeydown({key:'Enter',preventDefault(){prevented++;}});
  assert.equal(prevented,2);
  assert.equal(w.writes.length,0);
});
