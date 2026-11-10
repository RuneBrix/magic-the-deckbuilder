export { parseImport } from './deck-import.js';
export { readCollectionCsv, COLLECTION_COLUMNS, prepareCollectionUpload, parseCollectionImport } from './collection-import.js';
import { COMMANDER_BRACKETS } from './commander-brackets.js';
export { COMMANDER_BRACKETS };
import { TAG_CATALOG } from './tag-catalog.js';
import { replaceCondition, searchOptions } from './search.js';
export { parseQuery, replaceCondition, conditionQuery, SEARCH_FAMILIES, COST_SYMBOLS, MAX_COST_AMOUNT } from './search.js';
export { TAG_CATALOG };
export const FORMATS = ['commander', 'standard', 'modern', 'pioneer', 'pauper', 'legacy', 'vintage'];
export const TAGS = [
  ['ramp', 'Ramp', 'Make more mana'],
  ['draw', 'Card draw', 'Keep your hand full'],
  ['removal', 'Removal', 'Answer a threat'],
  ['sweeper', 'Board wipes', 'Reset the battlefield'],
  ['counterspell', 'Counterspells', 'Stop a spell'],
  ['repeatable-token-generator', 'Repeatable tokens', 'Build a board over time'],
  ['lifegain', 'Lifegain', 'Gain life'],
  ['reanimate', 'Reanimation', 'Return cards from your graveyard'],
  ['sacrifice-outlet', 'Sacrifice', 'Turn permanents into value'],
  ['flicker', 'Blink', 'Exile and return'],
  ['tutor', 'Tutors', 'Find the right card'],
  ['protection', 'Protection', 'Keep your threats safe'],
];
export const tagById = new Map(TAG_CATALOG.tags.map(t => [t.id, t]));
const normalizeTag = value => value.trim().toLowerCase().replace(/[-_\s]+/g, ' ');
export function findTags(value) {
  const q = normalizeTag(value);
  const terms = t => [t.id, ...t.aliases, ...TAGS.filter(([id]) => id === t.id).flatMap(([,label,desc]) => [label, desc])];
  const rank = t => terms(t).some(s => normalizeTag(s) === q) ? 0 : 1;
  return TAG_CATALOG.tags.filter(t => terms(t).some(s => normalizeTag(s).includes(q)))
    .sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id, 'en'));
}
export function resolveTag(value) {
  const q = normalizeTag(value);
  return tagById.get(value.trim().toLowerCase()) || TAG_CATALOG.tags.find(t => t.aliases.some(a => normalizeTag(a) === q));
}
export const count = deck => deck.cards.reduce((sum, e) => sum + e.qty, 0);
export const ZONES = { main: 'Main deck', sideboard: 'Sideboard', command: 'Command zone', maybeboard: 'Maybeboard' };
export const DEFAULT_BUDGET_ZONES = Object.freeze(['main','command','sideboard']);
const BUDGET_ZONE_ORDER = [...DEFAULT_BUDGET_ZONES,'maybeboard'];
export const zoneFor = entry => entry.zone ?? (entry.commander ? 'command' : 'main');
export const entryKey = entry => JSON.stringify([entry.card.oracle_id || entry.card.id, zoneFor(entry)]);
export const zoneCount = (deck, zone) => count({ cards: deck.cards.filter(e => zoneFor(e) === zone) });
export function moveEntry(deck, key, zone) {
  if (typeof zone !== 'string' || !Object.hasOwn(ZONES, zone)) throw Error('Unknown deck zone.');
  const entry = deck.cards.find(e => entryKey(e) === key);
  if (!entry || zoneFor(entry) === zone) return;
  const target = deck.cards.find(e => e !== entry && zoneFor(e) === zone && (e.card.oracle_id || e.card.id) === (entry.card.oracle_id || entry.card.id));
  if (target && target.qty + entry.qty > 500) throw Error('Maximum 500 copies per card in a zone. Nothing moved.');
  if (target) { target.qty += entry.qty; target.tags = [...new Set([...target.tags, ...entry.tags])]; deck.cards = deck.cards.filter(e => e !== entry); }
  else { entry.zone = zone; entry.commander = zone === 'command'; }
}
export function editEntry(deck, key, roles, zone) {
  if (typeof roles !== 'string' || roles.length > 500) throw Error('Use at most 500 characters for functions.');
  const tags=[...new Set(roles.split(',').map(t=>t.trim()).filter(Boolean))];
  if (tags.some(t=>t.length>80)) throw Error('Each function must be 80 characters or fewer. Your text is kept for correction.');
  const entry=deck.cards.find(e=>entryKey(e)===key);
  if (!entry) throw Error('This deck entry no longer exists. Reopen the card from your deck.');
  const other=deck.cards.find(e=>e!==entry && (e.card.oracle_id||e.card.id)===(entry.card.oracle_id||entry.card.id) && zoneFor(e)===zone);
  const otherTags=other?[...other.tags]:[];
  moveEntry(deck,key,zone);
  const moved=other || entry;
  moved.tags=other?[...new Set([...otherTags,...tags])]:tags;
  return moved;
}
export function assignEntryFunction(deck, key, name) {
  if(typeof name!=='string' || !name.trim() || name.trim().length>80 || name.includes(','))throw Error('Use one function name of 1–80 characters, without commas.');
  const entry=deck.cards.find(e=>entryKey(e)===key);
  if(!entry)throw Error('This card entry no longer exists.');
  name=name.trim();
  return editEntry(deck,key,[name,...entry.tags.filter(t=>t!==name)].join(', '),zoneFor(entry));
}
export function copyEntryToDeck(source, key, target, qty, zone) {
  if(source===target || source.id===target.id)throw Error('Choose another deck.');
  if(!Number.isInteger(qty) || qty<1 || qty>500)throw Error('Choose 1–500 copies.');
  if(typeof zone!=='string' || !Object.hasOwn(ZONES,zone))throw Error('Choose a destination zone.');
  const entry=source.cards.find(e=>entryKey(e)===key);
  if(!entry)throw Error('This card entry no longer exists.');
  const found=target.cards.find(e=>entryKey(e)===entryKey({card:entry.card,zone}));
  if(found && found.qty+qty>500)throw Error('Maximum 500 copies per card and zone. Nothing added.');
  if(!found && target.cards.length>=1000)throw Error('Maximum 1000 card entries per deck. Nothing added.');
  if(found){found.qty+=qty;found.tags=[...new Set([...found.tags,...entry.tags])];}
  else target.cards.push({card:structuredClone(entry.card),qty,tags:[...entry.tags],zone});
}
export function removeCardCopies(deck, key) {
  const entry=deck.cards.find(e=>entryKey(e)===key);
  if(!entry)throw Error('This card entry no longer exists.');
  const identity=entry.card.oracle_id || entry.card.id;
  const matches=e=>(e.card.oracle_id || e.card.id)===identity;
  const removed=count({cards:deck.cards.filter(matches)});
  deck.cards=deck.cards.filter(e=>!matches(e));
  return removed;
}
export function validatePrinting(original, printing) {
  if (printing?.layout==='reversible_card' && !printing.oracle_id && printing.card_faces?.length && printing.card_faces.every(f=>f.oracle_id===original.oracle_id)) {
    const face=printing.card_faces[0];
    printing={...printing,oracle_id:original.oracle_id,name:original.name,type_line:face.type_line,cmc:face.cmc,colors:face.colors || original.colors,color_identity:original.color_identity,oracle_text:face.oracle_text,mana_cost:face.mana_cost,power:face.power,toughness:face.toughness,loyalty:face.loyalty};
  }
  if (!original.oracle_id || printing?.oracle_id!==original.oracle_id) throw Error('This printing does not match the card’s rules identity.');
  validateBackup([{id:'printing',name:'Printing',format:'commander',cards:[{card:printing,qty:1,tags:[],zone:'main'}]}]);
  return printing;
}
export function setEntryPrinting(deck, key, printing) {
  const entry=deck.cards.find(e=>entryKey(e)===key);
  if (!entry) throw Error('This deck entry no longer exists. Reopen the card from your deck.');
  printing=validatePrinting(entry.card,printing);
  entry.card={...printing,legalities:entry.card.legalities || printing.legalities};
  return entry;
}
export const BRACKETS = {1:'Exhibition',2:'Core',3:'Upgraded',4:'Optimized',5:'cEDH'};
export function bracketReport(deck, snapshot=COMMANDER_BRACKETS, now=Date.now()) {
  const verified=Date.parse(snapshot?.verifiedAt), age=(now-verified)/86_400_000;
  const available=Boolean(snapshot && Array.isArray(snapshot.names) && snapshot.names.length && snapshot.names.every(n=>typeof n==='string' && n.trim()) && Number.isFinite(age) && age>=-1 && Number.isFinite(snapshot.reviewAfterDays));
  const stale=available && age>snapshot.reviewAfterDays;
  const normalize=name=>name.trim().replaceAll('’',"'").toLowerCase();
  const names=new Map(available?snapshot.names.map(name=>[normalize(name),name]):[]), matches=new Map();
  for(const entry of deck.cards.filter(e=>zoneFor(e)!=='sideboard' && zoneFor(e)!=='maybeboard')) {
    if(typeof entry.card?.name!=='string' || !Number.isInteger(entry.qty) || entry.qty<1)continue;
    const name=names.get(normalize(entry.card.name.split(' // ')[0]));
    if(name){const item=matches.get(name)||{name,qty:0,zones:[]};item.qty+=entry.qty;if(!item.zones.includes(zoneFor(entry)))item.zones.push(zoneFor(entry));matches.set(name,item);}
  }
  const count=[...matches.values()].reduce((sum,m)=>sum+m.qty,0);
  const missing=deck.cards.some(e=>zoneFor(e)!=='sideboard' && zoneFor(e)!=='maybeboard' && (typeof e.card?.name!=='string' || !e.card.name.trim() || !Number.isInteger(e.qty) || e.qty<1));
  const canSuggest=available && !stale && !missing && deck.format==='commander' && deck.cards.some(e=>zoneFor(e)!=='sideboard' && zoneFor(e)!=='maybeboard');
  return {available,stale,missing,count,matches:[...matches.values()],range:canSuggest&&count>0?(count<=3?[3,5]:[4,5]):null,canSuggest};
}
// One primary group per entry; multi-type filters still recognize every type on the deck-facing side.
const TYPE_PRIORITY=['Land','Creature','Planeswalker','Instant','Sorcery','Artifact','Enchantment','Battle','Conspiracy','Dungeon','Phenomenon','Plane','Scheme','Vanguard','Kindred'];
export function deckTypeLine(card) {
  if(card.layout==='split')return card.type_line || card.card_faces?.map(f=>f.type_line || '').join(' // ') || '';
  return card.card_faces?.[0]?.type_line || card.type_line?.split(' // ')[0] || '';
}
export function cardTypes(card) {
  const tokens=deckTypeLine(card).split(' // ').flatMap(line=>line.split(' — ')[0].split(/\s+/)).map(t=>t==='Tribal'?'Kindred':t);
  return TYPE_PRIORITY.filter(type=>tokens.includes(type));
}
export const isLand = card => cardTypes(card).includes('Land');
export const category = card => cardTypes(card)[0] || 'Other';
// The first personal role is primary; keeping the ordered tags preserves legacy backups.
export const primaryRole = entry => entry.tags[0] || 'Unassigned';
export function deckPrintingPrice(card) {
  const finishes = Array.isArray(card.finishes) ? card.finishes : [];
  const finish = !finishes.length || finishes.includes('nonfoil') ? 'regular' : finishes.length === 1 ? finishes[0] : null;
  const field = finish === 'regular' ? 'usd' : finish === 'foil' ? 'usd_foil' : finish === 'etched' ? 'usd_etched' : null;
  const quote = field ? card.prices?.[field] : null;
  const cents = parseCurrencyCents(typeof quote === 'number' ? String(quote) : quote);
  return { finish: field ? finish : null, cents };
}
const numeric = value => typeof value==='number' && Number.isFinite(value) ? value
  : typeof value==='string' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim()) && Number.isFinite(Number(value)) ? Number(value) : null;
