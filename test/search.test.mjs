import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuery, replaceCondition, conditionQuery, searchOptions } from '../public/search.js';
import { queryFor, relaxSearch } from '../public/core.js';

const edit=(query,family,changes)=>{const state=parseQuery(query);return replaceCondition(state,family,conditionQuery({...state,...changes},family));};

test('supported Boolean groups project and edits preserve every unrelated source expression',()=>{
  const query='(t:instant OR t:sorcery) AND mv>=2 mv<=4 (otag:ramp OR otag:draw) f:modern usd<5 o:/draw (one|two) cards/';
  const f=parseQuery(query);
  assert.equal(f.error,'');assert.deepEqual(f.types,['instant','sorcery']);assert.equal(f.typeMatch,'any');
  assert.deepEqual(f.values,[{op:'>=',value:'2'},{op:'<=',value:'4'}]);assert.equal(f.legal,'modern');
  assert.deepEqual(f.tags,['ramp','draw']);assert.equal(f.match,'any');assert.equal(queryFor(f),query);
  assert.ok(f.locked.includes('oracle'));
  const removed=edit(query,'tags',{tags:['draw']});
  assert.doesNotMatch(removed.query,/otag:ramp/);assert.match(removed.query,/otag:draw/);
  assert.ok(removed.query.includes('o:/draw (one|two) cards/'));assert.ok(removed.query.includes('usd<5'));
  assert.deepEqual(removed.types,['instant','sorcery']);assert.equal(removed.typeMatch,'any');
  assert.doesNotMatch(removed.query,/\bAND\b/); // Removing a condition cannot leave a dangling connector.
});

test('exact, all, any, subset, multicolor and colorless distinguish color from identity',()=>{
  for(const family of ['color','identity']){
    const prefix=family==='color'?'c':'id';
    for(const [mode,values,expected] of [['exact',['W','U'],prefix+'=WU'],['exact',['W'],prefix+'=W'],['all',['W','U'],prefix+'>=WU'],['any',['W','U'],'('+prefix+':W OR '+prefix+':U)'],['subset',['W'],prefix+'<=W'],['multi',[],prefix+':m'],['colorless',[],prefix+':c']]){
      const f=edit('',family,{[family]:{mode,values}});assert.equal(f.query,expected);assert.equal(f[family].mode,mode==='any'&&values.length===1?'all':mode);assert.deepEqual(f[family].values,values);
    }
  }
  const combined=parseQuery('c=W id<=WU');assert.equal(combined.color.mode,'exact');assert.equal(combined.identity.mode,'subset');
  assert.deepEqual(parseQuery('c:w c:u').color,{mode:'all',values:['W','U']});
});

test('types, ranges and literal symbol minimums round-trip without treating generic mana as colorless',()=>{
  assert.equal(edit('','type',{types:['artifact','creature'],typeMatch:'all'}).query,'(t:"artifact" t:"creature")');
  assert.deepEqual(parseQuery('t:elf').types,['elf']);
  assert.equal(edit('','mv',{values:[{op:'=',value:'2'},{op:'=',value:'4'}],valueMatch:'any'}).query,'(mv=2 OR mv=4)');
  const f=edit('','symbols',{symbols:{C:1,U:2}});assert.equal(f.query,'m>={U}{U}{C}');assert.deepEqual(f.symbols,{U:2,C:1});
  assert.deepEqual(parseQuery('m>={U} m>={C} m>={U}{U}').symbols,{U:2,C:1});
  assert.equal(parseQuery('m:{1}{G}').cost,'{1}{G}');
  const both=parseQuery('m:{1}{G} m>={C}');assert.equal(both.cost,'{1}{G}');assert.deepEqual(both.symbols,{C:1});
  assert.throws(()=>conditionQuery({...parseQuery(''),symbols:{U:-1}},'symbols'));
});

test('complex/negated conditions lock affected controls and unrelated edits retain their meaning',()=>{
  for(const query of ['(t:creature OR mv<3)','-(t:land)','NOT t:land','t:artifact (t:creature OR t:enchantment)','-otag:ramp','(otag:ramp OR (otag:draw otag:cantrip))']){
    const f=parseQuery(query);assert.equal(f.error,'');assert.equal(f.query,query);assert.ok(f.locked.length);
    assert.throws(()=>replaceCondition(f,f.locked[0],''));
    const next=edit(query,'name',{name:'A "name"'});assert.equal(next.name,'A "name"');assert.ok(next.query.includes(query));
  }
  const q=edit('t:creature OR mv<3','legal',{legal:'modern'}).query;
  assert.equal(q,'(t:creature OR mv<3) f:modern');
  assert.ok(parseQuery('t:creature OR mv<3').locked.includes('type'));
});

test('unsupported text and grouping survive repeated edits without growing parentheses',()=>{
  const original='(otag:ramp OR otag:draw) usd<5 o:/draw (one|two) cards/';
  let f=parseQuery(original);
  for(let i=0;i<70;i++)f=replaceCondition(f,'legal','f:'+(i%2?'modern':'commander'));
  assert.equal(f.error,'');assert.equal(f.query,'(otag:ramp OR otag:draw) usd<5 o:/draw (one|two) cards/ f:modern');
  assert.deepEqual(f.opaque,['usd<5','o:/draw (one|two) cards/']);
  assert.equal(edit('((usd<5))','legal',{legal:'modern'}).query,'((usd<5)) f:modern');
});

test('incomplete syntax is kept intact and cannot be changed by guided edits',()=>{
  for(const query of ['o:"draw','(t:creature','t:creature OR','mv>=','otag:',')','t:creature AND )']){
    const f=parseQuery(query);assert.ok(f.error,query);assert.equal(f.query,query);assert.throws(()=>replaceCondition(f,'tags','otag:ramp'));
  }
  assert.ok(parseQuery('('.repeat(45)+'t:creature'+')'.repeat(45)).error);
  assert.ok(parseQuery('x'.repeat(1501)).error);
});

test('relaxation uses recognized query conditions and restores original query exactly',()=>{
  const query='usd<5 (otag:ramp OR otag:draw) mv<=3';const f=parseQuery(query);
  assert.deepEqual(searchOptions(f).map(o=>o.key),['mv','tags']);
  const r=relaxSearch(f,null,'tags');assert.equal(r.original.query,query);assert.equal(r.query,'usd<5 mv<=3');assert.deepEqual(r.filters.tags,[]);
});
