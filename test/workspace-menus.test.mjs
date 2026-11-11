import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import * as core from '../public/core.js';
import { workspace, editorCard, editorDeck, formValues, chooseWorkspaceFile, startCardDrag, dropCard } from '../test-support/workspace.mjs';

test('deck action menus support arrow navigation, Escape return and outside dismissal', () => {
  const w=workspace();let focused=-1;
  const buttons=[0,1,2,3,4].map(i=>({focus(){focused=i;w.document.activeElement=this;}}));
  const summary={focus(){focused=-1;w.document.activeElement=this;}};
  const menu={open:false,querySelectorAll:()=>buttons,querySelector:()=>summary,contains:()=>false};
  const target={closest:()=>menu};
  const press=key=>w.node('#app').keydown({key,target,preventDefault(){}});
  press('ArrowDown');assert.equal(menu.open,true);assert.equal(focused,0);
  press('ArrowUp');assert.equal(focused,4);
  press('Home');assert.equal(focused,0);press('End');assert.equal(focused,4);
  press('Escape');assert.equal(menu.open,false);assert.equal(focused,-1);
  menu.open=true;w.document.querySelectorAll=()=>[menu];w.events.click({target:{}});assert.equal(menu.open,false);
});

test('menu actions target their named deck and close before a dialog; cancel deletion preserves every deck', async () => {
  const a=editorDeck(),b={...editorDeck(),id:'other',name:'Other'};
  const w=workspace({savedDecks:JSON.stringify([a,b]),initialView:null});
  let returned=false;const menu={open:true,querySelector:()=>({focus(){returned=true;}})};
  const click=action=>w.node('#app').click({target:{closest:()=>({dataset:{manage:action,target:'other'},closest:()=>menu})}});
  await click('export');assert.match(w.node('#dialog').innerHTML,/Export Other/);assert.equal(menu.open,false);assert.equal(returned,true);assert.equal(w.writes.length,0);
  await click('delete');assert.match(w.node('#dialog').innerHTML,/Delete Other/);w.node('#cancel-delete').onclick();
  assert.equal(vm.runInContext('decks.length',w.context),2);assert.equal(w.writes.length,0);
  await click('duplicate');assert.equal(vm.runInContext('decks[2].name',w.context),'Other (copy)');
  assert.equal(vm.runInContext('decks[0].name',w.context),'Garden');
  assert.doesNotThrow(()=>core.validateBackup(JSON.parse(vm.runInContext('JSON.stringify(decks)',w.context))));
});

test('card action menu scopes moves and details to the chosen entry and supports keyboard dismissal', async () => {
  const w=workspace({savedDecks:JSON.stringify([editorDeck()])});vm.runInContext("openDeck('editor')",w.context);
  const key=core.entryKey(editorDeck().cards[1]);w.context.key=key;let returned=false;
  const trigger={isConnected:true,setAttribute(){},focus(){returned=true;},getBoundingClientRect(){return {right:500,bottom:600};}};w.context.trigger=trigger;
  vm.runInContext('openCardActions(key,trigger)',w.context);
  assert.match(w.node('#card-actions').innerHTML,/Assign card to function…/);assert.match(w.node('#card-actions').innerHTML,/Delete card/);
  assert.doesNotMatch(w.node('#card-actions').innerHTML,/Garden|Main deck|Move to Maybeboard|<small>/);
  w.node('#card-actions').keydown({key:'Escape',target:{closest:()=>null},preventDefault(){}});assert.equal(returned,true);assert.equal(w.node('#card-actions').popoverOpen,false);
  vm.runInContext('openCardActions(key,trigger)',w.context);
  await w.node('#card-actions').click({target:{closest:()=>({dataset:{cardAction:'move-menu'}})}});
  assert.match(w.node('#card-submenu').innerHTML,/Maybeboard/);
  assert.doesNotMatch(w.node('#card-submenu').innerHTML,/>Main deck<|<p\b/);
  await w.node('#card-actions').click({target:{closest:()=>({dataset:{cardAction:'move:maybeboard'}})}});
  assert.equal(vm.runInContext('decks[0].cards[1].zone',w.context),'maybeboard');assert.equal(vm.runInContext('decks[0].cards[1].qty',w.context),2);
  assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(decks[0].cards[1].tags)',w.context)),['Removal','Ramp']);
  assert.match(w.node('#app').innerHTML,/Maybeboard · 2/);
});

