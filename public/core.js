import { TAG_CATALOG } from './tag-catalog.js';
import { replaceCondition, searchOptions } from './search.js';
export { parseQuery, replaceCondition, conditionQuery, SEARCH_FAMILIES } from './search.js';
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
export const ZONES = { main: 'Main deck', sideboard: 'Sideboard', command: 'Command zone' };
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
export const isLand = card => /\bLand\b/.test(card.type_line);
export const category = card => ['Land', 'Creature', 'Planeswalker', 'Instant', 'Sorcery', 'Artifact', 'Enchantment', 'Battle'].find(t => card.type_line?.includes(t)) || 'Other';
// The first personal role is primary; keeping the ordered tags preserves legacy backups.
export const primaryRole = entry => entry.tags[0] || 'Unassigned';
export function deckEntries(deck, { type = '', role = '', order = 'name' } = {}) {
  return deck.cards.filter(e => (!type || e.card.type_line.includes(type)) && (!role || e.tags.includes(role)))
    .sort((a, b) => (order === 'mana' ? a.card.cmc - b.card.cmc : order === 'quantity' ? b.qty - a.qty : 0) || a.card.name.localeCompare(b.card.name));
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
export function stats(deck) {
  const result = { total: count(deck), lands: 0, spells: 0, average: 0, curve: Array(8).fill(0), types: {}, tags: Object.create(null), colors: Object.fromEntries('WUBRGC'.split('').map(c => [c, 0])) };
  let value = 0;
  for (const { card, qty, tags = [] } of deck.cards.filter(e => zoneFor(e) !== 'sideboard' && (deck.format === 'commander' || zoneFor(e) === 'main'))) {
    const type = category(card);
    result.types[type] = (result.types[type] || 0) + qty;
    for (const tag of tags) result.tags[tag] = (result.tags[tag] || 0) + qty;
    if (isLand(card)) result.lands += qty;
    else { result.spells += qty; value += card.cmc * qty; result.curve[Math.min(7, Math.floor(card.cmc))] += qty; }
    for (const c of card.colors?.length ? card.colors : ['C']) result.colors[c] += qty;
  }
  result.total = result.lands + result.spells;
  result.average = result.spells ? value / result.spells : 0;
  return result;
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
    manual.push('Commander coverage is partial: pairings, basic-land type restrictions and special construction rules require manual review.');
  } else {
    if (main < 60) failed.push(`Main deck needs at least 60 cards (${main}/60); sideboard and command-zone cards do not count.`);
    if (side > 15) failed.push(`Sideboard has ${side} cards; maximum 15.`);
    if (command) failed.push('This constructed format has no command zone. Move those cards to the main deck or sideboard.');
    if (deck.format !== 'modern') manual.push('D03 validates Modern construction; this format uses shared constructed checks with remaining format-specific rules requiring manual review.');
  }
  const groups = new Map();
  const checked = deck.cards.filter(e => zoneFor(e) !== (deck.format === 'commander' ? 'sideboard' : 'command'));
  for (const entry of checked) {
    const { card } = entry, name = card.name.toLowerCase();
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(entry);
    const status = card.legalities?.[deck.format];
    if (!status || !['legal','restricted','banned','not_legal'].includes(status) || (status === 'restricted' && deck.format !== 'vintage')) unavailable.push(`${card.name} (${ZONES[zoneFor(entry)]}): legality data unavailable. Refresh card data.`);
    else if (status !== 'legal' && status !== 'restricted') failed.push(`${card.name} (${ZONES[zoneFor(entry)]}): ${status.replaceAll('_',' ')}.`);
    if (!hasOracle(card)) unavailable.push(`${card.name}: Oracle text unavailable; copy exceptions and special restrictions cannot be fully checked.`);
    if (/\bCompanion\b/.test(oracle(card)) || card.keywords?.includes('Companion')) manual.push(`${card.name}: companion designation and starting-deck restrictions are not checked.`);
    if (deck.format === 'commander' && commanders.length === 1 && commander && card.color_identity.some(c => !commander.card.color_identity.includes(c))) failed.push(`${card.name} is outside your commander's color identity.`);
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
export function parseImport(text) {
  const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(l=>l&&!l.startsWith('//')&&!l.startsWith('#'));
  const heading = /^(Main deck|Sideboard|Command zone|Commander):?$/i;
  const zoned = lines.some(l=>heading.test(l));
  if (!lines.length || lines.length > 310) throw Error('Import 1–300 card lines.');
  let zone = 'main', lineCount = 0;
  const entries = new Map();
  for (const line of lines) {
    const section = line.match(heading);
    if (section) { zone = /sideboard/i.test(section[1]) ? 'sideboard' : /command/i.test(section[1]) ? 'command' : 'main'; continue; }
    if (++lineCount > 300) throw Error('Import 1–300 card lines.');
    const match = line.match(/^(\d+)x?\s+(.+?)(?:\s+\([A-Za-z0-9]+\)\s+\S+)?$/);
    if (!match || +match[1] < 1 || +match[1] > 500) throw Error(`Cannot read “${line}”. Use “1 Card Name” per line, with optional Main deck, Sideboard or Command zone headings.`);
    const name=match[2], key=zone+'|'+name.toLowerCase(), previous=entries.get(key);
    entries.set(key,{name,qty:(previous?.qty||0)+Number(match[1]),...(zoned?{zone}:{})});
    if(entries.get(key).qty>500)throw Error('Maximum 500 copies per card in a zone.');
  }
  if(!entries.size)throw Error('Import 1–300 card lines.');
  return [...entries.values()];
}
export function validateBackup(data) {
  if (!Array.isArray(data) || data.length > 200) throw new Error('Invalid deck backup.');
  const ids = new Set();
  for (const d of data) {
    if (!d || typeof d.id !== 'string' || ids.has(d.id) || typeof d.name !== 'string' || d.name.length > 100 || !FORMATS.includes(d.format) || !Array.isArray(d.cards) || d.cards.length > 1000) throw new Error('Invalid deck backup.');
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
