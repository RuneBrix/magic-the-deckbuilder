import test from 'node:test';
import assert from 'node:assert/strict';
import { assignEntryFunction, entryKey, primaryRole, stats, workspaceFile, readWorkspaceFile } from '../public/core.js';
import { editorDeck } from '../test-support/workspace.mjs';

test('primary changes preserve all legacy memberships and round-trip Unassigned without recounting hidden functions',()=>{
  const deck=editorDeck(), entry=deck.cards[1], key=entryKey(entry);
  entry.tags=['Removal','Legacy, label',...Array.from({length:12},(_,i)=>'Long legacy membership '+i)];
  const memberships=[...entry.tags];
  assignEntryFunction(deck,key,'Draw');
  assert.deepEqual(entry.tags,['Draw',...memberships]);
  assert.equal(stats(deck).tags.Draw,3);
  assert.equal(stats(deck).tags.Removal,undefined);
  assignEntryFunction(deck,key,'');
  assert.equal(primaryRole(entry),'Unassigned');
  const restored=readWorkspaceFile(JSON.parse(JSON.stringify(workspaceFile([deck],[])))).decks[0];
  assert.deepEqual(restored.cards[1].tags,['','Draw',...memberships]);
  assignEntryFunction(deck,key,'Removal');
  assert.deepEqual(entry.tags,['Removal','Draw',...memberships.slice(1)]);
  const before=structuredClone(deck);
  assert.throws(()=>assignEntryFunction(deck,key,'Ramp, Draw'),/without commas/);
  assert.deepEqual(deck,before);
});