const combatValue = (card, field) => numeric(card[field] ?? card.card_faces?.[0]?.[field]);
export function deckEntries(deck, { type = '', role = '', search = '', order = 'name' } = {}) {
  const terms=search.trim().toLocaleLowerCase('en').split(/\s+/).filter(Boolean);
  const mode=order.replace(/-desc$/,''), descending=order.endsWith('-desc') || mode==='quantity';
  const value=entry=>{
    const c=entry.card;
    if(mode==='price')return deckPrintingPrice(c).cents;
    if(mode==='power' || mode==='toughness')return combatValue(c,mode);
    return mode==='mana'?numeric(c.cmc):mode==='quantity'?entry.qty:null;
  };
  return deck.cards.filter(e=>{
    const text=[e.card.name,deckTypeLine(e.card),category(e.card),primaryRole(e),...e.tags].join(' ').toLocaleLowerCase('en');
    return (!type || (TYPE_PRIORITY.includes(type)?cardTypes(e.card).includes(type):deckTypeLine(e.card).includes(type))) && (!role || e.tags.includes(role)) && terms.every(term=>text.includes(term));
  }).sort((a,b)=>{
    const av=value(a),bv=value(b);
    // Missing values always sort last, including in descending order.
    const compared=av===null?(bv===null?0:1):bv===null?-1:(av-bv)*(descending?-1:1);
    return compared || a.card.name.localeCompare(b.card.name,'en') || entryKey(a).localeCompare(entryKey(b),'en') || a.card.id.localeCompare(b.card.id,'en');
  });
}
export function deckIdentity(deck) {
  const entries = deck.cards.filter(e => zoneFor(e) === (deck.format === 'commander' ? 'command' : 'main'));
  return [...'WUBRG'].filter(c => entries.some(e => e.card.color_identity.includes(c)));
}
export const imageFor = card => card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal;
export function safeUrl(value, image = false) {
  try { const u = new URL(value); return u.protocol === 'https:' && (image ? u.hostname.endsWith('.scryfall.io') || u.hostname === 'cards.scryfall.io' : u.hostname === 'scryfall.com') ? u.href : ''; }
  catch { return ''; }
}
export const oracle = card => card.oracle_text || card.card_faces?.map(f => f.oracle_text).join('\n\n') || '';
const hasOracle = card => typeof card.oracle_text === 'string' || Boolean(card.card_faces?.length && card.card_faces.every(f => typeof f.oracle_text === 'string'));
export function queryFor(f, deck) {
  if(typeof f.query==='string')return f.query.trim()||'game:paper';
  const bits = [f.raw.trim()];
  if (f.name.trim()) bits.push('name:' + JSON.stringify(f.name.trim()));
  if (f.oracle.trim()) bits.push('o:' + JSON.stringify(f.oracle.trim()));
  if (f.type) bits.push('t:' + f.type);
  if (f.mv !== '') bits.push('mv' + f.mvOp + Number(f.mv));
  if (f.cost.trim()) bits.push('m:' + f.cost.trim());
  if (f.colors.length) bits.push('id<=' + f.colors.join(''));
  if (f.tags.length) bits.push('(' + f.tags.map(t => 'otag:' + t).join(f.match === 'any' ? ' OR ' : ' ') + ')');
  if (f.legal && deck) bits.push('f:' + deck.format);
  return bits.filter(Boolean).join(' ') || 'game:paper';
}
export function relaxationOptions(f, deck) {
  if(typeof f.query==='string')return searchOptions(f);
  return [
    ['name', f.name.trim(), `Card name: ${f.name}`],
    ['oracle', f.oracle.trim(), `Oracle phrase: ${f.oracle}`],
    ['type', f.type, `Type: ${f.type}`],
    ['mv', f.mv !== '', `Mana value: ${f.mvOp}${f.mv}`],
    ['cost', f.cost.trim(), `Mana cost: ${f.cost}`],
    ['colors', f.colors.length, `Color identity: ${f.colors.join(', ')}`],
    ['tags', f.tags.length, `Function tags (${f.match}): ${f.tags.join(', ')}`],
    ['legal', f.legal && deck, `Format legality: ${deck?.format}`],
  ].filter(([, active]) => active).map(([key,, label]) => ({ key, label }));
}
export function relaxSearch(f, deck, key) {
  const option = relaxationOptions(f, deck).find(o => o.key === key);
  if (!option) throw Error('Choose an active guided condition to relax.');
  const original = structuredClone(f), relaxed = structuredClone(f);
  if(typeof f.query==='string')return {original,filters:replaceCondition(f,key,''),originalQuery:queryFor(f),query:queryFor(replaceCondition(f,key,'')),label:option.label};
  relaxed[key] = Array.isArray(f[key]) ? [] : key === 'legal' ? false : '';
  return { original, filters: relaxed, originalQuery: queryFor(original, deck), query: queryFor(relaxed, deck), label: option.label };
}
export function stats(deck, { detailed = false } = {}) {
  const result = { total: 0, lands: 0, spells: 0, average: 0, curve: Array(8).fill(0), types: {}, tags: Object.create(null), colors: Object.fromEntries('WUBRGC'.split('').map(c => [c, 0])) };
  const values = detailed ? new Map() : null;
  if (detailed) {
    result.breakdowns = Object.fromEntries(['color', 'type', 'function', 'power', 'toughness', 'rarity'].map(key => [key, new Map()]));
    result.draw = { total: 0, types: new Map(), functions: new Map() };
    result.functions = new Map();
    result.manaCosts = manaDistribution();
    result.manaSources = manaDistribution();
    result.tokens = { references: new Map(), unavailable: 0 };
  }
  let value = 0;
  for (const entry of deck.cards) {
    const zone = zoneFor(entry);
    if (zone !== 'main' && !(zone === 'command' && deck.format === 'commander')) continue;
    const { card, qty, tags = [] } = entry;
    const types = cardTypes(card), type = types[0] || 'Other';
    const storedColors = card.colors ?? card.card_faces?.[0]?.colors;
    const knownColors = Array.isArray(storedColors) ? storedColors.filter(color => typeof color === 'string' && /^[WUBRG]$/.test(color)) : [];
    const colors = knownColors.length ? knownColors : ['C'];
    result.types[type] = (result.types[type] || 0) + qty;
    for (const tag of tags) result.tags[tag] = (result.tags[tag] || 0) + qty;
    for (const c of colors) result.colors[c] += qty;
    const primary = detailed ? primaryRole({ tags }) : null;
    if (detailed) {
      if (tags[0]) addWeight(result.functions, primary, qty);
      countMana(card, qty, result.manaCosts, result.manaSources);
      collectTokens(card, qty, result.tokens);
    }
    if (detailed && zone === 'main') {
      result.draw.total += qty;
      addWeight(result.draw.types, type, qty);
      addWeight(result.draw.functions, primary, qty);
    }
    if (type === 'Land') {
      result.lands += qty;
      continue;
    }
    result.spells += qty;
    value += card.cmc * qty;
    const bucket = Math.min(7, Math.max(0, Math.floor(card.cmc)));
    result.curve[bucket] += qty;
    if (detailed) {
      addWeight(values, card.cmc, qty);
      const groups = {
        color: [...new Set(colors)], type: types.length ? types : ['Other'], function: [primary],
        power: [combatValue(card, 'power') ?? 'No fixed value'], toughness: [combatValue(card, 'toughness') ?? 'No fixed value'],
        rarity: [typeof card.rarity === 'string' && card.rarity.trim() ? card.rarity.trim() : 'Unknown'],
      };
      for (const [key, labels] of Object.entries(groups)) {
        const breakdown = result.breakdowns[key];
        for (const label of labels) {
          if (!breakdown.has(label)) breakdown.set(label, Array(8).fill(0));
          breakdown.get(label)[bucket] += qty;
        }
      }
    }
  }
  result.total = result.lands + result.spells;
  result.average = result.spells ? value / result.spells : 0;
  if (detailed) {
    result.manaValue = value;
    result.median = weightedMedian(values, result.spells);
  }
  return result;
}

