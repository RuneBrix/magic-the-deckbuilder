import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TAG_CATALOG, TAGS, tagById, findTags, resolveTag, queryFor } from '../public/core.js';

test('bundled taxonomy has unique canonical tags and resolvable relationships', () => {
  assert.ok(TAG_CATALOG.tags.length > 1000);
  assert.equal(tagById.size, TAG_CATALOG.tags.length);
  assert.equal(new Set(TAG_CATALOG.tags.map(t => t.uuid)).size, TAG_CATALOG.tags.length);
  assert.ok(Number.isFinite(Date.parse(TAG_CATALOG.updated)));
  for (const t of TAG_CATALOG.tags) {
    assert.match(t.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    for (const id of [...t.parents, ...t.children]) assert.ok(tagById.has(id), `${t.id}: ${id}`);
  }
  for (const [id] of TAGS) assert.ok(tagById.has(id), `Starting point ${id} exists`);
  assert.ok(tagById.get('sweeper').parents.includes('removal'));
  assert.ok(tagById.get('removal').children.includes('sweeper'));
});

test('discovery searches aliases, names and curated labels with exact matches first', () => {
  assert.equal(findTags('  BLINK ')[0].id, 'flicker');
  assert.equal(findTags('mana rock')[0].id, 'mana-rock');
  assert.equal(findTags('Card draw')[0].id, 'draw');
  assert.equal(findTags('Board wipes')[0].id, 'sweeper');
  assert.equal(resolveTag('resurrect').id, 'reanimate');
  assert.equal(resolveTag('unknown-arcana-tag'), undefined);
  assert.deepEqual(findTags('unknown-arcana-tag'), []);
});

test('taxonomy discovery preserves explicit all/any and custom query terms', () => {
  const f = { raw: 'usd<5', name: '', oracle: '', type: '', mv: '', cost: '', colors: [], tags: ['mana-rock','unknown-arcana-tag'], match: 'all' };
  assert.equal(queryFor(f), 'usd<5 (otag:mana-rock otag:unknown-arcana-tag)');
  f.match = 'any';
  assert.equal(queryFor(f), 'usd<5 (otag:mana-rock OR otag:unknown-arcana-tag)');
});
