import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import * as core from '../public/core.js';
import { workspace, editorCard, editorDeck, formValues, chooseWorkspaceFile, startCardDrag, dropCard } from '../test-support/workspace.mjs';

test('version 2 browser storage renders collection and independent deck ownership planning',()=>{
  const d=editorDeck();d.cards[0].card.prices={eur:'2.00'};d.cards[1].card.prices={eur:null};
  const owned={card:{...editorCard('alternate'),oracle_id:'Ramp spell',set_name:'Other set',collector_number:'7'},finish:'regular',qty:1};
  const w=workspace({savedWorkspace:JSON.stringify(core.workspaceFile([d],[owned])),initialView:null});
  assert.equal(vm.runInContext('collection[0].qty',w.context),1);
  vm.runInContext("view='collection';render()",w.context);
  assert.match(w.node('#app').innerHTML,/1 owned copies/);assert.match(w.node('#app').innerHTML,/matched by rules identity|evaluated independently/i);
  vm.runInContext("openDeck('editor');deckTab='planning';render()",w.context);
  const html=w.node('#app').innerHTML;
  assert.match(html,/Ownership & budget/);assert.match(html,/Covered by collection<\/dt>\s*<dd>1/);assert.match(html,/Copies to buy<\/dt>\s*<dd>2/);assert.match(html,/Unknown/);
  w.node('#deck-budget').change({target:{value:'12.34'}});
  const saved=JSON.parse(w.writes.at(-1)[1]);assert.equal(saved.version,2);assert.equal(saved.decks[0].budgetCents,1234);assert.deepEqual(saved.collection,[owned]);
  assert.match(w.node('#app').innerHTML,/left after known costs/);
  assert.match(w.node('#app').innerHTML,/1 unpriced copy/);
  w.node('#deck-budget').change({target:{value:'1.00'}});
  assert.match(w.node('#app').innerHTML,/over budget from known costs alone/);
});

test('collection defaults and saved controls preserve stable added dates and sorting',()=>{
  const w=workspace();assert.equal(vm.runInContext('collectionOptions.group',w.context),'none');assert.equal(vm.runInContext('collectionOptions.sort',w.context),'added');
  vm.runInContext("view='collection';render()",w.context);
  w.node('#collection-group').change({target:{value:'color'}});w.node('#collection-sort').change({target:{value:'updated'}});
  const saved=JSON.parse(w.writes.at(-1)[1]);assert.equal(saved.group,'color');assert.equal(saved.sort,'updated');
  assert.equal(w.writes.at(-1)[0],'arcana.collection-view.v1');
});

test('owned search opens an anchored combobox after one literal character with no placeholder result',async()=>{
  const w=workspace();let query='';w.context.fetch=async url=>{query=new URLSearchParams(url.split('?')[1]).get('q');return {ok:true,json:async()=>({data:[editorCard('Alpha') ]})};};
  vm.runInContext('collectionLotDialog()',w.context);assert.match(w.node('#dialog').innerHTML,/role="combobox"/);assert.doesNotMatch(w.node('#dialog').innerHTML,/Choose a card|size="8"/);
  w.node('#owned-search').value='A';w.node('#owned-search').oninput();await w.timers.at(-1).fn();
  assert.equal(query,'game:paper name:/^A/');assert.match(w.node('#owned-matches').innerHTML,/role="option"/);
});

test('owned printing edits remain drafts until Update collection and use absolute quantities',()=>{
  const card=editorCard('Owned'),lot={card,finish:'regular',qty:3};
  const w=workspace({savedWorkspace:JSON.stringify(core.workspaceFile([], [lot]))});w.context.card=card;
  w.node('#owned-finish').value='regular';w.node('#owned-condition').value='';
  vm.runInContext('collectionLotDialog(card)',w.context);
  w.node('#owned-plus').onclick();assert.equal(w.node('#owned-qty').value,4);
  assert.equal(vm.runInContext('collection[0].qty',w.context),3);
  w.node('#owned-form').onsubmit({preventDefault(){}});
  assert.equal(vm.runInContext('collection[0].qty',w.context),4);
  assert.equal(vm.runInContext('collection.length',w.context),1);
});