const coloredMana = /^[WUBRG]$/;
const manaDistribution = () => ({ colors: Object.fromEntries([...'WUBRG'].map(color => [color, 0])), unavailable: 0 });

function countMana(card, qty, costs, sources) {
  const faceCosts = card.card_faces?.map(face => face.mana_cost) ?? [];
  const manaCosts = typeof card.mana_cost === 'string' ? [card.mana_cost] : faceCosts;
  if (!manaCosts.length || manaCosts.some(cost => typeof cost !== 'string')) costs.unavailable += qty;
  for (const cost of manaCosts.filter(value => typeof value === 'string')) {
    for (const [, symbol] of cost.matchAll(/\{([^{}]+)\}/g)) {
      const options = [...new Set(symbol.split('/').filter(part => coloredMana.test(part)))];
      for (const color of options) costs.colors[color] += qty / options.length;
    }
  }
  if (Array.isArray(card.produced_mana) && card.produced_mana.every(color => typeof color === 'string' && /^[WUBRGC]$/.test(color))) {
    for (const color of new Set(card.produced_mana.filter(color => coloredMana.test(color)))) sources.colors[color] += qty;
  } else if (card.produced_mana !== undefined || card.object !== 'card') {
    sources.unavailable += qty;
  }
}

function collectTokens(card, qty, tokens) {
  const parts = card.all_parts;
  if (parts === undefined && card.object === 'card') return;
  if (!Array.isArray(parts)) {
    tokens.unavailable += qty;
    return;
  }
  let incomplete = false;
  for (const part of parts) {
    if (typeof part?.component !== 'string') incomplete = true;
    if (part?.component !== 'token') continue;
    if (typeof part.id !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(part.id)
        || typeof part.name !== 'string' || !part.name.trim() || typeof part.type_line !== 'string' || !part.type_line.trim()) {
      incomplete = true;
      continue;
    }
    tokens.references.set(part.id.toLowerCase(), { name: part.name, type: part.type_line });
  }
  if (incomplete) tokens.unavailable += qty;
}

