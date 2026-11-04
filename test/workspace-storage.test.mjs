import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import * as core from '../public/core.js';
import { workspace, editorCard, editorDeck, formValues, chooseWorkspaceFile, startCardDrag, dropCard } from '../test-support/workspace.mjs';

test('library imports create a deck only after successful resolution, and cancelled forms cannot mutate decks',async()=>{
  const w=workspace({savedDecks:JSON.stringify([editorDeck()])});formValues(w,{name:'Imported',format:'modern',list:'2 Ramp spell'});
  w.context.fetch=async()=>({ok:true,json:async()=>({data:[],not_found:[{name:'Ramp spell'}]})});
  vm.runInContext('importDialog(null)',w.context);
  const form=w.node('#import-form');
  await form.onsubmit({preventDefault(){},target:form});
  assert.equal(vm.runInContext('decks.length',w.context),1);assert.match(w.node('#import-error').textContent,/Nothing imported/);
  w.context.fetch=async()=>({ok:true,json:async()=>({data:[editorCard('Ramp spell','Sorcery')]})});
  form.isConnected=false;await form.onsubmit({preventDefault(){},target:form});assert.equal(vm.runInContext('decks.length',w.context),1);
  form.isConnected=true;w.node('#dialog').open=false;await form.onsubmit({preventDefault(){},target:form});assert.equal(vm.runInContext('decks.length',w.context),1);
  w.node('#dialog').open=true;
  form.isConnected=true;await form.onsubmit({preventDefault(){},target:form});
  assert.equal(vm.runInContext('decks.length',w.context),1);
  assert.match(w.node('#import-preview').innerHTML,/Nothing has been imported/);
  await form.onsubmit({preventDefault(){},target:form});
  assert.equal(vm.runInContext('decks.length',w.context),2);assert.equal(vm.runInContext('current().cards[0].qty',w.context),2);
  assert.equal(vm.runInContext('decks[0].cards[1].qty',w.context),2);
});

test('targeted imports preserve edits made while resolving and roll back quantity overflow',async()=>{
  const w=workspace({savedDecks:JSON.stringify([editorDeck()])});formValues(w,{list:'2 Ramp spell'});
  let finish;w.context.fetch=()=>new Promise(resolve=>{finish=resolve;});
  vm.runInContext('importDialog(decks[0])',w.context);const form=w.node('#import-form');
  const pending=form.onsubmit({preventDefault(){},target:form});
  vm.runInContext('decks[0].cards[1].qty=4; decks[0].cards[1].tags.push("Edited while loading")',w.context);
  finish({ok:true,json:async()=>({data:[editorCard('Ramp spell','Sorcery')]})});await pending;
  assert.equal(vm.runInContext('decks[0].cards[1].qty',w.context),4);
  await form.onsubmit({preventDefault(){},target:form});
  assert.equal(vm.runInContext('decks[0].cards[1].qty',w.context),6);
  assert.equal(vm.runInContext('decks[0].cards[1].tags[2]',w.context),'Edited while loading');
  vm.runInContext('decks[0].cards[1].qty=499; importDialog(decks[0])',w.context);
  w.context.fetch=async()=>({ok:true,json:async()=>({data:[editorCard('Ramp spell','Sorcery')]})});
  const before=vm.runInContext('JSON.stringify(decks)',w.context);
  await form.onsubmit({preventDefault(){},target:form});
  assert.equal(vm.runInContext('JSON.stringify(decks)',w.context),before);
  await form.onsubmit({preventDefault(){},target:form});
  assert.equal(vm.runInContext('JSON.stringify(decks)',w.context),before);
  assert.match(w.node('#import-error').textContent,/Maximum 500/);
});