test('inline collection quantity validates changes and zero requests removal confirmation',()=>{
  const d=editorDeck(),lot={card:editorCard('Forest'),qty:2,finish:'regular'},w=workspace({savedWorkspace:JSON.stringify(core.workspaceFile([d],[lot]))});
  vm.runInContext('updateOwnedQuantity(0,5)',w.context);assert.equal(vm.runInContext('collection[0].qty',w.context),5);
  vm.runInContext('updateOwnedQuantity(0,1.5)',w.context);assert.equal(vm.runInContext('collection[0].qty',w.context),5);
  vm.runInContext('updateOwnedQuantity(0,0)',w.context);assert.equal(vm.runInContext('collection[0].qty',w.context),5);assert.match(w.node('#dialog').innerHTML,/Remove owned lot/);
});

test('collection deletion requires typed confirmation, persists first and preserves decks',()=>{
  const d=editorDeck(),lot={card:editorCard('Forest'),qty:2,finish:'regular'},w=workspace({savedWorkspace:JSON.stringify(core.workspaceFile([d],[lot]))});
  vm.runInContext('clearCollection()',w.context);w.node('#clear-collection-apply').onclick();assert.equal(vm.runInContext('collection.length',w.context),1);
  w.node('#clear-collection-confirm').value='DELETE';const persist=w.context.localStorage.setItem;w.context.localStorage.setItem=()=>{throw Error('Quota');};w.node('#clear-collection-apply').onclick();assert.equal(vm.runInContext('collection.length',w.context),1);
  w.context.localStorage.setItem=persist;w.node('#clear-collection-apply').onclick();assert.equal(vm.runInContext('collection.length',w.context),0);
  const saved=JSON.parse(w.writes.at(-1)[1]);assert.deepEqual(saved.decks,[d]);assert.deepEqual(saved.collection,[]);
});

test('owned versions load all pages automatically and never request beyond the final page',async()=>{
  const card=editorCard('Forest'),w=workspace();w.context.card=card;w.node('#owned-finish').value='regular';w.node('#owned-condition').value='';const pages=[];
  w.context.fetch=async url=>{const page=Number(new URLSearchParams(url.split('?')[1]).get('page'));pages.push(page);return {ok:true,json:async()=>({data:[{...card,id:'print-'+page}],has_more:page===1})};};
  vm.runInContext('collectionLotDialog(card)',w.context);for(let i=0;i<12;i++)await Promise.resolve();
  assert.deepEqual(pages,[1,2]);await w.node('#owned-load').onclick();assert.deepEqual(pages,[1,2]);assert.match(w.node('#owned-version').innerHTML,/print-2/);
});

test('collection TXT reports zones and uploads valid cards after skip confirmation',async()=>{
  const w=workspace();formValues(w,{list:'Mainboard\n2 Forest\nSideboard\n1 Forest'});
  w.context.fetch=async()=>({ok:true,json:async()=>({data:[editorCard('Forest')],not_found:[]})});
  vm.runInContext('collectionImport()',w.context);const form=w.node('#collection-import');
  await form.onsubmit({preventDefault(){}});assert.equal(vm.runInContext('collection.length',w.context),0);
  assert.match(w.node('#collection-notices').innerHTML,/Could not process the following cards/);w.node('#collection-accept-ignored').checked=true;
  await form.onsubmit({preventDefault(){}});assert.equal(vm.runInContext('collection[0].qty',w.context),3);
});

test('collection CSV upload merges matching finish and condition without a second review',async()=>{
  const w=workspace();formValues(w,{list:'Quantity,Name,Finish,Condition\n1,Forest,Normal,NM\n2,Forest,Normal,NM\n1,Forest,Foil,LP'});
  w.context.fetch=async()=>({ok:true,json:async()=>({data:[editorCard('Forest')],not_found:[]})});
  vm.runInContext('collectionImport()',w.context);const form=w.node('#collection-import');
  await form.onsubmit({preventDefault(){}});assert.equal(vm.runInContext('collection.length',w.context),2);
  assert.equal(vm.runInContext('collection[0].qty',w.context),3);assert.equal(vm.runInContext('collection[1].finish',w.context),'foil');assert.equal(vm.runInContext('collection[1].condition',w.context),'lightly_played');
});

