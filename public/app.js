import { FORMATS, TAGS, TAG_CATALOG, tagById, findTags, resolveTag, count, exportDeckText, ZONES, zoneFor, zoneCount, entryKey, moveEntry, legalityReport, imageFor, oracle, queryFor, relaxationOptions, relaxSearch, stats, parseImport, validateBackup, safeUrl, category, primaryRole, deckEntries, deckIdentity, parseQuery, replaceCondition, conditionQuery, SEARCH_FAMILIES } from './core.js';

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
for (const deck of decks) for (const entry of deck.cards) entry.zone = zoneFor(entry);
let active = decks[0]?.id;
let tracker = { id: active || '', visible: true, width: 340 };
try {
  const saved = JSON.parse(localStorage.getItem('arcana.explorer.v1'));
  if (saved && typeof saved === 'object') {
    if (typeof saved.id === 'string') tracker.id = decks.some(d=>d.id===saved.id) ? saved.id : '';
    if (typeof saved.visible === 'boolean') tracker.visible = saved.visible;
    if (Number.isFinite(saved.width)) tracker.width = Math.max(280,Math.min(480,saved.width));
  }
} catch {}
let view = 'explore', deckTab = 'cards', results = [], total = 0, page = 1, more = false, loading = false, error = '', requestId = 0, searched = false;
let filters = parseQuery('');
let filtersOpen = false, tagsOpen = false;
let order = 'edhrec', tagSearch = '', visibleLimit = 24;
let browsedTag = '', tagLimit = 30, allTags = false;
let comparison = [], comparisonOpen = false, broadening = null, resultContext = null;
let editorOptions = { group: 'type', type: '', role: '', order: 'name' };
const current = () => decks.find(d => d.id === (view === 'explore' ? tracker.id : active));
function saveTracker() {
  try { localStorage.setItem('arcana.explorer.v1', JSON.stringify(tracker)); }
  catch { toast('Tracker changed for this session. Browser preferences could not be saved.'); }
}
function trackDeck(id) {
  tracker.id = decks.some(d=>d.id===id) ? id : '';
  if (tracker.id) tracker.visible = true;
  saveTracker(); render();
}
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
  $('#app').style.setProperty('--tracker-width', tracker.width+'px');
  $('#app').classList.toggle('has-tracker', view==='explore' && Boolean(d) && tracker.visible);
  $('#app').innerHTML = `<header class="workspace-nav"><a class="brand" href="/" data-view="explore" aria-label="Arcana home — Explore cards"><span class="brand-mark">${icon('cards',25)}</span>arcana</a><nav aria-label="Main navigation"><button data-view="explore" class="nav-item ${view==='explore'?'selected':''}" ${view==='explore'?'aria-current="page"':''}>Explore cards</button><button data-view="decks" class="nav-item ${view==='decks'||view==='deck'?'selected':''}" ${view==='deck'?'aria-current="location"':view==='decks'?'aria-current="page"':''}>My decks</button><button class="nav-item" data-action="settings">Settings</button></nav><span class="local-status">${storageError?'Unsaved changes':'Saved in this browser'}</span><button class="icon-button" data-action="help" aria-label="Help">${icon('book',17)}</button></header>
  <main>${storageError ? `<div class="storage-warning" role="alert">${esc(storageError)} <button data-action="backup">Export backup</button></div>` : ''}${view === 'decks' ? library() : view === 'deck' ? deckWorkspace(d) : explorer()}</main>${view === 'explore' && d && tracker.visible ? `<button class="mobile-deck-jump primary" data-action="jump-deck">View tracker · ${esc(d.name)}</button><aside id="deck-tracker" class="deck-panel" aria-label="Tracked deck: ${esc(d.name)}"><div id="tracker-resize" role="separator" tabindex="0" aria-label="Resize deck tracker" aria-orientation="vertical" aria-controls="deck-tracker" aria-valuemin="280" aria-valuemax="480" aria-valuenow="${tracker.width}" aria-valuetext="${tracker.width} pixels, subject to available space" title="Drag to resize. Left widens; Right narrows; Home and End set limits."></div>${deckPanel(d)}</aside>` : ''}`;
  bind();
  if(focusSelector) {const target=document.querySelector(focusSelector)||document.querySelector('.deck-tabs [aria-selected="true"]');target?.focus({preventScroll:true});}
}
function queryNotes() {
  return `${filters.error?`<p class="query-error" role="alert">${esc(filters.error)} Guided edits are paused; your query is unchanged.</p>`:''}${filters.opaque.length&&!filters.error?`<details class="query-help"><summary>Query-only expressions · ${filters.opaque.length}</summary><p>These expressions stay verbatim in the search. Complex or unsupported expressions cannot be edited with guided controls${filters.locked.length?'; affected controls are disabled':''}.</p>${filters.opaque.map(text=>`<code>${esc(text)}</code>`).join('')}<p>Supported controls cover positive type/tag groups, two mana-value comparisons, color modes, symbol minimums, one name/Oracle phrase and one format. Edit other expressions directly above.</p></details>`:''}`;
}
function guidedControls() {
  const selected=(value,current)=>value===current?'selected':'';
  const mode=(name,current,options)=>`<select name="${name}" aria-label="${({'type-match':'Combine types','value-match':'Combine mana-value comparisons','color-mode':'Card color matching','identity-mode':'Color identity matching','mv-op-0':'Mana-value comparison 1','mv-op-1':'Mana-value comparison 2'})[name]}">${options.map(([v,l])=>`<option value="${v}" ${selected(v,current)}>${l}</option>`).join('')}</select>`;
  const match=(name,current)=>mode(name,current,[['all','Match all (AND)'],['any','Match any (OR)']]);
  const field=(family,title,content)=>`<fieldset data-family="${family}" ${filters.locked.includes(family)?'disabled':''}><legend>${title}</legend>${content}${filters.locked.includes(family)?'<p class="hint">Edit this condition in the query above.</p>':''}</fieldset>`;
  const color=(family,title)=>field(family,title,`<label>Matching mode${mode(family+'-mode',filters[family].mode,[['all','Contains all selected colors'],['any','Contains any selected color'],['exact','Exactly the selected colors'],['subset','Only these colors, including colorless'],['multi','Multicolor only'],['colorless','Colorless only']])}</label><div class="guided-colors">${[...'WUBRG'].map(c=>`<label><input type="checkbox" name="${family}-${c}" ${filters[family].values.includes(c)?'checked':''} ${['multi','colorless'].includes(filters[family].mode)?'disabled':''}>${mana('{'+c+'}')} ${({W:'White',U:'Blue',B:'Black',R:'Red',G:'Green'})[c]}</label>`).join('')}</div><p class="hint">Select colors for all/any/exact/only matching. Multicolor and colorless use no color selection.</p>`);
  return `<form id="guided-form"><div class="guided-grid">${field('type','Card types and subtypes',`<label>Type names, separated by commas<input name="types" value="${esc(filters.types.join(', '))}" placeholder="e.g. instant, sorcery" maxlength="200"></label><label>Combine types${match('type-match',filters.typeMatch)}</label><p class="hint">Use all for Artifact + Creature; any for Instant OR Sorcery. Subtypes such as Elf work here too.</p>`)}${field('mv','Mana value',`<label>Combine comparisons${match('value-match',filters.valueMatch)}</label>${[0,1].map(i=>`<div class="mana-comparison"><label>Comparison ${i+1}${mode('mv-op-'+i,filters.values[i]?.op|| (i?'<=':'>='),[['<=','At most (≤)'],['<','Less than (<)'],['=','Exactly (=)'],['>=','At least (≥)'],['>','More than (>)'],['!=','Not equal (≠)']])}</label><label>Mana value ${i+1}<input type="number" min="0" step="any" name="mv-${i}" value="${esc(filters.values[i]?.value??'')}" placeholder="Any"></label></div>`).join('')}<p class="hint">All combines a range; any combines alternatives. Blank values add no restriction.</p>`)}${color('color','Card color')}${color('identity','Color identity')}${field('name','Card name',`<label>Name phrase<input name="name" value="${esc(filters.name)}" maxlength="200" placeholder="e.g. Sol Ring"></label>`)}${field('oracle','Oracle text',`<label>Rules-text phrase<input name="oracle" value="${esc(filters.oracle)}" maxlength="300" placeholder="e.g. whenever a creature dies"></label>`)}${field('cost','Mana cost contains',`<label>Mana symbols<input name="cost" value="${esc(filters.cost)}" maxlength="100" placeholder="e.g. {1}{G}"></label><p class="hint">{C} is colorless mana; {1} is generic mana. Hybrid symbols such as {U/B} stay distinct.</p>`)}${field('symbols','Minimum mana-symbol counts',`<div class="symbol-minimums">${[...'WUBRGC'].map(c=>`<label>${c==='C'?'Colorless {C}':({W:'White {W}',U:'Blue {U}',B:'Black {B}',R:'Red {R}',G:'Green {G}'})[c]}<input type="number" name="symbol-${c}" min="0" max="20" step="1" value="${filters.symbols[c]||''}" placeholder="0"></label>`).join('')}</div><p class="hint">Each count means at least that many of the exact symbol, all required. Colorless {C} does not mean generic mana.</p>`)}${field('legal','Format legality',`<label>Legal in format<select name="legal"><option value="">Any format</option>${uniqueFormats().map(f=>`<option value="${esc(f)}" ${selected(f,filters.legal)}>${esc(f)}</option>`).join('')}</select></label><p class="hint">Chosen independently of the tracked deck.</p>`)}</div><p id="guided-error" role="alert"></p><button class="secondary" type="submit">Search with these filters</button></form>`;
}
function uniqueFormats(){return [...new Set([...FORMATS,...(filters.legal?[filters.legal]:[])])];}
function selectedFunctions() {
  if(!filters.tags.length)return '';
  return `<section class="selected-functions" aria-label="Selected function filters"><div class="selected-functions-heading"><h3>Selected functions</h3><label>Require<select id="tag-match"><option value="all" ${filters.match==='all'?'selected':''}>All selected functions (AND)</option><option value="any" ${filters.match==='any'?'selected':''}>Any selected function (OR)</option></select></label></div><div class="active-tags">${filters.tags.map(t=>`<button class="tag-option selected" data-tag="${esc(t)}" aria-label="Remove ${esc(t)} filter">${esc(t.replaceAll('-',' '))} ${icon('close',12)}</button>`).join('')}</div></section>`;
}
function explorer() {
  const d=current();
  return `<div class="explorer"><div class="page-heading"><div><h1>Explore cards</h1><p>Search by name, rules text, types or function.</p></div></div><div class="exploration-target"><label for="tracked-deck">Track deck<select id="tracked-deck"><option value="">No tracked deck</option>${decks.map(deck=>`<option value="${esc(deck.id)}" ${deck.id===tracker.id?'selected':''}>${esc(deck.name)}</option>`).join('')}</select></label>${d?`<span>Quick add: <strong>${esc(d.name)}</strong> · Main deck</span><button id="toggle-tracker" class="text-button" data-action="toggle-tracker" aria-expanded="${tracker.visible}" aria-controls="deck-tracker">${tracker.visible?'Hide':'Show'} tracker</button>`:'<span>Browse freely. Choose a destination when adding a card.</span>'}</div><form id="search-form"><label class="search-label" for="raw">Scryfall query</label><div class="search-box">${icon('search',22)}<input id="raw" name="raw" aria-label="Search cards or use Scryfall syntax" placeholder="Card name or Scryfall query…" value="${esc(filters.query)}" maxlength="1500" aria-describedby="query-notes"><button class="primary" type="submit">Search ${icon('arrow',16)}</button></div><button type="button" class="text-button reset-query" data-action="reset">Clear search and filters</button></form><div id="query-notes">${queryNotes()}</div><details id="search-filters" class="search-disclosure" ${filtersOpen?'open':''}><summary>Filters</summary><div id="guided-controls">${guidedControls()}</div></details><details id="function-tags" class="tag-browser" ${tagsOpen?'open':''}><summary>Browse by function <span>Find existing Scryfall tags</span></summary><div class="tag-browser-content"><label class="tag-search-label" for="tag-search">Find a function</label><div class="tag-search"><input id="tag-search" value="${esc(tagSearch)}" placeholder="e.g. ramp or removal" aria-label="Find function tags"></div><div id="tag-options">${tagOptions()}</div><div class="tag-footer"><button class="text-button" data-action="custom-tag">Enter an existing Scryfall tag…</button><details class="tag-info"><summary>About this tag catalog</summary><p>${TAG_CATALOG.tags.length.toLocaleString()} tags from <a href="https://scryfall.com/docs/api/tags" target="_blank" rel="noreferrer">Scryfall Tagger</a> · Snapshot ${esc(TAG_CATALOG.updated.slice(0,10))}. May lag behind live tags. This bundled catalog does not update live. Entering a tag searches existing Scryfall tagging; it does not create tags.</p></details></div></div></details><div id="selected-functions">${selectedFunctions()}</div>${searchResults()}${comparisonTools()}</div>`;
}
function searchResults(){
  const noMatch=Boolean(error)&&error.startsWith('No cards');
  const status=loading?'Searching Scryfall…':error?(noMatch?'0 cards found':'Search failed'):searched?total.toLocaleString()+(total===1?' card found':' cards found'):'Search above, or try an optional starting point.';
  return `<section id="results-area" aria-labelledby="result-heading" data-state="${loading?'loading':error?(noMatch?'no-match':'error'):searched?'populated':'initial'}"><div class="results-heading"><div><h2 id="result-heading" tabindex="-1">${searched||loading||error?'Cards':'Discover cards'}</h2><span id="result-count" role="status" aria-live="polite">${status}</span></div>${searched||loading||error?`<div class="results-controls"><label>Sort results<select id="sort" aria-label="Sort cards">${[['edhrec','Popular first'],['cmc','Mana value'],['name','Name A–Z'],['usd','Price: low first']].map(([v,l])=>`<option value="${v}" ${order===v?'selected':''}>${l}</option>`).join('')}</select></label></div>`:''}</div>
  ${resultContext&&resultContext.query!==queryFor(filters,current())?'<p class="query-stale" role="status">These results are from the previous query. Press Search to update them.</p>':''}
  ${error?`<div class="empty-state" role="alert"><h3>${noMatch?'No cards matched':'Search couldn’t finish'}</h3><p>${esc(error)}</p><div><button class="secondary" data-action="reset">Clear search and filters</button>${!noMatch?'<button class="primary" data-action="retry">Try again</button>':''}</div></div>`:loading&&!results.length?'<div class="loading-state" role="status"><p>Loading cards…</p></div>':`<div class="card-grid" aria-busy="${loading}">${results.slice(0,visibleLimit).map(cardTile).join('')}</div>${!searched&&!results.length?'<div class="search-starts"><p>Try a function</p><div><button class="secondary" data-preset="ramp">Find ramp</button><button class="secondary" data-preset="draw">Find card draw</button><button class="secondary" data-preset="removal">Find removal</button></div></div>':''}`}
  ${(more||visibleLimit<results.length)&&!error?`<button class="load-more secondary" data-action="more" ${loading?'disabled':''}>${loading?'Loading…':'Load more cards'}</button>`:''}<footer>Card data and images by <a href="https://scryfall.com" target="_blank" rel="noreferrer">Scryfall</a>. Magic: The Gathering © Wizards of the Coast.</footer></section>`;
}
function tagOptions() {
  const searching=Boolean(tagSearch.trim()), matches=searching||allTags?findTags(tagSearch):TAGS.map(([id])=>tagById.get(id)||resolveTag(id)).filter(Boolean);
  const shown=matches.slice(0,tagLimit),detail=tagById.get(browsedTag),locked=filters.locked.includes('tags');
  const browse=id=>`<button class="text-button" data-browse-tag="${esc(id)}">${esc(id.replaceAll('-',' '))}</button>`;
  const relation=(label,ids)=>`<div class="tag-relations"><strong>${label}</strong><div>${ids.map(browse).join('')||'<span class="hint">None recorded in this snapshot.</span>'}</div></div>`;
  return `<p class="hint" role="status">${searching?'Matching names and aliases for “'+esc(tagSearch)+'”':allTags?'Browsing the full bundled catalog':'Curated starting points — or search the full catalog above.'}</p>${locked?'<p class="hint">Function expressions in a complex query group must be edited in the query above.</p>':''}<details class="tag-info"><summary>About these tag results</summary><p>${matches.length.toLocaleString()} ${searching?'matching':allTags?'catalog':'curated'} tags · showing ${shown.length}. Search names and aliases; relationships come from the bundled snapshot.</p></details><div class="tag-options">${shown.map(t=>`<span class="tag-choice"><button class="tag-option ${filters.tags.includes(t.id)?'selected':''}" data-tag="${esc(t.id)}" aria-pressed="${filters.tags.includes(t.id)}" aria-label="${filters.tags.includes(t.id)?'Remove':'Add'} ${esc(t.id)} filter" ${locked?'disabled':''}>${esc(TAGS.find(([id])=>id===t.id)?.[1]||t.id.replaceAll('-',' '))} <span>${filters.tags.includes(t.id)?'Remove filter':'Add filter'}</span></button><button class="tag-browse" data-browse-tag="${esc(t.id)}" aria-label="Browse ${esc(t.id)} relationships">Related ${icon('arrow',14)}</button></span>`).join('')||'<p class="hint">No matching name or alias. Try another phrase or enter an existing Scryfall tag; absence here does not mean Scryfall rejects it.</p>'}</div>${!searching&&!allTags?'<button class="text-button tag-more" data-action="all-tags">Browse the full tag catalog</button>':''}${matches.length>shown.length?`<button class="text-button tag-more" data-action="more-tags">Show next ${Math.min(30,matches.length-shown.length)} ${searching?'matching':'catalog'} tags</button>`:''}${detail?`<section class="tag-detail" aria-label="Tag relationships"><h3>${esc(detail.id.replaceAll('-',' '))}</h3><p class="hint">${detail.aliases.length?'Aliases: '+esc(detail.aliases.join(', '))+'. ':''}<a href="https://tagger.scryfall.com/tags/card/${encodeURIComponent(detail.id)}" target="_blank" rel="noreferrer">View on Tagger</a></p>${relation('Broader tags',detail.parents)}${relation('Narrower tags',detail.children)}<p class="hint">Browsing relationships leaves the card query unchanged. Use Add filter to search a function.</p><button class="secondary" data-tag="${esc(detail.id)}" ${locked?'disabled':''}>${filters.tags.includes(detail.id)?'Remove filter':'Add filter'}</button></section>`:''}${filters.tags.filter(t=>!tagById.has(t)).map(t=>`<p class="hint">Existing tag “${esc(t)}” is outside this snapshot. Scryfall may accept it, reject it, or return no cards.</p>`).join('')}`;
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
      ${row('Card', ({card}) => { const image = safeUrl(imageFor(card),true); return `${image ? `<img src="${esc(image)}" alt="${esc(card.name)}" loading="lazy">` : ''}<button class="text-button" data-inspect="${esc(card.id)}" aria-label="Inspect ${esc(card.name)}">Inspect</button> <button class="text-button" data-add="${esc(card.id)}" aria-label="${esc(addLabel(card))}">${current()?'Add to tracked deck':'Add to…'}</button>`; })}
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
  broadening = result; filters = result.filters; comparisonOpen = true;
  return search(false, true).then(()=>$('#result-heading')?.focus());
}
function restoreSearch() {
  if (!broadening) return;
  filters = broadening.original; broadening = null;
  return search().then(()=>$('#result-heading')?.focus());
}
function cardTile(c) {
  const entry = current()?.cards.find(e=>cardKey(e.card)===cardKey(c)&&zoneFor(e)==='main');
  const image = imageFor(c);
  const compared = comparison.some(item=>cardKey(item.card)===cardKey(c));
  return `<article class="card-tile"><button class="card-image-button" data-inspect="${esc(c.id)}" aria-label="Inspect ${esc(c.name)}">${image ? `<img src="${esc(safeUrl(image,true))}" alt="${esc(c.name)}" loading="lazy" width="488" height="680">` : `<div class="card-fallback">${esc(c.name)}<p>${esc(oracle(c))}</p></div>`}</button><div class="card-caption"><button data-inspect="${esc(c.id)}" class="card-name">${esc(c.name)}</button><button class="add-button ${entry ? 'added' : ''}" data-add="${esc(c.id)}" aria-label="${esc(addLabel(c))}" title="${esc(addLabel(c))}">${entry ? `<span>${entry.qty}</span>` : icon('plus',17)}</button></div><div class="card-meta"><span>${esc(c.type_line?.split(' — ')[0])}</span><span>${c.prices?.usd ? '$' + esc(c.prices.usd) : '—'}</span></div>${current()?`<button class="text-button choose-deck" data-choose-add="${esc(c.id)}" aria-label="Choose another deck for ${esc(c.name)}">Add to…</button>`:''}<button class="text-button compare-card" data-compare="${esc(c.id)}" aria-label="${esc(compared ? `Remove ${c.name} from comparison` : `Compare ${c.name}`)}" aria-pressed="${compared}">${compared ? 'Remove comparison' : 'Compare'}</button></article>`;
}
function deckPanel(d) {
  return `<div class="panel-title"><span>Deck tracker</span><button class="text-button" data-action="toggle-tracker">Hide tracker</button></div><div class="deck-header"><h2 id="tracker-heading" tabindex="-1">${esc(d.name)}</h2><span class="format-badge">${esc(d.format)}</span>${identitySummary(d)}<p class="tracker-count"><strong>${stats(d).total}</strong> in playing deck · ${zoneCount(d,'sideboard')} sideboard</p><p class="hint">Quick add goes to Main deck.</p><button class="secondary" data-deck="${esc(d.id)}">Open full deck</button></div><div class="panel-content">${d.cards.length?deckList(d):'<p class="hint">No cards yet. Use quick add on a result to add to this deck’s Main deck.</p>'}</div>`;
}
function identitySummary(d) {
  const colors=deckIdentity(d), names={W:'White',U:'Blue',B:'Black',R:'Red',G:'Green'};
  const missing=d.format==='commander'&&!d.cards.some(e=>zoneFor(e)==='command');
  return `<span class="identity-summary" aria-label="${d.format==='commander'?'Command-zone identity':'Main-deck identity'}: ${missing?'not designated':colors.map(c=>names[c]).join(', ')||'colorless'}">${missing?'Commander not designated':colors.length?mana(colors.map(c=>'{'+c+'}').join('')):'Colorless'}<span>${d.format==='commander'?'Command-zone identity':'Main-deck identity'}</span></span>`;
}
function openDeck(id) {
  if(!decks.some(d=>d.id===id))return;
  const changed=active!==id;active=id;view='deck';deckTab='cards';
  if(changed)editorOptions={group:'type',type:'',role:'',order:'name'};
  render();$('#deck-title')?.focus();

}
function deckWorkspace(d) {
  if(!d)return `<div class="library"><h1>No deck selected</h1><button class="secondary" data-view="decks">Back to My decks</button></div>`;
  const s=stats(d), report=legalityReport(d), roles=[...new Set(d.cards.flatMap(e=>e.tags))].sort();
  const types=[...new Set(d.cards.flatMap(e=>e.card.type_line.split(' — ')[0].split(' ')))].sort();
  const select=(key,label,values)=>`<label>${label}<select id="editor-${key}">${values.map(([v,l])=>`<option value="${esc(v)}" ${editorOptions[key]===v?'selected':''}>${esc(l)}</option>`).join('')}</select></label>`;
  return `<div class="deck-workspace"><button class="text-button" data-view="decks">Back to My decks</button><div class="page-heading"><div><h1 id="deck-title" tabindex="-1">${esc(d.name)}</h1><p>${esc(d.format)} · ${s.total} in playing deck · ${zoneCount(d,'sideboard')} sideboard</p>${identitySummary(d)}</div><div class="workspace-actions"><button class="primary" data-action="find-cards">${icon('plus',16)} Find cards to add</button><button class="secondary" data-action="rename">Rename / format</button></div></div><div class="workspace-actions deck-management"><button class="secondary" data-action="import">Import cards</button><button class="secondary" data-action="export">Export deck</button><button class="secondary" data-manage="duplicate" data-target="${esc(d.id)}">Duplicate</button><button class="text-button danger" data-manage="delete" data-target="${esc(d.id)}">Delete deck…</button></div><div class="deck-tabs" role="tablist" aria-label="Deck sections">${[['cards','Cards'],['stats','Statistics'],['checks','Checks']].map(([key,label])=>`<button role="tab" aria-selected="${deckTab===key}" data-tab="${key}">${label}</button>`).join('')}</div><div class="editor-content">${deckTab==='stats'?statPanel(s):deckTab==='checks'?checksPanel(d,report):`<div class="editor-controls">${select('group','Group by',[['type','Card type'],['role','Primary function'],['none','No grouping']])}${select('order','Order by',[['name','Name'],['mana','Mana value'],['quantity','Quantity (most first)']])}${select('type','Filter card type',[['','All types'],...types.map(t=>[t,t])])}${select('role','Filter any assigned role',[['','All roles'],...roles.map(t=>[t,t])])}<button class="text-button" data-action="clear-deck-filters">Clear filters</button></div><p class="hint role-help">Primary function is the first personal role tag. Filtering matches every assigned role. Inspect a card to edit its ordered role tags.</p>${deckList(d,true)}`}</div></div>`;
}
function checksPanel(d, report) {
  const section = (label, items) => `<section class="check-section"><h3>${label} · ${items.length}</h3>${items.map(t=>`<p class="${label === 'Failed checks' ? 'check-issue' : 'hint'}">${esc(t)}</p>`).join('') || '<p class="hint">None found.</p>'}</section>`;
  return `<div class="checks"><h3>${report.failed.length ? 'Construction checks failed' : report.unavailable.length ? 'Checks incomplete' : 'Supported checks passed'}</h3><p>${d.format === 'modern' ? 'Modern: main deck 60+, sideboard up to 15, combined copy limits and stored card legality.' : 'Partial format coverage; review the notices below.'} Stored data can be outdated; refresh before playing.</p>${section('Failed checks',report.failed)}${section('Data unavailable',report.unavailable)}${section('Manual review',report.manual)}<p class="hint">Passing supported checks is not tournament certification. Companions, special construction text and formats outside the selected Modern rule family may require manual review.</p><button class="secondary" data-action="refresh">Refresh card legality</button></div>`;
}
function deckList(d, full=false) {
  return `<div class="zone-counts" aria-label="Deck zone counts">${Object.entries(ZONES).map(([z,label])=>`<span>${label}: ${zoneCount(d,z)}</span>`).join('')}</div>` + Object.entries(ZONES).map(([zone,label]) => {
    const entries = (full?deckEntries(d,editorOptions):d.cards).filter(e=>zoneFor(e)===zone), groups=new Map();
    for(const e of entries){const group=full?(editorOptions.group==='role'?primaryRole(e):editorOptions.group==='type'?category(e.card):''):'';if(!groups.has(group))groups.set(group,[]);groups.get(group).push(e);}
    return `<section class="deck-zone"><h3>${label} · ${zoneCount(d,zone)}${full&& (editorOptions.type||editorOptions.role)?' · '+entries.reduce((n,e)=>n+e.qty,0)+' shown':''}</h3>${[...groups].map(([group,items])=>`${group?`<h4>${esc(group)}</h4>`:''}${items.map(e=>`<div class="deck-row"><span class="qty">${e.qty}</span><span class="deck-name-wrap"><button class="deck-card-name" data-inspect="${esc(e.card.id)}" data-entry="${esc(entryKey(e))}">${esc(e.card.name)}</button>${full&&safeUrl(imageFor(e.card),true)?`<span class="row-preview" aria-hidden="true"><img src="${esc(safeUrl(imageFor(e.card),true))}" alt="" loading="lazy"></span>`:''}</span>${full?`<span class="row-mana">${mana(e.card.mana_cost||e.card.card_faces?.[0]?.mana_cost)}</span><label class="row-zone"><span class="sr-only">Zone for ${esc(e.card.name)} in ${label}</span><select data-move-entry="${esc(entryKey(e))}">${Object.entries(ZONES).map(([z,l])=>`<option value="${z}" ${zone===z?'selected':''}>${l}</option>`).join('')}</select></label>`:''}<div class="row-actions"><button data-zone-minus="${esc(entryKey(e))}" aria-label="Remove one ${esc(e.card.name)} from ${label}">−</button><button data-zone-plus="${esc(entryKey(e))}" aria-label="Add one ${esc(e.card.name)} to ${label}">+</button></div></div>`).join('')}`).join('') || `<p class="hint">${full&&d.cards.some(e=>zoneFor(e)===zone)?'No cards match these filters.':'No cards in this zone.'}</p>`}</section>`;
  }).join('');
}
function curve(s) { const max=Math.max(1,...s.curve); return `<div class="curve" role="img" aria-label="Mana curve: ${s.curve.map((n,i)=>`${i===7?'7+':i} mana: ${n}`).join(', ')}">${s.curve.map((n,i)=>`<div class="curve-column"><span>${n || ''}</span><div style="height:${n ? Math.max(4,n/max*54) : 2}px" class="${n?'filled':''}"></div><small>${i===7?'7+':i}</small></div>`).join('')}</div>`; }
function statPanel(s) { return `<div class="stats-view"><h3>Mana curve</h3>${curve(s)}<div class="stat-pair"><span>Average mana value</span><b>${s.average.toFixed(2)}</b></div><h3>Card types</h3>${Object.entries(s.types).map(([t,n])=>`<div class="stat-pair"><span>${t}</span><b>${n}</b></div>`).join('') || '<p class="hint">Add cards to see the breakdown.</p>'}<h3>Colors on cards</h3><div class="color-stats">${Object.entries(s.colors).map(([c,n])=>`<div><span class="mana mana-${c}">${c}</span><b>${n}</b></div>`).join('')}</div><p class="hint">Multicolor cards count in each of their colors.</p><h3>Your role tags</h3>${Object.entries(s.tags).map(([t,n])=>`<div class="stat-pair"><span>${esc(t)}</span><b>${n}</b></div>`).join('') || '<p class="hint">Inspect a deck card to assign roles such as ramp or removal.</p>'}</div>`; }
function library() { return `<div class="library"><div class="page-heading"><div><h1 tabindex="-1" id="library-title">My decks</h1><p>Choose a deck to continue building.</p></div><div class="workspace-actions"><button class="primary" data-action="new">${icon('plus',17)} New deck</button><button class="secondary" data-action="import-new">Import deck</button></div></div>${decks.length ? `<div class="deck-library">${decks.map(d=>{const s=stats(d);return `<article class="library-deck" aria-label="${esc(d.name)}"><div class="deck-cover">${d.cards[0] && imageFor(d.cards[0].card) ? `<img src="${esc(safeUrl(imageFor(d.cards[0].card),true))}" alt="${esc(d.cards[0].card.name)}" loading="lazy">` : icon('cards',62)}<span>${esc(d.format)}</span></div><div class="library-deck-body"><h2>${esc(d.name)}</h2>${identitySummary(d)}<p>${s.total} cards · ${s.lands} lands · ${s.average.toFixed(2)} average MV</p><button class="primary" data-deck="${esc(d.id)}">Open deck ${icon('arrow',16)}</button><div class="library-actions">${[['rename','Rename / format'],['duplicate','Duplicate'],['import','Import cards'],['export','Export'],['delete','Delete…']].map(([action,label])=>`<button class="text-button" data-manage="${action}" data-target="${esc(d.id)}" aria-label="${label} ${esc(d.name)}">${label}</button>`).join('')}</div></div></article>`;}).join('')}</div>` : `<div class="welcome-state"><h2>No decks yet.</h2><p>Create one, import a decklist, or try a small example.</p><button class="secondary" data-action="sample">Try an example deck</button></div>`}</div>`; }

