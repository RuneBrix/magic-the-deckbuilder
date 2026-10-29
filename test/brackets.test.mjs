import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bracketReport,COMMANDER_BRACKETS,validateBackup,exportDeckText} from '../public/core.js';
const now=Date.parse('2026-10-29T12:00:00Z');
const entry=(name,zone='main',qty=1)=>({card:{id:name,oracle_id:name,name,type_line:'Artifact',cmc:1,color_identity:[],oracle_text:''},qty,zone,tags:[]});
const deck=cards=>({id:'brackets',name:'Brackets',format:'commander',cards,bracket:2});
test('official snapshot includes the 2026 additions, excludes removed cards and carries auditable dates',()=>{
  assert.equal(COMMANDER_BRACKETS.names.length,53);assert.equal(new Set(COMMANDER_BRACKETS.names).size,53);
  for(const name of ['Farewell','Biorhythm'])assert.ok(COMMANDER_BRACKETS.names.includes(name));
  for(const name of ['Lutri, the Spellchaser','Food Chain','Deflecting Swat'])assert.ok(!COMMANDER_BRACKETS.names.includes(name));
  assert.equal(COMMANDER_BRACKETS.verifiedAt,'2026-10-29');assert.match(COMMANDER_BRACKETS.source,/^https:\/\/magic.wizards.com/);
});
test('ranges express standard Game Changer limits without inferring a definitive bracket or overwriting assignments',()=>{
  const d=deck([entry('Sol Ring')]);assert.equal(bracketReport(d,COMMANDER_BRACKETS,now).range,null);
  d.cards=[entry('Farewell'),entry('Rhystic Study','command'),entry('Demonic Tutor')];
  let r=bracketReport(d,COMMANDER_BRACKETS,now);assert.equal(r.count,3);assert.deepEqual(r.range,[3,5]);
  d.cards.push(entry('The One Ring'));r=bracketReport(d,COMMANDER_BRACKETS,now);assert.deepEqual(r.range,[4,5]);assert.equal(d.bracket,2);
  d.cards.push(entry('Force of Will','sideboard',5));assert.equal(bracketReport(d,COMMANDER_BRACKETS,now).count,4);
  d.cards=[entry('Tergrid, God of Fright // Tergrid’s Lantern','command',1),entry('Farewell','main',3)];
  r=bracketReport(d,COMMANDER_BRACKETS,now);assert.equal(r.count,4);assert.equal(r.matches.length,2);assert.deepEqual(r.matches[0].zones,['command']);
});
test('missing/old list data and incomplete cards suppress suggestions while retaining named snapshot evidence',()=>{
  const d=deck([entry('Farewell')]);assert.equal(bracketReport(d,null,now).available,false);
  assert.equal(bracketReport(d,{...COMMANDER_BRACKETS,names:[]},now).canSuggest,false);
  const stale=bracketReport(d,COMMANDER_BRACKETS,now+91*86_400_000);assert.equal(stale.stale,true);assert.equal(stale.count,1);assert.equal(stale.range,null);
  assert.equal(bracketReport(deck([]),COMMANDER_BRACKETS,now).canSuggest,false);
  assert.equal(bracketReport(deck([{...entry('Missing'),card:{}}]),COMMANDER_BRACKETS,now).canSuggest,false);
  assert.equal(bracketReport({...d,format:'modern'},COMMANDER_BRACKETS,now).canSuggest,false);
});
test('assigned bracket round trips without a migration, invalid values are rejected and text export makes no bracket promise',()=>{
  const d=deck([entry('Farewell')]);assert.equal(validateBackup(JSON.parse(JSON.stringify([d])))[0].bracket,2);
  for(const bracket of [0,6,'3',2.5,null])assert.throws(()=>validateBackup([{...d,bracket}]));
  const legacy={...d};delete legacy.bracket;assert.doesNotThrow(()=>validateBackup([legacy]));assert.doesNotMatch(exportDeckText(d),/Bracket/);
});
