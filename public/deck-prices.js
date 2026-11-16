import { parseEuroQuote, rulesIdentity, validateBackup, setEntryPrinting, entryKey, deckCurrency, deckPrintingPrice, isBasicLand, zoneFor, DEFAULT_BUDGET_ZONES } from './core.js';

const MAX_PAGES = 1000; // Same pagination boundary as the local search proxy.

export function priceIdentity(card) {
  const id = rulesIdentity(card);
  return /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id ?? '') ? id.toLowerCase() : null;
}

export function cardmarketProductId(card) {
  return Number.isSafeInteger(card.cardmarket_id) && card.cardmarket_id > 0 ? card.cardmarket_id : null;
}

export function refreshPriceQuotes(card, source, currency='EUR') {
  const prices = { ...card.prices };
  for (const field of currency==='USD' ? ['usd','usd_foil','usd_etched'] : ['eur','eur_foil']) {
    if (parseEuroQuote(source.prices?.[field]) !== null) prices[field] = source.prices[field];
  }
  const productId = cardmarketProductId(source);
  return { ...card, prices, ...(productId ? { cardmarket_id: productId } : {}) };
}

const eligible = card => card.lang === 'en' && Array.isArray(card.games) && card.games.includes('paper') && Array.isArray(card.finishes) && card.finishes.includes('nonfoil');

// An identity becomes complete only after its final page. Retry skips completed
// identities and restarts the interrupted identity, retaining last-complete quotes.
export async function cheapestPrintings(cards, fetchPage, currency='EUR', {state={},signal,onProgress=()=>{}}={}) {
  const ids=[...new Set(cards.map(priceIdentity).filter(Boolean))].sort();
  state.quotes ??= new Map();state.completed ??= new Set();state.errors ??= new Map();
  state.completed=new Set([...state.completed].filter(id=>ids.includes(id)));
  for(const id of state.errors.keys())if(!ids.includes(id))state.errors.delete(id);
  state.total=ids.length;
  const names=new Map(cards.map(card=>[priceIdentity(card),card.name]));
  for(const id of ids){
    signal?.throwIfAborted();
    if(state.completed.has(id))continue;
    const q=`game:paper lang:en is:nonfoil unique:prints (oracleid:${id})`;
    let best=null;
    try{
      for(let page=1;page<=MAX_PAGES;page++){
        signal?.throwIfAborted();
        onProgress({completed:state.completed.size,total:ids.length,name:names.get(id),page});
        const result=await fetchPage(q,page);
        signal?.throwIfAborted();
        if(!Array.isArray(result.data) || typeof result.has_more!=='boolean')throw Error('Printing search returned an incomplete response.');
        for(const card of result.data){
          if(priceIdentity(card)!==id || !eligible(card))continue;
          const cents=parseEuroQuote(card.prices?.[currency.toLowerCase()]);
          if(cents!==null && (!best || cents<best.cents || cents===best.cents && String(card.id??'').localeCompare(String(best.card.id??''))<0))best={cents,card};
        }
        if(!result.has_more){
          state.quotes.set(id,best);state.completed.add(id);state.errors.delete(id);
          break;
        }
        if(page===MAX_PAGES)throw Error('Printing scan reached the proxy pagination limit. No partial minimum was used.');
      }
    }catch(error){
      if(signal?.aborted || error.name==='AbortError')throw error;
      const message=`${error.message}${error.status?' (HTTP '+error.status+')':''}`;
      state.errors.set(id,message);
      if(!state.quotes.has(id) || state.quotes.get(id)?.incomplete)state.quotes.set(id,{incomplete:true,error:message});
      if(error.status===429)break;
    }
  }
  onProgress({completed:state.completed.size,total:ids.length});
  return state.quotes;
}

export function cheapestDeckPlan(deck, comparison) {
  validateBackup([deck]);
  if(!comparison || comparison.currency!==deckCurrency(deck) || comparison.status==='checking')throw Error('Finish a price check in this deck currency first.');
  const staged=structuredClone(deck),zones=deck.budgetZones??DEFAULT_BUDGET_ZONES,changes=[];
  let skipped=0,already=0;
  for(const entry of staged.cards){
    if(!zones.includes(zoneFor(entry)))continue;
    const id=priceIdentity(entry.card),quote=comparison.quotes?.get(id);
    if(isBasicLand(entry.card) || deckPrintingPrice(entry.card,entry.finish).finish!=='regular' || !quote?.card || quote.incomplete || comparison.errors?.has(id) || comparison.completed && !comparison.completed.has(id)
      || priceIdentity(quote.card)!==id || !eligible(quote.card) || parseEuroQuote(quote.card.prices?.[comparison.currency.toLowerCase()])!==quote.cents){skipped+=entry.qty;continue;}
    if(entry.card.id===quote.card.id){already+=entry.qty;continue;}
    const change={from:entry.card.name,fromSet:entry.card.set,toSet:quote.card.set,zone:zoneFor(entry),qty:entry.qty};
    // Validate the replacement and retain latest legality before merging variants.
    setEntryPrinting({cards:[entry]},entryKey(entry),quote.card,'regular');
    changes.push(change);
  }
  const merged=[];
  for(const entry of staged.cards){
    const same=merged.find(other=>rulesIdentity(other.card)===rulesIdentity(entry.card) && other.card.id===entry.card.id && zoneFor(other)===zoneFor(entry) && (other.finish??deckPrintingPrice(other.card).finish)===(entry.finish??deckPrintingPrice(entry.card).finish));
    if(same){
      same.qty+=entry.qty;same.tags=[...new Set([...same.tags,...entry.tags])];
      if(entry.companion)same.companion=true;
      if(entry.card.legalities && entry.card.legalityUpdatedAt && (!same.card.legalityUpdatedAt || entry.card.legalityUpdatedAt>same.card.legalityUpdatedAt)){
        same.card.legalities=entry.card.legalities;same.card.legalityUpdatedAt=entry.card.legalityUpdatedAt;
      }
    }
    else merged.push(entry);
  }
  staged.cards=merged;validateBackup([staged]);
  return {deck:staged,changes,changed:changes.reduce((sum,change)=>sum+change.qty,0),skipped,already,merged:deck.cards.length-merged.length};
}
