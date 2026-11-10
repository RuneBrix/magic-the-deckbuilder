import { drawProbability } from './core.js';
import { esc, mana } from './view-utils.js';

const breakdowns = {
  all: 'All nonlands', color: 'Color', type: 'Card type', function: 'Primary function',
  power: 'Power', toughness: 'Toughness', rarity: 'Rarity',
};
const colorNames = { W: 'White', U: 'Blue', B: 'Black', R: 'Red', G: 'Green', C: 'Colorless' };
const comparisons = { exactly: 'Exactly', 'at-least': 'At least', 'at-most': 'At most' };
const drawGroups = { functions: 'Primary function', types: 'Card type' };

function options(items, selected) {
  return items.map(([value, label]) => `<option value="${esc(value)}"${value === selected ? ' selected' : ''}>${esc(label)}</option>`).join('');
}

function curveGroups(s, by) {
  return [...(s.breakdowns[by] ?? [])].sort(([a], [b]) => {
    if (typeof a === 'number' || typeof b === 'number') {
      return (typeof a === 'number' ? a : Infinity) - (typeof b === 'number' ? b : Infinity);
    }
    return (by === 'color' ? colorNames[a] ?? a : a).localeCompare(by === 'color' ? colorNames[b] ?? b : b, 'en');
  });
}

function groupOptions(groups, by, selected) {
  return groups.length ? options(groups.map(([key]) => [String(key), by === 'color' ? colorNames[key] ?? key : key]), selected)
    : '<option value="">No groups</option>';
}

function curve(values, label = 'Mana curve') {
  const max = Math.max(1, ...values);
  const bucket = i => i === 7 ? '7+' : i;
  return `<div class="curve" role="img" aria-label="${esc(label)}: ${values.map((n, i) => `${bucket(i)} mana: ${n}`).join(', ')}">${values.map((n, i) => `<div class="curve-column"><span>${n || ''}</span><div style="height:${n ? Math.max(4, n / max * 54) : 2}px" class="${n ? 'filled' : ''}"></div><small>${bucket(i)}</small></div>`).join('')}</div>`;
}

function curveChart(s, by, groups, selected) {
  if (by === 'all') return curve(s.curve);
  const group = groups.find(([key]) => String(key) === selected) ?? groups[0];
  if (!group) return '<p class="hint">Add nonland cards to see a breakdown.</p>';
  const [key, values] = group;
  return curve(values, `Mana curve for ${by === 'color' ? colorNames[key] ?? key : key}`);
}

