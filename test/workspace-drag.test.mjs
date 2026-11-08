import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import * as core from '../public/core.js';
import { workspace, editorCard, editorDeck, formValues, chooseWorkspaceFile, startCardDrag, dropCard } from '../test-support/workspace.mjs';

test('Command zone stays ungrouped and Function drops move commanders into the target zone',()=>{
  const d=editorDeck();d.cards[0].tags=['Ramp','Life gain'];d.cards[1].tags=['Ramp'];
  const w=workspace({savedDecks:JSON.stringify([d])});vm.runInContext("view='deck';editorOptions.group='role';render()",w.context);
  const html=w.node('#app').innerHTML,command=html.slice(html.indexOf('<section class="deck-zone"'),html.indexOf('<section class="deck-zone"',html.indexOf('<section class="deck-zone"')+1));
  assert.doesNotMatch(command,/<h4>|data-drop-function/);
  startCardDrag(w,core.entryKey(d.cards[0]));dropCard(w,{dropFunction:'Ramp',dropZone:'main'});
  assert.equal(vm.runInContext('decks[0].cards[0].zone',w.context),'main');
  assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(decks[0].cards[0].tags)',w.context)),['Ramp','Life gain']);
  assert.equal(w.node('#toast').textContent,'Added Leader to Ramp');
  const before=vm.runInContext('JSON.stringify(decks)',w.context),writes=w.writes.length;
  startCardDrag(w,core.entryKey({...d.cards[0],zone:'main'}));dropCard(w,{dropFunction:'Ramp',dropZone:'main'});
  assert.equal(vm.runInContext('JSON.stringify(decks)',w.context),before);assert.equal(w.writes.length,writes);
});

test('dragged artwork follows the pointer and is removed after cancellation without restoring card focus',()=>{
  const d=editorDeck(),w=workspace({savedDecks:JSON.stringify([d])});vm.runInContext("view='deck';render()",w.context);
  const source=startCardDrag(w,core.entryKey(d.cards[1]));let blurred=0;
  source.contains=()=>true;w.document.activeElement={blur(){blurred++;}};
  const ghost=w.node('#dragged-card');assert.equal(ghost.inert,true);assert.equal(ghost.style.width,'190px');assert.equal(ghost.style.height,'264px');
  assert.equal(ghost.style.transform,'translate(60px,60px)');
  w.events.pointermove({pointerId:1,clientX:200,clientY:240,preventDefault(){}});
  assert.equal(ghost.style.transform,'translate(150px,190px)');
  w.events.pointercancel();assert.equal(ghost.removed,true);assert.equal(blurred,1);assert.equal(w.writes.length,0);
});

test('Function and zone changes are atomic on merges; Unassigned zone drops retain hidden commander Functions',()=>{
  const d=editorDeck();d.cards[0].tags=['Life gain'];
  d.cards.push({...structuredClone(d.cards[0]),zone:'main',qty:2,tags:['Ramp'],card:{...d.cards[0].card,id:'other-printing'}});
  const w=workspace({savedDecks:JSON.stringify([d])});vm.runInContext("view='deck';editorOptions.group='role';render()",w.context);
  const key=core.entryKey(d.cards[0]);startCardDrag(w,key);dropCard(w,{dropZone:'main',dropFunction:'Ramp'});
  const merged=JSON.parse(vm.runInContext('JSON.stringify(decks[0].cards.find(e=>e.card.id==="other-printing"))',w.context));
  assert.equal(merged.qty,3);assert.deepEqual(merged.tags,['Ramp','Life gain']);assert.equal(vm.runInContext('decks[0].cards.some(e=>e.zone==="command")',w.context),false);
  startCardDrag(w,core.entryKey(merged));dropCard(w,{dropZone:'command'});
  assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(decks[0].cards.find(e=>e.zone==="command").tags)',w.context)),['Ramp','Life gain']);
  // The non-target Unassigned group resolves to its zone and keeps personal labels.
  startCardDrag(w,core.entryKey({...merged,zone:'command'}));dropCard(w,{dropZone:'sideboard'});
  assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(decks[0].cards.find(e=>e.zone==="sideboard").tags)',w.context)),['Ramp','Life gain']);
  const writes=w.writes.length;
  vm.runInContext("decks[0].cards.push({...structuredClone(decks[0].cards[0]),tags:['Bad, name'],zone:'main',card:{...decks[0].cards[0].card,id:'bad',oracle_id:'bad'}})",w.context);
  const invalidBefore=vm.runInContext('JSON.stringify(decks)',w.context);
  startCardDrag(w,core.entryKey({...merged,zone:'sideboard'}));dropCard(w,{dropZone:'main',dropFunction:'Bad, name'});
  assert.equal(vm.runInContext('JSON.stringify(decks)',w.context),invalidBefore);assert.equal(w.writes.length,writes);
});

