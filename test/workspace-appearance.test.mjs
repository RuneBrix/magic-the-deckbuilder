import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import * as core from '../public/core.js';
import { workspace, editorCard, editorDeck, formValues, chooseWorkspaceFile, startCardDrag, dropCard } from '../test-support/workspace.mjs';

test('appearance honors saved choice, follows system only in system mode, and never writes deck data', () => {
  const w = workspace({ savedTheme: 'dark' });
  assert.equal(w.document.documentElement.dataset.theme, 'dark');
  vm.runInContext('settings()', w.context);
  w.node('#theme').onchange({ target: { value: 'light' } });
  assert.equal(w.document.documentElement.dataset.theme, 'light');
  assert.deepEqual(w.writes, [['arcana.theme.v1', 'light']]);
  w.media.matches = true;
  w.media.change();
  assert.equal(w.document.documentElement.dataset.theme, 'light');
  w.node('#theme').onchange({ target: { value: 'system' } });
  assert.equal(w.document.documentElement.dataset.theme, 'dark');
  w.media.matches = false;
  w.media.change();
  assert.equal(w.document.documentElement.dataset.theme, 'light');
});

test('invalid or unavailable appearance storage falls back to system and remains usable', () => {
  for (const options of [{ savedTheme: 'invalid', dark: true }, { blocked: true, dark: true }]) {
    const w = workspace(options);
    assert.equal(w.document.documentElement.dataset.theme, 'dark');
    vm.runInContext('settings()', w.context);
    assert.doesNotThrow(() => w.node('#theme').onchange({ target: { value: 'light' } }));
    assert.equal(w.document.documentElement.dataset.theme, 'light');
  }
});

test('all dark palettes persist independently and work with device/light appearance and blocked storage',()=>{
  for(const palette of ['green','blue','white','orange']) {
    const w=workspace({savedPalette:palette,savedTheme:'dark'});
    assert.equal(w.document.documentElement.dataset.palette,palette);
    assert.equal(w.document.documentElement.dataset.theme,'dark');
    vm.runInContext('settings()',w.context);
    w.node('#dark-palette').onchange({target:{value:palette}});
    assert.deepEqual(w.writes,[['arcana.palette.v1',palette]]);
    w.node('#theme').onchange({target:{value:'light'}});
    assert.equal(w.document.documentElement.dataset.theme,'light');
    w.media.matches=true;w.node('#theme').onchange({target:{value:'system'}});
    assert.equal(w.document.documentElement.dataset.theme,'dark');
    assert.equal(w.document.documentElement.dataset.palette,palette);
  }
  const w=workspace({blocked:true});vm.runInContext('settings()',w.context);
  assert.doesNotThrow(()=>w.node('#dark-palette').onchange({target:{value:'orange'}}));
  assert.match(w.node('#toast').textContent,/session/);
  assert.equal(workspace({savedPalette:'invalid'}).document.documentElement.dataset.palette,'green');
});
