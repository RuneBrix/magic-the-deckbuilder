import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import * as core from '../public/core.js';
import { workspace, editorCard, editorDeck, formValues, chooseWorkspaceFile, startCardDrag, dropCard } from '../test-support/workspace.mjs';

test('card details bind the named deck and row printing; roles autosave without replacing raw text',()=>{
  const d=editorDeck();d.cards[1].card.set_name='Stored release';
  const w=workspace({savedDecks:JSON.stringify([d,{...editorDeck(),id:'other',name:'Other'}])});
  vm.runInContext("results=[{...decks[0].cards[1].card,set_name:'Search release'}];inspect('Ramp spell',entryKey(decks[0].cards[1]));",w.context);
  assert.match(w.node('#detail-facts').innerHTML,/Stored release/);
  assert.match(w.node('#detail-deck').innerHTML,/selected>Garden/);
  assert.doesNotMatch(w.node('#dialog').innerHTML,/Save zone and roles/);
  const input=w.node('#detail-roles');input.value='Draw, Ramp, ';
  input.input();
  assert.equal(input.value,'Draw, Ramp, ');
  assert.equal(vm.runInContext('decks[0].cards[1].tags.join(",")',w.context),'Draw,Ramp');
  vm.runInContext("trackDeck('other')",w.context);
  input.value='Removal';input.input();
  assert.equal(vm.runInContext('decks[0].cards[1].tags[0]',w.context),'Removal');
  assert.equal(vm.runInContext('decks[1].cards[1].tags[0]',w.context),'Removal');
  assert.match(w.node('#detail-save-status').textContent,/Saved to Garden/);
});

test('invalid roles remain visible across printing preview and prevent Escape/close until fixed or explicitly discarded',()=>{
  const w=workspace({savedDecks:JSON.stringify([editorDeck()])});
  vm.runInContext("inspect('Ramp spell')",w.context);
  const input=w.node('#detail-roles');input.value='x'.repeat(81);input.input();
  assert.match(w.node('#detail-save-status').textContent,/80 characters/);
  assert.equal(w.node('#discard-roles').hidden,false);
  let warned=false;w.events.beforeunload({preventDefault(){warned=true;}});assert.equal(warned,true);
  assert.equal(vm.runInContext('closeDialog()',w.context),false);
  let prevented=false;w.node('#dialog').cancel({preventDefault(){prevented=true;}});assert.equal(prevented,true);
  vm.runInContext("detail.printings.push({...detail.card,id:'preview',set_name:'Other release'});detail.loaded=true;renderPrintings()",w.context);
  w.node('#view-printing').change({target:{value:'preview'}});
  assert.equal(input.value,'x'.repeat(81));
  assert.equal(vm.runInContext('decks[0].cards[1].card.id',w.context),'Ramp spell');
  w.node('#detail-zone').change({target:{value:'sideboard'}});
  assert.equal(vm.runInContext('detail.zone',w.context),'main');
  assert.equal(input.value,'x'.repeat(81));
  w.node('#detail-target').change({target:{value:''}});
  assert.equal(vm.runInContext('detail.deck.id',w.context),'editor');
  assert.equal(input.value,'x'.repeat(81));
  w.node('#discard-roles').onclick();assert.equal(vm.runInContext('detail',w.context),null);
});