test('function submenu lists only the named deck labels, assigns a primary without losing functions, and creates through a dialog',async()=>{
  const d=editorDeck(),other={...editorDeck(),id:'other',name:'Other'};other.cards[1].tags=['Other deck only'];
  const w=workspace({savedDecks:JSON.stringify([d,other])});vm.runInContext("openDeck('editor')",w.context);
  w.context.key=core.entryKey(d.cards[1]);w.context.trigger={setAttribute(){},getBoundingClientRect(){return {right:500,bottom:600};}};
  const click=dataset=>w.node('#card-actions').click({target:{closest:()=>({dataset})}});
  vm.runInContext('openCardActions(key,trigger)',w.context);
  const before=vm.runInContext('JSON.stringify(decks)',w.context);
  await click({cardAction:'function-menu'});
  const html=w.node('#card-submenu').innerHTML;
  assert.match(html,/data-function="Draw"/);assert.doesNotMatch(html,/data-function="Ramp"/);
  assert.match(html,/data-function="Removal"[^>]*aria-checked="true"/);
  assert.match(html,/role="menuitemradio"/);
  assert.doesNotMatch(html,/Other deck only|<p\b/);
  assert.equal(vm.runInContext('JSON.stringify(decks)',w.context),before);
  await click({cardAction:'assign-function',function:'Draw'});
  assert.equal(vm.runInContext('decks[0].cards[1].tags.join(",")',w.context),'Draw,Removal,Ramp');
  assert.equal(vm.runInContext('decks[0].cards[1].qty',w.context),2);
  assert.equal(vm.runInContext('decks[1].cards[1].tags[0]',w.context),'Other deck only');
  vm.runInContext('openCardActions(key,trigger)',w.context);await click({cardAction:'function-menu'});await click({cardAction:'new-function'});
  assert.match(w.node('#dialog').innerHTML,/Add a function|Create and assign/);
  assert.doesNotMatch(w.node('#dialog').innerHTML,/Existing function/);
  formValues(w,{'new-function':'Graveyard setup'});w.node('#function-form').onsubmit({preventDefault(){}});
  assert.equal(vm.runInContext('decks[0].cards[1].tags.join(",")',w.context),'Graveyard setup,Draw,Removal,Ramp');
  assert.equal(vm.runInContext('decks[1].cards[1].tags[0]',w.context),'Other deck only');
});

test('submenu keyboard navigation returns to its parent before closing and stays within the viewport',async()=>{
  const w=workspace({savedDecks:JSON.stringify([editorDeck()])});vm.runInContext("openDeck('editor')",w.context);
  w.context.key=core.entryKey(editorDeck().cards[1]);let returned=false,focused='';
  w.context.trigger={isConnected:true,setAttribute(){},focus(){returned=true;},getBoundingClientRect(){return {right:390,bottom:840};}};
  const menu=w.node('#card-actions'),sub=w.node('#card-submenu');
  const parents=Object.fromEntries(['function','move'].map(type=>[type,{focus(){focused=type;},setAttribute(){},getBoundingClientRect(){return {left:50,right:220,top:400,bottom:444};}}]));
  menu.querySelector=selector=>selector.includes('function-menu')?parents.function:parents.move;
  menu.querySelectorAll=()=>Object.values(parents);
  vm.runInContext('innerWidth=390;innerHeight=844;openCardActions(key,trigger)',w.context);
  const child={closest:()=>({dataset:{}})};sub.contains=target=>target===child;
  const key=(key,action,target)=>menu.keydown({key,target:target||{closest:()=>({dataset:{cardAction:action}})},preventDefault(){}});
  key('ArrowRight','function-menu');assert.equal(menu.dataset.submenu,'function');
  assert.equal(menu.popoverOpen,true);assert.equal(sub.popoverOpen,true);
  const buttons=['first','last'].map(name=>({focus(){focused=name;}}));sub.querySelectorAll=()=>buttons;
  w.document.activeElement=buttons[0];key('ArrowDown',null,child);assert.equal(focused,'last');
  key('Home',null,child);assert.equal(focused,'first');key('End',null,child);assert.equal(focused,'last');
  key('ArrowLeft');assert.equal(menu.dataset.submenu,'');assert.equal(focused,'function');
  assert.equal(menu.popoverOpen,true);assert.equal(sub.popoverOpen,false);
  key('ArrowRight','move-menu');key('Escape');assert.equal(menu.dataset.submenu,'');assert.equal(focused,'move');
  key('Escape');assert.equal(menu.popoverOpen,false);assert.equal(returned,true);
  assert.ok(parseFloat(menu.style.left)>=16);assert.ok(parseFloat(menu.style.top)+400<=828);
  assert.ok(parseFloat(sub.style.left)>=16);assert.ok(parseFloat(sub.style.left)+parseFloat(sub.style.width)<=374);
  vm.runInContext('openCardActions(key,trigger)',w.context);
  sub.querySelector=()=>({focus(){focused='submenu';}});
  await menu.click({detail:0,target:{closest:()=>({dataset:{cardAction:'function-menu'}})}});
  assert.equal(focused,'submenu');assert.equal(menu.dataset.keyboard,'true');
});

