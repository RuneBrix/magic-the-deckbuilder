import { FORMATS, TAGS, TAG_CATALOG, tagById, findTags, resolveTag, count, category, imageFor, oracle, queryFor, relaxationOptions, relaxSearch, stats, legality, parseImport, validateBackup, safeUrl } from './core.js';

const $ = s => document.querySelector(s);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const icon = (name, size = 20) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${({ search: '<path d="m10 2 8 8-8 8-8-8zM10 6v8M6 10h8m2 6 6 6"/>', cards: '<path d="M8 3h12v16H8zM4 7v14h12M11 8l3-2 3 2-3 4z"/>' , settings: '<path d="M4 7h16M4 17h16M8 4v6M16 14v6"/>' , filters: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>', plus: '<path d="M12 5v14M5 12h14"/>', arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>', close: '<path d="m6 6 12 12M6 18 18 6"/>', leaf: '<path d="M20 4C8 2 2 10 7 16s14-1 13-12ZM5 21 16 10"/>', check: '<path d="m5 12 4 4L19 6"/>', down: '<path d="m6 9 6 6 6-6"/>', upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>', download: '<path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/>', chart: '<path d="M4 20V4m0 16h17M9 16v-5m5 5V7m5 9v-8"/>', book: '<path d="M12 5C8 2 4 3 2 4v15c4-2 7-1 10 1 3-2 6-3 10-1V4c-4-2-7-1-10 1Zm0 0v15"/>' })[name] || ''}</svg>`;
const blankDeck = (name = 'Untitled deck', format = 'commander') => ({ id: crypto.randomUUID(), name, format, cards: [], updated: new Date().toISOString() });
let theme = 'system';
try { const saved = localStorage.getItem('arcana.theme.v1'); if (['light','dark','system'].includes(saved)) theme = saved; } catch {}
const systemTheme = matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const dark = theme === 'dark' || (theme === 'system' && systemTheme.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.querySelector('meta[name="theme-color"]').content = dark ? '#171e1b' : '#f4f1e9';
}
systemTheme.addEventListener('change', applyTheme);
applyTheme();
let storageError = '';
let decks;
try { const saved = localStorage.getItem('arcana.decks.v1'); decks = saved ? validateBackup(JSON.parse(saved)) : []; }
catch { decks = []; storageError = 'Saved decks could not be read. Restore a JSON backup before making changes.'; }
let active = decks[0]?.id;
let view = 'explore', deckTab = 'cards', results = [], total = 0, page = 1, more = false, loading = false, error = '', requestId = 0, searched = false;
let filters = { raw: '', name: '', oracle: '', type: '', mv: '', mvOp: '<=', cost: '', colors: [], tags: [], match: 'all', legal: false };
let filtersOpen = false, tagsOpen = false, queryOpen = false;
let order = 'edhrec', tagSearch = '', visibleLimit = 24;
let browsedTag = '', tagLimit = 30, allTags = false;
let comparison = [], comparisonOpen = false, broadening = null, resultContext = null;
const current = () => decks.find(d => d.id === active);
const cardKey = c => c.oracle_id || c.id;
function save() {
  if (storageError) { toast(storageError); return; }
  try { localStorage.setItem('arcana.decks.v1', JSON.stringify(decks)); }
  catch { storageError = 'Browser storage is full or unavailable. Export a JSON backup now to keep your changes.'; toast(storageError); }
}
let toastTimer;
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 4500); }
function mana(cost = '') { return [...cost.matchAll(/\{([^}]+)\}/g)].map(m => `<span class="mana mana-${/^[WUBRG]$/.test(m[1]) ? m[1] : 'C'}" title="${esc(m[1])}">${esc(m[1])}</span>`).join(''); }
function download(name, content, type) { const url = URL.createObjectURL(new Blob([content], { type })); const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
function changeDeck(fn) { const d = current(); if (!d) return; fn(d); d.updated = new Date().toISOString(); save(); render(); }

function render() {
  const focused=document.activeElement;
  let focusSelector='';
  if(focused && $('#app').contains(focused)) {
    if(focused.id) focusSelector='#'+CSS.escape(focused.id);
    else if(focused.name) focusSelector='[name="'+CSS.escape(focused.name)+'"]';
    else {const attribute=[...focused.attributes].find(a=>a.name.startsWith('data-'));if(attribute)focusSelector='['+attribute.name+'="'+CSS.escape(attribute.value)+'"]';}
  }
  const d = current();
  $('#app').innerHTML = `<aside class="sidebar"><a class="brand" href="/" aria-label="Arcana home"><span class="brand-mark">${icon('cards', 25)}</span>arcana</a><div class="workspace-label">YOUR WORKSPACE</div><nav aria-label="Main navigation"><button data-view="explore" class="nav-item ${view === 'explore' ? 'selected' : ''}">${icon('search')} Explore cards</button><button data-view="decks" class="nav-item ${view === 'decks' ? 'selected' : ''}">${icon('cards')} My decks <span class="nav-count">${decks.length}</span></button></nav><div class="sidebar-rule"></div><div class="deck-label">YOUR DECKS <button data-action="new" class="icon-button" aria-label="Create deck">${icon('plus', 16)}</button></div><div class="deck-nav">${decks.length ? decks.map(x => `<button class="deck-link ${x.id === active ? 'active' : ''}" data-deck="${esc(x.id)}"><span class="deck-symbol">${icon('cards', 15)}</span><span>${esc(x.name)}<small>${x.format} · ${count(x)} cards</small></span></button>`).join('') : '<p class="sidebar-empty">Your next deck starts here.</p>'}</div><button class="new-deck" data-action="new">${icon('plus', 16)} Create a deck</button><div class="sidebar-bottom"><span class="local-dot"></span> Local workspace<small>Saved in this browser</small></div></aside>
  <main><header class="topbar"><span>Workspace <span class="breadcrumb">/</span> <strong>${view === 'decks' ? 'My decks' : 'Card explorer'}</strong></span><span class="topbar-right"><button class="text-button settings-button" data-action="settings">${icon('settings',18)} Settings</button><button class="icon-button" data-action="help" aria-label="Help">${icon('book', 17)}</button></span></header>${storageError ? `<div class="storage-warning" role="alert">${esc(storageError)} <button data-action="backup">Export backup</button></div>` : ''}${view === 'decks' ? library() : explorer()}</main>${view === 'explore' ? `<button class="mobile-deck-jump primary" data-action="jump-deck">${icon('cards',16)} ${d ? 'View deck · '+count(d)+' cards' : 'Create a deck'}</button><aside class="deck-panel">${deckPanel(d)}</aside>` : ''}`;
  bind();
  if(focusSelector) {const target=document.querySelector(focusSelector)||document.querySelector('.deck-tabs [aria-selected="true"]');target?.focus({preventScroll:true});}
}
function explorer() {
  const d = current();
  return `<div class="explorer"><div class="page-heading"><div><h1>Find a place in your deck.</h1><p>Search Magic cards by name, rules text, or what they do.</p></div></div><form id="search-form"><div class="search-box">${icon('search', 22)}<input id="raw" name="raw" aria-label="Search cards or use Scryfall syntax" placeholder="Card name or Scryfall query…" value="${esc(filters.raw)}"><button class="primary" type="submit">Search ${icon('arrow', 16)}</button></div><details id="search-filters" class="search-disclosure" ${filtersOpen ? 'open' : ''}><summary>${icon('filters',16)} Filters <span>${[filters.type, filters.mv, filters.name, filters.oracle, filters.cost, ...filters.colors].filter(Boolean).length || ''}</span></summary><div class="filter-row"><label>Type<select name="type"><option value="">Any type</option>${['creature', 'instant', 'sorcery', 'artifact', 'enchantment', 'land', 'planeswalker', 'battle'].map(t => `<option ${filters.type === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label><label>Mana value<div class="value-filter"><select name="mvOp" aria-label="Mana value comparison">${['<=', '=', '>='].map(o => `<option ${o === filters.mvOp ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select><input name="mv" type="number" min="0" max="99" aria-label="Mana value" placeholder="Any" value="${esc(filters.mv)}"></div></label><fieldset class="color-filter"><legend>Color identity</legend><div>${'WUBRG'.split('').map(c => `<button type="button" class="color-button mana-${c} ${filters.colors.includes(c) ? 'chosen' : ''}" data-color="${c}" aria-pressed="${filters.colors.includes(c)}" aria-label="${({ W:'White', U:'Blue', B:'Black', R:'Red', G:'Green' })[c]} identity">${c}</button>`).join('')}</div></fieldset></div><div class="advanced-fields"><label>Card name<input name="name" value="${esc(filters.name)}" placeholder="Exact phrase in name"></label><label>Oracle text<input name="oracle" value="${esc(filters.oracle)}" placeholder="e.g. whenever a creature dies"></label><label>Mana cost<input name="cost" value="${esc(filters.cost)}" placeholder="e.g. {1}{G}"></label></div><p class="hint">Colors include colorless cards and any subset of the selected identity. Full syntax works in the search bar.</p></details></form>
  <details id="function-tags" class="tag-browser" ${tagsOpen ? 'open' : ''}><summary>${icon('leaf',16)} Browse by function <span>${filters.tags.length ? filters.tags.length + ' selected' : 'Ramp, draw, removal…'}</span></summary><div class="tag-browser-content"><div class="tag-search">${icon('search', 15)}<input id="tag-search" value="${esc(tagSearch)}" placeholder="Find a function, like ramp or removal…" aria-label="Find function tags"></div><div id="tag-options">${tagOptions()}</div><div class="tag-footer"><span>Match all requires every tag; Match any accepts any tag.</span><label class="inline-label">Combine tags<select id="tag-match"><option value="all" ${filters.match === 'all' ? 'selected' : ''}>Match all</option><option value="any" ${filters.match === 'any' ? 'selected' : ''}>Match any</option></select></label><button class="text-button" data-action="custom-tag">+ Custom tag</button></div></div></details>
  ${filters.tags.length ? `<div class="active-tags" aria-label="Active function tags">${filters.tags.map(t=>`<button class="tag-option selected" data-tag="${esc(t)}" aria-label="Remove ${esc(t)} filter">${esc(t.replaceAll('-',' '))} ${icon('close',12)}</button>`).join('')}</div>` : ''}<details id="query-details" class="query-details" ${queryOpen ? 'open' : ''}><summary>View Scryfall query</summary><div class="query-strip"><span>QUERY</span><code id="query">${esc(queryFor(filters, d))}</code><button class="icon-button" data-action="reset" aria-label="Reset all search filters">${icon('close', 15)}</button></div></details>
  ${comparisonTools()}
  <div class="results-heading"><div><h2 id="result-heading" tabindex="-1">${searched ? 'Cards' : 'Start a search'}</h2><span id="result-count" role="status" aria-live="polite">${loading ? 'Searching Scryfall…' : searched && !error ? `${total.toLocaleString()} cards found` : 'Choose a starting point below'}</span></div><div class="results-controls">${Object.entries(filters).some(([k,v])=>!['match','mvOp'].includes(k) && (Array.isArray(v) ? v.length : v)) ? '<button class="text-button" data-action="reset">Clear filters</button>' : ''}${d ? `<label class="legal-toggle"><input id="legal" type="checkbox" ${filters.legal ? 'checked' : ''}> ${esc(d.format)} legal</label>` : ''}<select id="sort" aria-label="Sort cards">${[['edhrec','Popular first'],['cmc','Mana value'],['name','Name A–Z'],['usd','Price: low first']].map(([v,l])=>`<option value="${v}" ${order === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div></div>
  ${error ? `<div class="empty-state" role="alert">${icon('search',32)}<h3>${error.startsWith('No cards') ? 'A little too specific?' : 'Search couldn’t finish'}</h3><p>${esc(error)}</p><div><button class="secondary" data-action="reset">Clear filters</button><button class="primary" data-action="retry">Try again</button></div></div>` : loading && !results.length ? `<div class="loading-state"><span class="spinner"></span><p>Looking through the library…</p></div>` : `<div class="card-grid" aria-busy="${loading}">${results.slice(0,visibleLimit).map(cardTile).join('')}</div>${!searched && !results.length ? `<div class="welcome-state"><span class="welcome-icon">${icon('leaf', 32)}</span><h3>What does your deck need?</h3><p>Start with a common role, or search for a card above.</p><div><button data-preset="ramp">Find ramp</button><button data-preset="draw">Find card draw</button><button data-preset="removal">Find removal</button></div></div>` : ''}`}
  ${(more || visibleLimit < results.length) && !error ? `<button class="load-more secondary" data-action="more" ${loading ? 'disabled' : ''}>${loading ? 'Loading…' : 'Load more cards'}</button>` : ''}<footer>Card data and images by <a href="https://scryfall.com" target="_blank" rel="noreferrer">Scryfall</a>. Magic: The Gathering © Wizards of the Coast.</footer></div>`;
}
function tagOptions() {
  const searching = Boolean(tagSearch.trim());
  const matches = searching || allTags ? findTags(tagSearch) : TAGS.map(([id]) => tagById.get(id) || resolveTag(id)).filter(Boolean);
  const shown = matches.slice(0, tagLimit), detail = tagById.get(browsedTag);
  const browse = id => `<button class="text-button" data-browse-tag="${esc(id)}">${esc(id.replaceAll('-', ' '))}</button>`;
  const relation = (label, ids) => `<div class="tag-relations"><strong>${label}</strong><div>${ids.map(browse).join('') || '<span class="hint">None recorded in this snapshot.</span>'}</div></div>`;
  return `<p class="hint">${TAG_CATALOG.tags.length.toLocaleString()} tags from <a href="https://scryfall.com/docs/api/tags" target="_blank" rel="noreferrer">Scryfall Tagger</a> · Snapshot ${esc(TAG_CATALOG.updated.slice(0,10))}. May lag behind live tags.</p>
    <p class="hint" role="status">${searching || allTags ? `${matches.length.toLocaleString()} matches · showing ${shown.length}` : 'Curated starting points. Search names and aliases across the full snapshot.'}</p>
    <div class="tag-options">${shown.map(t => `<span class="tag-choice"><button class="tag-option ${filters.tags.includes(t.id) ? 'selected' : ''}" data-tag="${esc(t.id)}" aria-pressed="${filters.tags.includes(t.id)}" aria-label="${filters.tags.includes(t.id) ? 'Remove' : 'Add'} ${esc(t.id)} filter">${esc(TAGS.find(([id])=>id===t.id)?.[1] || t.id.replaceAll('-',' '))} ${icon(filters.tags.includes(t.id) ? 'check' : 'plus',13)}</button><button class="tag-browse" data-browse-tag="${esc(t.id)}" aria-label="Browse ${esc(t.id)} relationships">${icon('arrow',14)}</button></span>`).join('') || '<p class="hint">No matching name or alias in this snapshot. Try another phrase or Custom tag; absence here does not mean Scryfall rejects it.</p>'}</div>
    ${!searching && !allTags ? '<button class="text-button tag-more" data-action="all-tags">Browse all tags</button>' : ''}
    ${matches.length > shown.length ? '<button class="text-button tag-more" data-action="more-tags">Show more tags</button>' : ''}
    ${detail ? `<section class="tag-detail" aria-label="Tag relationships"><h3>${esc(detail.id.replaceAll('-',' '))}</h3><p class="hint">${detail.aliases.length ? 'Aliases: '+esc(detail.aliases.join(', '))+'. ' : ''}<a href="https://tagger.scryfall.com/tags/card/${encodeURIComponent(detail.id)}" target="_blank" rel="noreferrer">View on Tagger</a></p>${relation('Broader tags', detail.parents)}${relation('Narrower tags', detail.children)}<p class="hint">Relationships come from the snapshot. Browsing leaves your filters unchanged; use + to combine tags. Match all requires every tag; Match any accepts any tag.</p><button class="secondary" data-tag="${esc(detail.id)}">${filters.tags.includes(detail.id) ? 'Remove from' : 'Add to'} search</button></section>` : ''}
    ${filters.tags.filter(t => !tagById.has(t)).map(t => `<p class="hint">Custom tag “${esc(t)}” is outside this snapshot. Scryfall may accept it, reject it, or return no cards.</p>`).join('')}`;
}
function comparisonTools() {
  const source = broadening?.original || filters;
  const options = relaxationOptions(source, current());
  const colors = value => Array.isArray(value) ? value.length ? [...new Set(value)].join(', ') : 'Colorless' : 'Unknown';
  const row = (label, value) => `<tr><th scope="row">${label}</th>${comparison.map(item => `<td>${value(item)}</td>`).join('')}${comparison.length === 1 ? '<td>—</td>' : ''}</tr>`;
  return `<details id="comparison-tools" class="search-disclosure comparison-tools" ${comparisonOpen ? 'open' : ''}><summary>Compare alternatives <span>${comparison.length}/2 cards</span></summary><div class="comparison-content">
    <p class="hint">Choose Compare on two cards to inspect their tradeoffs. Results follow your chosen Scryfall sort, with no synergy score or best-card ranking. Loaded batches are not exhaustive.</p>
    <h3 id="comparison-title" tabindex="-1">${comparison.length ? 'Your comparison' : 'Choose cards to compare'}</h3>
    ${comparison.length ? `<table class="comparison-table"><caption class="sr-only">Card attributes and search context</caption><thead><tr><th scope="col">Attribute</th>${comparison.map(({card}) => `<th scope="col">${esc(card.name)}<button class="text-button" data-remove-compare="${esc(cardKey(card))}" aria-label="Remove ${esc(card.name)} from comparison">Remove</button></th>`).join('')}${comparison.length === 1 ? '<th scope="col">Choose a second card</th>' : ''}</tr></thead><tbody>
      ${row('Card', ({card}) => { const image = safeUrl(imageFor(card),true); return `${image ? `<img src="${esc(image)}" alt="${esc(card.name)}" loading="lazy">` : ''}<button class="text-button" data-inspect="${esc(card.id)}" aria-label="Inspect ${esc(card.name)}">Inspect</button> <button class="text-button" data-add="${esc(card.id)}" aria-label="Add ${esc(card.name)} to deck">Add to deck</button>`; })}
      ${row('Mana value', ({card}) => esc(card.cmc))}
      ${row('Mana cost', ({card}) => mana(card.mana_cost) || 'No mana cost')}
      ${row('Colors', ({card}) => esc(colors(card.colors || (card.card_faces?.some(f => Array.isArray(f.colors)) ? card.card_faces.flatMap(f => f.colors || []) : undefined))))}
      ${row('Color identity', ({card}) => esc(colors(card.color_identity)))}
      ${row('Type', ({card}) => esc(card.type_line))}
      ${row('Oracle text', ({card}) => `<span class="comparison-oracle">${esc(oracle(card)) || 'No Oracle text.'}</span>`)}
      ${row('Functional roles', item => `${item.roles.length ? `Your deck roles: ${esc(item.roles.join(', '))}. ` : 'No personal roles recorded. '}${item.tags.length ? `Searched for ${esc(item.match)}: ${esc(item.tags.join(', '))}. Individual tag membership is not verified.` : 'No guided function tags in this search.'}`)}
      ${row('Why shown', item => esc(item.reason))}
      ${row('Selected from query', item => `<code>${esc(item.query)}</code>`)}
    </tbody></table>` : '<p class="hint">Use Compare below a result, or Compare this card in its details. Selections stay here across searches until removed or the page is reloaded.</p>'}
    <h3>Broaden one condition</h3><p class="hint">Ignore one guided condition to look for alternatives. All other conditions and advanced syntax stay in place. Changing the choice always starts from the original search, so relaxations do not accumulate. Removing the color or legality condition may show cards that do not fit your deck.</p>
    ${options.length ? `<div class="relax-options">${options.map(o => `<button class="secondary" data-relax="${esc(o.key)}" ${broadening?.label === o.label ? 'disabled' : ''}>Ignore ${esc(o.label)}</button>`).join('')}</div>` : '<p class="hint">No guided condition to relax. Add guided filters; advanced syntax is kept verbatim and is not rewritten.</p>'}
    ${broadening ? `<div class="broadening-note" role="status"><p><strong>Why these results:</strong> Ignored ${esc(broadening.label)}. Other original conditions were retained. A match is a candidate for manual comparison, not a guarantee of the same effect.</p><p>Original query: <code>${esc(broadening.originalQuery)}</code></p><p>Alternative query: <code>${esc(broadening.query)}</code></p><button class="secondary" data-action="restore-search">Return to original search</button><p class="hint">Applying other search controls starts a new search. Compare selections remain.</p></div>` : ''}
  </div></details>`;
}
function toggleComparison(id) {
  const card = findCard(id); if (!card) return;
  const key = cardKey(card), exists = comparison.some(item => cardKey(item.card) === key);
  if (exists) comparison = comparison.filter(item => cardKey(item.card) !== key);
  else {
    if (comparison.length === 2) { toast('Remove a comparison card before choosing another.'); return; }
    const context = results.some(c => c.id === id) ? resultContext : null;
    comparison.push({ card, query: context?.query || 'Selected from your deck; no result-query membership checked.', tags: [...(context?.tags || [])], match: context?.match || 'all',
      roles: [...(current()?.cards.find(e => cardKey(e.card) === key)?.tags || [])],
      reason: context?.reason || 'Selected manually from your deck. No search match or card equivalence is inferred.' });
  }
  comparisonOpen = true; render(); $('#comparison-title')?.focus();
}
function broaden(key) {
  readFilters();
  const result = relaxSearch(broadening?.original || filters, current(), key);
  broadening = result; filters = result.filters; comparisonOpen = true; queryOpen = true;
  return search(false, true).then(()=>$('#result-heading')?.focus());
}
function restoreSearch() {
  if (!broadening) return;
  filters = broadening.original; broadening = null;
  return search().then(()=>$('#result-heading')?.focus());
}
function cardTile(c) {
  const entry = current()?.cards.find(e=>cardKey(e.card)===cardKey(c));
  const image = imageFor(c);
  const compared = comparison.some(item=>cardKey(item.card)===cardKey(c));
  return `<article class="card-tile"><button class="card-image-button" data-inspect="${esc(c.id)}" aria-label="Inspect ${esc(c.name)}">${image ? `<img src="${esc(safeUrl(image,true))}" alt="${esc(c.name)}" loading="lazy" width="488" height="680">` : `<div class="card-fallback">${esc(c.name)}<p>${esc(oracle(c))}</p></div>`}</button><div class="card-caption"><button data-inspect="${esc(c.id)}" class="card-name">${esc(c.name)}</button><button class="add-button ${entry ? 'added' : ''}" data-add="${esc(c.id)}" aria-label="Add ${esc(c.name)} to deck">${entry ? `<span>${entry.qty}</span>` : icon('plus',17)}</button></div><div class="card-meta"><span>${esc(c.type_line?.split(' — ')[0])}</span><span>${c.prices?.usd ? '$' + esc(c.prices.usd) : '—'}</span></div><button class="text-button compare-card" data-compare="${esc(c.id)}" aria-label="${esc(compared ? `Remove ${c.name} from comparison` : `Compare ${c.name}`)}" aria-pressed="${compared}">${compared ? 'Remove comparison' : 'Compare'}</button></article>`;
}
function deckPanel(d) {
  if (!d) return `<div class="panel-title">${icon('cards',18)} Your deck</div><div class="empty-deck">${icon('cards',40)}<h2>Build as you browse.</h2><p>Create a deck and add cards as you explore. Your curve and card counts will take shape here.</p><button class="primary" data-action="new">${icon('plus',16)} Create a deck</button><button class="text-button" data-action="sample">Try an example deck</button></div><div class="panel-footnote">Your decks stay on this device.<br>Export a backup to take them with you.</div>`;
  const s = stats(d), issues = legality(d);
  return `<div class="panel-title">${icon('cards',18)} <span class="sr-only">Deck workspace</span><button class="text-button" data-action="edit">Edit deck</button></div><div class="deck-header"><h2>${esc(d.name)}</h2><div><span class="format-badge">${esc(d.format)}</span><span class="save-note">${storageError ? 'Unsaved changes' : 'Saved locally'}</span></div></div><div class="deck-progress"><strong>${s.total}<span> / ${d.format === 'commander' ? '100' : '60+'}</span></strong><span>cards in deck</span></div><div class="deck-tabs" role="tablist"><button role="tab" aria-selected="${deckTab==='cards'}" data-tab="cards">Cards</button><button role="tab" aria-selected="${deckTab==='stats'}" data-tab="stats">Statistics</button><button role="tab" aria-selected="${deckTab==='checks'}" data-tab="checks">Checks ${issues.length ? `<span>${issues.length}</span>` : ''}</button></div><div class="panel-content">${deckTab === 'cards' ? `<div class="mini-stats"><span><b>${s.lands}</b> lands</span><span><b>${s.spells}</b> spells</span><span><b>${s.average.toFixed(2)}</b> avg. MV</span></div>${s.total ? deckList(d) : '<div class="small-empty"><h3>No cards yet.</h3><p>Use the + on any card to add it here.</p></div>'}` : deckTab === 'stats' ? statPanel(s) : `<div class="checks"><h3>${issues.length ? 'Still taking shape' : 'Basic checks passed'}</h3><p>Checks use stored Scryfall data. Refresh before playing.</p>${issues.map(i=>`<div class="check-issue">${esc(i)}</div>`).join('')}<p class="hint">MVP checks: main-deck size, card legality, copy limits, one commander and color identity. Sideboards, partners, companions and special construction rules need manual review.</p><button class="secondary" data-action="refresh">Refresh card legality</button></div>`}</div><div class="panel-bottom"><div class="deck-actions"><button data-action="import">${icon('upload',15)} Import</button><button data-action="export">${icon('download',15)} Export</button></div></div>`;
}
function deckList(d) {
  return ['Creature','Instant','Sorcery','Artifact','Enchantment','Planeswalker','Battle','Land','Other'].map(type=>{
    const entries=d.cards.filter(e=>category(e.card)===type);
    if (!entries.length) return '';
    return `<section class="deck-group"><h3>${type === 'Sorcery' ? 'Sorceries' : type + 's'} <span>${entries.reduce((n,e)=>n+e.qty,0)}</span></h3>${entries.map(e=>`<div class="deck-row"><span class="qty">${e.qty}</span><button class="deck-card-name" data-inspect="${esc(e.card.id)}">${e.commander ? '<span class="commander-indicator" title="Commander">C</span>' : ''}${esc(e.card.name)}</button><span class="row-mana">${mana(e.card.mana_cost)}</span><div class="row-actions"><button data-minus="${esc(e.card.id)}" aria-label="Remove one ${esc(e.card.name)}">−</button><button data-add="${esc(e.card.id)}" aria-label="Add one ${esc(e.card.name)}">+</button></div></div>`).join('')}</section>`;
  }).join('');
}
function curve(s) { const max=Math.max(1,...s.curve); return `<div class="curve" role="img" aria-label="Mana curve: ${s.curve.map((n,i)=>`${i===7?'7+':i} mana: ${n}`).join(', ')}">${s.curve.map((n,i)=>`<div class="curve-column"><span>${n || ''}</span><div style="height:${n ? Math.max(4,n/max*54) : 2}px" class="${n?'filled':''}"></div><small>${i===7?'7+':i}</small></div>`).join('')}</div>`; }
function statPanel(s) { return `<div class="stats-view"><h3>Mana curve</h3>${curve(s)}<div class="stat-pair"><span>Average mana value</span><b>${s.average.toFixed(2)}</b></div><h3>Card types</h3>${Object.entries(s.types).map(([t,n])=>`<div class="stat-pair"><span>${t}</span><b>${n}</b></div>`).join('') || '<p class="hint">Add cards to see the breakdown.</p>'}<h3>Colors on cards</h3><div class="color-stats">${Object.entries(s.colors).map(([c,n])=>`<div><span class="mana mana-${c}">${c}</span><b>${n}</b></div>`).join('')}</div><p class="hint">Multicolor cards count in each of their colors.</p><h3>Your role tags</h3>${Object.entries(s.tags).map(([t,n])=>`<div class="stat-pair"><span>${esc(t)}</span><b>${n}</b></div>`).join('') || '<p class="hint">Inspect a deck card to assign roles such as ramp or removal.</p>'}</div>`; }
function library() { return `<div class="library"><div class="page-heading"><div><h1>My decks</h1><p>Choose a deck to continue building.</p></div><button class="primary" data-action="new">${icon('plus',17)} New deck</button></div>${decks.length ? `<div class="deck-library">${decks.map(d=>{const s=stats(d);return `<article class="library-deck"><div class="deck-cover">${d.cards[0] && imageFor(d.cards[0].card) ? `<img src="${esc(safeUrl(imageFor(d.cards[0].card),true))}" alt="${esc(d.cards[0].card.name)}" loading="lazy">` : icon('cards',62)}<span>${esc(d.format)}</span></div><div class="library-deck-body"><h2>${esc(d.name)}</h2><p>${s.total} cards · ${s.lands} lands · ${s.average.toFixed(2)} average MV</p><button class="secondary" data-deck="${esc(d.id)}">Open deck ${icon('arrow',16)}</button></div></article>`;}).join('')}</div>` : `<div class="welcome-state"><h2>No decks yet.</h2><p>Create one, or try a small example to explore the workspace.</p><button class="primary" data-action="new">Create a deck</button><button class="secondary" data-action="sample">Try an example deck</button></div>`}</div>`; }

function readFilters() { const form=$('#search-form'); if (!form) return; const data=new FormData(form); for(const key of ['raw','name','oracle','type','mv','mvOp','cost']) filters[key]=String(data.get(key)||''); }
function updateQuery() { const node=$('#query'); if(node) node.textContent=queryFor(filters,current()); }
function bind() {
  $('#comparison-tools')?.addEventListener('toggle',e=>{comparisonOpen=e.target.open;});
  $('#query-details')?.addEventListener('toggle',e=>{queryOpen=e.target.open;});
  $('#search-filters')?.addEventListener('toggle',e=>{filtersOpen=e.target.open;});
  $('#function-tags')?.addEventListener('toggle',e=>{tagsOpen=e.target.open;});
  $('#search-form')?.addEventListener('submit',e=>{e.preventDefault();readFilters();search();});
  $('#search-form')?.addEventListener('input',()=>{readFilters();updateQuery();});
  $('#search-form')?.addEventListener('change',e=>{readFilters();updateQuery();if(e.target.tagName==='SELECT')search();});
  $('#tag-search')?.addEventListener('input',e=>{tagSearch=e.target.value;tagLimit=30;$('#tag-options').innerHTML=tagOptions();});
  $('#tag-match')?.addEventListener('change',e=>{readFilters();filters.match=e.target.value;search();});
  $('#sort')?.addEventListener('change',e=>{readFilters();order=e.target.value;search(false,true);});
  $('#legal')?.addEventListener('change',e=>{readFilters();filters.legal=e.target.checked;search();});
}
$('#app').addEventListener('click',async e=>{
  const button=e.target.closest('button');if(!button)return;readFilters();
  if(button.dataset.view){view=button.dataset.view;render();return;}
  if(button.dataset.deck){broadening=null;active=button.dataset.deck;view='explore';if(filters.legal)search();else render();return;}
  if(button.dataset.tab){deckTab=button.dataset.tab;render();return;}
  if(button.dataset.compare){toggleComparison(button.dataset.compare);return;}
  if(button.dataset.removeCompare){comparison=comparison.filter(item=>cardKey(item.card)!==button.dataset.removeCompare);render();$('#comparison-title')?.focus();return;}
  if(button.dataset.relax){await broaden(button.dataset.relax);return;}
  if(button.dataset.browseTag){browsedTag=button.dataset.browseTag;$('#tag-options').innerHTML=tagOptions();$('#tag-options .tag-detail h3').tabIndex=-1;$('#tag-options .tag-detail h3').focus();return;}
  if(button.dataset.tag){readFilters();const t=button.dataset.tag;filters.tags=filters.tags.includes(t)?filters.tags.filter(x=>x!==t):[...filters.tags,t];search();return;}
  if(button.dataset.preset){filters.tags=[button.dataset.preset];search();return;}
  if(button.dataset.color){readFilters();const c=button.dataset.color;filters.colors=filters.colors.includes(c)?filters.colors.filter(x=>x!==c):[...filters.colors,c];button.classList.toggle('chosen');button.setAttribute('aria-pressed',filters.colors.includes(c));updateQuery();return;}
  if(button.dataset.inspect){inspect(button.dataset.inspect);return;}
  if(button.dataset.add){addCard(button.dataset.add);return;}
  if(button.dataset.minus){changeDeck(d=>{const entry=d.cards.find(x=>x.card.id===button.dataset.minus);if(entry&&--entry.qty===0)d.cards=d.cards.filter(x=>x!==entry);});return;}
  const action=button.dataset.action;
  if(action==='jump-deck')$('.deck-panel').scrollIntoView({behavior:'smooth'});
  if(action==='new') deckForm();
  if(action==='edit') deckForm(current());
  if(action==='settings')settings();
  if(action==='reset'){filters={raw:'',name:'',oracle:'',type:'',mv:'',mvOp:'<=',cost:'',colors:[],tags:[],match:'all',legal:false};tagSearch='';search();}
  if(action==='retry')search(false,true);
  if(action==='restore-search')await restoreSearch();
  if(action==='more')search(true);
  if(action==='all-tags'||action==='more-tags'){allTags=true;if(action==='more-tags')tagLimit+=30;$('#tag-options').innerHTML=tagOptions();}
  if(action==='custom-tag')customTag();
  if(action==='sample')sample();
  if(action==='import')importDialog();
  if(action==='export'&&current())download(current().name+'.txt',current().cards.map(e=>`${e.qty} ${e.card.name}`).join('\n'),'text/plain');
  if(action==='backup')download('arcana-decks.json',JSON.stringify(decks,null,2),'application/json');
  if(action==='restore')restore();
  if(action==='refresh')refresh();
  if(action==='help')showDialog(`<h2>A little guide to Arcana</h2><p>Pick function tags, combine them with Oracle text, then search. “Match all” narrows your results; “Match any” broadens them. Open “View Scryfall query” to see what goes to Scryfall.</p><p>Starting points and their descriptions are curated. Search names and aliases across the bundled Scryfall Oracle Tags snapshot; use the arrow beside a tag to browse its recorded broader and narrower relationships. The snapshot date is shown because live Tagger can change. Use Custom tag for newer or other known tags.</p><p>Create a deck to start adding cards. Inspect a card to set your commander or assign personal role tags. These role tags power deck statistics and are separate from Scryfall’s tags.</p><p>Decks save in this browser. Export a JSON backup to move them to another device. Card exploration and import require internet access.</p><p>Format checks cover common main-deck rules. Review special restrictions and tournament rules manually.</p>`);
});
async function api(url, options) { const r=await fetch(url,options);const data=await r.json();if(!r.ok)throw new Error(data.error || 'Request failed.');return data; }
async function search(append=false,keepBroadening=false) {
  if(!append && (!keepBroadening || (broadening && queryFor(filters,current())!==broadening.query)))broadening=null;
  if(append && visibleLimit < results.length){visibleLimit+=24;render();return;}
  const context=append&&resultContext ? resultContext : {query:queryFor(filters,current()),tags:[...filters.tags],match:filters.match,reason:broadening ? `Matched the query with ${broadening.label} ignored. Other original conditions were retained.` : 'Matched the recorded search query. Selected manually; card equivalence is not inferred.'};
  const id=++requestId;loading=true;error='';if(!append){page=1;results=[];visibleLimit=24;}else{visibleLimit+=24;}const requestedPage=append?page+1:1;render();
  try {const data=await api('/api/search?'+new URLSearchParams({q:context.query,page:requestedPage,order}));if(id!==requestId)return;results=append?[...results,...data.data]:data.data;resultContext=context;total=data.total_cards;more=data.has_more;page=requestedPage;}
  catch(e){if(id!==requestId)return;error=/0 cards|No cards|didn.t match any cards/i.test(e.message)?'No cards matched these filters. A custom tag may be unsupported. Remove a tag, switch to Match any, or broaden your Oracle text.':e.message;more=false;}
  finally{if(id===requestId){loading=false;searched=true;render();}}
}
function findCard(id) {return results.find(c=>c.id===id)||current()?.cards.find(e=>e.card.id===id)?.card||comparison.find(item=>item.card.id===id)?.card;}
function addCard(id) {const c=findCard(id);if(!c)return;if(!current()){deckForm(undefined,()=>addCard(id));return;}changeDeck(d=>{const found=d.cards.find(e=>cardKey(e.card)===cardKey(c));if(found){if(found.qty>=500)return;found.qty++;}else d.cards.push({card:c,qty:1,tags:[]});});toast(`${c.name} added`);}
function showDialog(html) {const dialog=$('#dialog');dialog.innerHTML=`<button class="dialog-close icon-button" aria-label="Close dialog">${icon('close')}</button>${html}`;dialog.setAttribute('aria-label',dialog.querySelector('h2')?.textContent || 'Card details');if(!dialog.open)dialog.showModal();dialog.querySelector('.dialog-close').onclick=()=>dialog.close();}
$('#dialog').addEventListener('click',e=>{if(e.target===$('#dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
function deckForm(deck,after) {
  showDialog(`<h2>${deck?'Edit deck':'Create a deck'}</h2><p>Give it a name. You can change the format any time.</p><form id="deck-form"><label>Deck name<input name="name" required maxlength="100" value="${esc(deck?.name||'')}" placeholder="e.g. The garden grows"></label><label>Format<select name="format">${FORMATS.map(f=>`<option ${f===(deck?.format||'commander')?'selected':''}>${f}</option>`).join('')}</select></label><button class="primary" type="submit">${deck?'Save changes':'Create deck'}</button>${deck?'<button type="button" id="delete-deck" class="danger">Delete deck…</button>':''}</form>`);
  $('#deck-form').onsubmit=e=>{e.preventDefault();const data=new FormData(e.target),name=String(data.get('name')).trim();if(!name)return;const f=String(data.get('format'));if(deck){deck.name=name;deck.format=f;}else{const d=blankDeck(name,f);decks.push(d);active=d.id;}save();$('#dialog').close();view='explore';render();after?.();};
  $('#delete-deck')?.addEventListener('click',()=>{showDialog(`<h2>Delete ${esc(deck.name)}?</h2><p>This removes the deck from this browser. Export a backup first if you want to keep it.</p><button id="confirm-delete" class="danger">Delete deck</button>`);$('#confirm-delete').onclick=()=>{decks=decks.filter(d=>d.id!==deck.id);active=decks[0]?.id;save();$('#dialog').close();render();};});
}
function settings() {
  showDialog(`<h2>Workspace settings</h2><p>Appearance and backups for this browser.</p><label class="theme-setting">Appearance<select id="theme">${[['system','Use device setting'],['light','Light'],['dark','Dark']].map(([v,l])=>`<option value="${v}" ${theme===v?'selected':''}>${l}</option>`).join('')}</select></label><h3 class="settings-heading">Deck backups</h3><p>Decks are saved only in this browser. A JSON backup preserves cards, commanders, and role tags.</p><div class="settings-actions"><button class="secondary" id="settings-backup">${icon('download',16)} Export JSON backup</button><button class="secondary" id="settings-restore">${icon('upload',16)} Restore JSON backup</button></div>`);
  $('#theme').onchange=e=>{theme=e.target.value;applyTheme();try{localStorage.setItem('arcana.theme.v1',theme);}catch{toast('Appearance changed for this session. Browser storage is unavailable.');}};
  $('#settings-backup').onclick=()=>download('arcana-decks.json',JSON.stringify(decks,null,2),'application/json');
  $('#settings-restore').onclick=restore;
}
function customTag(){showDialog('<h2>Explore a specific tag</h2><p>Enter a Scryfall function tag, such as mana-rock or reanimate. Names and aliases in the snapshot resolve to their canonical tags. Tags outside the snapshot are allowed, but may be unsupported by Scryfall.</p><form id="custom-tag-form"><label>Function tag<input name="tag" required maxlength="80" placeholder="e.g. mana-rock"></label><p id="custom-tag-error" role="alert"></p><button class="primary">Add to search</button></form>');$('#custom-tag-form').onsubmit=e=>{e.preventDefault();readFilters();const value=String(new FormData(e.target).get('tag')).trim().toLowerCase();const t=resolveTag(value)?.id || value.replace(/\s+/g,'-');if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(t)){$('#custom-tag-error').textContent='Use a tag name with letters, numbers and single hyphens.';return;}if(!filters.tags.includes(t))filters.tags.push(t);$('#dialog').close();search();};}
function inspect(id) {
  const c=findCard(id);if(!c)return;const entry=current()?.cards.find(e=>cardKey(e.card)===cardKey(c));const image=imageFor(c);
  showDialog(`<div class="card-detail">${image?`<img src="${esc(safeUrl(image,true))}" alt="${esc(c.name)}">`:''}<div><h2>${esc(c.name)}</h2><div class="detail-mana">${mana(c.mana_cost)}</div><p>${esc(c.type_line)}</p><p class="oracle-text">${esc(oracle(c))}</p><p class="hint">Mana value ${c.cmc} · ${esc(c.set_name)}${c.artist?' · Artist: '+esc(c.artist):''}</p><div class="legality-badges">${FORMATS.map(f=>`<span class="${c.legalities?.[f]==='legal'?'is-legal':''}">${f}: ${esc(c.legalities?.[f]?.replaceAll('_',' ')||'unknown')}</span>`).join('')}</div><button class="secondary" id="detail-compare">${comparison.some(item=>cardKey(item.card)===cardKey(c)) ? 'Remove from comparison' : 'Compare this card'}</button><button class="primary" id="detail-add">${icon('plus',16)} Add to deck${entry?' ('+entry.qty+' in deck)':''}</button>${entry?`<form id="roles-form"><label>Your role tags<input name="roles" placeholder="Ramp, Removal" maxlength="500" value="${esc(entry.tags.join(', '))}"></label><label class="checkbox-label"><input type="checkbox" name="commander" ${entry.commander?'checked':''}> Set as commander</label><button class="secondary">Save roles</button></form>`:''}<p><a href="${esc(safeUrl(c.scryfall_uri))}" target="_blank" rel="noreferrer">View on Scryfall ↗</a></p></div></div>`);
  $('#detail-compare').onclick=()=>{$('#dialog').close();toggleComparison(id);};
  $('#detail-add').onclick=()=>{addCard(id);if(current())inspect(id);};
  $('#roles-form')?.addEventListener('submit',e=>{e.preventDefault();const data=new FormData(e.target);changeDeck(d=>{entry.tags=[...new Set(String(data.get('roles')).split(',').map(t=>t.trim().slice(0,80)).filter(Boolean))];if(data.has('commander'))d.cards.forEach(x=>x.commander=x===entry);else entry.commander=false;});$('#dialog').close();toast('Card roles saved');});
}
async function fetchNames(names) {const cards=[],missing=[];for(let i=0;i<names.length;i+=75){const data=await api('/api/collection',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({names:names.slice(i,i+75)})});cards.push(...data.data);missing.push(...(data.not_found||[]).map(x=>x.name));}return {cards,missing};}
function importDialog(){
  if(!current()){deckForm(undefined,importDialog);return;}
  const target=current();
  showDialog(`<h2>Import cards</h2><p>Paste one card per line, such as “1 Sol Ring”. Cards will be added to ${esc(target.name)}. Export a deck from Archidekt as a plain-text list without section headings.</p><form id="import-form"><label>Decklist<textarea name="list" rows="9" required placeholder="1 Sol Ring&#10;1 Command Tower&#10;10 Forest"></textarea></label><p id="import-error" role="alert"></p><button class="primary">Import cards</button></form>`);
  $('#import-form').onsubmit=async e=>{e.preventDefault();const form=e.target,button=form.querySelector('button');button.disabled=true;button.textContent='Finding cards…';try{const parsed=parseImport(new FormData(form).get('list'));const {cards,missing}=await fetchNames(parsed.map(x=>x.name));if(missing.length)throw new Error('Not imported. Could not find: '+missing.join(', ')+'. Correct these names and try again.');const additions=parsed.map(p=>{const card=cards.find(c=>c.name.toLowerCase()===p.name.toLowerCase()||c.card_faces?.some(f=>f.name.toLowerCase()===p.name.toLowerCase()));if(!card)throw new Error('Could not resolve '+p.name);return {card,qty:p.qty,tags:[]};});const merged=structuredClone(target.cards);for(const a of additions){const found=merged.find(x=>cardKey(x.card)===cardKey(a.card));if(found){found.qty+=a.qty;if(found.qty>500)throw new Error('Maximum 500 copies per card.');}else merged.push(a);}target.cards=merged;target.updated=new Date().toISOString();save();$('#dialog').close();render();toast(`${additions.reduce((n,e)=>n+e.qty,0)} cards imported`);}catch(error){form.querySelector('#import-error').textContent=error.message;}finally{button.disabled=false;button.textContent='Import cards';}};
}
function restore(){showDialog('<h2>Restore your workspace</h2><p>Choose an Arcana JSON backup. Restored decks are added alongside existing decks.</p><input id="backup-file" type="file" accept="application/json,.json" aria-label="Deck backup file"><p id="restore-error" role="alert"></p>');$('#backup-file').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>15_000_000)throw new Error('Backup is too large (maximum 15 MB).');const imported=validateBackup(JSON.parse(await file.text()));if(decks.length+imported.length>200)throw new Error('Maximum 200 decks per workspace.');for(const d of imported){d.id=crypto.randomUUID();decks.push(d);}storageError='';active=imported[0]?.id||active;save();$('#dialog').close();render();toast('Backup restored');}catch(error){$('#restore-error').textContent=error.message;}};}
async function refresh(){const d=current();if(!d?.cards.length){toast('Add some cards first.');return;}toast('Refreshing card data…');try{const {cards,missing}=await fetchNames(d.cards.map(e=>e.card.name));if(missing.length)throw new Error('Some cards could not be refreshed. Your deck is unchanged.');const byName=new Map(cards.map(c=>[c.name,c]));if(d.cards.some(e=>!byName.has(e.card.name)))throw new Error('Could not refresh every card. Your deck is unchanged.');d.cards.forEach(e=>e.card=byName.get(e.card.name));save();render();toast('Card data and legality refreshed');}catch(e){toast(e.message);}}
async function sample(){toast('Loading a small example from Scryfall…');try{const names=['Tatyova, Benthic Druid','Sol Ring','Arcane Signet','Cultivate',"Kodama's Reach",'Llanowar Elves','Rampant Growth','Growth Spiral','Beast Within','Counterspell','Eternal Witness','Command Tower','Forest','Island'];const {cards,missing}=await fetchNames(names);if(missing.length)throw new Error('Example cards could not be loaded. Try again.');const d=blankDeck('The garden grows');d.cards=cards.map(card=>({card,qty:card.name==='Forest'?12:card.name==='Island'?10:1,tags:['Cultivate',"Kodama's Reach",'Rampant Growth','Sol Ring','Arcane Signet','Llanowar Elves'].includes(card.name)?['Ramp']:[],commander:card.name==='Tatyova, Benthic Druid'}));decks.push(d);active=d.id;save();view='explore';render();toast('Example loaded — an unfinished Commander deck to build on');}catch(e){toast(e.message);}}
render();