test('desktop card drops move whole entries, preserve merges and reject overflow and foreign payloads',()=>{
  const d=editorDeck();
  const w=workspace({savedDecks:JSON.stringify([d])});
  vm.runInContext("view='deck';render()",w.context);
  const key=core.entryKey(d.cards[1]);
  const before=vm.runInContext('JSON.stringify(decks)',w.context);
  dropCard(w,{dropZone:'sideboard'}); // No editor drag session: an external drop cannot mutate data.
  assert.equal(vm.runInContext('JSON.stringify(decks)',w.context),before);assert.equal(w.writes.length,0);
  startCardDrag(w,key);assert.equal(w.node('#deck-drag-targets').hidden,false);
  dropCard(w,{dropZone:'maybeboard'});
  let moved=JSON.parse(vm.runInContext('JSON.stringify(decks[0].cards.find(e=>e.zone==="maybeboard"))',w.context));
  assert.equal(moved.qty,d.cards[1].qty);assert.deepEqual(moved.card,d.cards[1].card);assert.deepEqual(moved.tags,d.cards[1].tags);
  vm.runInContext("decks[0].cards.push({...structuredClone(decks[0].cards.find(e=>e.zone==='maybeboard')),zone:'sideboard',qty:499,tags:['Other'],card:{...decks[0].cards.find(e=>e.zone==='maybeboard').card,id:'destination-printing'}})",w.context);
  const atLimit=vm.runInContext('JSON.stringify(decks)',w.context),writes=w.writes.length;
  startCardDrag(w,core.entryKey(moved));dropCard(w,{dropZone:'sideboard'});
  assert.equal(vm.runInContext('JSON.stringify(decks)',w.context),atLimit);assert.equal(w.writes.length,writes);
  assert.match(w.node('#toast').textContent,/Maximum 500/);
  vm.runInContext("decks[0].cards.find(e=>e.zone==='sideboard').qty=1",w.context);
  startCardDrag(w,core.entryKey(moved));dropCard(w,{dropZone:'sideboard'});
  moved=JSON.parse(vm.runInContext('JSON.stringify(decks[0].cards.find(e=>e.zone==="sideboard"))',w.context));
  assert.equal(moved.qty,1+d.cards[1].qty);assert.equal(moved.card.id,'destination-printing');assert.deepEqual(moved.tags,[...new Set(['Other',...d.cards[1].tags])]);
  assert.equal(vm.runInContext("decks[0].cards.some(e=>e.zone==='maybeboard')",w.context),false);
});

test('Function drops retain other labels; invalid, cancelled and stale drags do nothing',async()=>{
  const d=editorDeck();d.cards.push({...structuredClone(d.cards[0]),card:{...d.cards[0].card,id:'Draw card'},zone:'main',tags:['Draw']});
  const w=workspace({savedDecks:JSON.stringify([d])});vm.runInContext("view='deck';editorOptions.group='role';render()",w.context);
  const key=core.entryKey(d.cards[1]);
  startCardDrag(w,key);dropCard(w,{dropFunction:'Draw',dropZone:'main'});
  assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(decks[0].cards[1].tags)',w.context)),['Draw',...d.cards[1].tags]);
  assert.equal(vm.runInContext('decks[0].cards[1].zone',w.context),d.cards[1].zone);
  const before=vm.runInContext('JSON.stringify(decks)',w.context),writes=w.writes.length;
  startCardDrag(w,key);dropCard(w,{dropFunction:'Imaginary',dropZone:'main'});
  startCardDrag(w,key);w.events.pointercancel();dropCard(w,{dropZone:'command'});
  let suppressed=false;
  await w.node('#app').click({detail:1,preventDefault(){suppressed=true;}});assert.equal(suppressed,true);
  startCardDrag(w,key);vm.runInContext("view='decks';render()",w.context);dropCard(w,{dropZone:'command'});
  assert.equal(vm.runInContext('JSON.stringify(decks)',w.context),before);assert.equal(w.writes.length,writes);
  assert.equal(w.node('#deck-drag-targets').hidden,true);assert.equal(w.document.documentElement.dataset.cardDragging,undefined);
});

