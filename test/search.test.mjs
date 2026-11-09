import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuery, replaceCondition, conditionQuery, searchOptions } from '../public/search.js';
import { queryFor, relaxSearch } from '../public/core.js';
import { TYPE_CATALOG, KEYWORD_CATALOG } from '../public/filter-catalog.js';

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
    for(const [mode,values,expected] of [['exact',['W','U'],prefix+'=WU'],['exact',['W'],prefix+'=W'],['all',['W','U'],prefix+'>=WU'],['any',['W','U'],'('+prefix+'>=W OR '+prefix+'>=U)'],['subset',['W'],prefix+'<=W'],['multi',[],prefix+':m'],['colorless',[],prefix+':c']]){
      const f=edit('',family,{[family]:{mode,values}});assert.equal(f.query,expected);assert.equal(f[family].mode,mode==='any'&&values.length===1?'all':mode);assert.deepEqual(f[family].values,values);
    }
  }
  const combined=parseQuery('c=W id<=WU');assert.equal(combined.color.mode,'exact');assert.equal(combined.identity.mode,'subset');
  assert.deepEqual(parseQuery('c:w c:u').color,{mode:'all',values:['W','U']});
  const shorthand='id:w c:u f:commander';
  assert.deepEqual(parseQuery(shorthand).identity,{mode:'subset',values:['W']});
  assert.equal(edit(shorthand,'color',{color:{mode:'colorless',values:[]}}).query,'id:w c:c f:commander');
  assert.ok(parseQuery('(id:w OR id:u) c:u').locked.includes('identity'));
});

test('type conjunctions and mana-value alternatives round-trip',()=>{
  assert.equal(edit('','type',{types:['artifact','creature'],typeMatch:'all'}).query,'(t:"artifact" t:"creature")');
  assert.deepEqual(parseQuery('t:elf').types,['elf']);
  assert.equal(edit('','mv',{values:[{op:'=',value:'2'},{op:'=',value:'4'}],valueMatch:'any'}).query,'(mv=2 OR mv=4)');
});

test('mana cost comparisons count literal symbols and generic amounts with AND or OR',()=>{
  const cost=[{symbol:'U',op:'=',amount:'1'},{symbol:'generic',op:'<=',amount:'2'},{symbol:'C',op:'>=',amount:'2'},{symbol:'U/B',op:'>=',amount:'1'}];
  for(const costMatch of ['all','any']){
    const join=costMatch==='all'?' ':' OR ';
    const clause='('+['(m>={U} -m>={U}{U})','-m>={3}','m>={C}{C}','m>={U/B}'].join(join)+')';
    const next=edit('id:w usd<5','cost',{cost,costMatch});
    assert.equal(next.query,'id:w usd<5 '+clause);
    assert.deepEqual(next.cost,cost);
    assert.equal(next.costMatch,costMatch);
    assert.deepEqual(parseQuery(clause).cost,cost);
    assert.equal(relaxSearch(next,null,'cost').query,'id:w usd<5');
  }
  const single=edit('','cost',{cost:[cost[0]]});
  assert.deepEqual(single.cost,[cost[0]]);
  assert.deepEqual(parseQuery('mana>=uu mana>={X} -mana>={W/P}').cost,[
    {symbol:'U',op:'>=',amount:'2'},{symbol:'X',op:'>=',amount:'1'},{symbol:'W/P',op:'<=',amount:'0'},
  ]);
  assert.equal(edit('','cost',{cost:[{symbol:'generic',op:'<=',amount:'20'}]}).query,'-m>={21}');
  for(const amount of ['0','-1','1.5','21'])assert.throws(()=>edit('','cost',{cost:[{symbol:'U',op:'>=',amount}]}));
});