function duplicateDeck(deck) {
  if(decks.length>=200){toast('Maximum 200 decks per workspace.');return;}
  const copy=structuredClone(deck);copy.id=crypto.randomUUID();copy.name=(deck.name+' (copy)').slice(0,100);copy.updated=new Date().toISOString();
  decks.push(copy);save();render();toast(`${copy.name} created`);
}
function deleteDeck(deck) {
  showDialog(`<h2>Delete ${esc(deck.name)}?</h2><p>This removes only this deck from this browser. Export a JSON backup first to keep a complete copy.</p><div class="workspace-actions"><button id="cancel-delete" class="secondary">Keep deck</button><button id="confirm-delete" class="danger">Delete ${esc(deck.name)}</button></div>`);
  $('#cancel-delete').onclick=()=>$('#dialog').close();
  $('#confirm-delete').onclick=()=>{decks=decks.filter(d=>d.id!==deck.id);if(active===deck.id){active=decks[0]?.id;if(view==='deck')view='decks';}if(tracker.id===deck.id){tracker.id='';saveTracker();}save();$('#dialog').close();render();$('#library-title')?.focus();toast('Deck deleted');};
  $('#cancel-delete').focus();
}
function exportDialog(deck) {
  showDialog(`<h2>Export ${esc(deck.name)}</h2><p>JSON preserves every card, quantity, zone and ordered role tag. Text includes names, quantities and zone headings, but loses roles and printing details.</p><div class="workspace-actions"><button class="primary" id="export-json">Complete JSON backup</button><button class="secondary" id="export-text">Text decklist</button></div>`);
  $('#export-json').onclick=()=>download(deck.name+'.json',JSON.stringify([deck],null,2),'application/json');
  $('#export-text').onclick=()=>download(deck.name+'.txt',exportDeckText(deck),'text/plain');
}

