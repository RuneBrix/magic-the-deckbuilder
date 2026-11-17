import { collectionReport, deckCurrency, ZONES } from './core.js';
import { cardmarketProductId, priceIdentity } from './deck-prices.js';
import { esc, money, currencySymbol } from './view-utils.js';

export function budgetPanel(d, collection, state, comparison, sort = { key: 'card', direction: 'asc' }) {
  const report = collectionReport(d, collection), refreshing = state?.status === 'refreshing';
  const currency=deckCurrency(d), formatPrice=cents=>money(cents,currency);
  if(comparison?.currency && comparison.currency!==currency)comparison=null;
  const estimateValue = (cents, unknown) => report.demand && report.demand===report.basicCopies ? '—' : `${formatPrice(cents)}${unknown ? `<small>+ ${unknown} unpriced ${unknown === 1 ? 'copy' : 'copies'}</small>` : ''}`;
  const quoteFor = row => comparison?.quotes?.get(priceIdentity(row.entry.card));
  const checking = comparison?.status === 'checking';
  const canCompare = report.rows.some(row => !row.costExcluded && priceIdentity(row.entry.card));
  let lowestTotal = 0, lowestUnpriced = 0;
  for (const row of report.rows.filter(row => row.included && !row.costExcluded)) {
    const quote = quoteFor(row);
    if (quote?.cents === undefined) lowestUnpriced += row.demand;
    else lowestTotal += quote.cents * row.demand;
  }
  const costCopies=report.demand-report.basicCopies;
  const lowestEstimate = !comparison?.quotes || !costCopies ? '—'
    : lowestUnpriced === costCopies ? `Unavailable<small>${lowestUnpriced} unpriced ${lowestUnpriced === 1 ? 'copy' : 'copies'}</small>`
    : estimateValue(lowestTotal, lowestUnpriced);
  const columns = [['card','Card'],['zone','Zone'],['price','Price per card'],['copies','Copies'],['cheapest','Cheapest per card']];
  const header = ([key, label]) => `<th scope="col"${sort.key === key ? ` aria-sort="${sort.direction === 'asc' ? 'ascending' : 'descending'}"` : ''}><button class="text-button" data-cost-sort="${key}">${label}${sort.key === key ? ` ${sort.direction === 'asc' ? '↑' : '↓'}` : ''}</button></th>`;
  const value = row => ({ card: row.entry.card.name, zone: ZONES[row.zone], price: row.costExcluded ? null : row.unitCents, copies: row.demand, cheapest: row.costExcluded ? null : quoteFor(row)?.cents })[sort.key];
  const rows = [...report.rows].sort((a, b) => {
    const av = value(a), bv = value(b);
    if (av == null || bv == null) return (av == null) - (bv == null);
    const order = typeof av === 'number' ? av - bv : av.localeCompare(bv, undefined, { numeric: true, sensitivity: 'base' });
    return order * (sort.direction === 'desc' ? -1 : 1);
  });

  return `<div class="planning">
    <header class="planning-heading">
      <h2>Ownership & costs</h2>
      <div class="planning-actions">
        <button class="secondary" data-action="match-owned" ${!report.demand || !collection.length ? 'disabled' : ''}>Match owned printings…</button>
        <button class="secondary" data-action="refresh-prices" ${refreshing || !report.demand ? 'disabled' : ''}>${refreshing ? 'Refreshing…' : 'Refresh '+currencySymbol(currency)+' prices'}</button>
        <button class="secondary" data-action="cheapest-prices" ${!checking && !canCompare ? 'disabled' : ''}>${checking ? 'Cancel price check' : comparison?.status==='cancelled' ? 'Resume price check' : comparison?.status==='failed' ? 'Retry incomplete scans' : 'Check cheapest printings'}</button>
        <button class="secondary" data-action="apply-cheapest" ${checking || !report.demand || !comparison?.quotes?.size ? 'disabled' : ''}>Apply cheapest printings…</button>
      </div>
    </header>
    <fieldset class="planning-scope">
      <legend>Zones in estimate</legend>
      <div>${Object.entries(ZONES).map(([zone, label]) => `<label><input type="checkbox" id="budget-zone-${zone}" ${report.zones.includes(zone) ? 'checked' : ''}> ${label}</label>`).join('')}</div>
    </fieldset>
    <div class="planning-summaries">
      <table class="planning-summary" aria-label="Copy quantities"><caption>Copies</caption><tbody>
        <tr><th scope="row">In selected zones</th><td>${report.demand}</td></tr>
        <tr><th scope="row">Covered by collection</th><td>${report.owned}</td></tr>
        <tr><th scope="row">Still needed</th><td>${report.missing}</td></tr>
      </tbody></table>
      <table class="planning-summary" aria-label="Cost estimates"><caption>Cost estimates</caption><tbody>
        <tr><th scope="row">Deck value</th><td>${estimateValue(report.fullCents, report.fullUnpriced)}</td></tr>
        <tr><th scope="row">Cheapest printings estimate</th><td>${lowestEstimate}</td></tr>
        <tr><th scope="row">Cost of missing copies</th><td>${estimateValue(report.missingCents, report.missingUnpriced)}</td></tr>
      </tbody></table>
    </div>
    <div class="planning-controls">
      <label>Deck currency<select id="deck-currency"><option value="EUR" ${currency==='EUR'?'selected':''}>€ Euro</option><option value="USD" ${currency==='USD'?'selected':''}>$ US dollar</option></select></label>
      <label>Ownership matching<select id="ownership-match"><option value="rules" ${report.mode === 'rules' ? 'selected' : ''}>Any printing of the same card</option><option value="printing" ${report.mode === 'printing' ? 'selected' : ''}>Exact stored printing only</option></select></label>
    </div>
    ${!report.zones.length ? '<p class="hint">Select zones to estimate their cost.</p>' : ''}
    ${state?.status === 'failed' ? `<p class="query-error" role="alert">Price refresh failed. Last usable prices were retained. ${esc(state.error)}</p>` : ''}
    ${state?.kept ? `<p class="hint" role="status">Kept the saved quote for ${state.kept} ${state.kept === 1 ? 'entry without a new quote' : 'entries without new quotes'}.</p>` : ''}
    ${checking ? '<p class="hint" id="cheapest-progress" role="status">Checking cheapest printings on Scryfall…</p>' : ''}
    ${comparison?.status === 'failed' ? `<p class="query-error" role="alert">${comparison.errors?.size===1?'1 card scan needs retry':(comparison.errors?.size||'Some')+' card scans need retry'}. Completed results were retained. ${esc(comparison.error)}</p>` : ''}
    ${comparison?.status === 'cancelled' ? '<p class="hint" role="status">Price check cancelled. Resume keeps completed cards and restarts the interrupted card.</p>' : ''}
    ${!checking && comparison?.progress ? `<p class="hint" role="status">Checked ${comparison.progress.completed} of ${comparison.progress.total} cards.</p>` : ''}
    ${report.basicCopies ? `<p class="hint">${report.basicCopies} basic-land ${report.basicCopies===1?'copy is':'copies are'} excluded from cost estimates; copy counts and ownership include them.</p>` : ''}
    <details class="planning-help"><summary>About cost estimates</summary><p>Estimates use the deck currency, selected zones and each card's stored printing and finish. Basic lands, including snow basics, are excluded from costs and unpriced warnings, even when quoted. Cost of missing copies includes only copies not covered by your collection. Cheapest checks every page separately for each nonbasic card; failed scans never use provisional minima. Retry retains completed cards and restarts interrupted cards. Saved complete quotes remain visible after a failed refresh. Apply cheapest printings reviews changes to regular English paper versions in the selected zones; scanning alone changes no deck entries. A missing quote stays unknown; currencies and finishes are never substituted. Shipping and tax are excluded.</p></details>
    <div class="planning-table" tabindex="0" role="region" aria-label="Deck cards in all zones">
      <table aria-label="Deck cards in all zones">
        <thead><tr>${columns.map(header).join('')}</tr></thead>
        <tbody>${rows.length ? rows.map(row => {
          const quote = quoteFor(row);
          const product = currency==='EUR' && !row.costExcluded && row.unitCents === null && cardmarketProductId(row.entry.card);
          const cardmarket = product ? `<small><a href="https://www.cardmarket.com/Magic/Products?idProduct=${product}${row.finish === 'foil' ? '&amp;isFoil=Y' : ''}" target="_blank" rel="noreferrer">Cardmarket</a></small>` : '';
          const identity=priceIdentity(row.entry.card),scanError=comparison?.errors?.get(identity);
          const unfinished=comparison?.completed && !comparison.completed.has(identity);
          const cheapest = row.costExcluded ? 'Excluded' : !identity ? 'Rules identity unavailable' : quote?.incomplete ? 'Scan incomplete' : quote ? `${formatPrice(quote.cents)}<small>${esc(quote.card.set?.toUpperCase() || 'Set unavailable')} · Regular${scanError||unfinished?' · Last complete scan; recheck unfinished':''}</small>` : quote === null ? 'No eligible quote' : comparison?.quotes ? 'Unchecked' : '—';
          return `<tr>
          <th scope="row">${esc(row.entry.card.name)}${row.included && !row.identityResolved && report.mode === 'rules' ? '<small>Rules identity unavailable</small>' : ''}</th>
          <td>${ZONES[row.zone]}${row.included ? '' : '<small>Outside estimate</small>'}</td>
          <td>${row.costExcluded ? 'Basic land · excluded' : row.unitCents === null ? 'Unknown' : formatPrice(row.unitCents)}<small>${esc(row.finish || 'Finish unavailable')}</small>${cardmarket}</td>
          <td>${row.demand}</td><td>${cheapest}${scanError?`<small>${esc(scanError)} · Retry incomplete scans</small>`:''}</td>
        </tr>`; }).join('') : '<tr><td colspan="5">Add cards to see ownership and costs here.</td></tr>'}</tbody>
      </table>
    </div>
    ${d.priceUpdatedAt ? `<p class="hint">Last stored-price check <time datetime="${esc(d.priceUpdatedAt)}">${esc(new Date(d.priceUpdatedAt).toLocaleString())}</time>.</p>` : '<p class="hint">Prices have not been refreshed for this deck.</p>'}
  </div>`;
}