test('CSV ignored columns require confirmation and syntax validation itself sends no requests',async()=>{
  const w=workspace();formValues(w,{list:'Quantity,Name,Purchase Price,Tags\n1,Forest,5,personal'});let calls=0;
  w.context.fetch=async()=>{calls++;return {ok:true,json:async()=>({data:[editorCard('Forest')]})};};
  vm.runInContext('collectionImport()',w.context);const form=w.node('#collection-import');form.oninput();
  assert.equal(calls,0);assert.match(w.node('#collection-notices').innerHTML,/Not counted: Purchase Price, Tags/);assert.equal(w.node('#collection-upload-submit').disabled,true);
  await form.onsubmit({preventDefault(){}});assert.equal(calls,0);
  w.node('#collection-accept-ignored').checked=true;await form.onsubmit({preventDefault(){}});assert.equal(calls,1);assert.equal(vm.runInContext('collection.length',w.context),1);
});

test('compatible stored collection printings eliminate upload network lookups',async()=>{
  const lot={card:{...editorCard('Forest'),finishes:['nonfoil']},qty:2,finish:'regular'};
  const w=workspace({savedWorkspace:JSON.stringify(core.workspaceFile([],[lot]))});formValues(w,{list:'3 Forest'});
  w.context.fetch=async()=>{throw Error('Network should not be needed');};vm.runInContext('collectionImport()',w.context);await w.node('#collection-import').onsubmit({preventDefault(){}});
  assert.equal(vm.runInContext('collection[0].qty',w.context),5);assert.equal(w.node('#collection-import-error').textContent||'','');
});

test('separate successful uploads intentionally add again but a completed operation cannot apply twice',async()=>{
  const lot={card:{...editorCard('Forest'),finishes:['nonfoil']},qty:2,finish:'regular'};
  const w=workspace({savedWorkspace:JSON.stringify(core.workspaceFile([editorDeck()],[lot]))});formValues(w,{list:'3 Forest'});
  vm.runInContext('collectionImport()',w.context);const first=w.node('#collection-import').onsubmit;
  w.node('#collection-import').oninput();assert.match(w.node('#collection-impact').textContent,/2 → 5/);assert.match(w.node('#collection-impact').textContent,/Re-uploading/);
  await first({preventDefault(){}});assert.equal(vm.runInContext('collection[0].qty',w.context),5);
  await first({preventDefault(){}});assert.equal(vm.runInContext('collection[0].qty',w.context),5);
  vm.runInContext('collectionImport()',w.context);await w.node('#collection-import').onsubmit({preventDefault(){}});assert.equal(vm.runInContext('collection[0].qty',w.context),8);
});

test('replacement needs confirmation, merges duplicate rows and persists before replacing inventory',async()=>{
  const d=editorDeck(),lot={card:{...editorCard('Forest'),finishes:['nonfoil']},qty:20,finish:'regular'},w=workspace({savedWorkspace:JSON.stringify(core.workspaceFile([d],[lot]))});
  formValues(w,{list:'Quantity,Name,Finish,Condition\n1,Forest,Normal,NM\n2,Forest,Normal,NM'});
  vm.runInContext('collectionImport()',w.context);const form=w.node('#collection-import');w.node('#collection-import-mode').value='replace';form.oninput({target:{id:'collection-import-mode'}});
  assert.match(w.node('#collection-impact').textContent,/Replace 20 current copies in 1 lots with 3/);
  assert.match(w.node('#dialog').innerHTML,/Save current workspace copy/);
  await form.onsubmit({preventDefault(){}});assert.equal(w.writes.length,0);
  w.node('#collection-confirm-replace').checked=true;
  const persist=w.context.localStorage.setItem;w.context.localStorage.setItem=()=>{assert.equal(vm.runInContext('collection[0].qty',w.context),20);throw Error('Quota');};
  await form.onsubmit({preventDefault(){}});assert.equal(vm.runInContext('collection[0].qty',w.context),20);assert.match(w.node('#collection-import-error').textContent,/Quota/);
  w.context.localStorage.setItem=persist;await form.onsubmit({preventDefault(){}});
  const saved=JSON.parse(w.writes.at(-1)[1]);assert.deepEqual(saved.decks,[d]);assert.equal(saved.collection.length,1);assert.equal(saved.collection[0].qty,3);assert.equal(saved.collection[0].condition,'near_mint');assert.equal(saved.collection[0].finish,'regular');
});