function readFilters() {
  const input=$('#raw');if(view==='explore'&&typeof input?.value==='string'&&input.value!==filters.query)filters=parseQuery(input.value);
}
function resetResults(){++requestId;loading=false;results=[];total=0;more=false;searched=false;error='';resultContext=null;broadening=null;}
function runGuidedSearch(){if(!filters.query.trim()){resetResults();render();}else search();}
function setCondition(family,model,run=true){
  try{
    const previous=filters,clause=conditionQuery(model,family);filters=replaceCondition(filters,family,clause);
    // One operand cannot encode AND versus OR; retain the player's equivalent guided intent.
    // Typing in the raw query still rebuilds projections solely from that query.
    for(const key of SEARCH_FAMILIES){
      if(filters.locked.includes(key))continue;
      const source=family===key?model:previous;
      const fields=key==='type'?['types','typeMatch']:key==='mv'?['values','valueMatch']:key==='tags'?['tags','match']:[key];
      for(const field of fields)filters[field]=source[field];
    }
    if(run)runGuidedSearch();
    else{if(!filters.query.trim())resetResults();++requestId;loading=false;error='';broadening=null;$('#raw').value=filters.query;$('#query-notes').innerHTML=queryNotes();$('#results-area').outerHTML=searchResults();$('#comparison-tools').outerHTML=comparisonTools();$('#comparison-tools')?.addEventListener('toggle',e=>{comparisonOpen=e.target.open;});bindSort();}
    return true;
  }
  catch(error){const node=$('#guided-error');if(node)node.textContent=error.message;toast(error.message);return false;}
}
function applyGuided(family,run=true){
  const data=new FormData($('#guided-form')),model=structuredClone(filters);
  if(['name','oracle','cost','legal'].includes(family))model[family]=String(data.get(family)||'');
  if(family==='type'){model.types=[...new Set(String(data.get('types')||'').split(',').map(t=>t.trim().toLowerCase()).filter(Boolean))];model.typeMatch=String(data.get('type-match'));}
  if(family==='mv'){model.values=[0,1].map(i=>({op:String(data.get('mv-op-'+i)),value:String(data.get('mv-'+i)||'')}));model.valueMatch=String(data.get('value-match'));}
  if(family==='color'||family==='identity')model[family]={mode:String(data.get(family+'-mode')),values:[...'WUBRG'].filter(c=>data.get(family+'-'+c))};
  if(family==='symbols')model.symbols=Object.fromEntries([...'WUBRGC'].map(c=>[c,Number(data.get('symbol-'+c)||0)]));
  return setCondition(family,model,run);
}
function bindGuided(){
  $('#guided-form')?.addEventListener('input',e=>{const family=e.target.closest('[data-family]')?.dataset.family;if(family)applyGuided(family,false);});
  $('#guided-form')?.addEventListener('change',e=>{const family=e.target.closest('[data-family]')?.dataset.family;if(family)applyGuided(family);});
  $('#guided-form')?.addEventListener('submit',e=>{e.preventDefault();const family=document.activeElement?.closest('[data-family]')?.dataset.family;if(family)applyGuided(family);else search();});
  $('#tag-match')?.addEventListener('change',e=>{const model={...filters,match:e.target.value};setCondition('tags',model);});
}
function refreshSearchTools(){
  $('#query-notes').innerHTML=queryNotes();$('#guided-controls').innerHTML=guidedControls();$('#selected-functions').innerHTML=selectedFunctions();$('#tag-options').innerHTML=tagOptions();
  $('#comparison-tools').outerHTML=comparisonTools();$('#comparison-tools')?.addEventListener('toggle',e=>{comparisonOpen=e.target.open;});
  $('#results-area').outerHTML=searchResults();bindGuided();bindSort();
}
function bindSort(){$('#sort')?.addEventListener('change',e=>{readFilters();order=e.target.value;search(false,true);});}
function resizeTracker(width) {
  tracker.width = Math.round(Math.max(280,Math.min(480,width)));
  $('#app').style.setProperty('--tracker-width',tracker.width+'px');
  $('#tracker-resize')?.setAttribute('aria-valuenow',tracker.width);
  $('#tracker-resize')?.setAttribute('aria-valuetext',tracker.width+' pixels, subject to available space');
}
function bindTrackerResize() {
  const handle=$('#tracker-resize');if(!handle)return;
  handle.addEventListener('keydown',e=>{
    const width={ArrowLeft:tracker.width+20,ArrowRight:tracker.width-20,Home:280,End:480}[e.key];
    if(width===undefined)return;e.preventDefault();resizeTracker(width);saveTracker();
  });
  handle.addEventListener('pointerdown',e=>{
    if(e.button!==0)return;
    e.preventDefault();const start=e.clientX,width=tracker.width;
    handle.setPointerCapture(e.pointerId);
    handle.onpointermove=event=>resizeTracker(width+start-event.clientX);
    const finish=()=>{handle.onpointermove=null;handle.onpointerup=null;handle.onpointercancel=null;saveTracker();};
    handle.onpointerup=finish;handle.onpointercancel=finish;
  });
}
function bind() {
  $('#tracked-deck')?.addEventListener('change',e=>trackDeck(e.target.value));
  bindTrackerResize();
  for(const key of ['group','order','type','role'])$('#editor-'+key)?.addEventListener('change',e=>{editorOptions[key]=e.target.value;render();});
  $('#comparison-tools')?.addEventListener('toggle',e=>{comparisonOpen=e.target.open;});
  $('#search-filters')?.addEventListener('toggle',e=>{filtersOpen=e.target.open;});
  $('#function-tags')?.addEventListener('toggle',e=>{tagsOpen=e.target.open;});
  $('#search-form')?.addEventListener('submit',e=>{e.preventDefault();readFilters();search();});
  $('#raw')?.addEventListener('input',e=>{filters=parseQuery(e.target.value);++requestId;loading=false;error='';broadening=null;if(!filters.query.trim())resetResults();refreshSearchTools();});
  $('#tag-search')?.addEventListener('input',e=>{tagSearch=e.target.value;tagLimit=30;$('#tag-options').innerHTML=tagOptions();});
  bindGuided();bindSort();
}
$('#app').addEventListener('change',e=>{
  const key=e.target.dataset?.moveEntry;if(!key)return;
  try{changeDeck(d=>moveEntry(d,key,e.target.value));toast('All copies moved; roles preserved');}catch(error){toast(error.message);render();}
});
$('#app').addEventListener('click',async e=>{
  const button=e.target.closest('button, a[data-view]');if(!button)return;readFilters();
  if(button.dataset.view){e.preventDefault?.();view=button.dataset.view;render();if(view==='decks')$('#library-title')?.focus();else $('#raw')?.focus();return;}
  if(button.dataset.deck){openDeck(button.dataset.deck);return;}
  if(button.dataset.manage){const d=decks.find(d=>d.id===button.dataset.target);if(!d)return;const action=button.dataset.manage;if(action==='rename')deckForm(d);if(action==='duplicate')duplicateDeck(d);if(action==='delete')deleteDeck(d);if(action==='import')importDialog(d);if(action==='export')exportDialog(d);return;}
  if(button.dataset.tab){deckTab=button.dataset.tab;render();return;}
  if(button.dataset.compare){toggleComparison(button.dataset.compare);return;}
  if(button.dataset.removeCompare){comparison=comparison.filter(item=>cardKey(item.card)!==button.dataset.removeCompare);render();$('#comparison-title')?.focus();return;}
  if(button.dataset.relax){await broaden(button.dataset.relax);return;}
  if(button.dataset.browseTag){browsedTag=button.dataset.browseTag;$('#tag-options').innerHTML=tagOptions();$('#tag-options .tag-detail h3').tabIndex=-1;$('#tag-options .tag-detail h3').focus();return;}
  if(button.dataset.tag){const t=button.dataset.tag;setCondition('tags',{...filters,tags:filters.tags.includes(t)?filters.tags.filter(x=>x!==t):[...filters.tags,t]});return;}
  if(button.dataset.preset){setCondition('tags',{...filters,tags:[button.dataset.preset]});return;}

  if(button.dataset.inspect){inspect(button.dataset.inspect,button.dataset.entry);return;}
  if(button.dataset.chooseAdd){chooseDestination(button.dataset.chooseAdd);return;}
  if(button.dataset.add){addCard(button.dataset.add);return;}
  if(button.dataset.zoneMinus || button.dataset.zonePlus){const key=button.dataset.zoneMinus || button.dataset.zonePlus;changeDeck(d=>{const e=d.cards.find(x=>entryKey(x)===key);if(!e)return;if(button.dataset.zonePlus){if(e.qty<500)e.qty++;}else if(--e.qty===0)d.cards=d.cards.filter(x=>x!==e);});return;}
  const action=button.dataset.action;
  if(action==='clear-deck-filters'){editorOptions.type='';editorOptions.role='';render();}
  if(action==='toggle-tracker'){tracker.visible=!tracker.visible;saveTracker();render();$('#toggle-tracker')?.focus();}
  if(action==='find-cards'){view='explore';trackDeck(active);$('#raw')?.focus();}
  if(action==='jump-deck'){$('.deck-panel')?.scrollIntoView({behavior:'auto'});$('#tracker-heading')?.focus();}
  if(action==='new') deckForm();
  if(action==='edit'&&current()) openDeck(current().id);
  if(action==='rename') deckForm(current());
  if(action==='settings')settings();
  if(action==='reset'){filters=parseQuery('');tagSearch='';resetResults();render();$('#raw')?.focus();}
  if(action==='retry')search(false,true);
  if(action==='restore-search')await restoreSearch();
  if(action==='more')search(true);
  if(action==='all-tags'||action==='more-tags'){allTags=true;if(action==='more-tags')tagLimit+=30;$('#tag-options').innerHTML=tagOptions();}
  if(action==='custom-tag')customTag();
  if(action==='sample')sample();
  if(action==='import')importDialog();
  if(action==='import-new')importDialog(null);
  if(action==='export'&&current())exportDialog(current());
  if(action==='backup')download('arcana-decks.json',JSON.stringify(decks,null,2),'application/json');
  if(action==='restore')restore();
  if(action==='refresh')refresh();
  if(action==='help')showDialog(`<h2>A little guide to Arcana</h2><p>Pick function tags, combine them with Oracle text, then search. “Match all” narrows your results; “Match any” broadens them. The editable search bar is the exact query sent to Scryfall. Guided filters update that same query. Query-only expressions stay unchanged; affected controls explain when they cannot edit a complex expression.</p><p>Starting points and their descriptions are curated. Search names and aliases across the bundled Scryfall Oracle Tags snapshot; use the arrow beside a tag to browse its recorded broader and narrower relationships. The snapshot date is shown because live Tagger can change. Use Enter an existing Scryfall tag for newer or other known tags. This searches existing tags; it does not create tagging data.</p><p>Create a deck to start adding cards. Inspect a card to choose its deck zone or assign personal role tags. These role tags power deck statistics and are separate from Scryfall’s tags.</p><p>Decks save in this browser. Export a JSON backup to move them to another device. Card exploration and import require internet access.</p><p>Modern checks cover main/sideboard size, combined copy limits and stored legality. Checks separates failed rules, unavailable data and manual review. Commander coverage remains partial; review paired commanders and companions manually.</p>`);
});
async function api(url, options) { const r=await fetch(url,options);const data=await r.json();if(!r.ok)throw new Error(data.error || 'Request failed.');return data; }
async function search(append=false,keepBroadening=false) {
  if(filters.error){error=filters.error;loading=false;render();return;}
  if(!filters.query.trim())filters=parseQuery('game:paper');
  if(!append && (!keepBroadening || (broadening && queryFor(filters,current())!==broadening.query)))broadening=null;
  if(append && visibleLimit < results.length){visibleLimit+=24;render();return;}
  const context=append&&resultContext ? resultContext : {query:queryFor(filters,current()),tags:[...filters.tags],match:filters.match,reason:broadening ? `Matched the query with ${broadening.label} ignored. Other original conditions were retained.` : 'Matched the recorded search query. Selected manually; card equivalence is not inferred.'};
  const id=++requestId;loading=true;error='';if(!append){page=1;results=[];visibleLimit=24;}else{visibleLimit+=24;}const requestedPage=append?page+1:1;render();
  try {const data=await api('/api/search?'+new URLSearchParams({q:context.query,page:requestedPage,order}));if(id!==requestId)return;results=append?[...results,...data.data]:data.data;resultContext=context;total=data.total_cards;more=data.has_more;page=requestedPage;}
  catch(e){if(id!==requestId)return;error=/0 cards|No cards|didn.t match any cards/i.test(e.message)?'No cards matched these filters. A custom tag may be unsupported. Remove a tag, switch to Match any, or broaden your Oracle text.':e.message;more=false;}
  finally{if(id===requestId){loading=false;searched=true;render();}}
}
function findCard(id) {return results.find(c=>c.id===id)||current()?.cards.find(e=>e.card.id===id)?.card||comparison.find(item=>item.card.id===id)?.card;}
function addLabel(c) {
  const d=current();
  const qty=d?.cards.find(e=>cardKey(e.card)===cardKey(c)&&zoneFor(e)==='main')?.qty||0;
  return d?`Add ${c.name} to ${d.name} · Main deck (${qty} currently in Main deck)`:`Add ${c.name} to a chosen deck`;
}
function addToDeck(c,d,zone='main') {
  if(!decks.includes(d))throw new Error('That deck is no longer available. Choose another deck.');
  const found=d.cards.find(e=>cardKey(e.card)===cardKey(c)&&zoneFor(e)===zone);
  if(!found && d.cards.length>=1000)throw new Error('Maximum 1000 card entries per deck. No cards were added.');
  if(found?.qty>=500)throw new Error('Maximum 500 copies per card and zone. No cards were added.');
  if(found)found.qty++;else d.cards.push({card:c,qty:1,tags:[],zone});
  d.updated=new Date().toISOString();save();render();
  toast(storageError?storageError:`${c.name} added to ${d.name} · ${ZONES[zone]}`);
}
function addCard(id,zone='main') {
  const c=findCard(id);if(!c)return;
  if(!current()){chooseDestination(id);return;}
  try{addToDeck(c,current(),zone);}catch(error){toast(error.message);}
}
function chooseDestination(id,zone='main') {
  const c=findCard(id);if(!c)return;
  showDialog(`<h2>Add ${esc(c.name)}</h2><p>Choose the destination for one copy. Your tracked deck will stay selected.</p>${decks.length?`<form id="add-destination-form"><label>Destination deck<select name="deck" id="add-destination"><option value="">Choose a deck…</option>${decks.map(d=>`<option value="${esc(d.id)}">${esc(d.name)}</option>`).join('')}</select></label><p>Destination zone: <strong>${ZONES[zone]}</strong></p><p id="add-destination-error" role="alert"></p><button class="primary" type="submit">Add 1 to ${ZONES[zone]}</button></form>`:'<p>Create a deck to keep this card.</p><button class="primary" id="create-destination">Create deck…</button>'}`);
  if(decks.length)$('#add-destination-form').onsubmit=e=>{
    e.preventDefault();const d=decks.find(d=>d.id===$('#add-destination').value);
    if(!d){$('#add-destination-error').textContent='Choose a destination deck first.';return;}
    try{addToDeck(c,d,zone);$('#dialog').close();}catch(error){$('#add-destination-error').textContent=error.message;}
  };
  else $('#create-destination').onclick=()=>deckForm(undefined,d=>{view='explore';try{addToDeck(c,d,zone);}catch(error){toast(error.message);}});
}
function showDialog(html) {const dialog=$('#dialog');dialog.innerHTML=`<button class="dialog-close icon-button" aria-label="Close dialog">${icon('close')}</button>${html}`;dialog.setAttribute('aria-label',dialog.querySelector('h2')?.textContent || 'Card details');if(!dialog.open)dialog.showModal();dialog.querySelector('.dialog-close').onclick=()=>dialog.close();}
$('#dialog').addEventListener('click',e=>{if(e.target===$('#dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
function deckForm(deck,after) {
  if(!deck&&decks.length>=200){toast('Maximum 200 decks per workspace.');return;}
  let choices=[],selectionRequest=0;
  showDialog(`<h2>${deck?'Rename / format':'Create a deck'}</h2><p>You can change the format later and build an incomplete deck.</p><form id="deck-form"><label>Deck name<input name="name" required maxlength="100" value="${esc(deck?.name||'')}" placeholder="e.g. The garden grows"></label><label>Format<select name="format" id="deck-format">${FORMATS.map(f=>`<option ${f===(deck?.format||'commander')?'selected':''}>${f}</option>`).join('')}</select></label>${!deck?`<fieldset id="commander-choice"><legend>Commander (optional)</legend><label>Find a card<input id="commander-name" placeholder="e.g. Tatyova" maxlength="200"></label><button type="button" class="secondary" id="find-commander">Find commander</button><label>Designate a card<select id="commander-card"><option value="">Choose later</option></select></label><p class="hint">Selection puts one copy in the command zone. Eligibility and pairings still need review; this is not validation.</p><p id="commander-status" role="status"></p></fieldset>`:''}<p id="deck-form-error" role="alert"></p><button class="primary" type="submit">${deck?'Save changes':'Create deck'}</button></form>`);
  if(!deck){
    $('#deck-format').onchange=e=>{$('#commander-choice').hidden=e.target.value!=='commander';};
    $('#find-commander').onclick=async()=>{
      const q=$('#commander-name').value.trim();if(!q){$('#commander-status').textContent='Enter a card name to search.';return;}
      const id=++selectionRequest,select=$('#commander-card'),status=$('#commander-status');status.textContent='Finding cards…';
      try{const data=await api('/api/search?'+new URLSearchParams({q,order:'name'}));if(id!==selectionRequest)return;choices=data.data;select.innerHTML='<option value="">Choose later</option>'+choices.map(c=>`<option value="${esc(c.id)}">${esc(c.name)} — ${esc(c.type_line)}</option>`).join('');status.textContent=`${choices.length} cards shown. Choose a card, or leave it for later.`;}
      catch(error){if(id===selectionRequest)status.textContent=error.message;}
    };
  }
  $('#deck-form').onsubmit=e=>{e.preventDefault();const data=new FormData(e.target),name=String(data.get('name')).trim(),format=String(data.get('format'));if(!name||!FORMATS.includes(format))return;
    if(deck){if(!decks.includes(deck))return;deck.name=name;deck.format=format;deck.updated=new Date().toISOString();save();$('#dialog').close();render();}
    else{if(decks.length>=200){$('#deck-form-error').textContent='Maximum 200 decks per workspace.';return;}const d=blankDeck(name,format),commander=format==='commander'?choices.find(c=>c.id===$('#commander-card').value):null;if(commander)d.cards.push({card:commander,qty:1,tags:[],zone:'command'});decks.push(d);save();$('#dialog').close();openDeck(d.id);}
    after?.(deck || decks.at(-1));
  };
}
function settings() {
  showDialog(`<h2>Workspace settings</h2><p>Appearance and backups for this browser.</p><label class="theme-setting">Appearance<select id="theme">${[['system','Use device setting'],['light','Light'],['dark','Dark']].map(([v,l])=>`<option value="${v}" ${theme===v?'selected':''}>${l}</option>`).join('')}</select></label><h3 class="settings-heading">Deck backups</h3><p>Decks are saved only in this browser. A JSON backup preserves cards, commanders, and role tags.</p><div class="settings-actions"><button class="secondary" id="settings-backup">${icon('download',16)} Export JSON backup</button><button class="secondary" id="settings-restore">${icon('upload',16)} Restore JSON backup</button></div>`);
  $('#theme').onchange=e=>{theme=e.target.value;applyTheme();try{localStorage.setItem('arcana.theme.v1',theme);}catch{toast('Appearance changed for this session. Browser storage is unavailable.');}};
  $('#settings-backup').onclick=()=>download('arcana-decks.json',JSON.stringify(decks,null,2),'application/json');
  $('#settings-restore').onclick=restore;
}
function customTag(){showDialog('<h2>Enter an existing Scryfall tag</h2><p>Search an existing Scryfall function tag, such as mana-rock or reanimate. This does not create public tags. Names and aliases in the snapshot resolve to their canonical tags. Tags outside the snapshot are allowed, but may be unsupported by Scryfall.</p><form id="custom-tag-form"><label>Function tag<input name="tag" required maxlength="80" placeholder="e.g. mana-rock"></label><p id="custom-tag-error" role="alert"></p><button class="primary">Add to search</button></form>');$('#custom-tag-form').onsubmit=e=>{e.preventDefault();readFilters();const value=String(new FormData(e.target).get('tag')).trim().toLowerCase();const t=resolveTag(value)?.id || value.replace(/\s+/g,'-');if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(t)){$('#custom-tag-error').textContent='Use a tag name with letters, numbers and single hyphens.';return;}try{const model={...filters,tags:[...new Set([...filters.tags,t])]};const next=replaceCondition(filters,'tags',conditionQuery(model,'tags'));filters=next;$('#dialog').close();runGuidedSearch();}catch(error){$('#custom-tag-error').textContent=error.message;}};}
function inspect(id,entryId) {
  const c=findCard(id);if(!c)return;const entry=entryId ? current()?.cards.find(e=>entryKey(e)===entryId) : current()?.cards.find(e=>cardKey(e.card)===cardKey(c)&&zoneFor(e)==='main');const image=imageFor(c);
  showDialog(`<div class="card-detail">${image?`<img src="${esc(safeUrl(image,true))}" alt="${esc(c.name)}">`:''}<div><h2>${esc(c.name)}</h2><div class="detail-mana">${mana(c.mana_cost)}</div><p>${esc(c.type_line)}</p><p class="oracle-text">${esc(oracle(c))}</p><p class="hint">Mana value ${c.cmc} · ${esc(c.set_name)}${c.artist?' · Artist: '+esc(c.artist):''}</p><div class="legality-badges">${FORMATS.map(f=>`<span class="${c.legalities?.[f]==='legal'?'is-legal':''}">${f}: ${esc(c.legalities?.[f]?.replaceAll('_',' ')||'unknown')}</span>`).join('')}</div><button class="secondary" id="detail-compare">${comparison.some(item=>cardKey(item.card)===cardKey(c)) ? 'Remove from comparison' : 'Compare this card'}</button><button class="primary" id="detail-add">${icon('plus',16)} ${current()?'Add to '+esc(current().name)+' · '+(entry?ZONES[zoneFor(entry)]:'Main deck'):'Add to…'}${entry?' ('+entry.qty+' in this zone)':''}</button>${entry?`<form id="roles-form"><p>Editing ${esc(current().name)} · ${ZONES[zoneFor(entry)]}</p><label>Your ordered role tags<input name="roles" placeholder="e.g. Ramp, Removal" maxlength="500" value="${esc(entry.tags.join(', '))}"></label><p class="hint">Separate personal roles with commas. The first role is the primary function for grouping; every role can be filtered. These are separate from Scryfall function tags.</p><label>Deck zone<select name="zone">${Object.entries(ZONES).map(([z,label])=>`<option value="${z}" ${zoneFor(entry)===z?'selected':''}>${label}</option>`).join('')}</select></label><p class="hint">Moves all copies of this entry and preserves roles. The command zone is checked separately; it does not make an ineligible card a legal commander.</p><p id="zone-error" role="alert"></p><button class="secondary">Save zone and roles</button></form>`:''}<p><a href="${esc(safeUrl(c.scryfall_uri))}" target="_blank" rel="noreferrer">View on Scryfall ↗</a></p></div></div>`);
  $('#detail-compare').onclick=()=>{$('#dialog').close();toggleComparison(id);};
  $('#detail-add').onclick=()=>{const zone=entry?zoneFor(entry):'main';if(!current()){chooseDestination(id,zone);return;}addCard(id,zone);inspect(id,entry?entryKey(entry):undefined);};
  $('#roles-form')?.addEventListener('submit',e=>{e.preventDefault();const data=new FormData(e.target);try{const zone=String(data.get('zone'));const updatedTags=[...new Set(String(data.get('roles')).split(',').map(t=>t.trim().slice(0,80)).filter(Boolean))];changeDeck(d=>{const otherRoles=d.cards.find(e=>e!==entry&&cardKey(e.card)===cardKey(c)&&zoneFor(e)===zone)?.tags||[];moveEntry(d,entryKey(entry),zone);const moved=d.cards.find(e=>cardKey(e.card)===cardKey(c)&&zoneFor(e)===zone);moved.tags=[...new Set([...otherRoles,...updatedTags])];});$('#dialog').close();$('[data-entry="'+CSS.escape(entryKey({card:c,zone}))+'"]')?.focus();toast('Card zone and roles saved');}catch(error){$('#zone-error').textContent=error.message;}});
}
async function fetchNames(names) {const cards=[],missing=[];for(let i=0;i<names.length;i+=75){const data=await api('/api/collection',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({names:names.slice(i,i+75)})});cards.push(...data.data);missing.push(...(data.not_found||[]).map(x=>x.name));}return {cards,missing};}
function importDialog(target=current()){
  showDialog(`<h2>${target?'Import cards':'Import a deck'}</h2><p>Paste quantity/name lines with optional Main deck, Sideboard and Command zone headings. ${target?'Cards will be added to '+esc(target.name)+'.':'A new deck is created only after every card resolves.'}</p><form id="import-form">${!target?`<label>Deck name<input name="name" required maxlength="100"></label><label>Format<select name="format">${FORMATS.map(f=>`<option>${f}</option>`).join('')}</select></label>`:''}<label>Decklist<textarea name="list" rows="9" required placeholder="1 Sol Ring&#10;1 Command Tower&#10;10 Forest"></textarea></label><p id="import-error" role="alert"></p><button class="primary">Import cards</button></form>`);
  $('#import-form').onsubmit=async e=>{e.preventDefault();const form=e.target,button=form.querySelector('button'),data=new FormData(form);button.disabled=true;button.textContent='Finding cards…';try{
    const name=target?.name||String(data.get('name')).trim(),format=target?.format||String(data.get('format'));
    if(!name||name.length>100||!FORMATS.includes(format))throw new Error('Enter a deck name and supported format.');
    const parsed=parseImport(data.get('list'));const {cards,missing}=await fetchNames([...new Set(parsed.map(x=>x.name))]);
    if(missing.length)throw new Error('Not imported. Could not find: '+missing.join(', ')+'. Correct these names and try again.');
    const additions=parsed.map(p=>{const card=cards.find(c=>c.name.toLowerCase()===p.name.toLowerCase()||c.card_faces?.some(f=>f.name.toLowerCase()===p.name.toLowerCase()));if(!card)throw new Error('Could not resolve '+p.name);return {card,qty:p.qty,tags:[],zone:p.zone||'main'};});
    if(form.isConnected===false||$('#dialog').open===false)return;
    if(target&&!decks.includes(target))throw new Error('The destination deck no longer exists.');
    if(!target&&decks.length>=200)throw new Error('Maximum 200 decks per workspace.');
    const destination=target||blankDeck(name,format),merged=structuredClone(destination.cards);
    for(const a of additions){const found=merged.find(x=>entryKey(x)===entryKey(a));if(found){found.qty+=a.qty;if(found.qty>500)throw new Error('Maximum 500 copies per card.');}else merged.push(a);}
    if(merged.length>1000)throw new Error('Maximum 1000 card entries per deck.');
    destination.cards=merged;destination.updated=new Date().toISOString();if(!target)decks.push(destination);save();$('#dialog').close();openDeck(destination.id);toast(`${additions.reduce((n,e)=>n+e.qty,0)} cards imported`);
  }catch(error){form.querySelector('#import-error').textContent=error.message;}finally{button.disabled=false;button.textContent='Import cards';}};
}
function restore(){showDialog('<h2>Restore your workspace</h2><p>Choose an Arcana JSON backup. Restored decks are added alongside existing decks.</p><input id="backup-file" type="file" accept="application/json,.json" aria-label="Deck backup file"><p id="restore-error" role="alert"></p>');$('#backup-file').onchange=async e=>{try{const file=e.target.files[0];if(!file)return;if(file.size>15_000_000)throw new Error('Backup is too large (maximum 15 MB).');const imported=validateBackup(JSON.parse(await file.text()));if(decks.length+imported.length>200)throw new Error('Maximum 200 decks per workspace.');for(const d of imported){for(const e of d.cards)e.zone=zoneFor(e);d.id=crypto.randomUUID();decks.push(d);}storageError='';active=imported[0]?.id||active;save();$('#dialog').close();render();toast('Backup restored');}catch(error){$('#restore-error').textContent=error.message;}};}
async function refresh(){const d=current();if(!d?.cards.length){toast('Add some cards first.');return;}toast('Refreshing card data…');try{const {cards,missing}=await fetchNames(d.cards.map(e=>e.card.name));if(missing.length)throw new Error('Some cards could not be refreshed. Your deck is unchanged.');const byName=new Map(cards.map(c=>[c.name,c]));if(d.cards.some(e=>!byName.has(e.card.name)))throw new Error('Could not refresh every card. Your deck is unchanged.');d.cards.forEach(e=>e.card=byName.get(e.card.name));save();render();toast('Card data and legality refreshed');}catch(e){toast(e.message);}}
async function sample(){if(decks.length>=200){toast('Maximum 200 decks per workspace.');return;}toast('Loading a small example from Scryfall…');try{const names=['Tatyova, Benthic Druid','Sol Ring','Arcane Signet','Cultivate',"Kodama's Reach",'Llanowar Elves','Rampant Growth','Growth Spiral','Beast Within','Counterspell','Eternal Witness','Command Tower','Forest','Island'];const {cards,missing}=await fetchNames(names);if(missing.length)throw new Error('Example cards could not be loaded. Try again.');const d=blankDeck('The garden grows');d.cards=cards.map(card=>({card,qty:card.name==='Forest'?12:card.name==='Island'?10:1,tags:['Cultivate',"Kodama's Reach",'Rampant Growth','Sol Ring','Arcane Signet','Llanowar Elves'].includes(card.name)?['Ramp']:[],zone:card.name==='Tatyova, Benthic Druid'?'command':'main'}));decks.push(d);active=d.id;save();openDeck(d.id);toast('Example loaded — an unfinished Commander deck to build on');}catch(e){toast(e.message);}}
render();