test('editing an import invalidates review and in-flight lookup; ambiguity never applies a partial list',async()=>{
  const w=workspace({savedDecks:JSON.stringify([editorDeck()])}), values={list:'Mainboard\n2 Ramp spell'};
  formValues(w,values);vm.runInContext('importDialog(decks[0])',w.context);
  const form=w.node('#import-form'),before=vm.runInContext('JSON.stringify(decks)',w.context);
  let release;w.context.fetch=()=>new Promise(r=>release=r);
  const task=form.onsubmit({preventDefault(){}});values.list='Mainboard\n3 Ramp spell';form.oninput();
  release({ok:true,json:async()=>({data:[editorCard('Ramp spell','Sorcery')]})});await task;
  assert.match(w.node('#import-error').textContent,/changed during lookup/);
  w.context.fetch=async()=>({ok:true,json:async()=>({data:[editorCard('Ramp spell','Sorcery')]})});
  await form.onsubmit({preventDefault(){}});assert.match(w.node('#import-preview').innerHTML,/3 Ramp spell/);
  values.list='Mainboard\n4 Ramp spell';form.oninput();assert.equal(w.node('#import-preview').innerHTML,'');
  await form.onsubmit({preventDefault(){}});assert.match(w.node('#import-preview').innerHTML,/4 Ramp spell/);
  assert.equal(vm.runInContext('JSON.stringify(decks)',w.context),before);
});

test('portable open stages independent copies and failed writes preserve the complete live workspace',async()=>{
  const original=editorDeck(),w=workspace({savedDecks:JSON.stringify([original])});
  vm.runInContext('restore()',w.context);
  await chooseWorkspaceFile(w,core.workspaceFile([original]));
  assert.equal(vm.runInContext('decks.length',w.context),1);assert.equal(w.writes.length,0);
  assert.match(w.node('#restore-preview').innerHTML,/independent deck copy/);
  const before=vm.runInContext('JSON.stringify(decks)',w.context);
  const persist=w.context.localStorage.setItem;w.context.localStorage.setItem=()=>{throw Error('Quota exceeded');};
  w.node('#restore-apply').onclick();
  assert.equal(vm.runInContext('JSON.stringify(decks)',w.context),before);assert.match(w.node('#restore-error').textContent,/Nothing added/);
  assert.equal(w.node('#restore-recovery').hidden,false);
  w.context.localStorage.setItem=persist;w.node('#restore-apply').onclick();
  assert.equal(vm.runInContext('decks.length',w.context),2);
  assert.notEqual(vm.runInContext('decks[0].id',w.context),vm.runInContext('decks[1].id',w.context));
  assert.equal(vm.runInContext('JSON.stringify(decks[0].cards)===JSON.stringify(decks[1].cards)',w.context),true);
  assert.equal(w.writes.filter(([key])=>key==='arcana.workspace.v2').length,1);
  w.node('#restore-apply').onclick();assert.equal(vm.runInContext('decks.length',w.context),2);
});

test('portable open rejects unsupported files, limits and stale selection without writes',async()=>{
  const w=workspace({savedDecks:JSON.stringify([editorDeck()])});vm.runInContext('restore()',w.context);
  const before=vm.runInContext('JSON.stringify(decks)',w.context);
  await chooseWorkspaceFile(w,{...core.workspaceFile([editorDeck()]),version:9});assert.match(w.node('#restore-error').textContent,/Unsupported/);
  await chooseWorkspaceFile(w,[editorDeck()],{size:15_000_001});assert.match(w.node('#restore-error').textContent,/too large/);
  let release;const input=w.node('#backup-file');
  const pending=input.onchange({target:{files:[{size:10,text:()=>new Promise(r=>release=r)}]}});
  await input.onchange({target:{files:[]}});release(JSON.stringify([editorDeck()]));await pending;
  assert.equal(w.node('#restore-apply').disabled,true);
  input.isConnected=false;await chooseWorkspaceFile(w,[editorDeck()]);
  assert.equal(vm.runInContext('JSON.stringify(decks)',w.context),before);assert.equal(w.writes.length,0);
});