function addWeight(groups, key, qty) {
  groups.set(key, (groups.get(key) ?? 0) + qty);
}
function weightedMedian(values, total) {
  const lower = Math.floor((total - 1) / 2), upper = Math.floor(total / 2);
  let cumulative = 0, first;
  for (const [value, qty] of [...values].sort(([a], [b]) => a - b)) {
    cumulative += qty;
    if (cumulative > lower) first ??= value;
    if (cumulative > upper) return first / 2 + value / 2;
  }
  return null;
}
export function drawProbability(total, matching, draws, wanted, comparison) {
  const misses = total - matching;
  const min = Math.max(0, draws - misses), max = Math.min(draws, matching);
  const from = comparison === 'at-most' ? min : wanted;
  const to = comparison === 'at-least' ? max : wanted;
  if (from > max || to < min) return 0;
  if (from <= min && to >= max) return 1;

  // Start at the most likely outcome. Relative weights avoid huge binomial
  // coefficients and underflow from starting at an extreme tail.
  const mode = Math.floor((draws + 1) * (matching + 1) / (total + 2));
  const included = hits => hits >= from && hits <= to;
  let sum = 1, selected = included(mode) ? 1 : 0;
  for (let hits = mode, weight = 1; hits > min; hits--) {
    weight *= hits * (misses - draws + hits) / ((matching - hits + 1) * (draws - hits + 1));
    sum += weight;
    if (included(hits - 1)) selected += weight;
  }
  for (let hits = mode, weight = 1; hits < max; hits++) {
    weight *= (matching - hits) * (draws - hits) / ((hits + 1) * (misses - draws + hits + 1));
    sum += weight;
    if (included(hits + 1)) selected += weight;
  }
  return selected / sum;
}
export function legalityReport(deck) {
  const failed = [], unavailable = [], manual = [];
  const main = zoneCount(deck, 'main'), side = zoneCount(deck, 'sideboard'), command = zoneCount(deck, 'command');
  const commanders = deck.cards.filter(e => zoneFor(e) === 'command');
  const commander = commanders[0];
  if (deck.format === 'commander') {
    if (main + command !== 100) failed.push(`Commander needs exactly 100 cards including the command zone (${main + command}/100).`);
    if (!command) failed.push('Choose a commander from your deck and move it to the command zone.');
    if (commanders.some(e => e.qty !== 1)) failed.push('Each commander must have exactly one copy in the command zone.');
    if (commanders.length > 1) manual.push('Multiple commanders: pairing compatibility and combined identity require manual review.');
    if (commander && !(/Legendary.*Creature/.test(commander.card.type_line) || /can be your commander/i.test(oracle(commander.card)))) manual.push(`${commander.card.name}: commander eligibility requires manual review.`);
    if (side) manual.push('Commander sideboard/outside-game cards are not validated; they do not count toward the 100-card deck.');
    manual.push('Commander coverage is partial: verify commander eligibility and pairings, basic-land types allowed by commander color identity, and special construction rules. The app does not fully check these rules.');
  } else {
    if (main < 60) failed.push(`Main deck needs at least 60 cards (${main}/60); sideboard and command-zone cards do not count.`);
    if (side > 15) failed.push(`Sideboard has ${side} cards; maximum 15.`);
    if (command) failed.push('This constructed format has no command zone. Move those cards to the main deck or sideboard.');
    if (deck.format !== 'modern') manual.push('Only Modern has a supported construction rule set. This format uses shared size and copy checks; verify its format-specific construction rules yourself.');
  }
  const groups = new Map();
  const checked = deck.cards.filter(e => zoneFor(e) !== 'maybeboard' && zoneFor(e) !== (deck.format === 'commander' ? 'sideboard' : 'command'));
  for (const entry of checked) {
    const { card } = entry, name = card.name.toLowerCase();
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(entry);
    const status = card.legalities?.[deck.format];
    if (!status || !['legal','restricted','banned','not_legal'].includes(status) || (status === 'restricted' && deck.format !== 'vintage')) unavailable.push(`${card.name} (${ZONES[zoneFor(entry)]}): legality data unavailable. Refresh card data.`);
    else if (status !== 'legal' && status !== 'restricted') failed.push(`${card.name} (${ZONES[zoneFor(entry)]}): ${status.replaceAll('_',' ')} in ${deck.format} according to stored card legality.`);
    if (!hasOracle(card)) unavailable.push(`${card.name}: Oracle text unavailable; copy exceptions and special restrictions cannot be fully checked.`);
    if (/\bCompanion\b/.test(oracle(card)) || card.keywords?.includes('Companion')) manual.push(`${card.name}: companion designation and starting-deck restrictions are not checked.`);
    if (deck.format === 'commander' && commanders.length === 1 && commander && card.color_identity.some(c => !commander.card.color_identity.includes(c))) failed.push(`${card.name} (${ZONES[zoneFor(entry)]}) is outside your commander's color identity (${commander.card.name}).`);
  }
  for (const entries of groups.values()) {
    const qty = count({cards:entries}), card = (entries.find(e=>hasOracle(e.card)) || entries[0]).card, text = oracle(card);
    if (deck.format === 'vintage' && entries.some(e => e.card.legalities?.[deck.format] === 'restricted') && qty > 1) { failed.push(`${card.name} is restricted to one copy across zones.`); continue; }
    if (!hasOracle(card)) continue;
    if (/\bBasic\b/.test(card.type_line) || /A deck can have any number of cards named/i.test(text)) continue;
    const special = text.match(/A deck can have up to (\w+) cards named/i);
    let limit = deck.format === 'commander' ? 1 : 4;
    if (special) {
      limit = ({seven:7,nine:9})[special[1].toLowerCase()] || Number(special[1]);
      if (!Number.isInteger(limit) || limit < 1) { manual.push(`${card.name}: unrecognized copy exception requires manual review.`); continue; }
    }
    if (qty > limit) failed.push(`${card.name}: maximum ${limit} copies across ${deck.format === 'commander' ? 'main deck and command zone' : 'main deck and sideboard'} (${qty} stored).`);
  }
  return { failed:[...new Set(failed)], unavailable:[...new Set(unavailable)], manual:[...new Set(manual)] };
}
export function legality(deck) { const report = legalityReport(deck); return [...report.failed, ...report.unavailable]; }
export function exportDeckText(deck) {
  return Object.entries(ZONES).filter(([z])=>zoneCount(deck,z)>0).map(([z,label])=>label+'\n'+deck.cards.filter(e=>zoneFor(e)===z).map(e=>`${e.qty} ${e.card.name}`).join('\n')).join('\n\n');
}
export function resolveImport(parsed, cards) {
  const entries=[], problems=[];
  for (const p of parsed) {
    const name=p.name.toLowerCase(), matches=cards.filter(c=>c.name.toLowerCase()===name||c.card_faces?.some(f=>f.name.toLowerCase()===name));
    const identities=new Set(matches.map(c=>c.oracle_id||c.id));
    if (identities.size!==1) { problems.push({name:p.name,reason:identities.size?'Ambiguous name':'Not found'}); continue; }
    entries.push({card:matches[0],qty:p.qty,tags:[],zone:p.zone||'main'});
  }
  return {entries,problems};
}
export function validateBackup(data) {
  if (!Array.isArray(data) || data.length > 200) throw new Error('Invalid deck backup.');
  const ids = new Set();
  for (const d of data) {
    if (!d || typeof d.id !== 'string' || ids.has(d.id) || typeof d.name !== 'string' || d.name.length > 100 || !FORMATS.includes(d.format) || !Array.isArray(d.cards) || d.cards.length > 1000) throw new Error('Invalid deck backup.');
    if (d.bracket !== undefined && (!Number.isInteger(d.bracket) || !Object.hasOwn(BRACKETS,d.bracket))) throw Error('Invalid assigned Commander bracket.');
    if (d.budgetCents !== undefined && (!Number.isInteger(d.budgetCents) || d.budgetCents < 0 || d.budgetCents > 100_000_000)) throw Error('Invalid deck budget.');
    if (d.budgetBasis !== undefined && !['missing','full'].includes(d.budgetBasis)) throw Error('Invalid deck budget basis.');
    if (d.budgetZones !== undefined && (!Array.isArray(d.budgetZones) || new Set(d.budgetZones).size !== d.budgetZones.length || ![...d.budgetZones].every(zone=>BUDGET_ZONE_ORDER.includes(zone)))) throw Error('Invalid budget zones.');
    if (d.ownershipMatch !== undefined && !['rules','printing'].includes(d.ownershipMatch)) throw Error('Invalid ownership match mode.');
    if (d.priceUpdatedAt !== undefined && (typeof d.priceUpdatedAt !== 'string' || !Number.isFinite(Date.parse(d.priceUpdatedAt)))) throw Error('Invalid price refresh date.');
    ids.add(d.id);
    const cards = new Set();
    for (const e of d.cards) {
      if (!e || (e.zone !== undefined && (typeof e.zone !== 'string' || !Object.hasOwn(ZONES, e.zone))) || (e.commander !== undefined && typeof e.commander !== 'boolean') || (e.commander === true && e.zone !== undefined && e.zone !== 'command')) throw new Error('Invalid deck zone.');
      const c = e.card;
      if (!c || typeof c.id !== 'string' || cards.has(entryKey(e)) || typeof c.name !== 'string' || typeof c.type_line !== 'string' || !Number.isFinite(c.cmc) || !Number.isInteger(e.qty) || e.qty < 1 || e.qty > 500 || !Array.isArray(c.color_identity) || !Array.isArray(e.tags) || e.tags.some(t => typeof t !== 'string' || t.length > 80)) throw new Error('Invalid card in deck backup.');
      if (c.colors !== undefined && (!Array.isArray(c.colors) || c.colors.some(x => !'WUBRG'.includes(x)))) throw new Error('Invalid card colors.');
      if (c.color_identity.some(x => typeof x !== 'string' || !/^[WUBRG]$/.test(x))) throw new Error('Invalid card identity.');
      if (c.oracle_text !== undefined && typeof c.oracle_text !== 'string') throw new Error('Invalid Oracle text.');
      if (c.mana_cost !== undefined && typeof c.mana_cost !== 'string') throw new Error('Invalid mana cost.');
      if (c.card_faces !== undefined && (!Array.isArray(c.card_faces) || c.card_faces.some(f => !f || (f.oracle_text !== undefined && typeof f.oracle_text !== 'string')))) throw new Error('Invalid card faces.');
      cards.add(entryKey(e));
    }
  }
  return data;
}