test('advanced mana clauses stay verbatim and lock only the mana-cost controls',()=>{
  for(const query of ['m:{1}{G}','m>={U}{U}{C}','m<={C}','m={W}{W}','(t:creature OR m>={R})','m>={U} (m>={W} OR m>={B})']){
    const next=edit(query,'identity',{identity:{mode:'subset',values:['W','U']}});
    assert.ok(next.locked.includes('cost'),query);
    assert.equal(next.query,`${query} id<=WU`);
    assert.throws(()=>replaceCondition(next,'cost',''));
  }
  assert.ok(parseQuery('-mana>=').error);
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

test('type chips round-trip one positive group and independent exclusions', () => {
  const raw = 'usd<5 (t:creature OR type:"time lord") -t:artifact -type:"power-plant"';
  const parsed = parseQuery(raw);
  assert.deepEqual(parsed.types, ['creature', 'time lord']);
  assert.deepEqual(parsed.excludedTypes, ['artifact', 'power-plant']);
  assert.equal(parsed.typeMatch, 'any');
  assert.deepEqual(parsed.opaque, ['usd<5']);
  assert.equal(edit(raw, 'type', { types: [] }).query, 'usd<5 -t:"artifact" -t:"power-plant"');
  assert.equal(edit(raw, 'type', { excludedTypes: [] }).query, 'usd<5 (t:"creature" OR t:"time lord")');
  assert.deepEqual(relaxSearch(parsed, null, 'type').filters.excludedTypes, []);
  for (const query of ['(t:creature OR -t:artifact)', 't:land (t:creature OR t:artifact) -t:vehicle', '-t:/land|elf/']) {
    assert.ok(parseQuery(query).locked.includes('type'), query);
    assert.ok(edit(query, 'name', { name: 'Sol Ring' }).query.includes(query));
  }
});

test('keyword chips preserve quoted abilities, matching modes and unsupported expressions', () => {
  const raw = '(kw:flying OR keyword:"first strike") -t:artifact o:/draw a card/';
  const parsed = parseQuery(raw);
  assert.deepEqual(parsed.keywords, ['flying', 'first strike']);
  assert.equal(parsed.keywordMatch, 'any');
  assert.deepEqual(parsed.opaque, ['o:/draw a card/']);
  const updated = edit(raw, 'keyword', { keywordMatch: 'all', keywords: ['for mirrodin!', 'flying'] });
  assert.deepEqual(updated.keywords, ['for mirrodin!', 'flying']);
  assert.equal(updated.keywordMatch, 'all');
  assert.deepEqual(updated.excludedTypes, ['artifact']);
  assert.equal(edit(raw, 'keyword', { keywords: [] }).query, '-t:artifact o:/draw a card/');
  assert.ok(parseQuery('-kw:flying').locked.includes('keyword'));
  assert.ok(parseQuery('(kw:flying OR t:artifact)').locked.includes('keyword'));
  assert.ok(parseQuery('keyword:').error);
  for (const [values, operator, property] of [[TYPE_CATALOG,'t','types'], [KEYWORD_CATALOG,'keyword','keywords']]) {
    for (const value of values) assert.deepEqual(parseQuery(operator+':'+JSON.stringify(value))[property], [value.toLowerCase()]);
  }
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

test('repeatable mana values preserve every comparison and reject mixed Boolean edits',()=>{
  const values=[{op:'>=',value:'1'},{op:'<=',value:'5'},{op:'!=',value:'3'},{op:'=',value:''}];
  for(const valueMatch of ['all','any']){
    const next=edit('usd<5','mv',{values,valueMatch});
    assert.deepEqual(next.values,values.slice(0,3));assert.equal(next.valueMatch,valueMatch);
    assert.equal(next.locked.length,0);assert.ok(next.query.includes('usd<5'));
    assert.equal(edit(next.query,'legal',{legal:'modern'}).values.length,3);
  }
  const query='mv>=1 (mv=2 OR mv=4)';
  assert.ok(parseQuery(query).locked.includes('mv'));
  assert.ok(edit(query,'legal',{legal:'modern'}).query.includes(query));
});

test('Oracle and full-Oracle rows retain text, operators, matching and advanced expressions',()=>{
  const oracle=[{mode:'o',text:'Whenever ~ attacks'},{mode:'fo',text:'A "quote" and \\ slash'}];
  for(const oracleMatch of ['all','any']){
    const next=edit('usd<5','oracle',{oracle,oracleMatch});
    assert.deepEqual(next.oracle,oracle);assert.equal(next.oracleMatch,oracleMatch);
    assert.equal(next.locked.length,0);
    assert.deepEqual(edit(next.query,'mv',{values:[{op:'<',value:'5'}]}).oracle,oracle);
  }
  assert.deepEqual(parseQuery('oracle:draw fulloracle:flying').oracle,[{mode:'o',text:'draw'},{mode:'fo',text:'flying'}]);
  assert.equal(edit('','oracle',{oracle:[{mode:'fo',text:''}]}).query,'');
  for(const query of ['fo:/draw (one|two)/','-fulloracle:flying','o:draw (fo:flying OR o:haste)']){
    const state=parseQuery(query);assert.ok(state.locked.includes('oracle'),query);
    assert.ok(edit(query,'legal',{legal:'modern'}).query.includes(query));
  }
  for(const query of ['fo:','fulloracle:','fo:"unfinished'])assert.ok(parseQuery(query).error);
  assert.throws(()=>conditionQuery({...parseQuery(''),oracle:[{mode:'invalid',text:'draw'}]},'oracle'));
});