test('cancelled and changed replacement lookups retain prior decks and inventory',async()=>{
  for(const change of ['close','list','mode','inventory']){
    const lot={card:editorCard('Owned'),qty:7,finish:'regular'},w=workspace({savedWorkspace:JSON.stringify(core.workspaceFile([editorDeck()],[lot]))});formValues(w,{list:'2 New'});
    let release;w.context.fetch=async()=>{await new Promise(resolve=>release=resolve);return {ok:true,json:async()=>({data:[editorCard('New')]})};};
    vm.runInContext('collectionImport()',w.context);const form=w.node('#collection-import');w.node('#collection-import-mode').value='replace';w.node('#collection-confirm-replace').checked=true;
    const pending=form.onsubmit({preventDefault(){}});await Promise.resolve();
    if(change==='close')w.node('#dialog').open=false;
    if(change==='list'){formValues(w,{list:'4 New'});form.oninput();}
    if(change==='mode'){w.node('#collection-import-mode').value='add';form.oninput({target:{id:'collection-import-mode'}});}
    if(change==='inventory')vm.runInContext('collection[0].qty=9',w.context);
    release();await pending;
    assert.equal(w.writes.length,0,change);assert.equal(vm.runInContext('collection[0].qty',w.context),change==='inventory'?9:7,change);assert.equal(vm.runInContext('decks.length',w.context),1);
  }
});

test('unresolved/malformed replacement and failed additive writes retain the original inventory',async()=>{
  for(const mode of ['replace','add']){
    const lot={card:editorCard('Owned'),qty:7,finish:'regular'},w=workspace({savedWorkspace:JSON.stringify(core.workspaceFile([],[lot]))});formValues(w,{list:'0 Bad'});
    vm.runInContext('collectionImport()',w.context);const form=w.node('#collection-import');w.node('#collection-import-mode').value=mode;w.node('#collection-confirm-replace').checked=true;
    await form.onsubmit({preventDefault(){}});assert.equal(w.writes.length,0);
    if(mode==='replace'){
      formValues(w,{list:'0 Bad\n2 New'});form.oninput();w.node('#collection-accept-ignored').checked=true;
      await form.onsubmit({preventDefault(){}});assert.equal(w.writes.length,0);assert.match(w.node('#collection-syntax').textContent,/every row/);
    }
    formValues(w,{list:'2 New'});form.oninput();w.context.fetch=async()=>({ok:true,json:async()=>({data:[],has_more:false})});
    await form.onsubmit({preventDefault(){}});assert.equal(w.writes.length,0);
    w.context.fetch=async()=>({ok:true,json:async()=>({data:[editorCard('New')]})});vm.runInContext('collectionImport()',w.context);w.node('#collection-import-mode').value=mode;w.node('#collection-confirm-replace').checked=true;
    w.context.localStorage.setItem=()=>{throw Error('Quota');};await w.node('#collection-import').onsubmit({preventDefault(){}});
    assert.equal(vm.runInContext('collection[0].qty',w.context),7);assert.equal(vm.runInContext('collection.length',w.context),1);
  }
});

test('collection Text is a sortable table with dates, price and contained actions',async()=>{
  const w=workspace({savedWorkspace:JSON.stringify(core.workspaceFile([],[{card:editorCard('Forest'),qty:2,finish:'regular'}]))});formValues(w,{});
  vm.runInContext("view='collection';collectionOptions.view='text';render()",w.context);const html=w.node('#app').innerHTML;
  assert.match(html,/<table class="collection-table"/);assert.match(html,/data-collection-sort="price"/);assert.match(html,/data-collection-sort="updated"/);assert.match(html,/class="collection-actions"/);assert.doesNotMatch(html,/Horizontal text|Vertical text/);
  await w.node('#app').click({target:{closest:()=>({dataset:{collectionSort:'price'}})}});assert.equal(vm.runInContext('collectionOptions.sort',w.context),'price');
  await w.node('#app').click({target:{closest:()=>({dataset:{collectionSort:'price'}})}});assert.equal(vm.runInContext('collectionOptions.sort',w.context),'price-desc');
});