const FINISHES = ['regular','foil','etched'];
const CONDITIONS = ['near_mint','lightly_played','moderately_played','heavily_played','damaged'];

export function rulesIdentity(card) {
  if (typeof card?.oracle_id === 'string' && card.oracle_id) return card.oracle_id;
  const ids = [...new Set((card?.card_faces || []).map(face=>face?.oracle_id).filter(id=>typeof id==='string'&&id))];
  return ids.length===1 ? ids[0] : null;
}

export function validateCollection(data) {
  if (!Array.isArray(data) || data.length > 5000) throw Error('Invalid collection.');
  const keys=new Set();
  for (const lot of data) {
    if (!lot || !Number.isInteger(lot.qty) || lot.qty<1 || lot.qty>9999 || !FINISHES.includes(lot.finish) || (lot.condition!==undefined && !CONDITIONS.includes(lot.condition))) throw Error('Invalid collection lot.');
    validateBackup([{id:'collection',name:'Collection',format:'commander',cards:[{card:lot.card,qty:1,tags:[],zone:'main'}]}]);
    const key=[lot.card.id,lot.finish,lot.condition||''].join('|');
    if (keys.has(key)) throw Error('Duplicate collection lot.');
    keys.add(key);
  }
  return data;
}

function parseCurrencyCents(value) {
  if (typeof value !== 'string' || !/^\d+(?:[.,]\d{1,2})?$/.test(value.trim())) return null;
  const [units,cents=''] = value.trim().replace(',','.').split('.');
  const result=Number(units)*100+Number(cents.padEnd(2,'0'));
  return Number.isSafeInteger(result) ? result : null;
}
export const parseEuroCents = parseCurrencyCents;
export function parseEuroQuote(value) {
  const cents = parseEuroCents(value);
  // Keep totals exact even for a backup with 1,000 entries of 500 copies.
  return cents !== null && cents <= 1_000_000_000 ? cents : null;
}