test('side flyouts remain hover-only after clicks and can switch to another hovered option',async()=>{
  const w=workspace({savedDecks:JSON.stringify([editorDeck()])});vm.runInContext("openDeck('editor')",w.context);
  w.context.key=core.entryKey(editorDeck().cards[1]);w.context.trigger={setAttribute(){},getBoundingClientRect(){return {right:500,bottom:600};}};
  const menu=w.node('#card-actions'),sub=w.node('#card-submenu'),expanded={};
  const parents=Object.fromEntries(['function','move'].map(type=>[type,{focus(){},contains:target=>target===type,setAttribute(name,value){expanded[type]=value;},getBoundingClientRect(){return {left:240,right:360,top:750,bottom:794};}}]));
  menu.querySelector=selector=>selector.includes('function-menu')?parents.function:parents.move;
  menu.querySelectorAll=()=>Object.values(parents);sub.contains=target=>target==='sub';
  vm.runInContext('innerWidth=390;innerHeight=844;openCardActions(key,trigger)',w.context);
  const root=menu.innerHTML,before=vm.runInContext('JSON.stringify(decks)',w.context),writes=w.writes.length;
  const target=action=>({closest:()=>({dataset:{cardAction:action}})});
  menu.pointerover({pointerType:'touch',target:target('function-menu')});assert.equal(menu.dataset.submenu,'');
  menu.pointerover({pointerType:'mouse',target:target('function-menu')});
  assert.equal(sub.popoverOpen,true);assert.equal(menu.dataset.keyboard,'false');assert.equal(expanded.function,'true');
  assert.equal(menu.innerHTML,root);assert.ok(parseFloat(sub.style.left)<240);
  menu.pointerout({relatedTarget:'sub'});assert.equal(sub.popoverOpen,true);
  menu.pointerout({relatedTarget:'function'});assert.equal(sub.popoverOpen,true);
  menu.pointerout({relatedTarget:null});assert.equal(sub.popoverOpen,false);assert.equal(menu.popoverOpen,true);
  menu.pointerover({pointerType:'mouse',target:target('function-menu')});
  await menu.click({target:target('function-menu')});assert.equal(menu.dataset.keyboard,'false');
  menu.pointerout({relatedTarget:null});assert.equal(sub.popoverOpen,false);assert.equal(menu.popoverOpen,true);
  menu.pointerover({pointerType:'mouse',target:target('function-menu')});
  await menu.click({target:target('function-menu')});
  menu.pointerover({pointerType:'mouse',target:target('move-menu')});assert.equal(menu.dataset.submenu,'move');
  assert.equal(expanded.function,'false');
  menu.pointerout({relatedTarget:null});assert.equal(sub.popoverOpen,false);
  menu.popoverOpen=false;menu.toggle({target:menu,newState:'closed'});
  assert.equal(sub.popoverOpen,false);assert.equal(menu.dataset.keyboard,'false');
  assert.equal(vm.runInContext('JSON.stringify(decks)',w.context),before);assert.equal(w.writes.length,writes);
});

