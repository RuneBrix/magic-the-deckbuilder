import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../public/core.js';
import { cheapestPrintings, refreshPriceQuotes } from '../public/deck-prices.js';
import { budgetPanel } from '../public/budget-view.js';

const card = (name, type_line = 'Creature', prices = {}) => ({ id:name, oracle_id:name, name, type_line, prices, cmc:0, color_identity:[] });
const entry = (card, zone = 'main', qty = 2) => ({card,zone,qty,tags:[]});
const deck = cards => ({id:'test',name:'Test',format:'commander',cards});

test('basic lands keep quantities and ownership while excluded from every cost estimate', () => {
  const basics = ['Plains','Island','Swamp','Mountain','Forest','Snow-Covered Forest','Wastes'].map((name,i) => entry(card(name, name.startsWith('Snow') ? 'Basic Snow Land — Forest' : `Basic Land — ${name}`, {eur:i%2?'99.00':null})));
  const nonbasic = entry(card('Nonbasic', 'Land — Forest', {}));
  const d = deck([...basics,nonbasic,entry(card('Spell','Creature',{eur:'1.00'}))]);
  const owned = [{card:basics[0].card,qty:1,finish:'regular'}];
  const report = core.collectionReport(d,owned);
  assert.equal(report.demand,18);
  assert.equal(report.owned,1);
  assert.equal(report.missing,17);
  assert.equal(report.fullCents,200);
  assert.equal(report.fullUnpriced,2);
  assert.equal(report.missingUnpriced,2);
  assert.equal(report.basicCopies,14);
  assert.equal(report.rows.filter(row=>row.costExcluded).length,7);
  const html = budgetPanel(d,owned,null,{quotes:new Map()});
  assert.match(html,/Basic land · excluded/);
  assert.match(html,/4 unpriced copies/);
  assert.doesNotMatch(html,/18 unpriced copies/);
  basics[0].zone='maybeboard';
  assert.equal(core.collectionReport(d,owned).basicCopies,12);
  assert.equal(core.collectionReport(d,owned).demand,16);
  d.budgetZones=[];
  assert.equal(core.collectionReport(d,owned).basicCopies,0);
});

test('deck currency uses actual finish quotes, orders prices and survives complete JSON', () => {
  const a=entry(card('A','Creature',{eur:'1.00',usd:'9.00',eur_foil:'2.00',usd_foil:'8.00',usd_etched:'7.00'}));
  const b=entry(card('B','Creature',{eur:'3.00',usd:'4.00'}));
  const d=deck([a,b]);
  assert.equal(core.collectionReport(d,[]).fullCents,800);
  d.currency='USD';
  assert.equal(core.collectionReport(d,[]).fullCents,2600);
  assert.equal(core.deckEntries(d,{order:'price'})[0].card.name,'B');
  assert.equal(core.deckPrintingPrice(a.card,'foil','EUR').cents,200);
  assert.equal(core.deckPrintingPrice(a.card,'etched','EUR').cents,null);
  assert.equal(core.deckPrintingPrice(a.card,'etched','USD').cents,700);
  delete b.card.prices.usd;
  assert.equal(core.collectionReport(d,[]).fullUnpriced,2);
  const restored=core.readWorkspaceFile(JSON.parse(JSON.stringify(core.workspaceFile([d],[]))));
  assert.equal(restored.decks[0].currency,'USD');
  assert.throws(()=>core.validateBackup([{...d,currency:'GBP'}]),/currency/);
});

test('cheapest and refresh use the requested currency without losing saved quotes', async () => {
  const oracle_id='00000000-0000-4000-8000-000000000001';
  const first={...card('First','Creature',{eur:'1.00',usd:'9.00'}),oracle_id,games:['paper'],lang:'en',finishes:['nonfoil']};
  const second={...first,id:'Second',prices:{eur:'2.00',usd:'3.00'}};
  const fetchPage=async()=>({data:[first,second],has_more:false});
  assert.equal((await cheapestPrintings([first],fetchPage,'USD')).get(oracle_id).cents,300);
  assert.equal((await cheapestPrintings([first],fetchPage,'EUR')).get(oracle_id).cents,100);
  assert.deepEqual(refreshPriceQuotes(first,{prices:{usd:null,usd_foil:'4.00',eur:'0.50'}},'USD').prices,{eur:'1.00',usd:'9.00',usd_foil:'4.00'});
});