export function storedEuroPrice(entry) {
  const finish = entry.finish ?? deckPrintingPrice(entry.card).finish;
  const field = finish === 'regular' ? 'eur' : finish === 'foil' ? 'eur_foil' : null;
  return { finish, field, cents: field ? parseEuroQuote(entry.card.prices?.[field]) : null };
}

export function collectionReport(deck, collection) {
  validateBackup([deck]);validateCollection(collection);
  const mode=deck.ownershipMatch||'rules', zones=deck.budgetZones??DEFAULT_BUDGET_ZONES;
  const entries=[...deck.cards].sort((a,b)=>BUDGET_ZONE_ORDER.indexOf(zoneFor(a))-BUDGET_ZONE_ORDER.indexOf(zoneFor(b))||a.card.id.localeCompare(b.card.id));
  const matchKey=card=>mode==='printing'?card.id:rulesIdentity(card);
  const available=new Map();
  for(const lot of collection){const key=matchKey(lot.card);if(key)available.set(key,(available.get(key)||0)+lot.qty);}
  let demand=0,owned=0,missing=0,fullCents=0,missingCents=0,fullUnpriced=0,missingUnpriced=0;
  const rows=entries.map(entry=>{
    const key=matchKey(entry.card),zone=zoneFor(entry),included=zones.includes(zone);
    const { cents: unitCents, finish } = storedEuroPrice(entry);
    const row={entry,zone,included,demand:entry.qty,unitCents,finish,identityResolved:Boolean(key)};
    if(!included)return {...row,owned:null,missing:null};
    const have=available.get(key)||0,used=Math.min(entry.qty,have),needed=entry.qty-used;
    if(key)available.set(key,have-used);
    demand+=entry.qty;owned+=used;missing+=needed;
    if(unitCents===null){fullUnpriced+=entry.qty;missingUnpriced+=needed;}else{fullCents+=unitCents*entry.qty;missingCents+=unitCents*needed;}
    return {...row,owned:used,missing:needed};
  });
  return {mode,zones,rows,demand,owned,missing,fullCents,missingCents,fullUnpriced,missingUnpriced};
}


export function workspaceFile(decks, collection=null) {
  const file={format:'arcana-workspace',version:collection===null?1:2,exportedAt:new Date().toISOString(),decks:validateBackup(decks)};
  if(collection!==null)file.collection=validateCollection(collection);
  return file;
}
export function readWorkspaceFile(data) {
  if (Array.isArray(data)) return {decks:validateBackup(data),collection:null};
  if (!data || data.format!=='arcana-workspace') throw Error('Choose an Arcana workspace JSON file or legacy backup.');
  if (![1,2].includes(data.version)) throw Error('Unsupported workspace file version. Keep this file and open it with a compatible Arcana version.');
  if (typeof data.exportedAt!=='string' || !Number.isFinite(Date.parse(data.exportedAt))) throw Error('Invalid workspace export date.');
  return {decks:validateBackup(data.decks),collection:data.version===2?validateCollection(data.collection):null};
}