test('function submenu handles empty decks, escapes labels, and rejects stale selections without edits',async()=>{
  const d=editorDeck();d.cards.forEach(e=>e.tags=[]);
  const w=workspace({savedDecks:JSON.stringify([d])});vm.runInContext("openDeck('editor')",w.context);
  w.context.key=core.entryKey(d.cards[1]);w.context.trigger={setAttribute(){},getBoundingClientRect(){return {right:500,bottom:600};}};
  vm.runInContext("openCardActions(key,trigger);closeCardSubmenu();showCardSubmenu('function')",w.context);
  assert.doesNotMatch(w.node('#card-submenu').innerHTML,/<p\b/);
  assert.match(w.node('#card-submenu').innerHTML,/Add new function/);
  vm.runInContext(`decks[0].cards[0].tags=['<Draw & "ramp">'];closeCardSubmenu();showCardSubmenu('function')`,w.context);
  assert.match(w.node('#card-submenu').innerHTML,/&lt;Draw &amp; &quot;ramp&quot;&gt;/);
  assert.doesNotMatch(w.node('#card-submenu').innerHTML,/<Draw/);
  vm.runInContext('decks[0].cards[0].tags=[]',w.context);
  const before=vm.runInContext('JSON.stringify(decks)',w.context),writes=w.writes.length;
  await w.node('#card-actions').click({target:{closest:()=>({dataset:{cardAction:'assign-function',function:'<Draw & "ramp">'}})}});
  assert.equal(vm.runInContext('JSON.stringify(decks)',w.context),before);assert.equal(w.writes.length,writes);
  assert.match(w.node('#toast').textContent,/no longer in this deck/);
});

test('card function creation is deck scoped, cross-deck copying requires a target, and all-zone removal can be cancelled', () => {
  const d=editorDeck(),other={...editorDeck(),id:'other',name:'Other',cards:[]};
  const w=workspace({savedDecks:JSON.stringify([d,other])});w.context.key=core.entryKey(d.cards[1]);
  vm.runInContext('assignFunctionDialog(decks[0],key)',w.context);formValues(w,{'function':'','new-function':'Graveyard setup'});w.node('#function-form').onsubmit({preventDefault(){}});
  assert.equal(vm.runInContext('decks[0].cards[1].tags[0]',w.context),'Graveyard setup');assert.equal(vm.runInContext('decks[1].cards.length',w.context),0);
  vm.runInContext('copyEntryDialog(decks[0],key)',w.context);formValues(w,{deck:'',quantity:'2',zone:'maybeboard'});w.node('#copy-entry-form').onsubmit({preventDefault(){}});assert.match(w.node('#copy-entry-error').textContent,/destination/);
  formValues(w,{deck:'other',quantity:'2',zone:'maybeboard'});w.node('#copy-entry-form').onsubmit({preventDefault(){}});
  assert.equal(vm.runInContext('decks[1].cards[0].zone',w.context),'maybeboard');assert.equal(vm.runInContext('decks[1].cards[0].tags[0]',w.context),'Graveyard setup');
  vm.runInContext('removeCopiesDialog(decks[0],key)',w.context);assert.match(w.node('#dialog').innerHTML,/across all zones, including Maybeboard/);
  w.node('#keep-copies').onclick();assert.equal(vm.runInContext('decks[0].cards[1].qty',w.context),2);
});

test('card-name copying uses only the selected card name, without editing deck data', async () => {
  const w=workspace({savedDecks:JSON.stringify([editorDeck()])});vm.runInContext("openDeck('editor')",w.context);let copied='';
  w.context.navigator={clipboard:{writeText:async text=>{copied=text;}}};w.node('#card-actions').dataset={deck:'editor',entry:core.entryKey(editorDeck().cards[1])};
  await w.node('#card-actions').click({target:{closest:()=>({dataset:{cardAction:'copy-name'}})}});
  assert.equal(copied,'Ramp spell');assert.equal(w.writes.length,0);
});
