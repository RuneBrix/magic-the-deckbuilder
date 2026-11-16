import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { workspace, editorDeck } from '../test-support/workspace.mjs';

test('appearance retains legacy device mode until a deliberate Light or Dark choice', () => {
  const w=workspace({savedTheme:'system',dark:true});
  assert.equal(w.document.documentElement.dataset.theme,'dark');
  vm.runInContext('settings()',w.context);
  w.media.matches=false;w.media.change();
  assert.equal(w.document.documentElement.dataset.theme,'light');
  assert.equal(w.node('#theme').value,'light');
  w.node('#theme').onchange({target:{value:'dark'}});
  w.media.matches=false;w.media.change();
  assert.equal(w.document.documentElement.dataset.theme,'dark');
  assert.deepEqual(w.writes,[['arcana.theme.v1','dark']]);
  assert.doesNotMatch(vm.runInContext('settingsPage()',w.context),/value="system"/);
});

test('seven palettes persist separately for each appearance and migrate older dark choices',()=>{
  for(const palette of ['green','blue','white','orange','rose','teal','sepia']) {
    const w=workspace({savedPalette:palette,savedTheme:'dark'});
    assert.equal(w.document.documentElement.dataset.palette,palette);
    vm.runInContext('settings()',w.context);
    w.node('#theme').onchange({target:{value:'light'}});
    assert.equal(w.document.documentElement.dataset.palette,'green');
    w.node('#palette').onchange({target:{value:'rose'}});
    assert.deepEqual(JSON.parse(w.writes.at(-1)[1]),{light:'rose',dark:palette});
    w.node('#theme').onchange({target:{value:'dark'}});
    assert.equal(w.node('#palette').value,palette);
    const reload=workspace({savedTheme:'light',savedPalettes:JSON.stringify({light:'rose',dark:palette})});
    assert.equal(reload.document.documentElement.dataset.palette,'rose');
    vm.runInContext('settings()',reload.context);
    reload.node('#theme').onchange({target:{value:'dark'}});
    assert.equal(reload.document.documentElement.dataset.palette,palette);
  }
});

test('invalid or blocked appearance preferences remain usable without changing workspace data',()=>{
  for(const options of [{savedPalette:'invalid',savedPalettes:'broken',savedTheme:'invalid'}, {blocked:true}]) {
    const w=workspace(options);
    assert.equal(w.document.documentElement.dataset.palette,'green');
    vm.runInContext('settings()',w.context);
    assert.doesNotThrow(()=>w.node('#palette').onchange({target:{value:'orange'}}));
    assert.doesNotThrow(()=>w.node('#theme').onchange({target:{value:'dark'}}));
    const before=JSON.stringify(w.document.documentElement.dataset);
    w.node('#palette').onchange({target:{value:'invalid'}});
    w.node('#theme').onchange({target:{value:'invalid'}});
    assert.equal(JSON.stringify(w.document.documentElement.dataset),before);
    assert.ok(w.writes.every(([key])=>!key.includes('workspace')&&!key.includes('decks')));
    if(options.blocked)assert.match(w.node('#toast').textContent,/session/);
  }
});

test('Settings is a normal page preserving deck, search, collection and previous workflow',async()=>{
  const w=workspace({savedDecks:JSON.stringify([editorDeck()])});
  for(const previous of ['decks','deck','explore','collection']) {
    vm.runInContext(`view='${previous}';deckTab='stats';filters=parseQuery('t:creature');settings()`,w.context);
    assert.equal(vm.runInContext('view',w.context),'settings');
    assert.equal(vm.runInContext('settingsReturn',w.context),previous);
    assert.match(w.node('#app').innerHTML,/id="settings-title"/);
    assert.match(w.node('#app').innerHTML,/data-action="settings" aria-current="page"/);
    const button={dataset:{action:'settings-back'}};
    await w.node('#app').click({target:{closest:()=>button}});
    assert.equal(vm.runInContext('view',w.context),previous);
    assert.equal(vm.runInContext('deckTab',w.context),'stats');
    assert.equal(vm.runInContext('filters.query',w.context),'t:creature');
  }
  assert.equal(vm.runInContext('decks[0].cards.length',w.context),2);
});