test('details select deck and zone without moving copies or replacing the preview; quantity edits affect only that target',()=>{
  const d=editorDeck();d.cards.push({...structuredClone(d.cards[1]),qty:3,tags:['Destination'],zone:'sideboard',card:{...d.cards[1].card,id:'side-print'}});
  const other={...editorDeck(),id:'other',name:'Other'};
  const w=workspace({savedDecks:JSON.stringify([d,other])});vm.runInContext("inspect('Ramp spell')",w.context);
  w.node('#detail-roles').value='Removal, Ramp';
  const before=vm.runInContext('JSON.stringify(decks)',w.context);
  w.node('#detail-zone').change({target:{value:'sideboard'}});
  assert.equal(vm.runInContext('JSON.stringify(decks)',w.context),before);
  assert.equal(w.writes.length,0);
  assert.equal(vm.runInContext('detail.card.id',w.context),'Ramp spell');
  assert.match(w.node('#detail-deck').innerHTML,/id="detail-quantity"[^>]*>3<\/output>/);
  w.node('#detail-roles').value='Destination';
  w.node('#detail-add').onclick();
  assert.equal(vm.runInContext('decks[0].cards[2].qty',w.context),4);
  assert.equal(vm.runInContext('decks[0].cards[2].card.id',w.context),'side-print');
  assert.equal(vm.runInContext('decks[0].cards[1].qty',w.context),2);
  w.node('#detail-remove').onclick();
  assert.equal(vm.runInContext('decks[0].cards[2].qty',w.context),3);
  w.node('#detail-target').change({target:{value:'other'}});
  assert.equal(vm.runInContext('detail.zone',w.context),'sideboard');
  assert.equal(vm.runInContext('detail.card.id',w.context),'Ramp spell');
  assert.match(w.node('#detail-deck').innerHTML,/id="detail-quantity"[^>]*>0<\/output>/);
  w.node('#detail-add').onclick();
  assert.equal(vm.runInContext('decks[1].cards.at(-1).qty',w.context),1);
  assert.equal(vm.runInContext('decks[1].cards.at(-1).zone',w.context),'sideboard');
  w.node('#detail-roles').value='';
  w.node('#detail-remove').onclick();
  assert.equal(vm.runInContext('decks[1].cards.length',w.context),2);
  assert.equal(vm.runInContext('detail.key',w.context),null);
  assert.equal(vm.runInContext('detail.card.id',w.context),'Ramp spell');
  assert.match(w.node('#detail-deck').innerHTML,/id="detail-quantity"[^>]*>0<\/output>/);
});

test('printing browsing paginates safely, ignores dismissed responses, and preview/apply preserves entry metadata and backup',async()=>{
  const d=editorDeck(),w=workspace({savedDecks:JSON.stringify([d])});vm.runInContext("inspect('Ramp spell')",w.context);
  w.node('#detail-roles').value='Removal, Ramp';let calls=[];
  w.context.fetch=async url=>{calls.push(url);return {ok:true,json:async()=>({data:[{...d.cards[1].card,id:'new-print',set_name:'New release',collector_number:'123',prices:{usd:'2.50'}}],has_more:calls.length===1})};};
  await w.node('#load-printings').onclick();
  assert.equal(calls.length,1);assert.match(calls[0],/page=1/);
  assert.match(w.node('#load-printings').textContent,/Load more/);
  w.node('#view-printing').change({target:{value:'new-print'}});
  assert.match(w.node('#detail-facts').innerHTML,/New release/);
  assert.equal(vm.runInContext('decks[0].cards[1].card.id',w.context),'Ramp spell');
  w.node('#apply-printing').click();
  const entry=vm.runInContext('decks[0].cards[1]',w.context);
  assert.equal(entry.card.id,'new-print');assert.equal(entry.qty,2);assert.equal(entry.zone,'main');assert.equal(entry.tags.join(','),'Removal,Ramp');
  assert.equal(core.validateBackup(JSON.parse(vm.runInContext('JSON.stringify(decks)',w.context)))[0].cards[1].card.id,'new-print');
  await w.node('#load-printings').onclick();assert.match(calls[1],/page=2/);
  assert.equal(vm.runInContext('detail.printings.length',w.context),2);
  let resolve;w.context.fetch=()=>new Promise(r=>resolve=r);
  vm.runInContext("inspect('Leader',entryKey(decks[0].cards[0]))",w.context);
  const pending=w.node('#load-printings').onclick();
  vm.runInContext("inspect('new-print')",w.context);
  resolve({ok:true,json:async()=>({data:[d.cards[0].card]})});await pending;
  assert.equal(vm.runInContext('detail.card.id',w.context),'new-print');
});

