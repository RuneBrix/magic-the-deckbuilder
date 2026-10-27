import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as core from '../public/core.js';

const source = (await readFile(new URL('../public/app.js', import.meta.url), 'utf8')).replace(/^import .*;\r?\n/, '');

// Exercise the browser module's preferences and rendering without a DOM dependency.
function workspace({ savedTheme = null, dark = false, blocked = false } = {}) {
  const writes = [], nodes = new Map();
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, {
      innerHTML: '', content: '', addEventListener(type, fn) { this[type] = fn; },
      contains() { return false; }, querySelector: node,
      setAttribute() {}, showModal() {},
      classList: { add() {}, remove() {} },
    });
    return nodes.get(selector);
  };
  const media = { matches: dark, addEventListener(type, fn) { this[type] = fn; } };
  const document = { querySelector: node, documentElement: { dataset: {} }, activeElement: null };
  const context = vm.createContext({ ...core, document, matchMedia: () => media,
    localStorage: {
      getItem(key) { if (blocked) throw Error('Storage blocked'); return key === 'arcana.theme.v1' ? savedTheme : null; },
      setItem(key, value) { if (blocked) throw Error('Storage blocked'); writes.push([key, value]); },
    },
    setTimeout: () => 1, clearTimeout() {}, URLSearchParams,
  });
  vm.runInContext(source, context);
  return { context, document, media, node, writes };
}

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

test('search disclosures start closed and preserve the opened state and selected filters across renders', () => {
  const w = workspace();
  assert.doesNotMatch(w.node('#app').innerHTML, /id="search-filters"[^>]*\bopen\b/);
  assert.doesNotMatch(w.node('#app').innerHTML, /id="function-tags"[^>]*\bopen\b/);
  w.node('#search-filters').toggle({ target: { open: true } });
  w.node('#function-tags').toggle({ target: { open: true } });
  vm.runInContext("filters.oracle = 'draw a card'; filters.tags = ['ramp']; render()", w.context);
  const html = w.node('#app').innerHTML;
  assert.match(html, /id="search-filters"[^>]*\bopen\b/);
  assert.match(html, /id="function-tags"[^>]*\bopen\b/);
  assert.match(html, /name="oracle" value="draw a card"/);
  assert.match(html, /aria-label="Remove ramp filter"/);
  assert.doesNotMatch(html, /data-action="backup"|data-action="restore"/);
});

test('tag discovery renders aliases, verified relationships, limits and custom tag guidance', () => {
  const w = workspace();
  vm.runInContext("tagSearch = 'blink'; browsedTag = 'flicker'; filters.tags = ['unknown-arcana-tag']; render()", w.context);
  const html = w.node('#app').innerHTML;
  assert.match(html, /Add flicker filter/);
  assert.match(html, /Aliases: blink/);
  assert.match(html, /Broader tags/);
  assert.match(html, /Narrower tags/);
  assert.match(html, /data-browse-tag="flicker-creature"/);
  assert.match(html, /outside this snapshot/);
  assert.match(html, /Snapshot \d{4}-\d{2}-\d{2}/);
  assert.match(html, /Match all requires every tag/);
  assert.match(html, /otag:unknown-arcana-tag/);
  vm.runInContext("tagSearch = 'unknown-arcana-tag'; render()", w.context);
  assert.match(w.node('#app').innerHTML, /No matching name or alias/);
  vm.runInContext("tagSearch = ''; allTags = true; render()", w.context);
  assert.match(w.node('#app').innerHTML, /showing 30/);
  assert.match(w.node('#app').innerHTML, /Show more tags/);
});

test('upstream no-match responses explain recovery and possible unsupported custom tags', async () => {
  const w = workspace();
  w.context.fetch = async () => ({ ok: false, json: async () => ({ error: 'Your query didn’t match any cards. Adjust your search terms.' }) });
  await vm.runInContext("filters.tags = ['unknown-arcana-tag']; search()", w.context);
  assert.match(w.node('#app').innerHTML, /No cards matched these filters/);
  assert.match(w.node('#app').innerHTML, /custom tag may be unsupported/);
  assert.match(w.node('#app').innerHTML, /switch to Match any/);
  assert.match(w.node('#app').innerHTML, /otag:unknown-arcana-tag/);
});