test('Archidekt Normal rows accept Scryfall nonfoil finish for the reported three-card CSV',async()=>{
  const names=['Aang, Air Nomad',"Aang, Swift Savior // Aang and La, Ocean's Fury",'Abandoned Air Temple'];
  const csv='Quantity,Name,Finish,Condition\n1,"Aang, Air Nomad",Normal,NM\n1,"Aang, Swift Savior // Aang and La, Ocean\'s Fury",Normal,NM\n1,Abandoned Air Temple,Normal,NM';
  const w=workspace();formValues(w,{list:csv});w.context.fetch=async()=>({ok:true,json:async()=>({data:names.map(name=>({...editorCard(name),finishes:['nonfoil','foil']})),not_found:[]})});
  vm.runInContext('collectionImport()',w.context);const form=w.node('#collection-import');await form.onsubmit({preventDefault(){}});
  assert.equal(w.node('#collection-import-error').textContent||'','');assert.equal(vm.runInContext('collection.length',w.context),3);assert.equal(vm.runInContext("collection.every(l=>l.finish==='regular'&&l.condition==='near_mint')",w.context),true);
});

test('CSV falls back from a foil-only default and a missing double-faced lookup to compatible printings',async()=>{
  const w=workspace(),name='Aang, Air Nomad',double="Aang, Swift Savior // Aang and La, Ocean's Fury";formValues(w,{list:'Quantity,Name,Finish,Condition\n1,"'+name+'",Normal,NM\n1,"'+double+'",Normal,NM'});
  w.context.fetch=async url=>({ok:true,json:async()=>url==='/api/collection'?{data:[{...editorCard(name),finishes:['foil']}],not_found:[{name:double}]}:{data:[{...editorCard(url.includes('Swift')?double:name),id:url.includes('Swift')?'double-nonfoil':'air-nonfoil',finishes:['nonfoil']}],has_more:false}});
  vm.runInContext('collectionImport()',w.context);await w.node('#collection-import').onsubmit({preventDefault(){}});assert.equal(w.node('#collection-import-error').textContent||'','');assert.equal(vm.runInContext('collection.length',w.context),2);
});

test('live localhost upload resolves the reported Archidekt three-card CSV in a disposable VM', {skip:process.env.ARCANA_LIVE_CSV!=='1'},async()=>{
  const w=workspace();formValues(w,{list:'Quantity,Name,Finish,Condition\n1,"Aang, Air Nomad",Normal,NM\n1,"Aang, Swift Savior // Aang and La, Ocean\'s Fury",Normal,NM\n1,Abandoned Air Temple,Normal,NM'});
  w.context.fetch=(url,options)=>fetch('http://localhost:3000'+url,options);
  vm.runInContext('collectionImport()',w.context);await w.node('#collection-import').onsubmit({preventDefault(){}});
  assert.equal(w.node('#collection-import-error').textContent||'','');assert.equal(vm.runInContext('collection.length',w.context),3);
});

test('CSV set and language constraints reject mismatches before any collection write',async()=>{
  const w=workspace();formValues(w,{list:'Quantity,Name,Finish,Condition,Language,Edition Name\n1,Forest,Normal,NM,Japanese,Example Set'});
  const wrong={...editorCard('Forest'),lang:'en',set_name:'Other Set',set:'oth'};
  w.context.fetch=async()=>({ok:true,json:async()=>({data:[wrong],not_found:[],has_more:false})});
  vm.runInContext('collectionImport()',w.context);await w.node('#collection-import').onsubmit({preventDefault(){}});
  assert.equal(vm.runInContext('collection.length',w.context),0);assert.equal(w.writes.length,0);assert.match(w.node('#collection-import-error').textContent,/set\/language/);
});

