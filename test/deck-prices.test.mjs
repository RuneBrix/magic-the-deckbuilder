import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cheapestPrintings } from '../public/deck-prices.js';

const identity = number => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`;
const printing = (id, eur, fields) => ({ oracle_id: identity(id), games: ['paper'], lang: 'en', finishes: ['nonfoil'], prices: { eur }, ...fields });

test('cheapest printing uses exact rules identities and the lowest eligible quote across completed pages', async () => {
  const requests = [];
  const candidates = [printing(1,'2.50'), printing(2,null), printing(2,'10000000.01'), printing(1,'0.01',{lang:'ja'}),
    printing(1,'0.02',{games:['arena']}), printing(1,'0.03',{finishes:['foil']}), printing(3,'0.01')];
  const winner = printing(1,'0.33',{collector_number:'42'});
  const quotes = await cheapestPrintings([printing(1,null), printing(2,null), printing(1,null), {name:'No rules ID'}], async (query,page) => {
    requests.push({query,page});
    return page === 1 ? {data:candidates,has_more:true} : {data:[winner],has_more:false};
  });
  assert.deepEqual(requests.map(request => request.page),[1,2]);
  assert.equal(requests[0].query,`game:paper lang:en is:nonfoil unique:prints (oracleid:${identity(1)} OR oracleid:${identity(2)})`);
  assert.deepEqual([...quotes],[[identity(1),{cents:33,card:winner}],[identity(2),null]]);
});

test('a truncated batch stays incomplete while a separate completed batch retains a verified zero quote', async () => {
  const cards = Array.from({length:9},(_,i)=>printing(i+1,'0.00'));
  const calls = [];
  const quotes = await cheapestPrintings(cards, async (query,page) => {
    calls.push(page);
    return query.includes(identity(9)) ? {data:[cards[8]],has_more:false} : {data:[cards[0]],has_more:true};
  });
  assert.deepEqual(calls,[1,2,3,4,1]);
  assert.deepEqual(quotes.get(identity(1)),{incomplete:true});
  assert.deepEqual(quotes.get(identity(8)),{incomplete:true});
  assert.equal(quotes.get(identity(9)).cents,0);
});
