import { parseEuroQuote, rulesIdentity } from './core.js';

const IDENTITIES_PER_SCAN = 200;
const IDENTITIES_PER_QUERY = 8;
const PAGES_PER_QUERY = 4;

export function priceIdentity(card) {
  const id = rulesIdentity(card);
  return /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id ?? '') ? id.toLowerCase() : null;
}

export function cardmarketProductId(card) {
  return Number.isSafeInteger(card.cardmarket_id) && card.cardmarket_id > 0 ? card.cardmarket_id : null;
}

export function refreshEuroQuote(card, source) {
  const prices = { ...card.prices };
  for (const field of ['eur', 'eur_foil']) {
    if (parseEuroQuote(source.prices?.[field]) !== null) prices[field] = source.prices[field];
  }
  const productId = cardmarketProductId(source);
  return { ...card, prices, ...(productId ? { cardmarket_id: productId } : {}) };
}

// Every identity in a truncated batch stays unpriced. A later page may contain a lower quote.
export async function cheapestPrintings(cards, fetchPage) {
  const ids = [...new Set(cards.map(priceIdentity).filter(Boolean))].sort().slice(0, IDENTITIES_PER_SCAN);
  const quotes = new Map();
  for (let offset = 0; offset < ids.length; offset += IDENTITIES_PER_QUERY) {
    const batch = ids.slice(offset, offset + IDENTITIES_PER_QUERY);
    const matches = new Map(batch.map(id => [id, null]));
    const q = `game:paper lang:en is:nonfoil unique:prints (${batch.map(id => `oracleid:${id}`).join(' OR ')})`;
    let incomplete = true;
    for (let page = 1; page <= PAGES_PER_QUERY; page++) {
      const result = await fetchPage(q, page);
      if (!Array.isArray(result.data) || typeof result.has_more !== 'boolean') throw Error('Printing search returned an incomplete response.');
      for (const card of result.data) {
        const id = priceIdentity(card);
        if (!matches.has(id) || card.lang !== 'en' || !Array.isArray(card.games) || !card.games.includes('paper') || !Array.isArray(card.finishes) || !card.finishes.includes('nonfoil')) continue;
        const cents = parseEuroQuote(card.prices?.eur);
        const previous = matches.get(id);
        if (cents !== null && (!previous || cents < previous.cents)) matches.set(id, { cents, card });
      }
      if (!result.has_more) {
        incomplete = false;
        break;
      }
    }
    for (const [id, quote] of matches) quotes.set(id, incomplete ? { incomplete } : quote);
  }
  return quotes;
}
