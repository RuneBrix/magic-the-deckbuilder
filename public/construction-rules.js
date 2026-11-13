// Bounded construction checks. Sources and deliberate limits: docs/CONSTRUCTION_RULES.md.
const text = card => card.card_faces?.length ? card.card_faces[0].oracle_text ?? '' : card.oracle_text ?? '';
const front = card => card.card_faces?.[0] ?? card;
const type = card => front(card).type_line ?? '';
const legendary = card => /\bLegendary\b/.test(type(card));
const keyword = (card, name) => card.keywords?.includes(name) || text(card).replaceAll('’', "'").split('\n').some(line => line.split(' (')[0].toLowerCase() === name.toLowerCase());
const plainPartner = card => /^Partner(?: \(|$)/mi.test(text(card));
export const companionCapable = card => keyword(card, 'Companion') || /^Companion\s*[—-]/m.test(text(card));
const knownText = card => typeof front(card).oracle_text === 'string';
const partnerLabel = card => text(card).match(/^Partner\s*[—-]\s*([^\n(]+)/mi)?.[1].trim().toLowerCase() || (keyword(card, 'Friends forever') ? 'friends forever' : null);
const partnerName = card => text(card).match(/^Partner with ([^\n(]+)/mi)?.[1].trim().toLowerCase();
const doctor = card => legendary(card) && /\bCreature\b/.test(type(card)) && type(card).split(' — ')[1]?.trim() === 'Time Lord Doctor';
const background = card => legendary(card) && /\bEnchantment\b/.test(type(card)) && /\bBackground\b/.test(type(card));
function eligible(card) {
  if (!type(card)) return null;
  if (/can be your commander\./i.test(text(card))) return true;
  if (/can be your commander/i.test(text(card))) return null;
  if (!legendary(card)) return false;
  if (/\bCreature\b/.test(type(card))) return true;
  if (/\bVehicle\b/.test(type(card))) return true;
  if (/\bSpacecraft\b/.test(type(card))) return typeof front(card).power === 'string' && typeof front(card).toughness === 'string' ? true : null;
  return false;
}
function paired(a, b) {
  if (!legendary(a) || !legendary(b)) return false;
  return Boolean(plainPartner(a) && plainPartner(b)
    || partnerLabel(a) && partnerLabel(a) === partnerLabel(b)
    || partnerName(a) === b.name.toLowerCase() && partnerName(b) === a.name.toLowerCase()
    || keyword(a, 'Choose a Background') && background(b)
    || keyword(b, 'Choose a Background') && background(a)
    || keyword(a, "Doctor's companion") && /\bCreature\b/.test(type(a)) && doctor(b)
    || keyword(b, "Doctor's companion") && /\bCreature\b/.test(type(b)) && doctor(a));
}
export function commanderRules(commanders, entries, report) {
  const { failed, unavailable, manual } = report;
  const cards = commanders.map(entry => entry.card);
  let valid = cards.length > 0 && cards.length <= 2;
  if (cards.length > 2) failed.push('Commander allows at most two commanders.');
  if (cards.length === 2) {
    if (cards.some(card => !knownText(card) || !type(card))) { unavailable.push('Commander pairing: Oracle/type data unavailable.'); valid = false; }
    else if (!paired(...cards)) { failed.push('These commanders do not have compatible supported partner abilities.'); valid = false; }
  }
  for (const card of cards) {
    const pairedBackground = cards.length === 2 && valid && background(card);
    const supported = eligible(card);
    if (pairedBackground) continue;
    // Partner permits legendary noncreature cards; Background and Doctor variants have their own limits.
    if (cards.length === 2 && valid && legendary(card) && (plainPartner(card) || partnerLabel(card) || partnerName(card))) continue;
    if (supported === null || !supported && !knownText(card)) { unavailable.push(`${card.name}: commander eligibility data unavailable.`); valid = false; }
    else if (!supported) { failed.push(`${card.name}: not an eligible commander under the supported rules.`); valid = false; }
  }
  const special = cards.some(card => /before the game begins.*choose|choose.*before the game begins|(?:deck|commander).*can have|Rulebreaker/i.test(text(card)));
  if (special) { manual.push('Commander has a pregame choice or special deck-construction exception: review color identity and construction manually.'); valid = false; }
  if (cards.some(card => !knownText(card))) valid = false;
  if (valid) {
    const identity = new Set(cards.flatMap(card => card.color_identity));
    for (const { card } of entries) {
      if (card.color_identity.some(color => !identity.has(color))) failed.push(`${card.name} is outside your commander's color identity (${cards.map(card => card.name).join(' + ')}).`);
      // Both faces contribute basic land types (CR 903.4d/903.5d).
      const types = card.card_faces?.map(face => face.type_line ?? '').join(' // ') || card.type_line;
      for (const [land, color] of [['Plains','W'],['Island','U'],['Swamp','B'],['Mountain','R'],['Forest','G']]) {
        if (types.split(' // ').some(face => /\bLand\b/.test(face.split(' — ')[0]) && new RegExp(`\\b${land}\\b`).test(face.split(' — ')[1] ?? '')) && !identity.has(color)) failed.push(`${card.name}: basic land type ${land} is outside the commander's color identity.`);
      }
    }
  }
  manual.push('Commander coverage is partial: unusual deck-construction exceptions and interchangeable card names need manual review.');
}

const permanent = card => /\b(Artifact|Battle|Creature|Enchantment|Land|Planeswalker)\b/.test(type(card));
const land = card => /\bLand\b/.test(type(card));
export function companionRules(companion, starting, format, report) {
  if (!companion) return;
  const { card } = companion, { failed, unavailable, manual } = report;
  if (!knownText(card)) { unavailable.push(`${card.name}: companion ability data unavailable.`); return; }
  if (!companionCapable(card)) { failed.push(`${card.name}: the designated card has no companion ability.`); return; }
  const name = card.name.split(/[ ,]/)[0];
  if (name === 'Yorion') {
    if (starting.reduce((sum, entry) => sum + entry.qty, 0) < (format === 'commander' ? 120 : 80)) failed.push(`${card.name}: starting deck must contain at least 20 cards above the format minimum.`);
    return;
  }
  if (!['Gyruda','Jegantha','Kaheera','Keruga','Lurrus','Lutri','Obosh','Umori'].includes(name)) {
    manual.push(`${card.name}: companion predicate is unsupported; review the starting deck manually.`); return;
  }
  const supported = [];
  for (const entry of starting) {
    const c = entry.card;
    if (c.card_faces?.length || c.layout && !['normal','leveler','class','saga','token'].includes(c.layout)) {
      manual.push(`${c.name}: special card layout requires manual ${name} companion review.`); continue;
    }
    if (!c.type_line || !Number.isFinite(c.cmc) || !knownText(c)) { unavailable.push(`${c.name}: data unavailable for ${name}'s companion restriction.`); continue; }
    supported.push(entry);
    let violation = false;
    if (name === 'Gyruda') violation = c.cmc % 2 !== 0;
    if (name === 'Obosh') violation = !land(c) && c.cmc % 2 !== 1;
    if (name === 'Keruga') violation = !land(c) && c.cmc < 3;
    if (name === 'Lurrus') violation = permanent(c) && c.cmc > 2;
    if (name === 'Kaheera') violation = /\bCreature\b/.test(type(c)) && !/\b(Cat|Elemental|Nightmare|Dinosaur|Beast)\b/.test(type(c).split(' — ')[1] ?? '') && !keyword(c,'Changeling');
    if (name === 'Jegantha') {
      if (typeof c.mana_cost !== 'string') { unavailable.push(`${c.name}: mana cost unavailable for Jegantha.`); continue; }
      const symbols = c.mana_cost.match(/\{[^}]+\}/g) ?? [];
      violation = new Set(symbols).size !== symbols.length;
    }
    if (violation) failed.push(`${c.name}: does not meet ${card.name}'s starting-deck restriction.`);
  }
  if (name === 'Lutri') {
    const names = new Map();
    for (const { card: c, qty } of supported.filter(entry => !land(entry.card))) names.set(c.name, (names.get(c.name) ?? 0) + qty);
    for (const [n, qty] of names) if (qty > 1) failed.push(`${n}: Lutri requires distinct names for all nonland cards in the starting deck.`);
  }
  if (name === 'Umori') {
    const types = supported.filter(entry => !land(entry.card)).map(entry => type(entry.card).split(' — ')[0].match(/\b(Artifact|Battle|Creature|Enchantment|Instant|Kindred|Planeswalker|Sorcery)\b/g) ?? []);
    if (types.length && !types[0].some(t => types.every(values => values.includes(t)))) failed.push(`${card.name}: nonland cards in the starting deck do not share a card type.`);
  }
}