test('large collection review resumes after cooldown without repeating completed 75-name batches',async()=>{
  const w=workspace(),names=Array.from({length:80},(_,i)=>'Card '+i);formValues(w,{list:'Quantity,Name\n'+names.map(n=>'1,'+n).join('\n')});let calls=0,time=Date.now();
  w.context.Date=class extends Date{static now(){return time;}};
  w.context.fetch=async(_url,options)=>{calls++;if(calls===2)return {ok:false,status:429,json:async()=>({error:'Paused',retryAfter:60})};return {ok:true,json:async()=>({data:JSON.parse(options.body).names.map(n=>editorCard(n)),not_found:[]})};};
  vm.runInContext('collectionImport()',w.context);const form=w.node('#collection-import');await form.onsubmit({preventDefault(){}});
  assert.equal(calls,2);assert.equal(vm.runInContext('collection.length',w.context),0);assert.equal(w.node('#collection-upload-submit').disabled,true);
  await form.onsubmit({preventDefault(){}});assert.equal(calls,2);
  time+=61_000;await form.onsubmit({preventDefault(){}});assert.equal(calls,3);assert.equal(vm.runInContext('collection.length',w.context),80);
});

test('EUR refresh keeps the last good finish quote and updates only exact stored printings',async()=>{
  const d=editorDeck();for(const entry of d.cards)entry.card.prices={eur:'1.00',usd:'9.99'};
  d.budgetZones=['maybeboard'];d.cards.push({card:{...editorCard('idea'),finishes:['foil'],prices:{eur:null,usd:'9.99'}},qty:2,tags:[],zone:'maybeboard'});
  const w=workspace({savedDecks:JSON.stringify([d]),initialView:null});vm.runInContext("openDeck('editor');deckTab='planning';render()",w.context);
  w.context.fetch=async()=>{throw Error('Offline');};
  await vm.runInContext('refreshPrices()',w.context);
  assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(decks[0].cards)',w.context)),d.cards);
  assert.match(w.node('#app').innerHTML,/last usable prices were retained/i);
  const requests=[];
  w.context.fetch=async(_url,options)=>{const ids=JSON.parse(options.body).ids;requests.push(ids);return {ok:true,json:async()=>({data:ids.map(id=>({...editorCard(id),cardmarket_id:41,prices:{eur:null,eur_foil:requests.length===1?'2.50':null,usd:'0.01'}})),not_found:[]})};};
  await vm.runInContext('refreshPrices()',w.context);
  assert.deepEqual(requests,[['idea']]);
  assert.deepEqual(JSON.parse(vm.runInContext('JSON.stringify(decks[0].cards.map(e=>e.card.prices))',w.context)),[{eur:'1.00',usd:'9.99'},{eur:'1.00',usd:'9.99'},{eur:null,usd:'9.99',eur_foil:'2.50'}]);
  assert.equal(vm.runInContext('collectionReport(decks[0],collection).fullCents',w.context),500);
  assert.equal(vm.runInContext('decks[0].cards[2].card.cardmarket_id',w.context),41);
  await vm.runInContext('refreshPrices()',w.context);
  assert.match(w.node('#app').innerHTML,/Kept the saved quote for 1 entry/);
  assert.equal(vm.runInContext('decks[0].cards[2].card.prices.eur_foil',w.context),'2.50');
  assert.equal(typeof vm.runInContext('decks[0].priceUpdatedAt',w.context),'string');
});

test('EUR refresh skips a printing changed while its exact-id request is in flight',async()=>{
  const d=editorDeck();for(const entry of d.cards)entry.card.prices={eur:'1.00'};
  const w=workspace({savedDecks:JSON.stringify([d]),initialView:null});let release;
  w.context.fetch=async(_url,options)=>{const ids=JSON.parse(options.body).ids;await new Promise(resolve=>release=()=>resolve(ids));return {ok:true,json:async()=>({data:ids.map(id=>({...editorCard(id),prices:{eur:'2.50'}})),not_found:[]})};};
  const pending=vm.runInContext('refreshPrices()',w.context);await Promise.resolve();
  vm.runInContext("decks[0].cards[0].card={...decks[0].cards[0].card,id:'new-printing',prices:{eur:'8.00'}}",w.context);release();await pending;
  assert.equal(vm.runInContext("decks[0].cards[0].card.prices.eur",w.context),'8.00');assert.equal(vm.runInContext("decks[0].cards[1].card.prices.eur",w.context),'2.50');
});
