import { test } from 'node:test';
import assert from 'node:assert/strict';
import { relaxationOptions, relaxSearch } from '../public/core.js';

const filters = () => ({ raw: '(o:draw OR otag:cantrip) usd<5', name: 'A "name"', oracle: 'draw a card', type: 'instant', mv: '0', mvOp: '<=', cost: '{U}', colors: ['U'], tags: ['draw','cantrip'], match: 'any', legal: true });

test('relax exactly one guided condition, preserving raw syntax and original filters', () => {
  const f = filters(), before = structuredClone(f), deck = { format: 'modern' };
  const options = relaxationOptions(f, deck);
  assert.equal(options.length, 8);
  for (const { key } of options) {
    const result = relaxSearch(f, deck, key);
    assert.deepEqual(f, before);
    assert.deepEqual(result.original, before);
    assert.deepEqual(Object.keys(f).filter(k => JSON.stringify(f[k]) !== JSON.stringify(result.filters[k])), [key]);
    assert.ok(result.query.startsWith(f.raw));
    assert.ok(result.originalQuery.includes('mv<=0'));
    if (key !== 'legal') assert.ok(result.query.endsWith('f:modern'));
    result.filters.tags.push('removal');
    assert.deepEqual(f.tags, before.tags);
  }
});

test('tag group relaxation removes the entire all/any condition, never narrowing an OR group', () => {
  const f = filters();
  assert.match(relaxSearch(f, { format: 'modern' }, 'tags').label, /Function tags \(any\): draw, cantrip/);
  const query = relaxSearch(f, { format: 'modern' }, 'tags').query;
  assert.doesNotMatch(query, /otag:draw/);
  assert.match(query, /otag:cantrip\)/); // Advanced syntax is intentionally retained.
});

test('unsupported or inactive relaxation fails without editing filters', () => {
  const f = { ...filters(), name: '', oracle: '', type: '', mv: '', cost: '', colors: [], tags: [], legal: false };
  assert.deepEqual(relaxationOptions(f), []);
  for (const key of ['raw', 'match', '__proto__', 'mv', 'legal']) assert.throws(() => relaxSearch(f, undefined, key));
  assert.equal(f.raw, filters().raw);
});