const pair = (label, value) => `<div class="stat-pair"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;

function manaPie(title, { colors, unavailable }, empty) {
  const counts = Object.entries(colors).filter(([, count]) => count > 0);
  const total = counts.reduce((sum, [, count]) => sum + count, 0);
  let end = 0;
  const slices = counts.map(([color, count]) => {
    const start = end;
    end += count;
    return `var(--chart-${color}) ${start / total}turn ${end / total}turn`;
  });
  const fill = counts.length === 1 ? `var(--chart-${counts[0][0]})` : `conic-gradient(${slices.join(', ')})`;
  return `<section class="stat-tool"><h4>${title}</h4>
    ${total ? `<div class="mana-chart">
      <div class="mana-pie" aria-hidden="true" style="background:${fill}"></div>
      <ul class="mana-legend">${Object.entries(colors).map(([color, count]) => `<li><span class="mana-swatch" aria-hidden="true" style="--swatch:var(--chart-${color})"></span><span>${colorNames[color]}</span><b>${count}</b></li>`).join('')}</ul>
    </div>` : `<p class="hint">${empty}</p>`}
    ${unavailable ? `<p class="hint">Data unavailable for ${unavailable} ${unavailable === 1 ? 'copy' : 'copies'}.</p>` : ''}
  </section>`;
}

function tokenPanel({ references, unavailable }, scope) {
  const tokens = [...references].sort(([, a], [, b]) => a.name.localeCompare(b.name, 'en') || a.type.localeCompare(b.type, 'en'));
  return `<section class="stat-tool token-tool"><h3>Referenced tokens</h3>
    <p class="hint">Scryfall token references for ${scope}. Open a token to see its exact printing and art. Gameplay may create additional tokens.</p>
    ${tokens.length ? `<ul class="token-list">${tokens.map(([id, token]) => `<li><a href="https://scryfall.com/card/${id}" target="_blank" rel="noreferrer">${esc(token.name)}</a><span>${esc(token.type)}</span></li>`).join('')}</ul>` : `<p>${unavailable ? 'No token references in the available data.' : 'No referenced tokens.'}</p>`}
    ${unavailable ? `<p class="hint">Token reference data unavailable for ${unavailable} ${unavailable === 1 ? 'copy' : 'copies'}.</p>` : ''}
  </section>`;
}

export function statPanel(s, deck, previous) {
  const saved = (id, fallback) => previous?.querySelector('#' + id)?.value ?? fallback;
  const by = saved('curve-breakdown', 'all');
  const group = saved('curve-group', '');
  const groups = curveGroups(s, by);
  const { total } = s.draw;
  const scope = deck.format === 'commander' ? 'Main deck and Command zone' : 'Main deck';
  const drawCount = saved('draw-count', Math.min(7, total));
  const drawMatches = saved('draw-matches', total ? 1 : 0);
  return `<div class="stats-view" id="deck-statistics" data-statistics-deck="${esc(deck.id)}">
    <section class="stat-tool"><h3>Mana curve</h3>
      <p class="hint">${scope} · ${s.spells} nonland copies. Lands, Sideboard and Maybeboard are excluded.</p>
      <div class="stat-controls">
        <label>Breakdown<select id="curve-breakdown">${options(Object.entries(breakdowns), by)}</select></label>
        <label${by === 'all' ? ' hidden' : ''}>Group<select id="curve-group"${groups.length ? '' : ' disabled'}>${groupOptions(groups, by, group)}</select></label>
      </div>
      <div id="curve-chart" aria-live="polite">${curveChart(s, by, groups, group)}</div>
      <h4 class="stat-summary-heading">Mana values for all nonlands</h4>
      ${pair('Total mana value', s.manaValue.toLocaleString('en', { maximumFractionDigits: 6 }))}
      ${pair('Median mana value', s.median ?? '—')}
      ${pair('Average mana value', s.spells ? s.average.toFixed(2) : '—')}
      <p class="hint">Multicolor and multitype cards count in each matching group. Primary function uses the first assigned label. Variable or missing power and toughness appear under No fixed value.</p>
    </section>
    <div class="stat-tools">
      <section class="stat-tool"><h3>Card types</h3>${Object.entries(s.types).map(([t, n]) => pair(t, n)).join('') || '<p class="hint">Add cards to see the breakdown.</p>'}</section>
      <section class="stat-tool"><h3>Card functions</h3>${[...s.functions].map(([t, n]) => pair(t, n)).join('') || '<p class="hint">Inspect a deck card to assign a function such as ramp or removal.</p>'}</section>
      <section class="stat-tool"><h3>Colors on cards</h3><div class="color-stats">${Object.entries(s.colors).map(([c, n]) => `<div>${mana('{' + c + '}')}<b>${n}</b></div>`).join('')}</div><p class="hint">Multicolor cards count in each of their colors.</p></section>
    </div>
    <section class="stat-tool mana-tool"><h3>Colored mana</h3>
      <p class="hint">${scope}. Generic and colorless mana are excluded.</p>
      <div class="mana-distributions">
        ${manaPie('Mana costs', s.manaCosts, 'No recorded colored mana costs.')}
        ${manaPie('Mana production', s.manaSources, 'No recorded colored mana sources.')}
      </div>
      <p class="hint">Costs count printed symbols across all faces for each copy. Two-color hybrid symbols count half toward each color. Phyrexian and two-brid symbols count toward their colored options.</p>
      <p class="hint">Production counts each Scryfall-listed color once per copy, including lands, spells and other permanents. A multicolor source counts in each listed color. The chart measures possible colors without weighting conditions, amounts or repeat activations.</p>
    </section>
    ${tokenPanel(s.tokens, scope)}
    <section class="stat-tool draw-tool"><h3 id="draw-heading">Draw probability</h3>
      <p class="hint" id="draw-scope">${total} copies in Main deck, including lands. Draws are without replacement or mulligans. Each copy uses its first assigned function or its primary card type.</p>
      <fieldset class="stat-controls" aria-labelledby="draw-heading" aria-describedby="draw-scope draw-status"${total ? '' : ' disabled'}>
        <label>Cards drawn<input id="draw-count" type="number" min="0" max="${total}" step="1" value="${esc(drawCount)}"></label>
        <label>Comparison<select id="draw-comparison">${options(Object.entries(comparisons), saved('draw-comparison', 'exactly'))}</select></label>
        <label>Matching cards<input id="draw-matches" type="number" min="0" max="${esc(drawCount)}" step="1" value="${esc(drawMatches)}"></label>
        <label>Group by<select id="draw-grouping">${options(Object.entries(drawGroups), saved('draw-grouping', 'functions'))}</select></label>
      </fieldset>
      <p id="draw-status" class="hint" role="status">${total ? '' : 'Add cards to Main deck to calculate draw chances.'}</p>
      <div id="draw-results"></div>
    </section>
  </div>`;
}

const percent = new Intl.NumberFormat('en', { style: 'percent', maximumFractionDigits: 2 });
function chanceLabel(chance) {
  if (chance > 0 && chance < 0.0001) return '&lt;0.01%';
  if (chance < 1 && chance > 0.9999) return '&gt;99.99%';
  return percent.format(chance);
}

export function bindStatistics(root, s) {
  const find = id => root.querySelector('#' + id);
  const by = find('curve-breakdown'), group = find('curve-group');
  const draws = find('draw-count'), matches = find('draw-matches');
  const comparison = find('draw-comparison'), grouping = find('draw-grouping');
  const status = find('draw-status'), results = find('draw-results');
  const { total } = s.draw;

  function updateDraw() {
    if (!total) return;
    const n = draws.valueAsNumber, k = matches.valueAsNumber;
    const validDraws = Number.isInteger(n) && n >= 0 && n <= total;
    const validMatches = Number.isInteger(k) && k >= 0 && k <= n;
    draws.setAttribute('aria-invalid', String(!validDraws));
    matches.setAttribute('aria-invalid', String(validDraws && !validMatches));
    matches.max = validDraws ? String(n) : '';
    status.textContent = !validDraws ? `Enter a whole number of draws from 0 to ${total}.`
      : !validMatches ? `Enter a whole number of matches from 0 to ${n}.` : '';
    if (status.textContent) {
      results.innerHTML = '';
      return;
    }
    const rows = [...s.draw[grouping.value]].map(([label, copies]) => ({ label, copies,
      chance: drawProbability(total, copies, n, k, comparison.value) }));
    rows.sort((a, b) => b.chance - a.chance || a.label.localeCompare(b.label, 'en'));
    results.innerHTML = `<table class="draw-table" aria-label="Draw chances by ${drawGroups[grouping.value].toLowerCase()}"><thead><tr><th scope="col">Group</th><th scope="col">Copies</th><th scope="col">Chance</th></tr></thead><tbody>${rows.map(({ label, copies, chance }) => `<tr><th scope="row">${esc(label)}</th><td>${copies}</td><td>${chanceLabel(chance)}</td></tr>`).join('')}</tbody></table>`;
  }

  root.addEventListener('input', ({ target }) => {
    if (target === by || target === group) {
      const groups = curveGroups(s, by.value);
      if (target === by) {
        group.parentElement.hidden = by.value === 'all';
        group.disabled = !groups.length;
        group.innerHTML = groupOptions(groups, by.value, '');
      }
      find('curve-chart').innerHTML = curveChart(s, by.value, groups, group.value);
    } else {
      updateDraw();
    }
  });
  updateDraw();
}