test('printing failures retain viewed/stored cards and show retry; invalid identity cannot be applied',async()=>{
  const d=editorDeck(),w=workspace({savedDecks:JSON.stringify([d])});vm.runInContext("inspect('Ramp spell')",w.context);
  for(const mode of ['offline','empty','mismatch']) {
    w.context.fetch=async()=>{if(mode==='offline')throw Error('Offline');return {ok:true,json:async()=>({data:mode==='empty'?[]:[d.cards[0].card]})};};
    await w.node('#load-printings').onclick();
    assert.match(w.node('#load-printings').textContent,/Retry/);
    assert.equal(vm.runInContext('detail.card.id',w.context),'Ramp spell');
    assert.equal(vm.runInContext('decks[0].cards[1].card.id',w.context),'Ramp spell');
  }
  vm.runInContext("detail.card={...detail.card,oracle_id:'different'}",w.context);w.node('#detail-roles').value='Removal, Ramp';w.node('#apply-printing').click();
  assert.match(w.node('#detail-save-status').textContent,/rules identity/);
  assert.equal(vm.runInContext('decks[0].cards[1].card.id',w.context),'Ramp spell');
});

test('no-tracker details preview leaves decks unchanged; adding the viewed printing requires a named destination',()=>{
  const c=editorCard('Preview'),w=workspace({savedDecks:JSON.stringify([editorDeck()]),savedTracker:JSON.stringify({id:''})});
  w.context.preview=c;vm.runInContext('results=[preview];inspect(preview.id)',w.context);
  assert.match(w.node('#detail-deck').innerHTML,/Choose a deck before adding/);
  assert.equal(w.node('#detail-roles-section').innerHTML,'');
  assert.equal(w.writes.length,0);
  vm.runInContext("detail.card={...detail.card,id:'specific-print'}",w.context);
  w.node('#detail-add').onclick();assert.match(w.node('#detail-save-status').textContent,/Choose a destination deck/);
  w.node('#detail-target').change({target:{value:'editor'}});
  assert.equal(w.writes.length,0);
  w.node('#detail-add').onclick();
  assert.equal(vm.runInContext('decks[0].cards.at(-1).card.id',w.context),'specific-print');
  assert.equal(vm.runInContext('tracker.id',w.context),'');

});

test('details apply a preview only to the selected deck and zone and reject stale targets and quantity overflow',()=>{
  const d=editorDeck(),other={...editorDeck(),id:'other',name:'Other'};
  other.cards[1].zone='maybeboard';other.cards[1].qty=500;other.cards[1].tags=['Private'];
  const w=workspace({savedDecks:JSON.stringify([d,other])});
  vm.runInContext("inspect('Ramp spell');detail.card={...detail.card,id:'new-print',set_name:'New release'}",w.context);
  w.node('#detail-roles').value='Removal, Ramp';
  w.node('#detail-target').change({target:{value:'other'}});
  w.node('#detail-zone').change({target:{value:'maybeboard'}});
  assert.match(w.node('#detail-deck').innerHTML,/id="detail-add"[^>]*disabled/);
  w.node('#detail-roles').value='Private';
  const before=vm.runInContext('JSON.stringify(decks)',w.context);
  w.node('#detail-add').onclick();
  assert.equal(vm.runInContext('JSON.stringify(decks)',w.context),before);
  assert.match(w.node('#detail-save-status').textContent,/Maximum 500/);
  w.node('#apply-printing').click();
  assert.equal(vm.runInContext('decks[1].cards[1].card.id',w.context),'new-print');
  assert.equal(vm.runInContext('decks[1].cards[1].qty',w.context),500);
  assert.equal(vm.runInContext('decks[1].cards[1].tags[0]',w.context),'Private');
  assert.equal(vm.runInContext('decks[0].cards[1].card.id',w.context),'Ramp spell');
  vm.runInContext('decks.pop()',w.context);
  const remaining=vm.runInContext('JSON.stringify(decks)',w.context);
  w.node('#detail-remove').onclick();
  assert.match(w.node('#detail-save-status').textContent,/deck no longer exists/);
  assert.equal(vm.runInContext('JSON.stringify(decks)',w.context),remaining);
});

test('legacy cards without Oracle identity remain inspectable with a clear printing limitation',()=>{
  const w=workspace(),card={...editorCard('Legacy')};delete card.oracle_id;
  w.context.legacy=card;vm.runInContext('results=[legacy];inspect(legacy.id)',w.context);
  assert.match(w.node('#detail-facts').innerHTML,/Legacy/);
  assert.equal(w.node('#load-printings').disabled,true);
  assert.match(w.node('#printing-status').textContent,/Find the card again in search/);
  assert.equal(w.writes.length,0);
});