test('trash drops request existing all-zone confirmation and only its explicit action deletes copies',()=>{
  const d=editorDeck();d.cards.push({...structuredClone(d.cards[1]),qty:3,zone:'maybeboard'});
  const w=workspace({savedDecks:JSON.stringify([d])});vm.runInContext("view='deck';render()",w.context);
  const before=vm.runInContext('JSON.stringify(decks)',w.context),key=core.entryKey(d.cards[1]);
  startCardDrag(w,key);dropCard(w,{dropTrash:''});
  assert.match(w.node('#dialog').innerHTML,/across all zones, including Maybeboard/);assert.match(w.node('#dialog').innerHTML,/Delete 5 copies/);
  assert.equal(vm.runInContext('JSON.stringify(decks)',w.context),before);assert.equal(w.writes.length,0);
  w.node('#keep-copies').onclick();assert.equal(vm.runInContext('JSON.stringify(decks)',w.context),before);
  startCardDrag(w,key);dropCard(w,{dropTrash:''});w.node('#remove-copies').onclick();
  assert.equal(vm.runInContext('decks[0].cards.length',w.context),1);assert.equal(w.writes.length,1);
});

test('new Function drop target opens a scoped dialog without changing cards until valid submission',()=>{
  const d=editorDeck(),w=workspace({savedDecks:JSON.stringify([d])});vm.runInContext("view='deck';editorOptions.group='type';render()",w.context);
  const before=vm.runInContext('JSON.stringify(decks)',w.context),key=core.entryKey(d.cards[1]);
  startCardDrag(w,key);dropCard(w,{dropNewFunction:''});
  assert.match(w.node('#dialog').innerHTML,/Add a function/);assert.match(w.node('#dialog').innerHTML,/Ramp spell/);
  assert.equal(w.node('#deck-drag-targets').hidden,true);assert.equal(w.node('#dragged-card').removed,true);
  assert.equal(vm.runInContext('JSON.stringify(decks)',w.context),before);assert.equal(w.writes.length,0);
  w.node('#dialog').close();assert.equal(vm.runInContext('JSON.stringify(decks)',w.context),before);
  startCardDrag(w,key);dropCard(w,{dropNewFunction:''});
  formValues(w,{'new-function':'Invalid, function'});w.node('#function-form').onsubmit({preventDefault(){}});
  assert.match(w.node('#function-error').textContent,/without commas/);assert.equal(vm.runInContext('JSON.stringify(decks)',w.context),before);assert.equal(w.writes.length,0);
  formValues(w,{'new-function':'Graveyard setup'});w.node('#function-form').onsubmit({preventDefault(){}});
  const entry=JSON.parse(vm.runInContext('JSON.stringify(decks[0].cards[1])',w.context));
  assert.deepEqual(entry.tags,['Graveyard setup',...d.cards[1].tags]);assert.deepEqual(entry.card,d.cards[1].card);assert.equal(entry.qty,d.cards[1].qty);assert.equal(entry.zone,d.cards[1].zone);
  assert.equal(w.writes.length,1);assert.equal(w.node('#toast').textContent,'Added Ramp spell to Graveyard setup');
});

