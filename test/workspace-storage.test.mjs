import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import * as core from '../public/core.js';
import { workspace, editorCard, editorDeck, formValues, chooseWorkspaceFile, startCardDrag, dropCard } from '../test-support/workspace.mjs';

test('text deck imports initialize tag-derived and Land defaults with resolved printing metadata',async()=>{
  const beast={...editorCard('beast','Instant'),oracle_id:'7735eeba-693b-47e2-bd51-414379cf1016',name:'Beast Within',set:'tst',collector_number:'1',finishes:['nonfoil','foil']};
  const land={...editorCard('forest','Basic Land — Forest'),name:'Forest',set:'tst',collector_number:'2',finishes:['nonfoil']};
  const w=workspace();
  formValues(w,{name:'Resolved imports',format:'commander',list:'1 Beast Within\n2 Forest'});
  w.context.fetch=async()=>({ok:true,json:async()=>({data:[beast,land]})});
  vm.runInContext('importDialog(null)',w.context);
  const form=w.node('#import-form');
  await form.onsubmit({preventDefault(){},target:form});
  assert.equal(w.writes.length,0);
  await form.onsubmit({preventDefault(){},target:form});
  const saved=JSON.parse(w.writes.find(([key])=>key==='arcana.workspace.v2')[1]);
  assert.deepEqual(saved.decks[0].cards.map(e=>[e.card.name,e.qty,e.tags[0],e.finish,e.card.set]),[
    ['Beast Within',1,'Removal','regular','tst'],['Forest',2,'Land','regular','tst'],
  ]);
  assert.deepEqual(core.readWorkspaceFile(saved).decks[0].cards,saved.decks[0].cards);
});

test('deck import checks the exact identities omitted by bulk lookup and saves zones and quantities',async()=>{
  const fullNames=[
    'Jin-Gitaxias // The Great Synthesis',
    'Stensian Sanguinist // Exsanguinate',
    'Clearwater Pathway // Murkwater Pathway',
  ];
  const [jin,stensian,pathway]=fullNames.map((name,index)=>({
    ...editorCard('double-'+index),name,card_faces:name.split(' // ').map(name=>({name})),
  }));
  const canonical=editorCard('Exsanguinate','Sorcery');
  const w=workspace(),requests=[];
  formValues(w,{name:'Double-faced',format:'commander',list:[
    'Commander','1 '+jin.name,'Mainboard','2 '+stensian.name,'3 Exsanguinate','Sideboard','4 '+pathway.name,
  ].join('\n')});
  w.context.fetch=async(url,options)=>{
    requests.push(url);
    if(url==='/api/collection'){
      assert.deepEqual(JSON.parse(options.body).names,[jin.name,stensian.name,canonical.name,pathway.name]);
      return {ok:true,json:async()=>({data:[stensian],not_found:fullNames.map(name=>({name}))})};
    }
    const query=new URL(url,'http://localhost').searchParams.get('q');
    assert.equal(query,'!"'+[jin.name,canonical.name,pathway.name].join('" OR !"')+'"');
    return {ok:true,json:async()=>({data:[canonical,jin,pathway],has_more:false})};
  };
  vm.runInContext('importDialog(null)',w.context);
  const submit=w.node('#import-form').onsubmit,event={preventDefault(){}};
  await submit(event);
  assert.equal(requests.length,2);
  assert.equal(w.writes.length,0);
  await submit(event);
  const saved=JSON.parse(w.writes[0][1]);
  assert.deepEqual(saved.decks[0].cards.map(e=>[e.card.name,e.qty,e.zone]),[
    [jin.name,1,'command'],[stensian.name,2,'main'],[canonical.name,3,'main'],[pathway.name,4,'sideboard'],
  ]);
});

test('library imports create a deck only after successful resolution, and cancelled forms cannot mutate decks',async()=>{
  const w=workspace({savedDecks:JSON.stringify([editorDeck()])});formValues(w,{name:'Imported',format:'modern',list:'2 Ramp spell'});
  w.context.fetch=async url=>url==='/api/collection'
    ? {ok:true,json:async()=>({data:[],not_found:[{name:'Ramp spell'}]})}
    : {ok:false,status:404,json:async()=>({error:'No cards found.'})};
  vm.runInContext('importDialog(null)',w.context);
  const form=w.node('#import-form');
  await form.onsubmit({preventDefault(){},target:form});
  assert.equal(vm.runInContext('decks.length',w.context),1);
  assert.match(w.node('#import-error').innerHTML,/Ramp spell.*No exact match/);
  w.context.fetch=async()=>({ok:true,json:async()=>({data:[editorCard('Ramp spell','Sorcery')]})});
  form.isConnected=false;await form.onsubmit({preventDefault(){},target:form});assert.equal(vm.runInContext('decks.length',w.context),1);
  form.isConnected=true;w.node('#dialog').open=false;await form.onsubmit({preventDefault(){},target:form});assert.equal(vm.runInContext('decks.length',w.context),1);
  w.node('#dialog').open=true;
  form.isConnected=true;await form.onsubmit({preventDefault(){},target:form});
  assert.equal(vm.runInContext('decks.length',w.context),1);
  assert.match(w.node('#import-preview').innerHTML,/2 copies ready to import/);
  assert.doesNotMatch(w.node('#import-preview').innerHTML,/Ramp spell/);
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
  await form.onsubmit({preventDefault(){}});assert.match(w.node('#import-preview').innerHTML,/3 copies ready to import/);
  values.list='Mainboard\n4 Ramp spell';form.oninput();assert.equal(w.node('#import-preview').textContent,'');
  await form.onsubmit({preventDefault(){}});assert.match(w.node('#import-preview').innerHTML,/4 copies ready to import/);
  assert.equal(vm.runInContext('JSON.stringify(decks)',w.context),before);
});

test('deck import review lists only affected names and separates syntax, lookup failures and ambiguity',async()=>{
  const w=workspace(),values={name:'Import test',format:'commander',list:'Resolved\n1 Missing'};
  formValues(w,values);
  const resolved=editorCard('Resolved');
  const face=name=>({ ...editorCard(name),card_faces:[{name:'Shared'}] });
  let failure=true,requests=0;
  w.context.fetch=async url=>{
    requests++;
    if(url==='/api/collection')return {ok:true,json:async()=>({data:[resolved]})};
    const page=new URL(url,'http://localhost').searchParams.get('page');
    if(page==='2'&&failure)return {ok:false,status:404,json:async()=>({error:'No cards found.'})};
    return {ok:true,json:async()=>({data:page==='1'?[face('A // Shared')]:[face('B // Shared')],has_more:page==='1'})};
  };
  vm.runInContext('importDialog(null)',w.context);
  const form=w.node('#import-form'),alert=w.node('#import-error'),event={preventDefault(){}};
  await form.onsubmit(event);
  assert.match(alert.textContent,/Cannot read “Resolved”/);
  assert.equal(requests,0);
  values.list='1 Resolved\n1 Shared\n1 Missing';
  form.oninput();
  await form.onsubmit(event);
  assert.match(alert.textContent,/Card lookup is unavailable/);
  failure=false;
  await form.onsubmit(event);
  assert.match(alert.innerHTML,/Shared.*More than one card matches/);
  assert.match(alert.innerHTML,/Missing.*No exact match/);
  assert.doesNotMatch(alert.innerHTML,/Resolved/);
  assert.equal(w.writes.length,0);
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
