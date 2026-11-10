import { collectionReport, ZONES } from './core.js';
import { cardmarketProductId, priceIdentity } from './deck-prices.js';
import { esc, euro, printingLabel } from './view-utils.js';

const estimateLabels = { missing: 'Cost to buy', full: 'Deck estimate' };

function budgetComparison(budget, estimate, unpriced, zones) {
  if (!zones.length) return 'Select zones to estimate their cost.';
  if (budget === undefined) return 'Enter a budget to compare it with the selected estimate.';
  if (estimate > budget) return `${euro(estimate - budget)} over budget${unpriced ? ' from known costs alone' : ''}.`;
  if (unpriced) return `${euro(budget - estimate)} left after known costs. Unpriced copies may change the result.`;
  return `${euro(budget - estimate)} left in the budget.`;
}

export function budgetPanel(d, collection, state, comparison) {
  const report = collectionReport(d, collection), basis = d.budgetBasis ?? 'missing';
  const estimate = basis === 'full' ? report.fullCents : report.missingCents;
  const unpriced = basis === 'full' ? report.fullUnpriced : report.missingUnpriced;
  const budget = d.budgetCents, refreshing = state?.status === 'refreshing';
  const estimateValue = (cents, unknown) => `${euro(cents)}${unknown ? `<small>+ ${unknown} unpriced ${unknown === 1 ? 'copy' : 'copies'}</small>` : ''}`;
  const quoteFor = row => comparison?.quotes?.get(priceIdentity(row.entry.card));
  const checking = comparison?.status === 'checking';
  const canCompare = report.rows.some(row => priceIdentity(row.entry.card));
  let lowestTotal = 0, lowestUnpriced = 0;
  for (const row of report.rows.filter(row => row.included)) {
    const quote = quoteFor(row);
    if (quote?.cents === undefined) lowestUnpriced += row.demand;
    else lowestTotal += quote.cents * row.demand;
  }
  const lowestEstimate = !comparison?.quotes || !report.demand ? '—'
    : lowestUnpriced === report.demand ? `Unavailable<small>${lowestUnpriced} unpriced ${lowestUnpriced === 1 ? 'copy' : 'copies'}</small>`
    : estimateValue(lowestTotal, lowestUnpriced);

  return `<div class="planning">
    <header class="planning-heading">
      <h2>Ownership & budget</h2>
      <div class="planning-actions">
        <button class="secondary" data-action="refresh-prices" ${refreshing || !report.demand ? 'disabled' : ''}>${refreshing ? 'Refreshing…' : 'Refresh EUR prices'}</button>
        <button class="secondary" data-action="cheapest-prices" ${!checking && !canCompare ? 'disabled' : ''}>${checking ? 'Cancel price check' : 'Check cheapest printings'}</button>
      </div>
    </header>
    <fieldset class="planning-scope">
      <legend>Zones in estimate</legend>
      <div>${Object.entries(ZONES).map(([zone, label]) => `<label><input type="checkbox" id="budget-zone-${zone}" ${report.zones.includes(zone) ? 'checked' : ''}> ${label}</label>`).join('')}</div>
    </fieldset>
    <dl class="planning-totals">
      <div><dt>Copies in estimate</dt><dd>${report.demand}</dd></div>
      <div><dt>Covered by collection</dt><dd>${report.owned}</dd></div>
      <div><dt>Copies to buy</dt><dd>${report.missing}</dd></div>
      <div><dt>${estimateLabels.full}</dt><dd>${estimateValue(report.fullCents, report.fullUnpriced)}</dd></div>
      <div><dt>Cheapest printings estimate</dt><dd>${lowestEstimate}</dd></div>
      <div><dt>${estimateLabels.missing}</dt><dd>${estimateValue(report.missingCents, report.missingUnpriced)}</dd></div>
    </dl>
    <div class="planning-controls">
      <label>Budget in EUR<input id="deck-budget" inputmode="decimal" value="${budget === undefined ? '' : (budget / 100).toFixed(2)}" placeholder="Optional"></label>
      <label>Compare budget against<select id="budget-basis">${Object.entries(estimateLabels).map(([value, label]) => `<option value="${value}" ${basis === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      <label>Ownership matching<select id="ownership-match"><option value="rules" ${report.mode === 'rules' ? 'selected' : ''}>Any printing of the same card</option><option value="printing" ${report.mode === 'printing' ? 'selected' : ''}>Exact stored printing only</option></select></label>
    </div>
    <p class="budget-comparison">${esc(budgetComparison(budget, estimate, unpriced, report.zones))}</p>
    ${state?.status === 'failed' ? `<p class="query-error" role="alert">Price refresh failed. Last usable prices were retained. ${esc(state.error)}</p>` : ''}
    ${state?.kept ? `<p class="hint" role="status">Kept the saved quote for ${state.kept} ${state.kept === 1 ? 'entry without a new quote' : 'entries without new quotes'}.</p>` : ''}
    ${checking ? '<p class="hint" role="status">Checking cheapest printings on Scryfall…</p>' : ''}
    ${comparison?.status === 'failed' ? `<p class="query-error" role="alert">Could not check cheapest printings. ${esc(comparison.error)}</p>` : ''}
    ${comparison?.status === 'cancelled' ? '<p class="hint" role="status">Cheapest-printing check cancelled.</p>' : ''}
    ${comparison?.checkedAt ? `<p class="hint" role="status">Cheapest printings checked <time datetime="${esc(comparison.checkedAt)}">${esc(new Date(comparison.checkedAt).toLocaleString())}</time>.</p>` : ''}
    <p class="hint">Scryfall EUR quotes use the stored printing and finish. Refresh applies to the selected zones. Cheapest compares regular English paper printings for up to 200 distinct cards. Totals use the selected zones.</p>
    <div class="planning-table" tabindex="0" role="region" aria-label="Deck cards in all zones">
      <table aria-label="Deck cards in all zones">
        <thead><tr><th scope="col">Card</th><th scope="col">Zone</th><th scope="col">Copies</th><th scope="col">Covered</th><th scope="col">To buy</th><th scope="col">Stored each</th><th scope="col">Stored total</th><th scope="col">Cheapest each</th></tr></thead>
        <tbody>${report.rows.length ? report.rows.map(row => {
          const quote = quoteFor(row);
          const product = row.unitCents === null && cardmarketProductId(row.entry.card);
          const cardmarket = product ? `<small><a href="https://www.cardmarket.com/Magic/Products?idProduct=${product}${row.finish === 'foil' ? '&amp;isFoil=Y' : ''}" target="_blank" rel="noreferrer">Cardmarket</a></small>` : '';
          const cheapest = quote?.incomplete ? 'Scan incomplete' : quote ? `${euro(quote.cents)}<small>${esc(printingLabel(quote.card, { language: false }))}</small>` : quote === null ? 'Unknown' : comparison?.quotes ? 'Unchecked' : '—';
          return `<tr>
          <th scope="row">${esc(row.entry.card.name)}${row.included && !row.identityResolved && report.mode === 'rules' ? '<small>Rules identity unavailable</small>' : ''}</th>
          <td>${ZONES[row.zone]}${row.included ? '' : '<small>Outside estimate</small>'}</td>
          <td>${row.demand}</td><td>${row.owned ?? '—'}</td><td>${row.missing ?? '—'}</td>
          <td>${row.unitCents === null ? 'Unknown' : euro(row.unitCents)}<small>${esc(row.finish || 'Finish unavailable')}</small>${cardmarket}</td>
          <td>${row.unitCents === null ? 'Unknown' : euro(row.unitCents * row.demand)}</td><td>${cheapest}</td>
        </tr>`; }).join('') : '<tr><td colspan="8">Add cards to see ownership and costs here.</td></tr>'}</tbody>
      </table>
    </div>
    ${d.priceUpdatedAt ? `<p class="hint">Last stored-price check <time datetime="${esc(d.priceUpdatedAt)}">${esc(new Date(d.priceUpdatedAt).toLocaleString())}</time>.</p>` : '<p class="hint">Prices have not been refreshed for this deck.</p>'}
  </div>`;
}
