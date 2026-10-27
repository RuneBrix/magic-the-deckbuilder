import { TAG_CATALOG } from './tag-catalog.js';
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
export const isLand = card => /\bLand\b/.test(card.type_line);
export const category = card => ['Land', 'Creature', 'Planeswalker', 'Instant', 'Sorcery', 'Artifact', 'Enchantment', 'Battle'].find(t => card.type_line?.includes(t)) || 'Other';
export const imageFor = card => card.image_uris?.normal || card.card_faces?.[0]?.image_uris?.normal;
export function safeUrl(value, image = false) {
  try { const u = new URL(value); return u.protocol === 'https:' && (image ? u.hostname.endsWith('.scryfall.io') || u.hostname === 'cards.scryfall.io' : u.hostname === 'scryfall.com') ? u.href : ''; }
  catch { return ''; }
}
export const oracle = card => card.oracle_text || card.card_faces?.map(f => f.oracle_text).join('\n\n') || '';
export function queryFor(f, deck) {
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
export function stats(deck) {
  const result = { total: count(deck), lands: 0, spells: 0, average: 0, curve: Array(8).fill(0), types: {}, tags: Object.create(null), colors: Object.fromEntries('WUBRGC'.split('').map(c => [c, 0])) };
  let value = 0;
  for (const { card, qty, tags = [] } of deck.cards) {
    const type = category(card);
    result.types[type] = (result.types[type] || 0) + qty;
    for (const tag of tags) result.tags[tag] = (result.tags[tag] || 0) + qty;
    if (isLand(card)) result.lands += qty;
    else { result.spells += qty; value += card.cmc * qty; result.curve[Math.min(7, Math.floor(card.cmc))] += qty; }
    for (const c of card.colors?.length ? card.colors : ['C']) result.colors[c] += qty;
  }
  result.average = result.spells ? value / result.spells : 0;
  return result;
}
export function legality(deck) {
  const issues = [], total = count(deck);
  const commander = deck.cards.find(e => e.commander);
  if (deck.format === 'commander') {
    if (total !== 100) issues.push(`Commander needs exactly 100 cards including the commander (${total}/100).`);
    if (!commander) issues.push('Choose a commander from your deck.');
    if (deck.cards.filter(e => e.commander).length > 1) issues.push('This MVP supports one commander; review partner pairings manually.');
    if (commander && !(/Legendary.*Creature/.test(commander.card.type_line) || /can be your commander/i.test(oracle(commander.card)))) issues.push(`${commander.card.name} is not a supported commander.`);
  } else if (total < 60) issues.push(`Main deck needs at least 60 cards (${total}/60).`);
  for (const { card, qty } of deck.cards) {
    const status = card.legalities?.[deck.format];
    if (status !== 'legal' && status !== 'restricted') issues.push(`${card.name}: ${status?.replaceAll('_', ' ') || 'legality unknown'}.`);
    if (status === 'restricted' && qty > 1) issues.push(`${card.name} is restricted to one copy.`);
    const text = oracle(card);
    const anyCopies = /any number of cards named/i.test(text);
    const specialLimit = text.match(/up to (seven|nine) cards named/i);
    const limit = specialLimit ? ({ seven: 7, nine: 9 })[specialLimit[1].toLowerCase()] : deck.format === 'commander' ? 1 : 4;
    if (!/Basic.*Land/.test(card.type_line) && !anyCopies && qty > limit) issues.push(`${card.name}: maximum ${limit} copies.`);
    if (deck.format === 'commander' && commander && (card.color_identity || []).some(c => !commander.card.color_identity.includes(c))) issues.push(`${card.name} is outside your commander's color identity.`);
  }
  return issues;
}
export function parseImport(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('//') && !l.startsWith('#'));
  if (!lines.length || lines.length > 300) throw new Error('Import 1–300 card lines.');
  const entries = new Map();
  for (const line of lines) {
    const match = line.match(/^(\d+)x?\s+(.+?)(?:\s+\([A-Za-z0-9]+\)\s+\S+)?$/);
    if (!match || +match[1] < 1 || +match[1] > 500) throw new Error(`Cannot read “${line}”. Use “1 Card Name” per line, without section headings.`);
    const name = match[2], key = name.toLowerCase(), previous = entries.get(key);
    entries.set(key, { name, qty: (previous?.qty || 0) + +match[1] });
    if (entries.get(key).qty > 500) throw new Error('Maximum 500 copies per card.');
  }
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
      const c = e.card;
      if (!c || typeof c.id !== 'string' || cards.has(c.oracle_id || c.id) || typeof c.name !== 'string' || typeof c.type_line !== 'string' || !Number.isFinite(c.cmc) || !Number.isInteger(e.qty) || e.qty < 1 || e.qty > 500 || !Array.isArray(c.color_identity) || !Array.isArray(e.tags) || e.tags.some(t => typeof t !== 'string' || t.length > 80)) throw new Error('Invalid card in deck backup.');
      if (c.colors !== undefined && (!Array.isArray(c.colors) || c.colors.some(x => !'WUBRG'.includes(x)))) throw new Error('Invalid card colors.');
      if (c.color_identity.some(x => typeof x !== 'string' || !/^[WUBRG]$/.test(x))) throw new Error('Invalid card identity.');
      if (c.oracle_text !== undefined && typeof c.oracle_text !== 'string') throw new Error('Invalid Oracle text.');
      if (c.mana_cost !== undefined && typeof c.mana_cost !== 'string') throw new Error('Invalid mana cost.');
      if (c.card_faces !== undefined && (!Array.isArray(c.card_faces) || c.card_faces.some(f => !f || (f.oracle_text !== undefined && typeof f.oracle_text !== 'string')))) throw new Error('Invalid card faces.');
      cards.add(c.oracle_id || c.id);
    }
  }
  return data;
}