test('drag targets follow current hit testing during edge scroll and cleanup stops the frame',()=>{
  const d=editorDeck(),w=workspace({savedDecks:JSON.stringify([d])});vm.runInContext("view='deck';render()",w.context);
  const calls=[],target={dataset:{dropZone:'sideboard'},closest(){return this;},classList:{add(){calls.push('highlight');},remove(){calls.push('clear');}}};
  // The fixed dock itself must not induce edge scrolling; ordinary zones do.
  target.closest=selector=>selector==='#deck-drag-targets'?null:target;
  w.document.elementFromPoint=()=>target;w.context.scrollBy=options=>calls.push(options.top);
  startCardDrag(w,core.entryKey(d.cards[1]));w.document.elementFromPoint=()=>target;
  w.events.pointermove({pointerId:1,clientX:300,clientY:899,preventDefault(){}});
  w.dragFrame();assert.ok(calls.some(x=>typeof x==='number'&&x>0));
  calls.length=0;target.closest=()=>null;w.document.elementFromPoint=()=>null;w.dragFrame();assert.ok(calls.includes('clear'));
  w.events.pointercancel();assert.equal(w.dragFrame,null);assert.equal(w.node('#deck-drag-targets').hidden,true);
});

test('all layouts retain drag destinations and named card actions without the help paragraph',()=>{
  const d=editorDeck();d.cards[1].tags=['<Draw & more>'];
  const w=workspace({savedDecks:JSON.stringify([d])});
  const commandSection=html=>html.match(/<section class="deck-zone" data-drop-zone="command">([\s\S]*?)(?=<section class="deck-zone"|$)/)[1];
  for(const layout of ['visual-horizontal','visual-vertical','text-horizontal','text-vertical']) {
    w.context.dragLayout=layout;vm.runInContext("view='deck';editorOptions.layout=dragLayout;editorOptions.group='role';render()",w.context);
    const html=w.node('#app').innerHTML;assert.match(html,/data-card-draggable/);assert.doesNotMatch(html,/deck-drag-help/);
    assert.match(html,/aria-label="Card actions for Leader in Command zone"/);
    assert.match(html,/data-drop-new-function>Add to new function/);
    assert.doesNotMatch(commandSection(html),/<h4>|data-drop-function/);
    assert.match(html,/data-drop-function="&lt;Draw &amp; more&gt;"/);assert.doesNotMatch(html,/data-drop-function="Unassigned"/);
    assert.match(html,/data-drop-zone="sideboard">Move to Sideboard/);assert.match(html,/data-drop-zone="maybeboard">Move to Maybeboard/);
    vm.runInContext("editorOptions.group='type';render()",w.context);assert.doesNotMatch(w.node('#app').innerHTML,/data-drop-function=/);
    assert.match(w.node('#app').innerHTML,/data-drop-new-function>Add to new function/);
    assert.doesNotMatch(commandSection(w.node('#app').innerHTML),/<h4>/);
  }
  vm.runInContext("view='explore';render()",w.context);assert.doesNotMatch(w.node('#app').innerHTML,/data-drop-function|data-card-draggable|data-drop-zone/);
});

test('touch gestures, card controls and clicks below the drag threshold keep their existing behavior',()=>{
  const d=editorDeck(),w=workspace({savedDecks:JSON.stringify([d])});vm.runInContext("view='deck';render()",w.context);
  const before=vm.runInContext('JSON.stringify(decks)',w.context);
  const source={dataset:{previewEntry:core.entryKey(d.cards[1])},closest(selector){return selector==='button'?null:this;}};
  w.node('#app').pointerdown({target:source,pointerType:'touch',pointerId:1,button:0,clientX:100,clientY:100});
  w.events.pointermove({pointerId:1,clientX:300,clientY:400});assert.equal(w.document.documentElement.dataset.cardDragging,undefined);
  source.closest=selector=>selector==='button'?{matches(){return false;}}:source;
  w.node('#app').pointerdown({target:source,pointerType:'mouse',pointerId:1,button:0,clientX:100,clientY:100});
  w.events.pointermove({pointerId:1,clientX:300,clientY:400});assert.equal(w.document.documentElement.dataset.cardDragging,undefined);
  source.closest=selector=>selector==='button'?null:source;
  w.node('#app').pointerdown({target:source,pointerType:'mouse',pointerId:1,button:0,clientX:100,clientY:100});
  w.events.pointermove({pointerId:1,clientX:102,clientY:102});w.events.pointerup({pointerId:1});
  assert.equal(w.document.documentElement.dataset.cardDragging,undefined);assert.equal(vm.runInContext('JSON.stringify(decks)',w.context),before);assert.equal(w.writes.length,0);
});