test('portable download writes a versioned complete file and reports initiation failures',()=>{
  const w=workspace({savedDecks:JSON.stringify([editorDeck()])});let content;
  w.context.Blob=class{constructor(parts){content=parts[0];this.size=content.length;}};
  w.context.URL={createObjectURL:()=> 'blob:test',revokeObjectURL(){}};
  w.document.createElement=()=>({click(){}});
  assert.equal(vm.runInContext('saveWorkspaceCopy()',w.context),true);
  assert.deepEqual(core.readWorkspaceFile(JSON.parse(content)),{decks:[editorDeck()],collection:[]});
  assert.match(w.node('#toast').textContent,/download requested/);
  w.document.createElement=()=>({click(){throw Error('Download blocked');}});
  assert.equal(vm.runInContext('saveWorkspaceCopy()',w.context),false);assert.match(w.node('#toast').textContent,/Could not request/);
});

test('version 2 open previews keep versus replace collection without ever summing lots',async()=>{
  const d=editorDeck(),currentLot={card:editorCard('Current'),finish:'regular',qty:2},fileLot={card:editorCard('File'),finish:'foil',qty:4};
  const keep=workspace({savedWorkspace:JSON.stringify(core.workspaceFile([d],[currentLot]))});vm.runInContext('restore()',keep.context);
  await chooseWorkspaceFile(keep,core.workspaceFile([], [fileLot]));assert.match(keep.node('#restore-preview').innerHTML,/Keep current collection|Replace with file collection/);
  keep.node('#restore-apply').onclick();assert.equal(vm.runInContext("collection[0].card.id",keep.context),'Current');
  const replace=workspace({savedWorkspace:JSON.stringify(core.workspaceFile([d],[currentLot]))});vm.runInContext('restore()',replace.context);
  await chooseWorkspaceFile(replace,core.workspaceFile([], [fileLot]));replace.node('#restore-collection').value='replace';replace.node('#restore-apply').onclick();
  assert.equal(vm.runInContext('collection.length',replace.context),1);assert.equal(vm.runInContext("collection[0].card.id",replace.context),'File');assert.equal(vm.runInContext('collection[0].qty',replace.context),4);
});

test('file status tracks full-workspace requests without confusing them with browser saves or per-deck exports',()=>{
  const w=workspace({savedDecks:JSON.stringify([editorDeck()])});
  w.context.Blob=class{constructor(parts){this.size=parts[0].length;}};
  vm.runInContext('download=()=>{};settings()',w.context);
  assert.match(w.node('#backup-status').textContent,/No workspace file requested/);
  vm.runInContext('saveWorkspaceCopy()',w.context);assert.match(w.node('#backup-status').textContent,/No further workspace changes/);
  vm.runInContext("decks[0].name='Edited';save()",w.context);assert.match(w.node('#backup-status').textContent,/Workspace changed/);
  vm.runInContext('saveWorkspaceCopy([decks[0]])',w.context);assert.match(w.node('#backup-status').textContent,/Workspace changed/);
  vm.runInContext('saveWorkspaceCopy()',w.context);assert.match(w.node('#backup-status').textContent,/No further workspace changes/);
  vm.runInContext("decks[0].name='Edited again';download=()=>{throw Error('Cancelled or blocked')};saveWorkspaceCopy()",w.context);
  assert.match(w.node('#backup-status').textContent,/Workspace changed/);assert.match(w.node('#backup-download-error').textContent,/Could not request/);
  assert.match(w.node('#app').innerHTML,/Saved in this browser/);
});

test('failed browser saving retains in-memory edits and permits a portable recovery request',()=>{
  const w=workspace({savedDecks:JSON.stringify([editorDeck()])});
  w.context.Blob=class{constructor(parts){this.size=parts[0].length;}};
  w.context.localStorage.setItem=()=>{throw Error('Storage full');};
  vm.runInContext("download=()=>{};decks[0].name='Recover me';save();render();settings()",w.context);
  assert.match(w.node('#app').innerHTML,/Unsaved changes/);
  assert.equal(vm.runInContext('saveWorkspaceCopy()',w.context),true);
  assert.match(w.node('#backup-status').textContent,/No further workspace changes/);
  assert.equal(vm.runInContext('decks[0].name',w.context),'Recover me');
  assert.match(vm.runInContext('storageError',w.context),/full or unavailable/);
});
