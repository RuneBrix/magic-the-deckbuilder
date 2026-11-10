import { FORMATS, BRACKETS, COMMANDER_BRACKETS, bracketReport, TAGS, TAG_CATALOG, tagById, findTags, resolveTag, count, exportDeckText, ZONES, DEFAULT_BUDGET_ZONES, zoneFor, zoneCount, entryKey, moveEntry, assignEntryFunction, addDeckCopies, deckCardCopies, deckFinishOptions, copyEntryToDeck, removeCardCopies, validatePrinting, setEntryPrinting, legalityReport, imageFor, oracle, queryFor, relaxationOptions, relaxSearch, stats, parseImport, parseCollectionImport, prepareCollectionUpload, COLLECTION_COLUMNS, resolveImport, validateBackup, validateCollection, parseEuroCents, workspaceFile, readWorkspaceFile, safeUrl, category, primaryRole, deckEntries, deckIdentity, parseQuery, replaceCondition, conditionQuery, SEARCH_FAMILIES } from './core.js';
import { esc, mana, printingLabel } from './view-utils.js';
import { collectionPage, CONDITION_LABELS, collectionChoices } from './collection-view.js';
import { bindStatistics, statPanel } from './statistics-view.js';
import { budgetPanel } from './budget-view.js';
import { deckPrintingPrice, COST_SYMBOLS, MAX_COST_AMOUNT } from './core.js';
import { TYPE_CATALOG, KEYWORD_CATALOG } from './filter-catalog.js';

const $ = s => document.querySelector(s);
const icon = (name, size = 20) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${({ search: '<path d="m10 2 8 8-8 8-8-8zM10 6v8M6 10h8m2 6 6 6"/>', cards: '<path d="M8 3h12v16H8zM4 7v14h12M11 8l3-2 3 2-3 4z"/>' , settings: '<path d="M4 7h16M4 17h16M8 4v6M16 14v6"/>' , filters: '<path d="M3 5h18l-7 8v6l-4 2v-8z"/>', plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>', arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>', close: '<path d="m6 6 12 12M6 18 18 6"/>', leaf: '<path d="M20 4C8 2 2 10 7 16s14-1 13-12ZM5 21 16 10"/>', check: '<path d="m5 12 4 4L19 6"/>', down: '<path d="m6 9 6 6 6-6"/>', upload: '<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>', download: '<path d="M12 3v13m-5-5 5 5 5-5M4 17v4h16v-4"/>', chart: '<path d="M4 20V4m0 16h17M9 16v-5m5 5V7m5 9v-8"/>', more: '<circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/>', book: '<path d="M12 5C8 2 4 3 2 4v15c4-2 7-1 10 1 3-2 6-3 10-1V4c-4-2-7-1-10 1Zm0 0v15"/>' })[name] || ''}</svg>`;
const blankDeck = (name = 'Untitled deck', format = 'commander') => ({ id: crypto.randomUUID(), name, format, cards: [], updated: new Date().toISOString() });
const DARK_PALETTES = [['green','Dark green'],['blue','Dark blue'],['white','Black / white'],['orange','Black / orange']];
let palette = 'green';
try { const saved = localStorage.getItem('arcana.palette.v1'); if (DARK_PALETTES.some(([key])=>key===saved)) palette=saved; } catch {}
let theme = 'system';
try { const saved = localStorage.getItem('arcana.theme.v1'); if (['light','dark','system'].includes(saved)) theme = saved; } catch {}
const systemTheme = matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const dark = theme === 'dark' || (theme === 'system' && systemTheme.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.dataset.palette = palette;
  document.querySelector('meta[name="theme-color"]').content = dark ? ({green:'#171e1b',blue:'#141c29',white:'#101010',orange:'#101010'})[palette] : '#f4f1e9';
}
systemTheme.addEventListener('change', applyTheme);
applyTheme();
let storageError = '';
let requestedExportSnapshot=null, requestedExportAt='', downloadError='';
let decks, collection=[];
try {
  const savedWorkspace=localStorage.getItem('arcana.workspace.v2'),savedDecks=localStorage.getItem('arcana.decks.v1');
  const saved=savedWorkspace||savedDecks,parsed=saved?readWorkspaceFile(JSON.parse(saved)):{decks:[],collection:null};
  decks=parsed.decks;collection=parsed.collection||[];
}
catch { decks = []; collection=[];storageError = 'Saved workspace could not be read. Restore a JSON backup before making changes.'; }
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
let view = 'decks', deckTab = 'cards', results = [], total = 0, page = 1, more = false, loading = false, error = '', requestId = 0, searched = false;
let filters = parseQuery('');
let colorTarget = '';
let filtersOpen = false, tagsOpen = false;
const openFilterFamilies = new Set();
const SEARCH_SORTS = {
  edhrec: { label: 'Popular first', params: { order: 'edhrec' } },
  cmc: { label: 'Mana value', params: { order: 'cmc' } },
  name: { label: 'Name A–Z', params: { order: 'name' } },
  'usd-asc': { label: 'USD: low first', params: { order: 'usd', dir: 'asc' } },
  'usd-desc': { label: 'USD: high first', params: { order: 'usd', dir: 'desc' } },
};
let order = 'edhrec', tagSearch = '', visibleLimit = 24;
let browsedTag = '', tagLimit = 30;
let broadeningOpen = false, broadening = null, resultContext = null;
let editorOptions = { layout: 'visual-horizontal', group: 'type', search: '', order: 'name' };
let previewKey = '', previewDeck = '', cardActionTrigger = null;
let cardDrag = null, cardDragPress = null, suppressCardClick = false;
const legalityStates = new Map();
let legalityQueue = Promise.resolve();
const priceStates = new Map();
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
  updateBackupStatus();
  if (storageError) { toast(storageError); return; }
  try { localStorage.setItem('arcana.workspace.v2', JSON.stringify(workspaceFile(decks,collection))); }
  catch { storageError = 'Browser storage is full or unavailable. Export a JSON backup now to keep your changes.'; toast(storageError); }
}
let toastTimer;
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 4500); }
function download(name, content, type) { const url = URL.createObjectURL(new Blob([content], { type })); try { const a = document.createElement('a'); a.href = url; a.download = name; a.click(); } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); } }
function saveWorkspaceCopy(source=decks,name='arcana-workspace.json') {
  try {
    const complete=source===decks,content=JSON.stringify(workspaceFile(source,complete?collection:null),null,2);
    if(new Blob([content]).size>15_000_000)throw Error('Workspace file exceeds the 15 MB import limit. Export individual decks instead.');
    download(name,content,'application/json');
    if(complete){requestedExportSnapshot=JSON.stringify({decks,collection});requestedExportAt=new Date().toLocaleString();}
    downloadError='';updateBackupStatus();
    toast('JSON download requested. Check your browser downloads and keep a dated copy.');
    return true;
  } catch(error) { downloadError='Could not request a JSON download. '+error.message;updateBackupStatus();toast(downloadError);return false; }
}
function changeNamedDeck(d,fn){if(!decks.includes(d))throw Error('That deck is no longer available.');const result=fn(d);d.updated=new Date().toISOString();save();render();return result;}
function changeDeck(fn) { const d=current();if(d)return changeNamedDeck(d,fn); }

function updateNavigationHeight() {
  document.documentElement.style?.setProperty('--nav-height',Math.ceil($('.workspace-nav').getBoundingClientRect().height)+'px');
}
const navigationObserver=typeof ResizeObserver==='undefined'?null:new ResizeObserver(updateNavigationHeight);
function render() {
  finishCardDrag();
  closeCardActions(false);
  const focused=document.activeElement;
  let focusSelector='';
  if(focused && $('#app').contains(focused)) {
    if(focused.id) focusSelector='#'+CSS.escape(focused.id);
    else if(focused.name) focusSelector='[name="'+CSS.escape(focused.name)+'"]';
    else {const attribute=[...focused.attributes].find(a=>a.name.startsWith('data-'));if(attribute)focusSelector='['+attribute.name+'="'+CSS.escape(attribute.value)+'"]';}
  }
  const d = current();
  if (d && ['deck','explore'].includes(view)) ensureLegality(d);
  const statistics = view === 'deck' && d && deckTab === 'stats' ? stats(d, { detailed: true }) : null;
  const previousStatistics = statistics ? $('#deck-statistics') : null;
  $('#app').style.setProperty('--tracker-width', tracker.width+'px');
  $('#app').classList.toggle('has-tracker', view==='explore' && Boolean(d) && tracker.visible);
  $('#app').innerHTML = `<header class="workspace-nav"><a class="brand" href="/" data-view="decks" aria-label="Arcana home — My decks"><span class="brand-mark">${icon('cards',25)}</span>arcana</a><nav aria-label="Main navigation"><button data-view="decks" class="nav-item ${view==='decks'||view==='deck'?'selected':''}" ${view==='deck'?'aria-current="location"':view==='decks'?'aria-current="page"':''}>My decks</button><button data-view="explore" class="nav-item ${view==='explore'?'selected':''}" ${view==='explore'?'aria-current="page"':''}>Explore cards</button><button data-view="collection" class="nav-item ${view==='collection'?'selected':''}" ${view==='collection'?'aria-current="page"':''}>Collection</button><button class="nav-item" data-action="settings">Settings</button></nav><span class="local-status">${storageError?'Unsaved changes':'Saved in this browser'}</span><button class="icon-button" data-action="help" aria-label="Help">${icon('book',17)}</button></header>
  <main>${storageError ? `<div class="storage-warning" role="alert">${esc(storageError)} <button data-action="backup">Export backup</button></div>` : ''}${view === 'decks' ? library() : view === 'deck' ? deckWorkspace(d, statistics, previousStatistics) : view==='collection'?collectionPage(collection,collectionOptions):explorer()}</main>${view === 'explore' && d && tracker.visible ? `<button class="mobile-deck-jump primary" data-action="jump-deck">View tracker · ${esc(d.name)}</button><aside id="deck-tracker" class="deck-panel" aria-label="Tracked deck: ${esc(d.name)}"><div id="tracker-resize" role="separator" tabindex="0" aria-label="Resize deck tracker" aria-orientation="vertical" aria-controls="deck-tracker" aria-valuemin="280" aria-valuemax="480" aria-valuenow="${tracker.width}" aria-valuetext="${tracker.width} pixels, subject to available space" title="Drag to resize. Left widens; Right narrows; Home and End set limits."></div>${deckPanel(d)}</aside>` : ''}`;
  updateNavigationHeight();
  navigationObserver?.disconnect();
  navigationObserver?.observe($('.workspace-nav'));
  bind();
  if (statistics) bindStatistics($('#deck-statistics'), statistics);
  if(focusSelector) {const target=document.querySelector(focusSelector)||document.querySelector('.deck-tabs [aria-selected="true"]');target?.focus({preventScroll:true});}
}
function queryNotes() {
  return `${filters.error?`<p class="query-error" role="alert">${esc(filters.error)} Guided edits are paused; your query is unchanged.</p>`:''}${filters.opaque.length&&!filters.error?`<details class="query-help"><summary>Query-only expressions · ${filters.opaque.length}</summary><p>These expressions stay verbatim in the search. Complex or unsupported expressions cannot be edited with guided controls${filters.locked.length?'; affected controls are disabled':''}.</p>${filters.opaque.map(text=>`<code>${esc(text)}</code>`).join('')}<p>Guided controls support type groups and exclusions, keyword abilities, function tags, mana comparisons, colors, Oracle phrases, one name and one format. Edit other expressions directly above.</p></details>`:''}`;
}
function appliedFiltersSummary() {
  if(filters.error)return 'Query incomplete or invalid';
  const labels=relaxationOptions(filters,current()).map(option=>option.label);
  if(filters.opaque.length)labels.push(`${filters.opaque.length} query-only ${filters.opaque.length===1?'expression':'expressions'}`);
  return labels.join(' · ')||'No filters applied';
}
const clearFilterButton = (name, label) => `<button type="button" class="guided-clear" data-clear-filter="${name}" aria-label="Clear ${esc(label)}" title="Clear ${esc(label)}">${icon('close',16)}</button>`;
const clearable = (name, label, control) => `<div class="guided-entry">${control}${clearFilterButton(name,label)}</div>`;
const colorNames = {W:'White',U:'Blue',B:'Black',R:'Red',G:'Green'};
const colorTargets = [['color','Card color'],['identity','Color identity']];
const colorOptions = [['all','Contains all selected colors'],['any','Contains any selected color'],['exact','Exactly the selected colors'],['subset','Only these colors, including colorless'],['multi','Multicolor only'],['colorless','Colorless only']];
const colorSelectionDisabled = mode => mode==='multi'||mode==='colorless';
const repeatableFilters = {
  mv:{key:'values',label:'mana value',empty:()=>({op:'>=',value:''})},
  oracle:{key:'oracle',label:'oracle',empty:()=>({mode:'o',text:''})},
  cost:{key:'cost',label:'mana cost',empty:()=>({symbol:'generic',op:'>=',amount:''})},
};
const chipFields = {
  types: { catalog: TYPE_CATALOG, label: 'Types and subtypes', placeholder: 'e.g. Elf' },
  excludedTypes: { catalog: TYPE_CATALOG, label: 'Do not include', placeholder: 'e.g. Artifact' },
  keywords: { catalog: KEYWORD_CATALOG, label: 'Keyword abilities', placeholder: 'e.g. First strike' },
};
function chipPicker(name) {
  const { catalog, label, placeholder } = chipFields[name];
  const selected = filters[name].map(value => {
    const display = catalog.find(choice => choice.toLowerCase() === value) || value;
    return `<button type="button" class="tag-option selected" data-remove-chip="${esc(value)}" aria-label="Remove ${esc(display)} from ${esc(label)}">${esc(display)} ${icon('close',12)}</button>`;
  }).join('');
  const input = `<label>${label}<input type="text" name="${name}" data-chip-input autocomplete="off" maxlength="80" placeholder="${placeholder}" aria-controls="${name}-suggestions"></label>`;
  return `<div class="chip-picker" data-chip-picker="${name}">${clearable(name,label,input)}<div class="chip-suggestions" id="${name}-suggestions" role="group" aria-label="${label} suggestions" hidden></div>${selected?`<div class="filter-chips">${selected}</div>`:''}</div>`;
}
function guidedControls() {
  const selected=(value,current)=>value===current?'selected':'';
  const mode=(name,current,options,label='')=>`<select name="${name}" ${label?`aria-label="${label}"`: ''}>${options.map(([v,l])=>`<option value="${v}" ${selected(v,current)}>${l}</option>`).join('')}</select>`;
  const match=(name,current)=>mode(name,current,[['all','Matching all (AND)'],['any','Matching any (OR)']]);
  const field=(family,title,content,{panel=family,before=''}={})=>{
    const locked=filters.locked.includes(family),summaryId=`filter-heading-${panel}`;
    return `<details class="guided-family" data-guided-family="${panel}" ${openFilterFamilies.has(panel)?'open':''}><summary id="${summaryId}">${title}${locked?' <span>Query only</span>':''}</summary>${before}<fieldset data-family="${family}" aria-labelledby="${summaryId}" ${locked?'disabled':''}>${locked?'<p class="hint">Edit this condition in the query above.</p>':''}${content}</fieldset></details>`;
  };
  const removeRow=(family,i,total)=>`<button type="button" class="remove-filter-row" data-remove-filter="${family}" data-filter-index="${i}" aria-label="Remove ${repeatableFilters[family].label} filter ${i+1}" title="Remove ${repeatableFilters[family].label} filter ${i+1}" ${total===1?'disabled':''}>${icon('close',16)}</button>`;
  const values=filters.values.length?filters.values:[repeatableFilters.mv.empty()],phrases=filters.oracle.length?filters.oracle:[repeatableFilters.oracle.empty()];
  const valueRows=`<div class="filter-rows" role="region" aria-label="Mana-value comparisons" tabindex="0"><div class="filter-column-head mana-columns" aria-hidden="true"><span>Comparison</span><span>Mana value</span><span></span></div>${values.map((row,i)=>`<div class="repeatable-filter-row mana-columns">${mode('mv-op-'+i,row.op,[['<=','At most (≤)'],['<','Less than (<)'],['=','Exactly (=)'],['>=','At least (≥)'],['>','More than (>)'],['!=','Not equal (≠)']],'Comparison '+(i+1))}${clearable('mv-'+i,'mana value '+(i+1),`<input type="number" min="0" step="any" name="mv-${i}" value="${esc(row.value)}" aria-label="Mana value ${i+1}" placeholder="Any">`)}${removeRow('mv',i,values.length)}</div>`).join('')}</div>`;
  const oracleRows=`<div class="filter-rows" role="region" aria-label="Oracle phrases" tabindex="0"><div class="filter-column-head oracle-columns" aria-hidden="true"><span>Text source</span><span>Rules-text phrase</span><span></span></div>${phrases.map((row,i)=>`<div class="repeatable-filter-row oracle-columns">${mode('oracle-mode-'+i,row.mode,[['o','Oracle'],['fo','Full oracle']],'Text source '+(i+1))}${clearable('oracle-'+i,'rules-text phrase '+(i+1),`<input name="oracle-${i}" value="${esc(row.text)}" aria-label="Rules-text phrase ${i+1}" maxlength="300" placeholder="e.g. whenever ~ attacks">`)}${removeRow('oracle',i,phrases.length)}</div>`).join('')}</div><p class="hint">Full oracle includes reminder text.</p>`;
  const colorFamily=colorTarget||colorTargets.find(([family])=>filters.parts.some(part=>part.affected.includes(family)))?.[0]||'color';
  const colorTitle=colorTargets.find(([family])=>family===colorFamily)[1];
  const {mode:colorMode,values:colors}=filters[colorFamily];
  const colorPanel=field(colorFamily,'Colors',`${clearable(colorFamily+'-mode',colorTitle,`<label>Matching mode${mode(colorFamily+'-mode',colorMode,colorOptions)}</label>`)}
    <div class="guided-colors">${Object.entries(colorNames).map(([color,label])=>`<label><input type="checkbox" name="${colorFamily}-${color}" ${colors.includes(color)?'checked':''} ${colorSelectionDisabled(colorMode)?'disabled':''}>${mana('{'+color+'}',true)} ${label}</label>`).join('')}</div>`,
    {panel:'colors',before:`<label class="color-target">Match by${mode('color-target',colorFamily,colorTargets)}</label>`});
  const costs=filters.cost.length?filters.cost:[repeatableFilters.cost.empty()];
  const costSymbols=COST_SYMBOLS.map(symbol=>[symbol,symbol==='generic'?'Generic':symbol==='C'?'Colorless':colorNames[symbol]||`{${symbol}}`]);
  const costRows=`<div class="filter-rows" role="region" aria-label="Mana-cost comparisons" tabindex="0">
    <div class="filter-column-head cost-columns" aria-hidden="true"><span>Symbol</span><span>Comparison</span><span>Amount</span><span></span></div>
    ${costs.map((row,i)=>`<div class="repeatable-filter-row cost-columns">
      ${mode('cost-symbol-'+i,row.symbol,costSymbols,'Mana symbol '+(i+1))}
      ${mode('cost-op-'+i,row.op,[['>=','At least'],['<=','At most'],['=','Exactly']],'Mana cost comparison '+(i+1))}
      ${clearable('cost-'+i,'mana amount '+(i+1),`<input type="number" min="0" max="${MAX_COST_AMOUNT}" step="1" name="cost-${i}" value="${esc(row.amount)}" aria-label="Mana amount ${i+1}" placeholder="Any">`)}
      ${removeRow('cost',i,costs.length)}
    </div>`).join('')}</div>`;
  const formats=uniqueFormats().map(f=>`<option value="${esc(f)}" ${selected(f,filters.legal)}>${esc(f)}</option>`).join('');
  return `<form id="guided-form"><div class="guided-grid">
    ${field('name','Card name',clearable('name','name phrase',`<label>Name phrase<input name="name" value="${esc(filters.name)}" maxlength="200" placeholder="e.g. Sol Ring"></label>`))}
    ${field('type','Types and subtypes',`${chipPicker('types')}<label>Combine types by${match('type-match',filters.typeMatch)}</label>${chipPicker('excludedTypes')}`)}
    ${field('keyword','Keywords',`${chipPicker('keywords')}<label>Combine keywords by${match('keyword-match',filters.keywordMatch)}</label>`)}
    ${field('mv','Mana value',`${valueRows}<button type="button" class="text-button" data-add-filter="mv">Add additional mana value filter</button><label>Combine mana value filter by${match('value-match',filters.valueMatch)}</label>`)}
    ${colorPanel}
    ${field('oracle','Oracle text',`${oracleRows}<button type="button" class="text-button" data-add-filter="oracle">Add additional oracle filter</button><label>Combine oracle filter by${match('oracle-match',filters.oracleMatch)}</label>`)}
    ${field('cost','Mana cost',`${costRows}<button type="button" class="text-button" data-add-filter="cost">Add mana cost</button><label>Combine mana cost filter by${match('cost-match',filters.costMatch)}</label>
      <p class="hint"><span class="generic-mana" aria-hidden="true">X</span> Generic counts the printed number. ${mana('{C}',true)} Colorless counts {C} symbols. Choose {X} for a variable cost. Hybrid and Phyrexian symbols count separately.</p>`)}
    ${field('legal','Format legality',`${clearable('legal','format legality',`<label>Legal in format<select name="legal"><option value="">Any format</option>${formats}</select></label>`)}<p class="hint">Chosen independently of the tracked deck.</p>`)}
    </div><p id="guided-error" role="alert"></p></form>`;
}
function uniqueFormats(){return [...new Set([...FORMATS,...(filters.legal?[filters.legal]:[])])];}
function selectedFunctions() {
  return `<section class="selected-functions" aria-label="Selected function filters"><div class="selected-functions-heading"><h3>Selected functions</h3><label>Combine functions by<select id="tag-match"><option value="all" ${filters.match==='all'?'selected':''}>Matching all (AND)</option><option value="any" ${filters.match==='any'?'selected':''}>Matching any (OR)</option></select></label></div><div class="active-tags">${filters.tags.map(t=>`<button class="tag-option selected" data-tag="${esc(t)}" aria-label="Remove ${esc(t)} filter">${esc(t.replaceAll('-',' '))} ${icon('close',12)}</button>`).join('')}</div></section>`;
}
function searchPanels() {
  const matches=tagMatches();
  return `<div class="filters-panel">
    <details id="search-filters" class="search-disclosure search-panel" ${filtersOpen?'open':''}>
      <summary id="filters-heading" aria-labelledby="filters-title" aria-describedby="applied-filter-summary"><span id="filters-title" class="search-panel-title">Filters</span><span id="applied-filter-summary">${appliedFiltersSummary()}</span></summary>
      <div id="guided-controls">${guidedControls()}</div>
    </details>
    <button id="search-guided" class="secondary" type="submit" form="guided-form">Search with these filters</button>
  </div>
  <details id="function-tags" class="tag-browser search-panel" ${tagsOpen?'open':''}>
    <summary id="function-tags-heading"><span class="search-panel-title">Browse by function</span></summary>
    <div class="tag-browser-content">
      <div id="selected-functions">${selectedFunctions()}</div>
      <label class="tag-search-label" for="tag-search">Find a function</label>
      <input id="tag-search" type="search" value="${esc(tagSearch)}" maxlength="200" placeholder="e.g. ramp or removal" aria-describedby="tag-match-count">
      <p id="tag-match-count" role="status">${tagMatchCount(matches)}</p>
      <div id="tag-options">${tagOptions(matches)}</div>
    </div>
  </details>`;
}
function explorer() {
  const d=current();
  return `<div class="explorer"><div class="page-heading"><div><h1>Explore cards</h1><p>Search by name, rules text, types or function.</p></div></div><div class="exploration-target"><label for="tracked-deck">Track deck<select id="tracked-deck" ${d?'':'aria-describedby="tracker-hint"'}><option value="">No tracked deck</option>${decks.map(deck=>`<option value="${esc(deck.id)}" ${deck.id===tracker.id?'selected':''}>${esc(deck.name)}</option>`).join('')}</select></label>${d?`<span>Default destination: <strong>${esc(d.name)}</strong> · Main deck</span><button id="toggle-tracker" class="text-button" data-action="toggle-tracker" aria-expanded="${tracker.visible}" aria-controls="deck-tracker">${tracker.visible?'Hide':'Show'} tracker</button>`:'<p id="tracker-hint">Browse freely. Choose a destination when adding a card.</p>'}</div><form id="search-form"><label class="search-label" for="raw">Scryfall query</label><div class="search-box">${icon('search',22)}<input id="raw" name="raw" aria-label="Search cards or use Scryfall syntax" placeholder="Card name or Scryfall query…" value="${esc(filters.query)}" maxlength="1500" aria-describedby="query-notes"><button class="primary" type="submit">Search ${icon('arrow',16)}</button></div><button type="button" class="text-button reset-query" data-action="reset">Clear search and filters</button></form><div id="query-notes">${queryNotes()}</div>${searchPanels()}<div id="search-output">${searchResults()}${broadeningTools()}</div></div>`;
}
function searchResults(){
  if(!searched&&!loading&&!error)return '';
  const noMatch=Boolean(error)&&error.startsWith('No cards');
  const status=loading?'Searching Scryfall…':error?(noMatch?'0 cards found':'Search failed'):total.toLocaleString()+(total===1?' card found':' cards found');
  const sortOptions = Object.entries(SEARCH_SORTS).map(([value, { label }]) => `<option value="${value}" ${order===value?'selected':''}>${label}</option>`).join('');
  return `<section id="results-area" aria-labelledby="result-heading" data-state="${loading?'loading':error?(noMatch?'no-match':'error'):searched?'populated':'initial'}"><div class="results-heading"><div><h2 id="result-heading" tabindex="-1">Cards</h2><span id="result-count" role="status" aria-live="polite">${status}</span></div><div class="results-controls"><label>Sort results<select id="sort" aria-label="Sort cards">${sortOptions}</select></label></div></div>
  ${resultContext&&resultContext.query!==queryFor(filters,current())?'<p class="query-stale" role="status">These results are from the previous query. Press Search to update them.</p>':''}
  ${error?`<div class="empty-state" role="alert"><h3>${noMatch?'No cards matched':'Search couldn’t finish'}</h3><p>${esc(error)}</p><div><button class="secondary" data-action="reset">Clear search and filters</button>${!noMatch?'<button class="primary" data-action="retry">Try again</button>':''}</div></div>`:loading&&!results.length?'<div class="loading-state" role="status"><p>Loading cards…</p></div>':`<div class="card-grid" aria-busy="${loading}">${results.slice(0,visibleLimit).map(cardTile).join('')}</div>`}
  ${(more||visibleLimit<results.length)&&!error?`<button class="load-more secondary" data-action="more" ${loading?'disabled':''}>${loading?'Loading…':'Load more cards'}</button>`:''}<footer>Card data and images by <a href="https://scryfall.com" target="_blank" rel="noreferrer">Scryfall</a>. Magic: The Gathering © Wizards of the Coast.</footer></section>`;
}
function tagMatches() {
  return tagSearch.trim()?findTags(tagSearch):TAGS.map(([id])=>tagById.get(id)||resolveTag(id)).filter(Boolean);
}
function tagMatchCount(matches) {
  return tagSearch.trim()?`${matches.length.toLocaleString()} matching ${matches.length===1?'tag':'tags'}`:`${matches.length} starting points · Search ${TAG_CATALOG.tags.length.toLocaleString()} tags`;
}
function unlistedFunctionOption(locked) {
  const value=tagSearch.trim(),slug=value.toLowerCase().replace(/\s+/g,'-');
  if(slug.length>80||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))return '<p class="hint">Use up to 80 letters, numbers, spaces or single hyphens for an unlisted function.</p>';
  if(filters.tags.includes(slug))return '<p class="hint">This unlisted function is already applied.</p>';
  return `<div class="unlisted-function"><button type="button" class="secondary" data-tag="${esc(slug)}" ${locked?'disabled':''}>Add “${esc(value)}” as an unlisted function</button><p class="hint">Searches for this tag on Scryfall. It may be unsupported or return no cards.</p></div>`;
}
function refreshTagOptions() {
  const matches=tagMatches();
  $('#tag-match-count').textContent=tagMatchCount(matches);
  $('#tag-options').innerHTML=tagOptions(matches);
}
function refreshFunctionFilters() {
  $('#selected-functions').innerHTML = selectedFunctions();
  refreshTagOptions();
}
function applySelectedFunctions(model, focusSelector) {
  if (!setCondition('tags', model, true, true)) return;
  refreshFunctionFilters();
  $(focusSelector)?.focus({ preventScroll: true });
}
function tagOptions(matches) {
  const shown=matches.slice(0,tagLimit),detail=tagById.get(browsedTag),locked=filters.locked.includes('tags');
  const browse=id=>`<button class="text-button" data-browse-tag="${esc(id)}">${esc(id.replaceAll('-',' '))}</button>`;
  const relation=(label,ids)=>`<div class="tag-relations"><strong>${label}</strong><div>${ids.map(browse).join('')||'<span class="hint">None recorded in this snapshot.</span>'}</div></div>`;
  return `${locked?'<p class="hint">Function expressions in a complex query group must be edited in the query above.</p>':''}<div class="tag-options">${shown.map(t=>`<span class="tag-choice"><button class="tag-option ${filters.tags.includes(t.id)?'selected':''}" data-tag="${esc(t.id)}" aria-pressed="${filters.tags.includes(t.id)}" aria-label="${filters.tags.includes(t.id)?'Remove':'Add'} ${esc(t.id)} filter" ${locked?'disabled':''}>${esc(TAGS.find(([id])=>id===t.id)?.[1]||t.id.replaceAll('-',' '))} <span>${filters.tags.includes(t.id)?'Remove filter':'Add filter'}</span></button><button class="tag-browse" data-browse-tag="${esc(t.id)}" aria-label="Browse ${esc(t.id)} relationships">Related ${icon('arrow',14)}</button></span>`).join('')}</div>${!matches.length?unlistedFunctionOption(locked):''}${matches.length>shown.length?`<button class="text-button tag-more" data-action="more-tags">Show next ${Math.min(30,matches.length-shown.length)} matching tags</button>`:''}${detail?`<section class="tag-detail" aria-label="Tag relationships"><h3>${esc(detail.id.replaceAll('-',' '))}</h3><p class="hint">${detail.aliases.length?'Aliases: '+esc(detail.aliases.join(', '))+'. ':''}<a href="https://tagger.scryfall.com/tags/card/${encodeURIComponent(detail.id)}" target="_blank" rel="noreferrer">View on Tagger</a></p>${relation('Broader tags',detail.parents)}${relation('Narrower tags',detail.children)}<p class="hint">Browsing relationships leaves the card query unchanged. Use Add filter to search a function.</p><button class="secondary" data-tag="${esc(detail.id)}" ${locked?'disabled':''}>${filters.tags.includes(detail.id)?'Remove filter':'Add filter'}</button></section>`:''}${filters.tags.filter(t=>!tagById.has(t)).map(t=>`<p class="hint">Existing tag “${esc(t)}” is outside this snapshot. Scryfall may accept it, reject it, or return no cards.</p>`).join('')}`;
}
function broadeningTools() {
  const options=relaxationOptions(broadening?.original || filters,current());
  if(!options.length&&!broadening)return '';
  return `<details id="broadening-tools" class="search-disclosure" ${broadeningOpen?'open':''}><summary>Broaden this search</summary><div class="broadening-content">
    ${options.length ? `<div class="relax-options">${options.map(o => `<button class="secondary" data-relax="${esc(o.key)}" ${broadening?.label === o.label ? 'disabled' : ''}>Ignore ${esc(o.label)}</button>`).join('')}</div>` : ''}
    ${broadening ? `<div class="broadening-note" role="status"><p><strong>Why these results:</strong> Ignored ${esc(broadening.label)}. Other original conditions were retained. A match does not guarantee the same effect.</p><p>Original query: <code>${esc(broadening.originalQuery)}</code></p><p>Alternative query: <code>${esc(broadening.query)}</code></p><button class="secondary" data-action="restore-search">Return to original search</button><p class="hint">Applying other search controls starts a new search.</p></div>` : ''}
  </div></details>`;
}
function broaden(key) {
  readFilters();
  const result = relaxSearch(broadening?.original || filters, current(), key);
  broadening = result; filters = result.filters; broadeningOpen = true;view='explore';
  return search(false, true).then(()=>$('#result-heading')?.focus());
}
function restoreSearch() {
  if (!broadening) return;
  filters = broadening.original; broadening = null;
  return search().then(()=>$('#result-heading')?.focus());
}
function cardTile(c) {
  const copies = deckCardCopies(current(),c,'main');
  const image = imageFor(c);
  const price = c.prices?.usd ? esc(c.prices.usd) + ' USD' : 'Price unavailable';
  return `<article class="card-tile"><button class="card-image-button" data-inspect="${esc(c.id)}" aria-label="Inspect ${esc(c.name)}">${image ? `<img src="${esc(safeUrl(image,true))}" alt="${esc(c.name)}" loading="lazy" width="488" height="680">` : `<div class="card-fallback">${esc(c.name)}<p>${esc(oracle(c))}</p></div>`}</button><div class="card-caption"><button data-inspect="${esc(c.id)}" class="card-name">${esc(c.name)}</button><button class="add-button ${copies ? 'added' : ''}" data-add="${esc(c.id)}" aria-label="${esc(addLabel(c))}" title="${esc(addLabel(c))}">${copies ? `<span>${copies}</span>` : icon('plus',17)}</button></div><div class="card-meta"><span>${esc(c.type_line?.split(' — ')[0])}</span><span>${price}</span></div>${current()?`<button class="text-button choose-deck" data-choose-add="${esc(c.id)}" aria-label="Choose another deck for ${esc(c.name)}">Add to…</button>`:''}</article>`;
}
function deckPanel(d) {
  return `<div class="panel-title"><span>Deck tracker</span><button class="text-button" data-action="toggle-tracker">Hide tracker</button></div><div class="deck-header"><h2 id="tracker-heading" tabindex="-1">${esc(d.name)}</h2><span class="format-badge">${esc(d.format)}</span>${identitySummary(d)}<p class="tracker-count"><strong>${stats(d).total}</strong> in playing deck · ${zoneCount(d,'sideboard')} sideboard</p><p class="hint">Adds default to Main deck.</p>${freshnessNotice(d)}<button class="secondary" data-deck="${esc(d.id)}">Open full deck</button></div><div class="panel-content">${d.cards.length?deckList(d):'<p class="hint">No cards yet. Use Add on a result to choose copies for this deck.</p>'}</div>`;
}
function identitySummary(d, compact=false) {
  const colors=deckIdentity(d), names={W:'White',U:'Blue',B:'Black',R:'Red',G:'Green'};
  const missing=d.format==='commander'&&!d.cards.some(e=>zoneFor(e)==='command');
  return `<span class="identity-summary${compact?' compact-identity':''}" aria-label="${compact?'Color identity':d.format==='commander'?'Command-zone identity':'Main-deck identity'}: ${missing?'not designated':colors.map(c=>names[c]).join(', ')||'colorless'}">${missing?'Commander not designated':colors.length?mana(colors.map(c=>'{'+c+'}').join('')):'Colorless'}${compact?'':`<span>${d.format==='commander'?'Command-zone identity':'Main-deck identity'}</span>`}</span>`;
}
function openDeck(id) {
  if(!decks.some(d=>d.id===id))return;
  const changed=active!==id;active=id;view='deck';deckTab='cards';
  if(changed){editorOptions={layout:'visual-horizontal',group:'type',search:'',order:'name'};previewKey='';}
  render();$('#deck-title')?.focus();

}

const collectionOptions={view:'visual',group:'none',sort:'added',filter:''};
try{const saved=JSON.parse(localStorage.getItem('arcana.collection-view.v1'));for(const key of ['view','group','sort'])if(collectionChoices[key].some(([value])=>value===saved?.[key]))collectionOptions[key]=saved[key];if(['list','visual-vertical'].includes(saved?.view))collectionOptions.view=saved.view==='list'?'text':'visual';if(typeof saved?.filter==='string')collectionOptions.filter=saved.filter.slice(0,300);}catch{}
function saveCollectionOptions(){try{localStorage.setItem('arcana.collection-view.v1',JSON.stringify(collectionOptions));}catch{toast('Collection view kept for this session.');}}
function collectionLotDialog(card=null,index=null,back=null){
  if(index!==null)card=collection[index]?.card;
  if(!card){
    showDialog('<h2>Add owned card</h2><div class="owned-search-wrap"><label>Search card names<input id="owned-search" type="search" role="combobox" aria-autocomplete="list" aria-controls="owned-matches" aria-expanded="false" autocomplete="off" placeholder="Type a card name"></label><div id="owned-matches" class="owned-suggestions" role="listbox" hidden></div></div><p id="owned-search-status" role="status">Type a letter to search card names.</p><button class="secondary" id="owned-cancel">Cancel</button>');
    const input=$('#owned-search'),matches=$('#owned-matches'),status=$('#owned-search-status');let revision=0,timer,choices=[],activeOption=-1;
    const choose=id=>{const selected=choices.find(c=>c.id===id);if(selected){revision++;collectionLotDialog(selected);}};
    input.oninput=()=>{const version=++revision,value=input.value.trim();clearTimeout(timer);matches.innerHTML='';matches.hidden=true;input.setAttribute('aria-expanded','false');choices=[];activeOption=-1;if(!value){status.textContent='Type a letter to search card names.';return;}status.textContent='Searching…';timer=setTimeout(async()=>{try{
      const literal=value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\//g,'\\/');
      const data=await api('/api/search?'+new URLSearchParams({q:'game:paper name:/^'+literal+'/',order:'name'}));
      if(version!==revision||!input.isConnected)return;choices=data.data;matches.innerHTML=choices.map((c,i)=>`<button type="button" role="option" id="owned-option-${i}" data-owned-choice="${esc(c.id)}" aria-selected="false">${esc(c.name)}</button>`).join('');matches.hidden=!choices.length;input.setAttribute('aria-expanded',String(Boolean(choices.length)));status.textContent=choices.length+' matching card names.';
    }catch(error){if(version===revision&&input.isConnected)status.textContent=error.message;}},250);};
    matches.onclick=e=>{const button=e.target.closest('[data-owned-choice]');if(button)choose(button.dataset.ownedChoice);};
    input.onkeydown=e=>{if(e.key==='Escape'&&!matches.hidden){e.preventDefault();e.stopPropagation();matches.hidden=true;input.setAttribute('aria-expanded','false');return;}if(['ArrowDown','ArrowUp'].includes(e.key)&&choices.length){e.preventDefault();matches.hidden=false;activeOption=(activeOption+(e.key==='ArrowDown'?1:choices.length-1)+choices.length)%choices.length;input.setAttribute('aria-activedescendant','owned-option-'+activeOption);input.setAttribute('aria-expanded','true');for(const [i,node] of [...matches.querySelectorAll('[role="option"]')].entries())node.setAttribute('aria-selected',String(i===activeOption));}if(e.key==='Enter'&&activeOption>=0&&!matches.hidden){e.preventDefault();choose(choices[activeOption].id);}};
    $('#owned-cancel').onclick=()=>closeDialog();input.focus();return;
  }
  const original=collection[index],draft=new Map();let selected=card,printings=[card],page=0;
  const key=()=>[selected.id,$('#owned-finish').value,$('#owned-condition').value].join('|');
  showDialog(`<h2>Update collection</h2><div class="owned-editor"><div id="owned-art"></div><form id="owned-form"><h3>${esc(card.name)}</h3><label>Version<select id="owned-version"></select></label><button type="button" class="text-button" id="owned-load" hidden>Retry loading versions</button><p id="owned-status" role="status"></p><label>Finish<select id="owned-finish">${['regular','foil','etched'].map(f=>`<option value="${f}" ${original?.finish===f?'selected':''}>${f}</option>`).join('')}</select></label><label>Condition<select id="owned-condition"><option value="">Not recorded</option>${Object.entries(CONDITION_LABELS).map(([v,l])=>`<option value="${v}" ${original?.condition===v?'selected':''}>${l}</option>`).join('')}</select></label><p id="owned-existing"></p><label>Quantity of this version</label><div class="owned-quantity"><button type="button" class="secondary" id="owned-minus" aria-label="Subtract one owned copy">−</button><input id="owned-qty" aria-label="Owned quantity" type="number" min="0" max="9999" step="1"><button type="button" class="secondary" id="owned-plus" aria-label="Add one owned copy">+</button></div><p id="owned-error" role="alert"></p><div class="settings-actions"><button class="primary">Update collection</button><button type="button" class="secondary" id="owned-cancel">Cancel</button></div></form></div>`);
  const form=$('#owned-form'),qty=$('#owned-qty');let currentKey='';
  const remember=()=>{if(currentKey)draft.set(currentKey,{card:selected,finish:$('#owned-finish').value,condition:$('#owned-condition').value,qty:Number(qty.value)});};
  const display=()=>{currentKey=key();const lot=collection.find(l=>[l.card.id,l.finish,l.condition||''].join('|')===currentKey);qty.value=draft.get(currentKey)?.qty??lot?.qty??0;$('#owned-existing').textContent='Current quantity for this version, finish and condition: '+(lot?.qty||0);const image=safeUrl(imageFor(selected),true);$('#owned-art').innerHTML=image?`<img src="${esc(image)}" alt="${esc(selected.name)}">`:'<p>Artwork unavailable.</p>';};
  const options=()=>{$('#owned-version').innerHTML=printings.map(c=>`<option value="${esc(c.id)}" ${c.id===selected.id?'selected':''}>${esc(printingLabel(c))}</option>`).join('');};
  for(const id of ['owned-finish','owned-condition'])$('#'+id).onchange=()=>{if(currentKey)draft.set(currentKey,{card:selected,finish:currentKey.split('|')[1],condition:currentKey.split('|')[2],qty:Number(qty.value)});display();};
  $('#owned-version').onchange=()=>{remember();selected=printings.find(c=>c.id===$('#owned-version').value)||selected;display();};
  $('#owned-minus').onclick=()=>qty.value=Math.max(0,Number(qty.value)-1);$('#owned-plus').onclick=()=>qty.value=Math.min(9999,Number(qty.value)+1);
  $('#owned-cancel').onclick=back || closeDialog;
  if(back){
    $('#owned-cancel').textContent='Back to card details';
    $('#dialog h2').textContent='Add this card to collection';
    $('#dialog').setAttribute('aria-label','Add this card to collection');
  }
  let versionsLoading=false,versionsComplete=false;
  $('#owned-load').onclick=async()=>{if(versionsLoading||versionsComplete)return;versionsLoading=true;const button=$('#owned-load');button.hidden=true;try{if(!card.oracle_id)throw Error('Versions unavailable for this stored card.');while(!versionsComplete&&form.isConnected&&$('#dialog').open!==false){$('#owned-status').textContent='Loading versions… '+printings.length+' available so far.';const data=await api('/api/printings?'+new URLSearchParams({oracle:card.oracle_id,page:page+1}));if(!form.isConnected||$('#dialog').open===false)return;page++;printings=[...new Map([...printings,...data.data].map(c=>[c.id,c])).values()];options();versionsComplete=!data.has_more;if(page>=1000&&!versionsComplete)throw Error('Version limit reached. Loaded versions remain available.');}if(form.isConnected)$('#owned-status').textContent=printings.length+' versions available in the dropdown.';}catch(error){if(form.isConnected){$('#owned-status').textContent=error.message;button.hidden=false;}}finally{versionsLoading=false;}};
  form.onsubmit=e=>{e.preventDefault();try{remember();let next=structuredClone(collection);for(const [lotKey,lot] of draft){if(!Number.isInteger(lot.qty)||lot.qty<0||lot.qty>9999)throw Error('Enter a whole number from 0 to 9999.');const position=next.findIndex(l=>[l.card.id,l.finish,l.condition||''].join('|')===lotKey);if(lot.qty){const previous=collection.find(l=>[l.card.id,l.finish,l.condition||''].join('|')===lotKey);lot.addedAt=previous?previous.addedAt:new Date().toISOString();lot.updatedAt=new Date().toISOString();if(!lot.condition)delete lot.condition;if(position>=0)next[position]=lot;else next.push(lot);}else if(position>=0)next.splice(position,1);}validateCollection(next);collection=next;save();if(!back)closeDialog();render();if(back)back();toast(storageError?'Collection kept for this session; save a workspace copy.':'Collection updated.');}catch(error){$('#owned-error').textContent=error.message;}};
  options();display();$('#owned-load').onclick();
}
const importCardPool=new Map();
function collectionImport(){
  showDialog('<h2>Upload collection</h2><p>Choose a TXT or CSV file, or paste card data. Syntax is checked locally before Upload becomes available. Upload resolves the cards and adds them when complete.</p><form id="collection-import"><label>TXT or CSV file<input id="collection-csv-file" type="file" accept=".txt,.csv,text/plain,text/csv"></label><label>Card list or CSV<textarea name="list" rows="7" required placeholder="Paste your own card data here…"></textarea></label><details class="import-examples"><summary>Examples of accepted text and CSV</summary><p>Examples only — replace them with your cards.</p><pre>2 Sol Ring&#10;12 Forest</pre><pre>Quantity,Name,Finish,Condition&#10;1,&quot;Aang, Air Nomad&quot;,Normal,NM</pre><pre>Quantity,Name,Language,Edition Name&#10;2,Forest,English,Foundations</pre><p>CSV without headers is also supported: assign its columns below. Collection lists have no deck zones.</p></details><div id="collection-mapping"></div><div id="collection-syntax" role="status"></div><div id="collection-notices"></div><p id="collection-import-error" role="alert"></p><div id="collection-import-preview" role="status"></div><button class="primary" disabled>Upload</button></form>');
  const form=$('#collection-import'),button=form.querySelector('button'),responses=new Map(),cache=new Map();let review=null,plan=null,mapping=null,revision=0,pending=false,cooldownUntil=0;
  const lookup=async(url,options)=>{if(!form.isConnected||$('#dialog').open===false)throw Error('Upload closed.');const key=url+(options?.body||'');if(responses.has(key))return responses.get(key);const data=await api(url,options);responses.set(key,data);return data;};
  const progress=message=>{if(form.isConnected)$('#collection-import-preview').textContent=message;};
  const validate=()=>{
    plan=null;button.disabled=true;$('#collection-import-error').textContent='';$('#collection-notices').innerHTML='';
    try{
      const text=String(new FormData(form).get('list')||'');const result=prepareCollectionUpload(text,mapping);
      if(result.needsMapping){
        $('#collection-syntax').textContent='Assign the CSV columns, then check syntax.';
        $('#collection-mapping').innerHTML='<h3>Define CSV columns</h3><label><input type="checkbox" id="csv-has-header" '+(result.suggestHeaders?'checked':'')+'> First row contains column headings</label>'+Array.from({length:result.width},(_,i)=>'<label>Column '+(i+1)+' · '+esc(result.preview.map(row=>row[i]||'').join(' / ').slice(0,120))+'<select data-csv-column="'+i+'"><option value="">Ignore this column</option>'+COLLECTION_COLUMNS.map(c=>'<option>'+c+'</option>').join('')+'</select></label>').join('')+'<button type="button" class="secondary" id="csv-check-mapping">Check syntax</button>';
        $('#csv-check-mapping').onclick=()=>{mapping={header:$('#csv-has-header').checked,columns:[...form.querySelectorAll('[data-csv-column]')].map(node=>node.value)};validate();};return;
      }
      plan=result;$('#collection-syntax').textContent='Syntax valid · '+result.rows.length+' card rows · '+result.rows.reduce((n,r)=>n+r.qty,0)+' copies.';
      $('#collection-notices').innerHTML='<p>Processed columns: '+result.accepted.map(esc).join(', ')+'.</p>'+(result.ignored.length?'<p>Not counted: '+result.ignored.map(esc).join(', ')+'.</p>':'')+(result.skipped.length?'<h3>Could not process the following cards</h3><ul>'+result.skipped.map(line=>'<li>'+esc(line)+'</li>').join('')+'</ul><p>These lines will be skipped. Valid card rows can still be uploaded.</p>':'')+(result.ignored.length||result.skipped.length?'<label class="import-confirm"><input type="checkbox" id="collection-accept-ignored"> Continue with only the processed columns and valid card rows</label>':'');
      const confirm=$('#collection-accept-ignored'),needsConfirm=result.ignored.length||result.skipped.length;
      if(needsConfirm)confirm.onchange=()=>{button.disabled=!confirm.checked||pending||Date.now()<cooldownUntil;};
      button.disabled=Boolean(needsConfirm)||pending||Date.now()<cooldownUntil;button.textContent='Upload';
    }catch(error){$('#collection-syntax').textContent=error.message;}
  };
  form.oninput=e=>{if(e?.target?.id==='collection-accept-ignored')return;if(e?.target?.dataset?.csvColumn!==undefined||e?.target?.id==='csv-has-header'){revision++;review=null;plan=null;button.disabled=true;$('#collection-syntax').textContent='Column mapping changed. Check syntax again.';return;}revision++;review=null;mapping=null;$('#collection-mapping').innerHTML='';$('#collection-import-preview').textContent='';validate();};
  $('#collection-csv-file').onchange=async e=>{revision++;review=null;plan=null;mapping=null;button.disabled=true;const version=revision,file=e.target.files[0];if(!file)return;try{if(!/\.(txt|csv)$/i.test(file.name))throw Error('Choose a .txt or .csv file.');if(file.size>15_000_000)throw Error('File exceeds 15 MB.');const text=await file.text();if(form.isConnected&&revision===version){form.querySelector('textarea').value=text;$('#collection-mapping').innerHTML='';validate();}}catch(error){if(form.isConnected)$('#collection-import-error').textContent=error.message;}};
  form.onsubmit=async e=>{e.preventDefault();if(pending||Date.now()<cooldownUntil)return;if(!plan)validate();if(!plan)return;if((plan.ignored.length||plan.skipped.length)&&!$('#collection-accept-ignored').checked)return;pending=true;button.disabled=true;try{
    if(!review){
      const version=revision,parsed=plan.rows;
      const pool=[...importCardPool.values(),...collection.map(l=>l.card),...decks.flatMap(d=>d.cards.map(e=>e.card))];
      const indexCards=values=>{const index=new Map();for(const c of values)for(const name of new Set([c.name,...(c.card_faces||[]).map(f=>f.name)].filter(Boolean))){const key=name.toLowerCase();if(!index.has(key))index.set(key,[]);index.get(key).push(c);}return index;};
      const localIndex=indexCards(pool);
      const matchesRow=(c,row)=>(c.name.toLowerCase()===row.name.toLowerCase()||c.card_faces?.some(f=>f.name?.toLowerCase()===row.name.toLowerCase()))&&(!row.language||c.lang===row.language)&&(!row.set||[c.set,c.set_name].some(v=>v?.toLowerCase()===row.set.toLowerCase()))&&c.finishes?.includes(row.finish==='regular'?'nonfoil':row.finish);
      const local=new Map();for(const row of parsed){const found=(localIndex.get(row.name.toLowerCase())||[]).find(c=>matchesRow(c,row));if(found)local.set(JSON.stringify([row.name,row.set,row.language,row.finish]),found);}
      const names=[...new Set(parsed.filter(row=>!row.set&&!row.language&&!local.has(JSON.stringify([row.name,row.set,row.language,row.finish]))).map(p=>p.name.split(' // ')[0]))],cards=[],resolved=[];
      for(let i=0;i<names.length;i+=75){
        if(!form.isConnected||$('#dialog').open===false)return;if(version!==revision)throw Error('List changed; review it again.');
        progress('Looking up names '+(i+1)+'–'+Math.min(i+75,names.length)+' of '+names.length+'. Completed lookups are retained for retry.');
        const data=await lookup('/api/collection',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({names:names.slice(i,i+75)})});cards.push(...data.data);for(const c of data.data){importCardPool.set(c.id,c);if(importCardPool.size>5000)importCardPool.delete(importCardPool.keys().next().value);}
      }
      const remoteIndex=indexCards(cards);
      for(const row of parsed){
        if(!form.isConnected||$('#dialog').open===false)return;
        if(version!==revision)throw Error('List changed; review it again.');
        progress('Resolving '+(resolved.length+1)+' of '+parsed.length+' card rows…');
        let card=local.get(JSON.stringify([row.name,row.set,row.language,row.finish]));
        if(card){/* Reuse the already verified local printing. */}
        else if(row.set||row.language){
          const cacheKey=JSON.stringify([row.name,row.set,row.language,row.finish]);
          if(cache.has(cacheKey))card=cache.get(cacheKey);else{
            const quote=value=>'"'+value.replace(/["\\]/g,'\\$&')+'"';
            const q='game:paper !'+quote(row.name)+(row.set?' set:'+quote(row.set):'')+(row.language?' lang:'+row.language:'')+' unique:prints';
            const result=await lookup('/api/search?'+new URLSearchParams({q,order:'name'}));
            const candidates=result.data.filter(c=>(c.name.toLowerCase()===row.name.toLowerCase()||c.card_faces?.some(f=>f.name?.toLowerCase()===row.name.toLowerCase()))&&(!row.language||c.lang===row.language)&&(!row.set||[c.set,c.set_name].some(value=>value?.toLowerCase()===row.set.toLowerCase()))&&(!c.finishes||c.finishes.includes(row.finish==='regular'?'nonfoil':row.finish)));
            if(result.has_more||candidates.length!==1)throw Error(row.name+': set/language does not identify one supported printing. Refine the CSV set or add this printing manually.');
            card=candidates[0];cache.set(cacheKey,card);
          }
        }else{
          const result=resolveImport([{name:row.name,qty:1}],remoteIndex.get(row.name.toLowerCase())||[]);
          card=result.entries[0]?.card;
          if(!card||card.finishes&&!card.finishes.includes(row.finish==='regular'?'nonfoil':row.finish)){
            const cacheKey=JSON.stringify([row.name,row.finish]);
            if(cache.has(cacheKey))card=cache.get(cacheKey);else{
              const front=row.name.split(' // ')[0],quoted='"'+front.replace(/["\\]/g,'\\$&')+'"';
              let chosen=null;
              for(let page=1;page<=20;page++){
                const data=await lookup('/api/search?'+new URLSearchParams({q:'game:paper !'+quoted+' unique:prints',order:'name',page}));
                const matches=data.data.filter(c=>(c.name.toLowerCase()===row.name.toLowerCase()||c.card_faces?.some(f=>f.name?.toLowerCase()===row.name.toLowerCase()))&&c.finishes?.includes(row.finish==='regular'?'nonfoil':row.finish));
                const identities=new Set(matches.map(c=>c.oracle_id||c.id));if(identities.size>1)throw Error(row.name+': ambiguous rules identity. Specify a set.');
                if(matches.length){chosen=matches[0];break;}if(!data.has_more)break;
              }
              if(!chosen)throw Error(row.name+': no compatible '+row.finish+' printing found. Specify a set or add manually.');
              card=chosen;cache.set(cacheKey,card);
            }
          }
        }
        importCardPool.set(card.id,card);if(importCardPool.size>5000)importCardPool.delete(importCardPool.keys().next().value);
        resolved.push({card,qty:row.qty,finish:row.finish,...(row.condition?{condition:row.condition}:{})});
      }
      if(!form.isConnected||$('#dialog').open===false)return;if(version!==revision)throw Error('List changed; review it again.');
      review=resolved;
    }
    if(!form.isConnected||$('#dialog').open===false)return;
    const next=structuredClone(collection);
    for(const e of review){const found=next.find(l=>l.card.id===e.card.id&&l.finish===e.finish&&(l.condition||'')===(e.condition||''));if(found){found.qty+=e.qty;found.updatedAt=new Date().toISOString();}else next.push({...e,addedAt:new Date().toISOString(),updatedAt:new Date().toISOString()});}
    validateCollection(next);collection=next;save();closeDialog();render();toast(storageError?'Imported copies kept for this session. Save a workspace copy.':'Collection uploaded.');
  }catch(error){if(form.isConnected){$('#collection-import-error').textContent=error.message;if(error.status===429){cooldownUntil=Date.now()+Math.max(60,Number(error.retryAfter)||60)*1000;const tick=()=>{if(!form.isConnected)return;const left=Math.max(0,Math.ceil((cooldownUntil-Date.now())/1000));button.disabled=left>0;button.textContent=left?'Paused · '+left+'s remaining':'Resume upload';progress('Rate limit reached. No cards added yet. Completed lookups are retained in this window.');if(left)setTimeout(tick,1000);};tick();}else button.textContent=review?'Upload':'Retry upload';}}finally{pending=false;if(Date.now()>=cooldownUntil)button.disabled=false;}};
}
function removeCollectionLot(index){
  const lot=collection[index];if(!lot)return;
  showDialog(`<h2>Remove owned lot?</h2><p>This removes ${lot.qty} ${esc(lot.card.name)} ${lot.qty===1?'copy':'copies'} from local collection planning.</p><div class="settings-actions"><button class="danger" id="confirm-remove-owned">Remove lot</button><button class="secondary" id="cancel-remove-owned">Cancel</button></div>`);
  $('#cancel-remove-owned').onclick=()=>$('#dialog').close();$('#confirm-remove-owned').onclick=()=>{collection=collection.filter((_,i)=>i!==index);save();$('#dialog').close();render();toast('Owned lot removed.');};
}
function updateOwnedQuantity(index,value){
  const lot=collection[index];if(!lot)return;
  const qty=Number(value);if(!String(value).trim()||!Number.isInteger(qty)||qty<0||qty>9999){toast('Quantity must be a whole number from 0 to 9999.');render();return;}
  if(qty===0){removeCollectionLot(index);render();return;}
  if(qty===lot.qty)return;lot.qty=qty;lot.updatedAt=new Date().toISOString();save();render();
}
function clearCollection(){
  showDialog('<h2>Delete entire collection?</h2><p>This removes all owned-card quantities from this browser. Your decks and their budget settings stay intact. This cannot be undone here; save a workspace copy first if you want to restore it later.</p><button class="secondary" id="clear-collection-backup">Save workspace copy</button><label>Type DELETE to confirm<input id="clear-collection-confirm" autocomplete="off"></label><p id="clear-collection-error" role="alert"></p><div class="settings-actions"><button class="danger" id="clear-collection-apply" disabled>Delete entire collection</button><button class="secondary" id="clear-collection-cancel">Keep collection</button></div>');
  $('#clear-collection-backup').onclick=()=>saveWorkspaceCopy();$('#clear-collection-cancel').onclick=()=>closeDialog();
  $('#clear-collection-confirm').oninput=e=>$('#clear-collection-apply').disabled=e.target.value!=='DELETE';
  $('#clear-collection-apply').onclick=()=>{if($('#clear-collection-confirm').value!=='DELETE')return;try{localStorage.setItem('arcana.workspace.v2',JSON.stringify(workspaceFile(decks,[])));collection=[];storageError='';updateBackupStatus();closeDialog();render();toast('Collection deleted. Decks retained.');}catch(error){$('#clear-collection-error').textContent='Collection was not deleted. '+error.message;}};
  $('#clear-collection-cancel').focus();
}
function deckWorkspace(d, statistics, previousStatistics) {
  if(!d)return `<div class="library"><h1>No deck selected</h1><button class="secondary" data-view="decks">Back to My decks</button></div>`;
  const s=statistics ?? stats(d), report=legalityReport(d);
  const select=(key,label,values)=>`<label>${label}<select id="editor-${key}">${values.map(([v,l])=>`<option value="${esc(v)}" ${editorOptions[key]===v?'selected':''}>${esc(l)}</option>`).join('')}</select></label>`;
  return `<div class="deck-workspace"><header class="deck-editor-header"><div class="deck-title-row"><h1 id="deck-title" tabindex="-1">${esc(d.name)}</h1><div class="workspace-actions"><button class="primary" data-action="find-cards">${icon('plus',16)} Find cards to add</button>${deckMenu(d)}</div></div><div class="deck-editor-meta"><span class="format-badge">${esc(formatLabel(d.format))}</span><span>${s.total} in playing deck · ${zoneCount(d,'sideboard')} sideboard</span>${identitySummary(d,true)}${bracketControl(d)}</div></header><div class="deck-tabs" role="tablist" aria-label="Deck sections">${[['cards','Cards'],['stats','Statistics'],['planning','Ownership & budget'],['checks','Checks']].map(([key,label])=>`<button role="tab" aria-selected="${deckTab===key}" data-tab="${key}">${label}</button>`).join('')}</div><div class="editor-content">${deckTab==='stats'?statPanel(s, d, previousStatistics?.dataset.statisticsDeck === d.id ? previousStatistics : null):deckTab==='planning'?budgetPanel(d,collection,priceStates.get(d.id)):deckTab==='checks'?checksPanel(d,report):`<div class="editor-controls">${select('layout','View',[['visual-horizontal','Horizontal visual stacks'],['visual-vertical','Vertical visual stacks'],['text-horizontal','Horizontal text'],['text-vertical','Vertical text']])}${select('group','Group by',[['type','Type'],['role','Function'],['none','No grouping']])}${select('order','Sort by',[['name','Name (A–Z)'],['mana','Mana value (low first)'],['quantity','Quantity (most first)'],['price','Price USD (low first)'],['price-desc','Price USD (high first)'],['power','Power (low first)'],['power-desc','Power (high first)'],['toughness','Toughness (low first)'],['toughness-desc','Toughness (high first)']])}<label class="deck-text-filter" for="editor-search">Filter cards<input id="editor-search" type="search" value="${esc(editorOptions.search)}" placeholder="Name, type or function" maxlength="300"></label><button class="text-button" data-action="clear-deck-filters">Clear filter</button></div>${deckCards(d)}`}</div></div>`;
}
function bracketControl(d) {
  if(d.format!=='commander')return '';
  return `<div class="bracket-tools"><label class="bracket-control" for="assigned-bracket">Commander bracket<select id="assigned-bracket"><option value="">Not assigned</option>${Object.entries(BRACKETS).map(([n,label])=>`<option value="${n}" ${d.bracket===Number(n)?'selected':''}>${n} · ${label}</option>`).join('')}</select></label><a href="#bracket-discussion" data-action="bracket-guidance">Bracket discussion guidance</a></div>`;
}
function bracketPanel(d) {
  if(d.format!=='commander')return '';
  const report=bracketReport(d),range=report.range;
  const suggestion=!report.available?'Guidance unavailable: app bracket data is missing.':report.stale?'Guidance is outdated. Check the current official source before using it.':report.missing?'Guidance unavailable: some stored card data is incomplete.':!report.canSuggest?'Add cards to see Game Changer guidance.':range?`Discussion range: Brackets ${range[0]}–${range[1]} based on Game Changer count.`:'No discussion range from Game Changers alone; zero matches can fit any bracket.';
  return `<section class="bracket-review" id="bracket-discussion" tabindex="-1" aria-label="Commander bracket discussion"><h3>Commander bracket discussion</h3><p><strong>Player assigned:</strong> ${d.bracket?'Bracket '+d.bracket+' · '+BRACKETS[d.bracket]:'Not assigned'}.</p><p class="check-info bracket-suggestion">${esc(suggestion)}</p><p>${report.available?`${report.count} Game Changer ${report.count===1?'copy':'copies'} in Main deck + Command zone${report.stale?' (outdated app data)':''}.`:'Game Changer count unavailable.'} Sideboard and Maybeboard excluded.</p>${report.matches.length?`<ul>${report.matches.map(m=>`<li>${esc(m.name)} · ${m.qty} ${m.qty===1?'copy':'copies'} · ${m.zones.map(z=>ZONES[z]).join(', ')}</li>`).join('')}</ul>`:''}${range&&d.bracket&&d.bracket<range[0]?'<p class="bracket-conflict">Your assigned bracket is below this count-based range. Discuss the deck with your group; thematic exceptions can be agreed.</p>':''}<p class="hint">Game Changer counts are not a power rating or bracket certification. Discuss combos, extra turns, mass land denial, speed, consistency and intended play with your group. Counts do not distinguish Brackets 4 and 5; thematic exceptions are a group decision.</p><h4>About bracket data</h4><p class="hint">Last updated: <time datetime="${esc(COMMANDER_BRACKETS.verifiedAt)}">${esc(COMMANDER_BRACKETS.verifiedAt)}</time> · Developer-maintained.</p><p>This date records the last developer review of the bundled list and guidance. Updates arrive with app versions; there is no live refresh. Card-legality refresh does not update bracket data.</p><p><a href="${COMMANDER_BRACKETS.source}" target="_blank" rel="noreferrer">Current official Commander brackets and Game Changers</a></p></section>`;
}
function checksPanel(d, report) {
  const section = (label, items, status, symbol, explanation) => items.length ? `<section class="check-section check-${status}"><h3>${icon(symbol,18)} ${label} · ${items.length}</h3><p>${explanation}</p><ul>${items.map(t=>`<li>${esc(t)}</li>`).join('')}</ul></section>` : '';
  const state=legalityStates.get(d.id), fresh=state?.status==='fresh' && Date.now()-state.time<300_000;
  const status = report.failed.length ? 'failure' : report.unavailable.length || !fresh ? 'warning' : report.manual.length ? 'info' : 'success';
  const title = report.failed.length ? 'Deck legality issues found' : report.unavailable.length || !fresh ? 'Checks incomplete' : report.manual.length ? 'Supported checks passed · manual review needed' : 'Supported checks passed';
  const scope = d.format==='commander'
    ? 'Checks main deck + command zone: 100-card total, commander quantities, copy limits, card legality and color identity against a single commander. Sideboard and Maybeboard are excluded.'
    : `Checks main deck + sideboard: main deck 60+, sideboard up to 15, combined copy limits and ${esc(formatLabel(d.format))} card legality. A command zone is flagged; Maybeboard is excluded.`;
  return `<div class="checks"><h2>Deck legality checks</h2><p>Deck construction and card legality are checked together for ${esc(formatLabel(d.format))}.</p><h3 class="check-summary check-${status}">${icon(status==='success'?'check':status==='failure'?'close':'book',18)} ${title}</h3><p>${scope} Card legality uses stored data; freshness is shown below.</p>${freshnessNotice(d)}${section('Failed checks',report.failed,'failure','close','These supported rules fail with the stored deck and card data. Review freshness before relying on card legality results.')}${section('Data unavailable',report.unavailable,'warning','book','Missing or unrecognized card data prevents these checks. This does not mean the affected cards are banned.')}${section('Manual review',report.manual,'info','book','The app cannot fully check these rules. Verify them yourself before playing.')}<p class="hint">Passing supported checks is not tournament certification. ${d.format==='commander'?'<a href="https://github.com/RuneBrix/magic-the-deckbuilder/issues/13" target="_blank" rel="noreferrer">Commander rules still needing support</a> include basic-land type restrictions, commander eligibility and pairings. ':''}Companion designation and starting-deck restrictions are not automated.</p>${bracketPanel(d)}</div>`;
}

const usdAmount = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usd = cents => usdAmount.format(cents / 100) + ' USD';
function deckPriceTotal(entries) {
  let total = 0, unpriced = 0, priced = 0;
  for (const entry of entries) {
    const { cents } = deckPrintingPrice(entry.card,entry.finish);
    if (cents === null) unpriced += entry.qty;
    else { total += cents * entry.qty; priced += entry.qty; }
  }
  const unknownCopies = `${unpriced} ${unpriced === 1 ? 'copy' : 'copies'} unpriced`;
  if (!Number.isSafeInteger(total)) return unpriced ? `Price total unavailable · ${unknownCopies}` : 'Price total unavailable';
  if (!unpriced) return usd(total);
  return priced ? `${usd(total)} known · ${unknownCopies}` : unknownCopies;
}
function stackCardMeta({card,finish}) {
  const { cents } = deckPrintingPrice(card,finish);
  const setCode = typeof card.set === 'string' && card.set.trim() ? card.set.toUpperCase() : 'Set unknown';
  return `<div class="stack-card-meta"><span>${esc(card.name)}</span><span>${esc(setCode)}${finish ? ' · '+finish : ''} · ${cents === null ? 'Price unavailable' : usd(cents)}</span></div>`;
}
function previewMarkup(d) {
  const entry=deckEntries(d,editorOptions).find(e=>entryKey(e)===previewKey);
  if(!entry)return '<p class="hint">Point to a card or focus its name to preview.</p>';
  const image=safeUrl(imageFor(entry.card),true);
  const { cents, finish } = deckPrintingPrice(entry.card,entry.finish);
  const price = cents === null ? 'Price unavailable' : `${usd(cents)} per copy`;
  return `<figure>${image?`<img src="${esc(image)}" alt="${esc(entry.card.name)}">`:'<p class="hint">Artwork unavailable for this printing.</p>'}<figcaption>${esc(entry.card.name)} · ${ZONES[zoneFor(entry)]}<span>Function: ${esc(primaryRole(entry))}</span><span>${price}${finish ? ' · ' + finish : ''}</span></figcaption></figure>`;
}
function deckCards(d) {
  if(previewDeck!==d.id || !deckEntries(d,editorOptions).some(e=>entryKey(e)===previewKey)){previewKey='';previewDeck=d.id;}
  return `<div id="editor-card-area"><div class="deck-card-area"><aside class="deck-hover-preview" aria-label="Card preview"><div id="deck-card-preview">${previewMarkup(d)}</div></aside><div class="deck-rows">${deckList(d,true)}</div></div><div id="deck-drag-targets" hidden><p id="deck-drag-label" role="status"></p><div class="drag-zone-targets" role="group" aria-label="Card drop destinations"><div data-drop-new-function>Add to new function</div>${Object.entries(ZONES).map(([zone,label])=>`<div data-drop-zone="${zone}">Move to ${label}</div>`).join('')}</div><div class="drag-trash" data-drop-trash title="Confirm deletion of all copies across all zones"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/></svg><span>Delete card…</span><small>All zones · asks first</small></div></div></div>`;
}
function previewEntry(key) {
  const d=current();if(view!=='deck' || deckTab!=='cards' || !d || previewKey===key)return;
  if(!deckEntries(d,editorOptions).some(e=>entryKey(e)===key))return;
  previewDeck=d.id;previewKey=key;$('#deck-card-preview').innerHTML=previewMarkup(d);
  for(const row of document.querySelectorAll('[data-preview-entry]'))row.classList.toggle('is-previewed',row.dataset.previewEntry===key);
}
function deckEntry(e, atLimit) {
  const key=entryKey(e),visual=editorOptions.layout.startsWith('visual'),image=safeUrl(imageFor(e.card),true),zone=ZONES[zoneFor(e)];
  const variant=e.finish?` · ${esc(printingLabel(e.card))} · ${e.finish}`:'';
  const minus=`<button data-zone-minus="${esc(key)}" aria-label="Remove one ${esc(e.card.name)} from ${zone}">${icon('minus',14)}</button>`,plus=`<button data-zone-plus="${esc(key)}" aria-label="Add one ${esc(e.card.name)} to ${zone}" ${atLimit?'disabled':''}>${icon('plus',14)}</button>`;
  const quantity=`<div class="card-quantity">${visual?plus+minus:minus+plus}</div>`;
  const menu=`<button class="card-menu-trigger" data-card-menu="${esc(key)}" aria-label="Card actions for ${esc(e.card.name)} in ${zone}${variant}" aria-haspopup="menu" aria-controls="card-actions" aria-expanded="false">${icon('more',18)}</button>`;
  const badge=`<span class="entry-quantity${visual&&e.qty>=100?' three-digits':''}" aria-label="${e.qty} ${e.qty===1?'copy':'copies'}">${e.qty}</span>`;
  const art=`<button class="card-art" data-inspect="${esc(e.card.id)}" data-entry="${esc(key)}" aria-label="Inspect ${esc(e.card.name)} in ${zone}">${image?`<img draggable="false" src="${esc(image)}" alt="${esc(e.card.name)}" loading="lazy" width="488" height="680">`:`<span class="entry-art-fallback">${esc(e.card.name)}<small>${esc(e.card.type_line)}</small></span>`}</button>`;
  return `<article class="deck-entry ${visual?'visual-card':'text-card'}${key===previewKey?' is-previewed':''}" data-card-draggable data-preview-entry="${esc(key)}"${visual?` tabindex="0" aria-label="${esc(e.card.name)} · ${zone} · ${e.qty} ${e.qty===1?'copy':'copies'}${variant}"`: ''}>${visual?`${badge}<div class="card-side-controls">${quantity}${menu}</div>${art}${stackCardMeta(e)}`:`${badge}<button class="deck-card-name" title="${esc(e.card.name)}${variant}" data-inspect="${esc(e.card.id)}" data-entry="${esc(key)}">${esc(e.card.name)}${e.finish?`<small class="deck-card-variant">${esc(String(e.card.set||'').toUpperCase()||e.card.set_name||'Set unknown')} · #${esc(e.card.collector_number||'?')} · ${e.finish}</small>`:''}</button><span class="row-mana">${mana(e.card.mana_cost||e.card.card_faces?.[0]?.mana_cost)}</span>${quantity}${menu}`}</article>`;
}
function deckList(d, full=false) {
  const filtered = full ? deckEntries(d, editorOptions) : d.cards;
  const filtering = full && Boolean(editorOptions.search.trim());
  const visual = full && editorOptions.layout.startsWith('visual');
  const zones = ['command', 'main', 'sideboard', 'maybeboard'].map(zone => [zone, ZONES[zone], zoneCount(d, zone)]);
  const zoneCounts = zones.map(([,label,qty]) => `<span>${label}: ${qty}</span>`).join('');
  const zoneSections = zones.map(([zone,label,qty]) => {
    if (qty === 0 && ['sideboard', 'maybeboard'].includes(zone)) return '';
    const entries = filtered.filter(e => zoneFor(e) === zone);
    const grouping = full && zone !== 'command' ? editorOptions.group : 'none';
    const groups = new Map();
    for (const entry of entries) {
      const group = grouping === 'role' ? primaryRole(entry) : grouping === 'type' ? category(entry.card) : '';
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(entry);
    }
    const groupSections = [...groups].map(([group,items]) => {
      const cards = items.map(e => {
        const atLimit=deckCardCopies(d,e.card,zone)>=500;
        if (visual) return `<div class="card-slot">${deckEntry(e,atLimit)}</div>`;
        if (full) return deckEntry(e,atLimit);
        const key = esc(entryKey(e)), name = esc(e.card.name);
        return `<div class="deck-row"><span class="qty">${e.qty}</span><span class="deck-name-wrap"><button class="deck-card-name" data-inspect="${esc(e.card.id)}" data-entry="${key}">${name}</button></span><div class="row-actions"><button data-zone-minus="${key}" aria-label="Remove one ${name} from ${label}">−</button><button data-zone-plus="${key}" aria-label="Add one ${name} to ${label}" ${atLimit?'disabled':''}>+</button></div></div>`;
      }).join('');
      const target = grouping === 'role' && items.some(e => e.tags[0] === group)
        ? ` data-drop-zone="${zone}" data-drop-function="${esc(group)}" data-drop-label="Add to ${esc(group)}"` : '';
      const groupQty = group ? count({ cards: items }) : 0;
      const summary = group ? `<h4>${esc(group)} <span>· ${groupQty} ${filtering ? 'shown' : groupQty === 1 ? 'card' : 'cards'}</span></h4><p class="deck-group-price">${deckPriceTotal(items)}</p>` : '';
      return `<section class="deck-group"${target}>${summary}<div class="deck-group-items" style="--stack-divisor:${Math.max(1, items.length - 2)}">${cards}</div></section>`;
    }).join('');
    const shown = filtering ? ` · ${count({ cards: entries })} shown` : '';
    const price = full ? `<span class="deck-zone-price"> · ${deckPriceTotal(entries)}${filtering ? ' for shown cards' : ''}</span>` : '';
    const empty = `<p class="hint">${full && qty ? 'No cards match these filters.' : 'No cards in this zone.'}</p>`;
    return `<section class="deck-zone"${full ? ` data-drop-zone="${zone}"` : ''}><h3>${label} · ${qty}${shown}${price}</h3><div class="deck-group-list">${groupSections || empty}</div></section>`;
  }).join('');
  const priceNote = full ? '<p class="deck-price-note">Stored USD estimates use the selected finish or the default for older entries.</p>' : '';
  return `<div class="zone-counts" aria-label="Deck zone counts">${zoneCounts}</div>${priceNote}<div class="deck-zones ${full ? esc(editorOptions.layout) : 'tracker-zones'}">${zoneSections}</div>`;
}
function finishCardDrag() {
  cardDragPress=null;
  if(!cardDrag)return;
  suppressCardClick=true;
  if(cardDrag.source.hasPointerCapture?.(cardDrag.pointerId))cardDrag.source.releasePointerCapture(cardDrag.pointerId);
  cancelAnimationFrame(cardDrag.frame);
  cardDrag.target?.classList.remove('is-drop-target');
  cardDrag.source.classList.remove('is-dragging');
  cardDrag.originGroup?.classList.remove('is-drag-origin');
  cardDrag.ghost?.remove();
  if(cardDrag.source.contains(document.activeElement))document.activeElement.blur();
  cardDrag=null;
  delete document.documentElement.dataset.cardDragging;
  $('#deck-drag-targets').hidden=true;
}
function cardDropTarget(node) {
  if(!cardDrag || view!=='deck' || deckTab!=='cards' || current()!==cardDrag.deck)return null;
  const target=node?.closest('[data-drop-trash], [data-drop-new-function], [data-drop-function], [data-drop-zone]');
  if(!target || !$('#editor-card-area').contains(target))return null;
  const zone=target.dataset.dropZone,entry=cardDrag.deck.cards.find(e=>entryKey(e)===cardDrag.key);
  if(!entry || (zone!==undefined && !Object.hasOwn(ZONES,zone)))return null;
  if(target.dataset.dropFunction!==undefined) {
    if(zone==='command' || editorOptions.group!=='role' || !cardDrag.deck.cards.some(e=>zoneFor(e)===zone && e.tags[0]===target.dataset.dropFunction))return null;
    if(zone===cardDrag.zone && primaryRole(entry)===target.dataset.dropFunction)return null;
  }else if(zone===cardDrag.zone)return null;
  return target;
}
function positionDraggedCard(x,y) {
  const {ghost,offsetX,offsetY}=cardDrag;
  ghost.style.transform=`translate(${x-offsetX}px,${y-offsetY}px)`;
}
function highlightCardDrop(node) {
  const target=cardDropTarget(node);
  if(target!==cardDrag.target){cardDrag.target?.classList.remove('is-drop-target');target?.classList.add('is-drop-target');cardDrag.target=target;}
  return target;
}
function scrollCardDrag() {
  if(!cardDrag)return;
  const {x,y}=cardDrag;
  if(x!==null && x>=0 && x<innerWidth && y>=0 && y<innerHeight) {
    const node=document.elementFromPoint(x,y);
    if(!node?.closest('#deck-drag-targets')) {
      const top=$('.workspace-nav').getBoundingClientRect().bottom+56;
      const speed=y<top?-Math.min(16,(top-y)/4):y>innerHeight-64?Math.min(16,(y-innerHeight+64)/4):0;
      if(speed)scrollBy({top:speed,behavior:'instant'});
    }
    highlightCardDrop(document.elementFromPoint(x,y));
  }
  cardDrag.frame=requestAnimationFrame(scrollCardDrag);
}
// Leave touch scrolling and keyboard controls native. Mouse/trackpad dragging uses
// the same pointer events as the existing tracker resize, without browser image drags.
$('#app').addEventListener('dragstart',e=>{if(e.target.closest('[data-card-draggable]'))e.preventDefault();});
$('#app').addEventListener('pointerdown',e=>{
  suppressCardClick=false;
  if(e.pointerType!=='mouse' || e.button!==0)return;
  const source=e.target.closest('[data-card-draggable]'),button=e.target.closest('button');
  if(!source || (button&&!button.matches('[data-inspect]')) || view!=='deck' || deckTab!=='cards')return;
  const d=current(),key=source.dataset.previewEntry,entry=d?.cards.find(e=>entryKey(e)===key);
  if(entry)cardDragPress={deck:d,key,zone:zoneFor(entry),source,pointerId:e.pointerId,x:e.clientX,y:e.clientY};
});
addEventListener('pointermove',e=>{
  if(!cardDrag && cardDragPress && e.pointerId===cardDragPress.pointerId) {
    if(Math.hypot(e.clientX-cardDragPress.x,e.clientY-cardDragPress.y)<6)return;
    cardDrag={...cardDragPress,target:null,frame:0};cardDragPress=null;
    closeCardActions(false);
    cardDrag.source.setPointerCapture(e.pointerId);
    cardDrag.source.classList.add('is-dragging');document.documentElement.dataset.cardDragging='true';
    const entry=cardDrag.deck.cards.find(entry=>entryKey(entry)===cardDrag.key);
    if(!entry){finishCardDrag();return;}
    cardDrag.originGroup=cardDrag.source.closest('[data-drop-function]');
    cardDrag.originGroup?.classList.add('is-drag-origin');
    const rect=cardDrag.source.getBoundingClientRect(),ghost=cardDrag.source.cloneNode(true);
    ghost.id='dragged-card';ghost.inert=true;ghost.setAttribute('aria-hidden','true');
    ghost.classList.remove('is-dragging','is-previewed');ghost.classList.add('card-drag-ghost');
    ghost.style.width=rect.width+'px';ghost.style.height=rect.height+'px';
    cardDrag.ghost=ghost;cardDrag.offsetX=cardDrag.x-rect.left;cardDrag.offsetY=cardDrag.y-rect.top;
    document.body.append(ghost);positionDraggedCard(e.clientX,e.clientY);
    $('#deck-drag-label').textContent=`${entry.card.name} · ${entry.qty} ${entry.qty===1?'copy':'copies'} · ${ZONES[zoneFor(entry)]}`;
    $('#deck-drag-targets').hidden=false;
    cardDrag.frame=requestAnimationFrame(scrollCardDrag);
  }
  if(!cardDrag || e.pointerId!==cardDrag.pointerId)return;
  e.preventDefault();cardDrag.x=e.clientX;cardDrag.y=e.clientY;
  positionDraggedCard(e.clientX,e.clientY);
  highlightCardDrop(document.elementFromPoint(e.clientX,e.clientY));
});
addEventListener('pointerup',e=>{
  if(!cardDrag){cardDragPress=null;return;}
  if(e.pointerId!==cardDrag.pointerId)return;
  e.preventDefault();
  const target=cardDropTarget(document.elementFromPoint(e.clientX,e.clientY)),{deck:d,key}=cardDrag;
  finishCardDrag();
  if(!target)return;
  const entry=d.cards.find(e=>entryKey(e)===key);if(!entry)return;
  try {
    if(target.dataset.dropTrash!==undefined){removeCopiesDialog(d,key);return;}
    if(target.dataset.dropNewFunction!==undefined){assignFunctionDialog(d,key);return;}
    if(target.dataset.dropFunction!==undefined){
      const zone=target.dataset.dropZone,name=target.dataset.dropFunction;
      changeNamedDeck(d,deck=>{
        // Stage both operations: a Function validation failure must not leave a zone move behind.
        const staged={...deck,cards:deck.cards.map(e=>({...e,tags:[...e.tags]}))};
        const moved=moveEntry(staged,key,zone);
        assignEntryFunction(staged,entryKey(moved),name);
        deck.cards=staged.cards;
      });
      toast(`Added ${entry.card.name} to ${name}`);
    }
    else {const zone=target.dataset.dropZone;changeNamedDeck(d,deck=>moveEntry(deck,key,zone));toast('All entry copies moved to '+ZONES[zone]);}
  }catch(error){toast(error.message);}
});
addEventListener('pointercancel',finishCardDrag);
addEventListener('blur',finishCardDrag);
addEventListener('keydown',e=>{if(e.key==='Escape'&&(cardDrag||cardDragPress)){e.preventDefault();finishCardDrag();}});

function closeCardSubmenu(restore=false) {
  const menu=$('#card-actions'),previous=menu.dataset.submenu,sub=$('#card-submenu');
  if(sub?.matches(':popover-open'))sub.hidePopover();
  menu.dataset.submenu='';menu.dataset.keyboard='false';
  menu.querySelectorAll('[aria-haspopup="menu"]').forEach(button=>button.setAttribute('aria-expanded','false'));
  if(restore&&previous)menu.querySelector(`[data-card-action="${previous}-menu"]`)?.focus();
}
function closeCardActions(restore=true) {
  closeCardSubmenu();
  const menu=$('#card-actions');
  if(menu.matches?.(':popover-open'))menu.hidePopover();
  cardActionTrigger?.setAttribute('aria-expanded','false');
  if(restore && cardActionTrigger?.isConnected)cardActionTrigger.focus();
}
function positionCardSubmenu() {
  const menu=$('#card-actions');if(!menu.dataset.submenu)return;
  const parent=menu.querySelector(`[data-card-action="${menu.dataset.submenu}-menu"]`),sub=$('#card-submenu');
  const anchor=parent.getBoundingClientRect(),preferred=Math.min(270,Math.floor((innerWidth-32)/2));
  const right=innerWidth-16-anchor.right,left=anchor.left-16,opensLeft=right<preferred&&left>right;
  const width=Math.min(preferred,Math.max(left,right));
  sub.style.width=width+'px';
  sub.style.left=(opensLeft?anchor.left-width:anchor.right)+'px';
  sub.style.top=Math.max(16,Math.min(anchor.top,innerHeight-sub.getBoundingClientRect().height-16))+'px';
}
function positionCardActions() {
  const menu=$('#card-actions');
  menu.style.width=Math.min(270,Math.floor((innerWidth-32)/2))+'px';
  const anchor=cardActionTrigger.getBoundingClientRect(),{height,width}=menu.getBoundingClientRect();
  menu.style.left=Math.max(16,Math.min(anchor.right-width,innerWidth-width-16))+'px';
  menu.style.top=Math.max(16,Math.min(anchor.bottom+6,innerHeight-height-16))+'px';
  positionCardSubmenu();
}
function showCardSubmenu(type,focus=false) {
  const menu=$('#card-actions'),sub=$('#card-submenu'),d=decks.find(d=>d.id===menu.dataset.deck),entry=d?.cards.find(e=>entryKey(e)===menu.dataset.entry);
  if(!entry || current()!==d){closeCardActions();toast('This card entry is no longer available in this view.');return;}
  if(menu.dataset.submenu!==type) {
    closeCardSubmenu();
    const action=(value,label,attributes='',role='menuitem')=>`<button role="${role}" data-card-action="${value}" ${attributes}>${label}</button>`;
    let items;
    if(type==='function') {
      const functions=[...new Set(d.cards.flatMap(e=>e.tags))].sort((a,b)=>a.localeCompare(b));
      items=functions.map(name=>action('assign-function',esc(name),`data-function="${esc(name)}" aria-checked="${primaryRole(entry)===name}"`,'menuitemradio')).join('')+action('new-function','Add new function…');
    } else {
      items=Object.entries(ZONES).filter(([z])=>z!==zoneFor(entry)).map(([z,label])=>action('move:'+z,label)).join('');
    }
    sub.innerHTML=items;sub.scrollTop=0;
    sub.setAttribute('aria-label',`${type==='function'?'Functions':'Move destinations'} for ${entry.card.name} in ${d.name} · ${ZONES[zoneFor(entry)]}`);
    menu.dataset.submenu=type;
    menu.querySelector(`[data-card-action="${type}-menu"]`).setAttribute('aria-expanded','true');
    sub.showPopover();positionCardSubmenu();
  }
  menu.dataset.keyboard=String(focus);
  if(focus)sub.querySelector('button:not(:disabled)')?.focus();
}
function renderCardActions() {
  const menu=$('#card-actions'),d=decks.find(d=>d.id===menu.dataset.deck),entry=d?.cards.find(e=>entryKey(e)===menu.dataset.entry);
  if(!entry || current()!==d){closeCardActions();return;}
  const action=(value,label,attributes='')=>`<button role="menuitem" data-card-action="${value}" ${attributes}>${label}</button>`;
  const submenu='aria-haspopup="menu" aria-expanded="false" aria-controls="card-submenu"';
  menu.setAttribute('aria-label',`Card actions for ${entry.card.name} in ${d.name} · ${ZONES[zoneFor(entry)]}`);
  menu.innerHTML=`<h3>${esc(entry.card.name)}</h3>`+action('details','Open details')+action('function-menu','Assign card to function… <span aria-hidden="true">›</span>',submenu)+action('move-menu','Move to… <span aria-hidden="true">›</span>',submenu)+action('edit-printing','Change in-deck card details')+action('copy-name','Copy card name')+action('copy-deck','Add to another deck…',decks.length<2?'disabled':'')+action('remove','Delete card')+'<div id="card-submenu" popover="manual" role="menu"></div>';
  menu.scrollTop=0;
  menu.showPopover();positionCardActions();
  menu.querySelector(':scope > button:not(:disabled)')?.focus();
}
function openCardActions(key,trigger) {
  closeCardActions(false);
  const d=current(),entry=d?.cards.find(e=>entryKey(e)===key);if(!entry)return;
  const menu=$('#card-actions');cardActionTrigger=trigger;menu.dataset.deck=d.id;menu.dataset.entry=key;
  renderCardActions();trigger.setAttribute('aria-expanded','true');
}
function focusCardEntry(d,key) {
  if(current()!==d || typeof CSS==='undefined')return;
  document.querySelector('[data-card-menu="'+CSS.escape(key)+'"]')?.focus();
}
function assignFunctionDialog(d,key) {
  const entry=d.cards.find(e=>entryKey(e)===key);if(!entry)return;
  showDialog(`<h2>Add a function</h2><p>${esc(entry.card.name)} · ${esc(d.name)} · ${ZONES[zoneFor(entry)]}. The new function becomes primary; other functions stay assigned.</p><form id="function-form"><label>Function name<input name="new-function" required maxlength="80" placeholder="e.g. Graveyard setup"></label><p id="function-error" role="alert"></p><button class="primary">Create and assign</button></form>`);
  $('#function-form').onsubmit=e=>{e.preventDefault();try{const name=String(new FormData(e.target).get('new-function')||'');changeNamedDeck(d,deck=>assignEntryFunction(deck,key,name));$('#dialog').close();focusCardEntry(d,key);toast(`Added ${entry.card.name} to ${name.trim()}`);}catch(error){$('#function-error').textContent=error.message;}};
  $('#function-form input').focus();
}
function removeCopiesDialog(d,key) {
  const entry=d.cards.find(e=>entryKey(e)===key);if(!entry)return;
  const matches=d.cards.filter(e=>cardKey(e.card)===cardKey(entry.card)),total=matches.reduce((n,e)=>n+e.qty,0);
  showDialog(`<h2>Delete ${esc(entry.card.name)}?</h2><p>Remove ${total} ${total===1?'copy':'copies'} from ${esc(d.name)} across all zones, including Maybeboard.</p><p>${matches.map(e=>`${ZONES[zoneFor(e)]}: ${e.qty}`).join(' · ')}</p><div class="workspace-actions"><button id="keep-copies" class="secondary">Keep cards</button><button id="remove-copies" class="danger">Delete ${total} ${total===1?'copy':'copies'}</button></div><p id="remove-copies-error" role="alert"></p>`);
  $('#keep-copies').onclick=()=>$('#dialog').close();$('#keep-copies').focus();
  $('#remove-copies').onclick=()=>{try{changeNamedDeck(d,deck=>removeCardCopies(deck,key));$('#dialog').close();$('#deck-title')?.focus();toast('All copies removed from '+d.name);}catch(error){$('#remove-copies-error').textContent=error.message;}};
}
function confirmCommanderRemoval(d,entry,remove) {
  if(zoneFor(entry)!=='command'||deckCardCopies(d,entry.card,'command')!==1)return false;
  const dialog=$('#commander-removal'),error=$('#commander-removal-error');
  $('#commander-removal-title').textContent=`Remove ${entry.card.name}?`;
  $('#commander-removal-description').textContent=`This removes the last copy of this commander from the Command zone in ${d.name}.`;
  error.hidden=true;error.textContent='';
  $('#confirm-commander-removal').onclick=()=>{
    if(!decks.includes(d)||!d.cards.includes(entry)||zoneFor(entry)!=='command'||deckCardCopies(d,entry.card,'command')!==1){
      error.hidden=false;error.textContent='This commander entry changed. Close this dialog and review the deck.';return;
    }
    dialog.close();remove();
  };
  dialog.showModal();
  return true;
}
$('#card-actions').addEventListener('click',async e=>{
  const button=e.target.closest('[data-card-action]');if(!button){if(!$('#card-submenu').contains(e.target))closeCardSubmenu();return;}if(button.disabled)return;
  const menu=$('#card-actions'),d=decks.find(x=>x.id===menu.dataset.deck),key=menu.dataset.entry,entry=d?.cards.find(e=>entryKey(e)===key);
  if(!d||!entry||current()!==d){closeCardActions();toast('This card entry is no longer available in this view.');return;}
  const action=button.dataset.cardAction;
  if(action==='function-menu'||action==='move-menu'){showCardSubmenu(action==='function-menu'?'function':'move',e.detail===0);return;}
  closeCardActions();
  try{
    if(action==='details')inspect(entry.card.id,key);
    if(action==='edit-printing')deckCardDialog(entry.card,{zone:zoneFor(entry),edit:{deck:d,entry,key}});
    if(action==='new-function')assignFunctionDialog(d,key);
    if(action==='assign-function'){
      if(!d.cards.some(e=>e.tags.includes(button.dataset.function)))throw Error('This function is no longer in this deck. Reopen the menu.');
      changeNamedDeck(d,deck=>assignEntryFunction(deck,key,button.dataset.function));focusCardEntry(d,key);toast(`Added ${entry.card.name} to ${button.dataset.function}`);
    }
    if(action==='copy-deck')deckCardDialog(entry.card,{source:{deck:d,entry,key}});
    if(action==='remove')removeCopiesDialog(d,key);
    if(action==='copy-name'){await navigator.clipboard.writeText(entry.card.name);toast('Card name copied');}
    if(action.startsWith('move:')){const zone=action.slice(5),moved=changeNamedDeck(d,deck=>moveEntry(deck,key,zone));focusCardEntry(d,entryKey(moved));toast('All entry copies moved to '+ZONES[zone]);}
  }catch(error){toast(error.message);}
});
$('#card-actions').addEventListener('pointerover',e=>{
  if(e.pointerType==='touch')return;
  const action=e.target.closest('[data-card-action]')?.dataset.cardAction;
  if(action==='function-menu'||action==='move-menu')showCardSubmenu(action==='function-menu'?'function':'move');
});
$('#card-actions').addEventListener('pointerout',e=>{
  const menu=$('#card-actions');if(e.pointerType==='touch'||!menu.dataset.submenu||menu.dataset.keyboard==='true')return;
  const parent=menu.querySelector(`[data-card-action="${menu.dataset.submenu}-menu"]`),next=e.relatedTarget;
  if(parent.contains(next)||$('#card-submenu').contains(next))return;
  closeCardSubmenu();
});
$('#card-actions').addEventListener('keydown',e=>{
  const menu=$('#card-actions'),button=e.target.closest('[data-card-action]'),sub=$('#card-submenu');
  if(e.key==='Escape'||e.key==='ArrowLeft'&&menu.dataset.submenu){e.preventDefault();if(menu.dataset.submenu)closeCardSubmenu(true);else closeCardActions();return;}
  if(e.key==='ArrowRight'&&['function-menu','move-menu'].includes(button?.dataset.cardAction)){e.preventDefault();showCardSubmenu(button.dataset.cardAction==='function-menu'?'function':'move',true);return;}
  if(e.key==='Tab'){closeCardActions();return;}
  if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const scope=sub.contains(e.target)?sub:menu,buttons=[...scope.querySelectorAll(':scope > button:not(:disabled)')],i=buttons.indexOf(document.activeElement);buttons[e.key==='Home'?0:e.key==='End'?buttons.length-1:e.key==='ArrowDown'?(i+1)%buttons.length:(i+buttons.length-1)%buttons.length]?.focus();}
});
addEventListener('resize',()=>{if($('#card-actions').matches(':popover-open'))positionCardActions();});
$('#card-actions').addEventListener('toggle',e=>{if(e.target===$('#card-actions')&&e.newState==='closed'){closeCardSubmenu();cardActionTrigger?.setAttribute('aria-expanded','false');}});
addEventListener('scroll',e=>{const menu=$('#card-actions');if(!menu.contains(e.target))closeCardActions(false);else if(e.target===menu)positionCardSubmenu();},true);
const formatLabel = format => format.charAt(0).toUpperCase()+format.slice(1);
function deckMenu(d) {
  return `<details class="deck-menu" name="deck-actions"><summary aria-label="Deck actions for ${esc(d.name)}" title="Deck actions">${icon('more',20)}</summary><div class="deck-menu-actions">${[['rename','Rename / format'],['import','Import cards'],['export','Export deck'],['duplicate','Duplicate'],['delete','Delete deck…']].map(([action,label])=>`<button class="${action==='delete'?'danger':''}" data-manage="${action}" data-target="${esc(d.id)}">${label}</button>`).join('')}</div></details>`;
}
function deckCover(d) {
  const commander=d.cards.find(e=>zoneFor(e)==='command');
  const entry=commander || d.cards.find(e=>zoneFor(e)==='main' && safeUrl(imageFor(e.card),true));
  const card=entry?.card;
  const art=card && safeUrl(card.image_uris?.art_crop || card.card_faces?.[0]?.image_uris?.art_crop,true);
  const image=art || (card && safeUrl(imageFor(card),true));
  return `<button class="deck-cover${image&&!art?' cover-portrait':''}" data-deck="${esc(d.id)}" aria-label="Open ${esc(d.name)}">${image?`<img src="${esc(image)}" alt="${esc(card.name)}" loading="lazy">`:icon('cards',62)}<span>${esc(formatLabel(d.format))}</span></button>`;
}
function library() {
  return `<div class="library"><div class="page-heading"><div><h1 tabindex="-1" id="library-title">My decks</h1><p>Choose a deck to continue building.</p></div><div class="workspace-actions"><button class="primary" data-action="new">${icon('plus',17)} New deck</button><button class="secondary" data-action="import-new">Import deck</button></div></div>${decks.length?`<div class="deck-library">${decks.map(d=>`<article class="library-deck" aria-label="${esc(d.name)}">${deckCover(d)}<div class="library-deck-body"><h2><button data-deck="${esc(d.id)}">${esc(d.name)}</button></h2>${deckMenu(d)}${identitySummary(d,true)}${d.format==='commander'?`<p class="assigned-bracket">${d.bracket?'Bracket '+d.bracket+' · '+BRACKETS[d.bracket]:'No bracket assigned'}</p>`:''}</div></article>`).join('')}</div>`:`<div class="welcome-state"><h2>No decks yet.</h2><p>Create one, import a decklist, or try a small example.</p><button class="secondary" data-action="sample">Try an example deck</button></div>`}</div>`;
}

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
  showDialog(`<h2>Export ${esc(deck.name)}</h2><p>JSON preserves every card, quantity, zone, ordered role tag and player-assigned bracket. Text includes names, quantities and zone headings, but loses roles, printing details and assigned brackets.</p><div class="workspace-actions"><button class="primary" id="export-json">Complete JSON backup</button><button class="secondary" id="export-text">Text decklist</button></div>`);
  $('#export-json').onclick=()=>saveWorkspaceCopy([deck],deck.name+'.json');
  $('#export-text').onclick=()=>download(deck.name+'.txt',exportDeckText(deck),'text/plain');
}

function readFilters() {
  const input=$('#raw');if(view==='explore'&&typeof input?.value==='string'&&input.value!==filters.query){filters=parseQuery(input.value);colorTarget='';}
}
function resetResults(){++requestId;loading=false;results=[];total=0;more=false;searched=false;error='';resultContext=null;broadening=null;}
function clearSearch(){
  filters=parseQuery('');
  colorTarget='';
  tagSearch='';
  browsedTag='';
  tagLimit=30;
  resetResults();
}
function resetExplore(){
  clearSearch();
  tracker.id='';
  filtersOpen=tagsOpen=broadeningOpen=false;
  openFilterFamilies.clear();
  page=1;
  visibleLimit=24;
  order='edhrec';
}
function runGuidedSearch(keepForm=false){if(!filters.query.trim()){resetResults();renderSearchState(keepForm);}else search(false,false,keepForm);}
function setCondition(family,model,run=true,keepForm=false){
  try{
    const previous=filters,clause=conditionQuery(model,family),next=replaceCondition(filters,family,clause);
    if(next.error)throw Error(next.error);
    filters=next;
    // One operand cannot encode AND versus OR; retain the player's equivalent guided intent.
    // Typing in the raw query still rebuilds projections solely from that query.
    for(const key of SEARCH_FAMILIES){
      if(filters.locked.includes(key))continue;
      const source=family===key?model:previous;
      const fields=key==='type'?['types','excludedTypes','typeMatch']:key==='keyword'?['keywords','keywordMatch']:key==='mv'?['values','valueMatch']:key==='oracle'?['oracle','oracleMatch']:key==='cost'?['cost','costMatch']:key==='tags'?['tags','match']:[key];
      for(const field of fields)filters[field]=source[field];
    }
    const guidedError=$('#guided-error');
    if(guidedError)guidedError.textContent='';
    if(run)runGuidedSearch(keepForm);
    else{if(!filters.query.trim())resetResults();++requestId;loading=false;error='';broadening=null;renderSearchState(true);}
    return true;
  }
  catch(error){const node=$('#guided-error');if(node)node.textContent=error.message;toast(error.message);return false;}
}
function applyGuided(family,run=true,keepForm=false){
  const data=new FormData($('#guided-form')),model=structuredClone(filters);
  if(['name','legal'].includes(family))model[family]=String(data.get(family)||'');
  if(family==='oracle'){model.oracle=Array.from({length:Math.max(1,filters.oracle.length)},(_,i)=>({mode:String(data.get('oracle-mode-'+i)),text:String(data.get('oracle-'+i)||'')}));model.oracleMatch=String(data.get('oracle-match'));}
  if(family==='type')model.typeMatch=String(data.get('type-match'));
  if(family==='keyword')model.keywordMatch=String(data.get('keyword-match'));
  if(family==='mv'){model.values=Array.from({length:Math.max(1,filters.values.length)},(_,i)=>({op:String(data.get('mv-op-'+i)),value:String(data.get('mv-'+i)||'')}));model.valueMatch=String(data.get('value-match'));}
  if(family==='color'||family==='identity'){
    const mode=String(data.get(family+'-mode'));
    colorTarget=family;
    model[family]={mode,values:colorSelectionDisabled(mode)?[]:Object.keys(colorNames).filter(c=>data.get(family+'-'+c))};
  }
  if(family==='cost'){
    model.cost=Array.from({length:Math.max(1,filters.cost.length)},(_,i)=>({
      symbol:String(data.get('cost-symbol-'+i)),op:String(data.get('cost-op-'+i)),amount:String(data.get('cost-'+i)||'')
    }));
    model.costMatch=String(data.get('cost-match'));
  }
  return setCondition(family,model,run,keepForm);
}
function showChipSuggestions(input) {
  const list = document.getElementById(input.getAttribute('aria-controls'));
  const query = input.value.trim().toLowerCase();
  const { catalog } = chipFields[input.name];
  const selected = filters[input.name];
  if (!query) { list.hidden = true; return; }
  const available = catalog.filter(choice => !selected.includes(choice.toLowerCase()));
  const prefix = available.filter(choice => choice.toLowerCase().startsWith(query));
  const others = available.filter(choice => choice.toLowerCase().includes(query) && !prefix.includes(choice));
  const matches = [...prefix, ...others].slice(0, 12);
  list.innerHTML = matches.map(choice => `<button type="button" data-add-chip="${esc(choice.toLowerCase())}">${esc(choice)}</button>`).join('')
    || '<p class="hint" role="status">No matching suggestions.</p>';
  list.hidden = false;
}
function editChips(picker, values) {
  const name = picker.dataset.chipPicker;
  const family = picker.closest('[data-family]').dataset.family;
  const previous = filters.query;
  if (!setCondition(family,{ ...filters, [name]: values },false)) return;
  picker.outerHTML = chipPicker(name);
  $('#guided-form').elements.namedItem(name).focus();
  if (filters.query !== previous) runGuidedSearch(true);
}
function clearGuidedField(form, button, family) {
  const input = form.elements.namedItem(button.dataset.clearFilter);
  if (family === 'color' || family === 'identity') {
    input.value = 'all';
    for (const color of button.closest('fieldset').querySelectorAll('input[type="checkbox"]')) {
      color.checked = false;
      color.disabled = false;
    }
  } else input.value = '';
  const previous = filters.query;
  if (applyGuided(family,false) && filters.query !== previous) runGuidedSearch(true);
  input.focus();
}
function bindGuided(){
  $('#guided-form')?.addEventListener('toggle',e=>{
    const family=e.target.dataset.guidedFamily;
    if(!family||!e.target.isConnected)return;
    if(e.target.open)openFilterFamilies.add(family);else openFilterFamilies.delete(family);
  },true);
  $('#guided-form')?.addEventListener('input',e=>{
    if(e.target.hasAttribute('data-chip-input')){showChipSuggestions(e.target);return;}
    const family=e.target.closest('[data-family]')?.dataset.family;if(family)applyGuided(family,false);
  });
  $('#guided-form')?.addEventListener('change',e=>{
    if(e.target.hasAttribute('data-chip-input'))return;
    if(e.target.name==='color-target'){
      colorTarget=e.target.value;
      refreshSearchTools();
      $('#guided-form [name="color-target"]').focus();
      return;
    }
    const field=e.target.closest('[data-family]'),family=field?.dataset.family;
    const color=family==='color'||family==='identity';
    if(color&&e.target.name===family+'-mode'){
      const disabled=colorSelectionDisabled(e.target.value);
      for(const checkbox of field.querySelectorAll('input[type="checkbox"]')){
        checkbox.disabled=disabled;
        if(disabled)checkbox.checked=false;
      }
    }
    if(family)applyGuided(family,true,color||family==='cost'||e.target.tagName==='INPUT');
  });
  $('#guided-form')?.addEventListener('click',e=>{
    const button=e.target.closest('button[data-clear-filter],button[data-add-chip],button[data-remove-chip]');
    if(!button)return;
    const picker=button.closest('[data-chip-picker]');
    if(!picker){clearGuidedField(e.currentTarget,button,button.closest('[data-family]').dataset.family);return;}
    const selected=filters[picker.dataset.chipPicker];
    const values=button.dataset.addChip?[...selected,button.dataset.addChip]:button.dataset.removeChip?selected.filter(value=>value!==button.dataset.removeChip):[];
    editChips(picker,values);
  });
  $('#guided-form')?.addEventListener('focusout',e=>{
    const picker=e.target.closest('[data-chip-picker]');
    if(picker && e.relatedTarget && !picker.contains(e.relatedTarget))picker.querySelector('.chip-suggestions').hidden=true;
  });
  $('#guided-form')?.addEventListener('focusin',e=>{
    if(e.target.matches('[data-chip-input]'))showChipSuggestions(e.target);
  });
  $('#guided-form')?.addEventListener('keydown',e=>{
    const picker=e.target.closest('[data-chip-picker]');
    if(!picker)return;
    const input=picker.querySelector('[data-chip-input]'),list=picker.querySelector('.chip-suggestions');
    if(e.key==='Escape'&&!list.hidden){e.preventDefault();input.focus();list.hidden=true;return;}
    if(e.key==='Enter'&&e.target===input){
      e.preventDefault();
      if(!list.hidden)list.querySelector('button')?.click();
      return;
    }
    if(list.hidden || !['ArrowDown','ArrowUp'].includes(e.key) || (e.target!==input&&!list.contains(e.target)))return;
    const options=[...list.querySelectorAll('button')],index=options.indexOf(e.target);
    e.preventDefault();
    const next=e.key==='ArrowDown'?Math.min(index+1,options.length-1):index-1;
    (options[next]||input).focus();
  });
  $('#guided-form')?.addEventListener('submit',e=>{e.preventDefault();const family=document.activeElement?.closest('[data-family]')?.dataset.family;if(family)applyGuided(family,true,true);else search(false,false,true);});
}
function refreshSearchTools(){
  $('#query-notes').innerHTML=queryNotes();$('#applied-filter-summary').textContent=appliedFiltersSummary();$('#guided-controls').innerHTML=guidedControls();refreshFunctionFilters();
  refreshSearchOutput();
  bindGuided();
}
function refreshSearchOutput(){
  const focusSort = document.activeElement?.id === 'sort';
  $('#search-output').innerHTML=searchResults()+broadeningTools();
  bindSearchOutput();
  if (focusSort) $('#sort')?.focus({ preventScroll: true });
}
function bindSearchOutput(){
  $('#broadening-tools')?.addEventListener('toggle',e=>{if(e.target.isConnected)broadeningOpen=e.target.open;});
  $('#sort')?.addEventListener('change',e=>{readFilters();order=e.target.value;search(false,true,true);});
}
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
  for(const key of ['view','group','sort'])$('#collection-'+key)?.addEventListener('change',e=>{collectionOptions[key]=e.target.value;saveCollectionOptions();render();});
  $('#collection-filter')?.addEventListener('input',e=>{collectionOptions.filter=e.target.value;saveCollectionOptions();const container=document.createElement('div');container.innerHTML=collectionPage();$('#collection-results').innerHTML=container.querySelector('#collection-results').innerHTML;});
  $('#tracked-deck')?.addEventListener('change',e=>trackDeck(e.target.value));
  bindTrackerResize();
  $('#assigned-bracket')?.addEventListener('change',e=>{const d=current();if(!d || d.format!=='commander')return;const value=Number(e.target.value);if(e.target.value && !Object.hasOwn(BRACKETS,value))return;if(e.target.value)d.bracket=value;else delete d.bracket;d.updated=new Date().toISOString();save();render();$('#assigned-bracket')?.focus();});
  for(const key of ['layout','group','order'])$('#editor-'+key)?.addEventListener('change',e=>{editorOptions[key]=e.target.value;render();});
  $('#editor-search')?.addEventListener('input',e=>{editorOptions.search=e.target.value;const d=current();if(view==='deck' && d)$('#editor-card-area').outerHTML=deckCards(d);});
  $('#deck-budget')?.addEventListener('change',e=>{const d=current();if(!d)return;const value=e.target.value.trim();if(!value)delete d.budgetCents;else{const cents=parseEuroCents(value);if(cents===null){toast('Enter a EUR amount with at most two decimals.');render();return;}d.budgetCents=cents;}d.updated=new Date().toISOString();save();render();});
  $('#budget-basis')?.addEventListener('change',e=>{const d=current();if(!d)return;d.budgetBasis=e.target.value;d.updated=new Date().toISOString();save();render();});
  for(const zone of Object.keys(ZONES))$('#budget-zone-'+zone)?.addEventListener('change',e=>{
    const d=current();if(!d)return;
    const zones=new Set(d.budgetZones??DEFAULT_BUDGET_ZONES);
    if(e.target.checked)zones.add(zone);else zones.delete(zone);
    d.budgetZones=[...zones];d.updated=new Date().toISOString();save();render();
  });
  $('#ownership-match')?.addEventListener('change',e=>{const d=current();if(!d)return;d.ownershipMatch=e.target.value;d.updated=new Date().toISOString();save();render();});
  $('#search-filters')?.addEventListener('toggle',e=>{if(e.target.isConnected)filtersOpen=e.target.open;});
  $('#function-tags')?.addEventListener('toggle',e=>{if(e.target.isConnected)tagsOpen=e.target.open;});
  $('#search-form')?.addEventListener('submit',e=>{e.preventDefault();readFilters();search();});
  $('#raw')?.addEventListener('input',e=>{filters=parseQuery(e.target.value);colorTarget='';++requestId;loading=false;error='';broadening=null;if(!filters.query.trim())resetResults();refreshSearchTools();});
  $('#tag-search')?.addEventListener('input',e=>{tagSearch=e.target.value;tagLimit=30;browsedTag='';refreshTagOptions();});
  bindGuided();bindSearchOutput();
}
addEventListener('click',e=>{
  for(const menu of document.querySelectorAll('.deck-menu[open]'))if(!menu.contains(e.target))menu.open=false;
});
$('#app').addEventListener('keydown',e=>{
  const menu=e.target.closest('.deck-menu');if(!menu)return;
  if(e.key==='Escape' && menu.open){e.preventDefault();menu.open=false;menu.querySelector('summary').focus();}
  if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){
    e.preventDefault();menu.open=true;
    const buttons=[...menu.querySelectorAll('button')],index=buttons.indexOf(document.activeElement);
    const next=e.key==='Home'?0:e.key==='End'?buttons.length-1:e.key==='ArrowDown'?(index+1)%buttons.length:(index<0?buttons.length-1:(index+buttons.length-1)%buttons.length);
    buttons[next]?.focus();
  }
});
$('#app').addEventListener('pointerover',e=>{if(e.pointerType==='touch')return;const row=e.target.closest('[data-preview-entry]');if(row)previewEntry(row.dataset.previewEntry);});
$('#app').addEventListener('focusin',e=>{const row=e.target.closest('[data-preview-entry]');if(row)previewEntry(row.dataset.previewEntry);});
$('#app').addEventListener('change',e=>{
  if(e.target.id==='tag-match'){
    applySelectedFunctions({...filters,match:e.target.value}, '#tag-match');
    return;
  }
  if(e.target.dataset?.ownedQuantity!==undefined){updateOwnedQuantity(Number(e.target.dataset.ownedQuantity),e.target.value);return;}
  const key=e.target.dataset?.moveEntry;if(!key)return;
  try{changeDeck(d=>moveEntry(d,key,e.target.value));toast('All copies moved; roles preserved');}catch(error){toast(error.message);render();}
});
$('#app').addEventListener('click',async e=>{
  if(e.detail>0 && suppressCardClick){suppressCardClick=false;e.preventDefault();return;}
  const button=e.target.closest('button, a[data-view], a[data-action]');if(!button)return;readFilters();
  if(button.dataset.removeFilter){
    const family=button.dataset.removeFilter,key=repeatableFilters[family].key,index=Number(button.dataset.filterIndex);
    if(filters.locked.includes(family)||!Number.isInteger(index)||index<0||filters[key].length<2||index>=filters[key].length)return;
    const model=structuredClone(filters),previousQuery=filters.query;model[key].splice(index,1);
    if(setCondition(family,model,false)){
      render();$(`#guided-form [name="${family}-${Math.min(index,model[key].length-1)}"]`)?.focus();
      if(filters.query!==previousQuery)runGuidedSearch(true);
    }
    return;
  }
  if(button.dataset.addFilter){
    const family=button.dataset.addFilter,{key,empty}=repeatableFilters[family];
    if(filters.locked.includes(family))return;
    if(!filters[key].length)filters[key].push(empty());
    filters[key].push(empty());
    render();$(`#guided-form [name="${family}-${filters[key].length-1}"]`)?.focus();return;
  }
  if(button.dataset.collectionSort){const key=button.dataset.collectionSort,current=collectionOptions.sort.replace(/-(asc|desc)$/,'');collectionOptions.sort=current!==key?key:collectionOptions.sort===key?key+(['added','updated','quantity'].includes(key)?'-asc':'-desc'):key;saveCollectionOptions();render();return;}
  if(button.dataset.view){
    e.preventDefault?.();
    view=button.dataset.view;
    if(view==='explore')resetExplore();
    render();
    if(view==='decks')$('#library-title')?.focus();
    else if(view==='collection')$('#collection-title')?.focus();
    else $('#raw')?.focus();
    return;
  }
  if(button.dataset.inspectOwned!==undefined){const lot=collection[Number(button.dataset.inspectOwned)];if(lot)inspect(lot.card.id,null,lot.card);return;}
  if(button.dataset.editOwned!==undefined){collectionLotDialog(null,Number(button.dataset.editOwned));return;}
  if(button.dataset.ownedMinus!==undefined||button.dataset.ownedPlus!==undefined){const index=Number(button.dataset.ownedMinus??button.dataset.ownedPlus),lot=collection[index];if(lot)updateOwnedQuantity(index,lot.qty+(button.dataset.ownedPlus!==undefined?1:-1));return;}
  if(button.dataset.removeOwned!==undefined){removeCollectionLot(Number(button.dataset.removeOwned));return;}
  if(button.dataset.cardMenu){openCardActions(button.dataset.cardMenu,button);return;}
  if(button.dataset.deck){openDeck(button.dataset.deck);return;}
  if(button.dataset.manage){const menu=button.closest?.('.deck-menu');if(menu){menu.open=false;menu.querySelector('summary').focus();}const d=decks.find(d=>d.id===button.dataset.target);if(!d)return;const action=button.dataset.manage;if(action==='rename')deckForm(d);if(action==='duplicate')duplicateDeck(d);if(action==='delete')deleteDeck(d);if(action==='import')importDialog(d);if(action==='export')exportDialog(d);return;}
  if(button.dataset.tab){deckTab=button.dataset.tab;render();return;}
  if(button.dataset.relax){await broaden(button.dataset.relax);return;}
  if(button.dataset.browseTag){browsedTag=button.dataset.browseTag;refreshTagOptions();$('#tag-options .tag-detail h3').tabIndex=-1;$('#tag-options .tag-detail h3').focus();return;}
  if(button.dataset.tag){
    const t=button.dataset.tag, model={...filters,tags:filters.tags.includes(t)?filters.tags.filter(x=>x!==t):[...filters.tags,t]};
    if(button.closest?.('#selected-functions')) applySelectedFunctions(model, '#tag-search');
    else setCondition('tags',model);
    return;
  }

  if(button.dataset.inspect){inspect(button.dataset.inspect,button.dataset.entry);return;}
  if(button.dataset.chooseAdd){chooseDestination(button.dataset.chooseAdd);return;}
  if(button.dataset.add){addCard(button.dataset.add);return;}
  if(button.dataset.zoneMinus || button.dataset.zonePlus){
    const d=current(),key=button.dataset.zoneMinus||button.dataset.zonePlus,entry=d?.cards.find(e=>entryKey(e)===key);
    if(!entry)return;
    if(button.dataset.zonePlus){
      if(deckCardCopies(d,entry.card,zoneFor(entry))<500)changeNamedDeck(d,()=>{entry.qty++;});
    }else{
      const remove=()=>{
        changeNamedDeck(d,()=>{if(--entry.qty===0)d.cards=d.cards.filter(e=>e!==entry);});
        if(entry.qty===0&&view==='explore')$('#tracker-heading')?.focus({preventScroll:true});
      };
      if(!confirmCommanderRemoval(d,entry,remove))remove();
    }
    return;
  }
  const action=button.dataset.action;
  if(action==='bracket-guidance'){e.preventDefault();deckTab='checks';render();const section=$('#bracket-discussion');section?.scrollIntoView({block:'start'});section?.focus({preventScroll:true});return;}
  if(action==='clear-deck-filters'){editorOptions.search='';render();}
  if(action==='toggle-tracker'){tracker.visible=!tracker.visible;saveTracker();render();$('#toggle-tracker')?.focus();}
  if(action==='find-cards'){view='explore';trackDeck(active);$('#raw')?.focus();}
  if(action==='jump-deck'){$('.deck-panel')?.scrollIntoView({behavior:'auto'});$('#tracker-heading')?.focus();}
  if(action==='new') deckForm();
  if(action==='edit'&&current()) openDeck(current().id);
  if(action==='rename') deckForm(current());
  if(action==='settings')settings();
  if(action==='reset'){clearSearch();render();$('#raw')?.focus();}
  if(action==='retry')search(false,true);
  if(action==='restore-search')await restoreSearch();
  if(action==='more')search(true);
  if(action==='more-tags'){
    const previousLimit=tagLimit;tagLimit+=30;refreshTagOptions();
    document.querySelectorAll('#tag-options .tag-choice .tag-option')[previousLimit]?.focus();
  }
  if(action==='sample')sample();
  if(action==='import')importDialog();
  if(action==='import-new')importDialog(null);
  if(action==='export'&&current())exportDialog(current());
  if(action==='backup')saveWorkspaceCopy();
  if(action==='restore')restore();
  if(action==='refresh')refresh();
  if(action==='refresh-prices')await refreshPrices();
  if(action==='add-owned')collectionLotDialog();
  if(action==='import-collection')collectionImport();
  if(action==='clear-collection')clearCollection();
  if(action==='help')showDialog(`<h2>A little guide to Arcana</h2><p>Pick function tags, combine them with Oracle text, then search. “Matching all” narrows your results; “Matching any” broadens them. The editable search bar is the exact query sent to Scryfall. Guided filters update that same query. Query-only expressions stay unchanged; affected controls explain when they cannot edit a complex expression.</p><p>Search names and aliases in the bundled Scryfall Oracle Tags snapshot from ${esc(TAG_CATALOG.updated.slice(0,10))}. Use Related to browse recorded broader and narrower relationships. When a name has no catalog match, add it as an unlisted function to try it in a Scryfall search.</p><p>My decks is the home page. Explore cards opens search; Broaden this search lets you ignore one condition and restore the original query. Create a deck to start adding cards. Open card details to view printings and ownership, or choose Add card to deck to set the destination and primary function.</p><p>Decks save in this browser. Export a JSON backup to move them to another device. Card exploration and import require internet access.</p><p>Modern checks cover main/sideboard size, combined copy limits and stored legality. Checks separates failed rules, unavailable data and manual review. Commander coverage remains partial; review paired commanders and companions manually.</p>`);
});
async function api(url, options) { const r=await fetch(url,options);const data=await r.json();if(!r.ok)throw Object.assign(new Error(data.error || 'Request failed.'),{status:r.status,retryAfter:data.retryAfter});return data; }
// Input blur may happen while the next row is receiving focus. Keep that form in place
// during its search, including when the response arrives after the next keystroke.
function renderSearchState(keepForm=false){
  if(!keepForm||view!=='explore'){render();return;}
  $('#raw').value=filters.query;$('#query-notes').innerHTML=queryNotes();$('#applied-filter-summary').textContent=appliedFiltersSummary();
  refreshSearchOutput();
}
async function search(append=false,keepBroadening=false,keepForm=false) {
  if(filters.error){error=filters.error;loading=false;renderSearchState(keepForm);return;}
  if(!filters.query.trim())filters=parseQuery('game:paper');
  if(!append && (!keepBroadening || (broadening && queryFor(filters,current())!==broadening.query)))broadening=null;
  if(append && visibleLimit < results.length){visibleLimit+=24;renderSearchState(keepForm);return;}
  const context=append&&resultContext ? resultContext : {query:queryFor(filters,current()),order};
  const id=++requestId;loading=true;error='';if(!append){page=1;results=[];visibleLimit=24;}else{visibleLimit+=24;}const requestedPage=append?page+1:1;renderSearchState(keepForm);
  try {const data=await api('/api/search?'+new URLSearchParams({q:context.query,page:requestedPage,...SEARCH_SORTS[context.order].params}));if(id!==requestId)return;results=append?[...results,...data.data]:data.data;resultContext=context;total=data.total_cards;more=data.has_more;page=requestedPage;}
  catch(e){if(id!==requestId)return;error=/0 cards|No cards|didn.t match any cards/i.test(e.message)?'No cards matched these filters. A custom tag may be unsupported. Remove a tag, switch to Match any, or broaden your Oracle text.':e.message;more=false;}
  finally{if(id===requestId){loading=false;searched=true;renderSearchState(keepForm);}}
}
function findCard(id) {return results.find(c=>c.id===id)||current()?.cards.find(e=>e.card.id===id)?.card;}
function addLabel(c) {
  const d=current(), qty=deckCardCopies(d,c,'main');
  return d?`Add ${c.name} to ${d.name} · Main deck (${qty} currently in Main deck)`:`Add ${c.name} to a chosen deck`;
}
function addCard(id,zone='main') {
  const card=findCard(id);
  if(card)deckCardDialog(card,{deck:current(),zone});
}
function chooseDestination(id,zone='main') {
  const card=findCard(id);
  if(card)deckCardDialog(card,{zone});
}
function closeDialog() {$('#dialog').close();}
function showDialog(html) {
  const dialog=$('#dialog');
  dialog.onclose=null;
  dialog.innerHTML=`<button class="dialog-close icon-button" aria-label="Close dialog">${icon('close')}</button>${html}`;
  dialog.scrollTop=0;
  dialog.setAttribute('aria-label',dialog.querySelector('h2')?.textContent || 'Card details');
  if(!dialog.open)dialog.showModal();
  else dialog.querySelector('.dialog-close').focus();
  dialog.querySelector('.dialog-close').onclick=closeDialog;
}
$('#dialog').addEventListener('click',e=>{
  if(e.target!==$('#dialog'))return;
  const r=e.target.getBoundingClientRect();
  if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeDialog();
});
function deckForm(deck,after) {
  if(!deck&&decks.length>=200){toast('Maximum 200 decks per workspace.');return;}
  let commander=null;
  showDialog(`<h2>${deck?'Rename / format':'Create a deck'}</h2><p>You can change the format later and build an incomplete deck.</p><form id="deck-form"><label>Deck name<input name="name" required maxlength="100" value="${esc(deck?.name||'')}" placeholder="e.g. The garden grows"></label><label>Format<select name="format" id="deck-format">${FORMATS.map(f=>`<option ${f===(deck?.format||'commander')?'selected':''}>${f}</option>`).join('')}</select></label>${!deck?`<fieldset id="commander-choice"><legend>Commander (optional)</legend>
    <label>Search commander names<input id="commander-name" role="combobox" aria-autocomplete="list" aria-controls="commander-matches" aria-expanded="false" autocomplete="off" placeholder="e.g. Tatyova" maxlength="200"></label>
    <div id="commander-matches" role="listbox" aria-label="Commander suggestions" hidden></div>
    <p id="commander-status" role="status"></p>
    <div class="commander-actions"><span class="hint">You can add pairings later.</span><button type="button" class="text-button" id="choose-commander-later">Choose later</button></div>
  </fieldset>`:''}<p id="deck-form-error" role="alert"></p><button class="primary" type="submit">${deck?'Save changes':'Create deck'}</button></form>`);
  if(!deck){
    const dialog=$('#dialog'),field=$('#commander-choice'),input=$('#commander-name');
    const matches=$('#commander-matches'),status=$('#commander-status');
    let revision=0,timer,choices=[],activeOption=-1;
    const option=index=>matches.querySelector('#commander-option-'+index);
    const setExpanded=expanded=>{
      matches.hidden=!expanded;
      input.setAttribute('aria-expanded',String(expanded));
      if(!expanded){
        option(activeOption)?.setAttribute('aria-selected','false');
        input.removeAttribute('aria-activedescendant');
        activeOption=-1;
      }
    };
    const resetSuggestions=()=>{
      revision++;
      clearTimeout(timer);
      setExpanded(false);
      choices=[];
      matches.innerHTML='';
      status.textContent='';
    };
    const choose=card=>{
      resetSuggestions();
      commander=card;
      input.value=card?.name??'';
      if(card)status.textContent='Commander selected.';
    };
    $('#deck-format').onchange=e=>{
      field.hidden=e.target.value!=='commander';
      if(field.hidden)choose(null);
    };
    input.oninput=e=>{
      resetSuggestions();
      commander=null;
      const value=input.value.trim();
      if(e.isComposing||!value)return;
      if(value.length<2){status.textContent='Type at least two characters.';return;}
      const version=revision;
      const current=()=>version===revision&&input.isConnected&&dialog.open;
      status.textContent='Searching…';
      timer=setTimeout(async()=>{
        if(!current())return;
        try{
          const literal=value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\//g,'\\/');
          const q='game:paper is:commander f:commander name:/'+literal+'/';
          const data=await api('/api/search?'+new URLSearchParams({q,order:'name'}));
          if(!current())return;
          choices=data.data.slice(0,8);
          matches.innerHTML=choices.map((card,i)=>`<button type="button" role="option" tabindex="-1" id="commander-option-${i}" data-commander-option="${i}" aria-selected="false">${esc(card.name)}</button>`).join('');
          setExpanded(choices.length>0&&document.activeElement===input);
          status.textContent=choices.length?'':'No commanders match that name.';
        }catch(error){
          if(current())status.textContent=error.status===404?'No commanders match that name.':'Could not search commanders. Edit the name to try again.';
        }
      },250);
    };
    input.onfocus=()=>{if(choices.length)setExpanded(true);};
    input.onblur=e=>{if(!matches.contains(e.relatedTarget))setExpanded(false);};
    matches.onclick=e=>{
      const button=e.target.closest('[data-commander-option]');
      if(button){choose(choices[Number(button.dataset.commanderOption)]);input.focus();}
    };
    input.onkeydown=e=>{
      if(e.isComposing)return;
      if(e.key==='Escape'&&!matches.hidden){e.preventDefault();e.stopPropagation();setExpanded(false);}
      if(e.key==='Enter'){
        e.preventDefault();
        if(activeOption>=0)choose(choices[activeOption]);
      }
      if((e.key==='ArrowDown'||e.key==='ArrowUp')&&choices.length){
        e.preventDefault();
        option(activeOption)?.setAttribute('aria-selected','false');
        const step=e.key==='ArrowDown'?1:-1;
        activeOption=activeOption<0?(step===1?0:choices.length-1):(activeOption+step+choices.length)%choices.length;
        setExpanded(true);
        const active=option(activeOption);
        active.setAttribute('aria-selected','true');
        input.setAttribute('aria-activedescendant',active.id);
        active.scrollIntoView({block:'nearest'});
      }
    };
    $('#choose-commander-later').onclick=()=>{choose(null);$('#deck-form button[type=submit]').focus();};
  }
  $('#deck-form').onsubmit=e=>{e.preventDefault();const data=new FormData(e.target),name=String(data.get('name')).trim(),format=String(data.get('format'));if(!name||!FORMATS.includes(format))return;
    if(deck){if(!decks.includes(deck))return;deck.name=name;deck.format=format;deck.updated=new Date().toISOString();save();$('#dialog').close();render();}
    else{if(decks.length>=200){$('#deck-form-error').textContent='Maximum 200 decks per workspace.';return;}const d=blankDeck(name,format);if(format==='commander'&&commander)d.cards.push({card:commander,qty:1,tags:[],zone:'command'});decks.push(d);save();$('#dialog').close();openDeck(d.id);}
    after?.(deck || decks.at(-1));
  };
}
function backupStatus() {
  if(requestedExportSnapshot===null)return 'No workspace file requested this session.';
  return JSON.stringify({decks,collection})===requestedExportSnapshot
    ? 'No further workspace changes since the last file request ('+requestedExportAt+').'
    : 'Workspace changed since the last file request ('+requestedExportAt+'). Save another copy to include these edits.';
}
function updateBackupStatus() {
  const status=$('#backup-status');if(status)status.textContent=backupStatus();
  const error=$('#backup-download-error');if(error)error.textContent=downloadError;
}
function settings() {
  showDialog(`<h2>Workspace settings</h2><p>Appearance and backups for this browser.</p><label class="theme-setting">Appearance<select id="theme">${[['system','Use device setting'],['light','Light'],['dark','Dark']].map(([v,l])=>`<option value="${v}" ${theme===v?'selected':''}>${l}</option>`).join('')}</select></label><label class="theme-setting">Dark palette<select id="dark-palette">${DARK_PALETTES.map(([v,l])=>`<option value="${v}" ${palette===v?'selected':''}>${l}</option>`).join('')}</select></label><p class="hint">Used in Dark mode and when the device uses dark appearance.</p><h3 class="settings-heading">Portable workspace files</h3><p>Browser autosave keeps decks, collection and planning settings on this address and device. It does not update downloaded files.</p><p id="backup-status" role="status"></p><p id="backup-download-error" role="alert"></p><p>A file request starts a browser download; check Downloads to confirm it finished. If you cancel or cannot find it, request another copy.</p><div class="settings-actions"><button class="secondary" id="settings-backup">${icon('download',16)} Save workspace copy</button><button class="secondary" id="settings-restore">${icon('upload',16)} Open workspace file…</button></div><details class="backup-help"><summary>Move files and recover decks</summary><p>Save a complete JSON copy, then move it to your other device and use Open workspace file. Opening adds independent deck copies. A complete version 2 file also lets you explicitly keep or replace the current collection; collections are never silently combined.</p><p>An older file restores only deck snapshots and leaves the current collection unchanged. If browser saving fails, keep this page open and save a workspace copy before leaving.</p><p>Once Arcana is running, editing stored cards and opening or saving JSON work offline. Search, text imports, printing lookups, uncached images, legality and price refresh need internet. No account or cloud sync is used; external file-sync conflicts remain yours to resolve.</p></details>`);
  updateBackupStatus();
  $('#dark-palette').onchange=e=>{palette=e.target.value;applyTheme();try{localStorage.setItem('arcana.palette.v1',palette);}catch{toast('Palette changed for this session. Browser storage is unavailable.');}};
  $('#theme').onchange=e=>{theme=e.target.value;applyTheme();try{localStorage.setItem('arcana.theme.v1',theme);}catch{toast('Appearance changed for this session. Browser storage is unavailable.');}};
  $('#settings-backup').onclick=()=>saveWorkspaceCopy();
  $('#settings-restore').onclick=restore;
}
const printingControls=`<label for="view-printing">Set / printing</label><select id="view-printing"></select>
  <p id="printing-status" role="status"></p><button type="button" class="secondary" id="load-printings" hidden>Load more printings</button>`;

function mountPrintings(state, onSelect) {
  const select=$('#view-printing'), status=$('#printing-status'), button=$('#load-printings');
  const oracleId=state.source.oracle_id;
  const live=()=>select.isConnected && $('#dialog').open!==false;
  const loaded=()=>`${state.printings.length} ${state.printings.length===1?'printing':'printings'} loaded${state.more?' · more available':''}.`;
  function renderOptions() {
    select.innerHTML=state.printings.map(card=>`<option value="${esc(card.id)}" ${card.id===state.card.id?'selected':''}>${esc(printingLabel(card))}</option>`).join('');
  }
  select.onchange=()=>{
    state.card=state.printings.find(card=>card.id===select.value)||state.card;
    onSelect();
  };
  button.onclick=async()=>{
    if(!oracleId || button.disabled || (state.page&&!state.more))return;
    button.disabled=true;status.textContent='Loading printings…';
    try{
      const page=state.page+1,data=await api('/api/printings?'+new URLSearchParams({oracle:oracleId,page}));
      if(!live())return;
      if(!Array.isArray(data.data)||!data.data.length)throw Error('No printings were returned.');
      const cards=data.data.map(card=>validatePrinting(state.source,card));
      state.printings=[...new Map([...cards,...state.printings].map(card=>[card.id,card])).values()];
      state.page=page;state.more=Boolean(data.has_more);
      renderOptions();
      status.textContent=loaded();
      if(!state.more && document.activeElement===button)select.focus();
      button.hidden=!state.more;button.textContent='Load more printings';
    }catch(error){
      if(live()){status.textContent=error.message;button.hidden=false;button.textContent='Retry loading printings';}
    }finally{button.disabled=false;}
  };
  renderOptions();
  button.hidden=!state.more;
  status.textContent=state.page?loaded():oracleId?'':'Other printings are unavailable for this stored card. Find it again in search.';
  if(!state.page && oracleId)button.onclick();
}

function printingState(card) {return {source:card,card,printings:[card],page:0,more:false};}

function showCardDetails(state, focus) {
  showDialog(`<div class="card-detail"><div id="detail-images" class="detail-images"></div>
    <div class="detail-information"><div id="detail-facts"></div>
      <section class="printing-browser" aria-label="Card printings"><h3>Sets and printings</h3>${printingControls}<p id="detail-scryfall"></p></section>
      <section class="detail-deck-context" aria-label="Collection and deck"><h3>Collection</h3><p id="detail-ownership"></p>
        <button class="secondary" id="detail-add-owned">Add this card to collection</button>
        <h3>Deck</h3><button class="primary" id="detail-add">Add card to deck</button></section>
    </div></div>`);
  function renderCard() {
    const c=state.card;
    const images=c.image_uris?[{name:c.name,image:c.image_uris.normal}]:c.card_faces?.map(f=>({name:f.name,image:f.image_uris?.normal}))||[];
    $('#detail-images').innerHTML=images.some(f=>safeUrl(f.image,true))?images.filter(f=>safeUrl(f.image,true)).map(f=>`<img src="${esc(safeUrl(f.image,true))}" alt="${esc(f.name)}" width="488" height="680">`).join(''):'<p class="hint">Artwork unavailable for this printing.</p>';
    const date=typeof c.legalityUpdatedAt==='string' && Number.isFinite(Date.parse(c.legalityUpdatedAt))?c.legalityUpdatedAt.slice(0,10):null;
    $('#detail-facts').innerHTML=`<h2>${esc(c.name)}</h2><div class="detail-mana">${mana(c.mana_cost||c.card_faces?.map(f=>f.mana_cost||'').join(' // '))}</div>
      <p class="detail-type">${esc(c.type_line)}</p><p class="oracle-text">${esc(oracle(c))}</p>
      <dl class="card-facts">${c.power!==undefined?`<div><dt>Power / toughness</dt><dd>${esc(c.power)} / ${esc(c.toughness)}</dd></div>`:''}${c.loyalty!==undefined?`<div><dt>Loyalty</dt><dd>${esc(c.loyalty)}</dd></div>`:''}
      <div><dt>Release</dt><dd>${esc(printingLabel(c,{language:false}))}</dd></div><div><dt>Rarity</dt><dd>${esc(c.rarity||'Unavailable')}</dd></div><div><dt>Artist</dt><dd>${esc(c.artist||c.card_faces?.map(f=>f.artist).filter(Boolean).join(' / ')||'Unavailable')}</dd></div></dl>
      <section class="detail-legality" aria-label="Stored format legality"><h3>Stored format legality</h3>
      <div class="legality-badges">${FORMATS.map(f=>{
        const status=c.legalities?.[f];
        return `<span class="${status==='legal'?'is-legal':status?'':'is-unknown'}">${f}: ${esc(typeof status==='string'?status.replaceAll('_',' '):'unknown')}</span>`;
      }).join('')}</div>
      ${date?`<p class="hint">Last updated <time datetime="${esc(date)}">${esc(date)}</time></p>`:''}</section>`;
    const link=safeUrl(c.scryfall_uri);
    $('#detail-scryfall').innerHTML=link?`<a href="${esc(link)}" target="_blank" rel="noreferrer">View this printing on Scryfall</a>`:'';
    const owned=collection.reduce((qty,lot)=>qty+(lot.card.id===c.id?lot.qty:0),0);
    $('#detail-ownership').textContent=owned?`${owned} ${owned===1?'copy':'copies'} owned of this printing.`:'No copies owned of this printing.';
    $('#dialog').setAttribute('aria-label',c.name+' — Card details');
  }
  $('#detail-add-owned').onclick=()=>collectionLotDialog(state.card,null,()=>showCardDetails(state,'#detail-add-owned'));
  $('#detail-add').onclick=()=>deckCardDialog(state.card,{
    deck:view==='deck'||view==='explore'?current():null,zone:state.zone,printings:state,back:()=>showCardDetails(state,'#detail-add'),
  });
  renderCard();
  mountPrintings(state,renderCard);
  if(focus)$(focus).focus();
  $('#dialog').onclose=()=>{
    if(!$('#dialog').open && state.origin && typeof CSS!=='undefined')document.querySelector(state.origin)?.focus({preventScroll:true});
  };
}

function inspect(id,key,card) {
  const row=key?current()?.cards.find(entry=>entryKey(entry)===key):null;
  const source=card || row?.card || findCard(id);
  if(!source)return;
  const origin=typeof CSS==='undefined'||card?null:row?'[data-entry="'+CSS.escape(key)+'"]':'[data-inspect="'+CSS.escape(id)+'"]';
  showCardDetails({...printingState(source),zone:row?zoneFor(row):'main',origin});
}

function deckCardDialog(card, {deck,zone='main',source,edit,back,printings}={}) {
  const state=printings?{...printings}:printingState(card);
  const selectedDeck=deck;
  const title=edit?'Change in-deck card details':'Add card to deck';
  if(!edit && !decks.length){
    showDialog(`<h2>${title}</h2><p>Create a destination deck for ${esc(card.name)}.</p><div class="settings-actions"><button class="primary" id="create-destination">Create deck…</button>${back?'<button class="secondary" id="deck-card-cancel">Back to card details</button>':''}</div>`);
    $('#create-destination').onclick=()=>deckForm(undefined,d=>deckCardDialog(card,{deck:d,zone,back,printings:state}));
    if(back)$('#deck-card-cancel').onclick=back;
    return;
  }
  const destinations=decks.filter(d=>d!==source?.deck);
  showDialog(`<h2>${title}</h2><p>${esc(card.name)}${edit?` · ${esc(edit.deck.name)} · ${ZONES[zone]} · ${edit.entry.qty} ${edit.entry.qty===1?'copy':'copies'}`:''}</p>
    <form id="deck-card-form">
      ${edit?'':`<label>Destination deck<select id="add-destination" required><option value="">Choose a deck…</option>${destinations.map(d=>`<option value="${esc(d.id)}" ${d===selectedDeck?'selected':''}>${esc(d.name)}</option>`).join('')}</select></label>
      <label>Destination zone<select id="add-zone">${Object.entries(ZONES).map(([id,label])=>`<option value="${id}" ${id===zone?'selected':''}>${label}</option>`).join('')}</select></label>
      <p id="add-existing" role="status"></p>`}
      <div class="deck-card-printings">${printingControls}</div>
      <div class="deck-card-printings"><label for="deck-card-finish">Finish</label><select id="deck-card-finish" required></select></div>
      <p id="deck-card-price" role="status"></p>
      ${edit?'':`<label>Primary function<input id="add-primary" maxlength="80" placeholder="e.g. Removal" value="${esc(source?.entry.tags[0]||'')}"></label>
      <label>Quantity to add<input id="add-quantity" type="number" min="1" max="500" step="1" value="1" required></label>`}
      <p id="deck-card-error" role="alert"></p><div class="settings-actions"><button class="primary">${edit?'Save printing and finish':'Add card(s) to deck'}</button>
      <button class="secondary" type="button" id="deck-card-cancel">${back?'Back to card details':'Cancel'}</button></div>
    </form>`);
  const finish=$('#deck-card-finish'), destination=()=>decks.find(d=>d.id===$('#add-destination').value);
  const showPrice=()=>{
    const {cents}=deckPrintingPrice(state.card,finish.value);
    $('#deck-card-price').textContent=cents===null?'Price unavailable for this printing and finish.':usd(cents)+' per copy';
  };
  const showFinishes=(preferred=finish.value)=>{
    const options=deckFinishOptions(state.card);
    finish.innerHTML=options.length?options.map(value=>`<option value="${value}">${{regular:'Nonfoil',foil:'Foil',etched:'Etched'}[value]}</option>`).join(''):'<option value="">No supported finish</option>';
    finish.value=options.includes(preferred)?preferred:options[0]||'';
    showPrice();
  };
  if(!edit){
    const showCopies=()=>{
      const d=destination();
      $('#add-existing').textContent=d?`Copies already in this deck across all zones and printings: ${deckCardCopies(d,card)}.`:'Choose a deck to see its existing copies.';
    };
    $('#add-destination').onchange=showCopies;
    showCopies();
  }
  $('#deck-card-cancel').onclick=back || closeDialog;
  finish.onchange=showPrice;
  showFinishes(edit?.entry.finish ?? source?.entry.finish);
  mountPrintings(state,showFinishes);
  $('#deck-card-form').onsubmit=e=>{
    e.preventDefault();
    try{
      const d=edit?.deck || destination();
      if(!d)throw Error('Choose an available destination deck.');
      if(!finish.value)throw Error('Choose an available finish.');
      if(edit && (!d.cards.includes(edit.entry)||entryKey(edit.entry)!==edit.key))throw Error('This entry changed. Reopen it from the deck.');
      if(source && (!decks.includes(source.deck)||!source.deck.cards.includes(source.entry)))throw Error('The source entry is no longer available.');
      const qty=edit?0:Number($('#add-quantity').value);
      const targetZone=edit?zone:$('#add-zone').value;
      const primary=edit?'':$('#add-primary').value;
      const selection={card:state.card,finish:finish.value,primary};
      const changed=changeNamedDeck(d,target=>{
        if(edit)return setEntryPrinting(target,edit.key,state.card.id===edit.entry.card.id?edit.entry.card:state.card,finish.value);
        if(source)return copyEntryToDeck(source.deck,source.key,target,qty,targetZone,selection);
        return addDeckCopies(target,state.card,qty,targetZone,finish.value,primary);
      });
      if(back)back();
      else {
        closeDialog();
        if(edit)focusCardEntry(d,entryKey(changed));
        if(source)focusCardEntry(source.deck,source.key);
        if(!edit&&!source&&typeof CSS!=='undefined')document.querySelector('[data-add="'+CSS.escape(card.id)+'"]')?.focus();
      }
      toast(storageError || (edit?'Printing and finish saved.':`Added ${qty} ${qty===1?'copy':'copies'} to ${d.name} · ${ZONES[targetZone]}`));
    }catch(error){$('#deck-card-error').textContent=error.message;}
  };
}

async function fetchCollection(values,key='names') {const cards=[],missing=[];for(let i=0;i<values.length;i+=75){const data=await api('/api/collection',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({[key]:values.slice(i,i+75)})});cards.push(...data.data);missing.push(...(data.not_found||[]).map(x=>x[key==='ids'?'id':'name']));}return {cards,missing};}
async function refreshPrices(d=current()){
  if(!d)return;
  if(priceStates.get(d.id)?.status==='refreshing')return;
  const zones=d.budgetZones??DEFAULT_BUDGET_ZONES;
  const entries=d.cards.filter(entry=>zones.includes(zoneFor(entry))).map(entry=>({entry,id:entry.card.id})),ids=[...new Set(entries.map(snapshot=>snapshot.id))];
  if(!ids.length){toast('No scoped cards to refresh.');return;}
  priceStates.set(d.id,{status:'refreshing'});render();
  try{
    const {cards,missing}=await fetchCollection(ids,'ids'),byId=new Map(cards.map(card=>[card.id,card]));
    if(missing.length||ids.some(id=>!byId.has(id)))throw Error('Some stored printings could not be refreshed.');
    if(!decks.includes(d))return;
    const updates=entries.filter(snapshot=>d.cards.includes(snapshot.entry)&&snapshot.entry.card.id===snapshot.id).map(snapshot=>({entry:snapshot.entry,eur:byId.get(snapshot.id).prices?.eur??null}));
    for(const update of updates)update.entry.card={...update.entry.card,prices:{...(update.entry.card.prices||{}),eur:update.eur}};
    if(updates.length){d.priceUpdatedAt=new Date().toISOString();d.updated=d.priceUpdatedAt;}
    priceStates.set(d.id,{status:'fresh'});save();render();toast(storageError?'Prices kept for this session. Export a workspace copy.':'Regular EUR prices refreshed.');
  }catch(error){priceStates.set(d.id,{status:'failed',error:error.message});render();}
}
function importDialog(target=current()){
  showDialog(`<h2>${target?'Import cards':'Import a deck'}</h2><p>Paste Archidekt text using “1 Card Name” and generic Commander, Mainboard, Sideboard or Maybeboard headings. Main deck and Command zone also work. ${target?'Cards will be added to '+esc(target.name)+'.':'A new deck is created only after every card resolves.'}</p><form id="import-form">${!target?`<label>Deck name<input name="name" required maxlength="100"></label><label>Format<select name="format">${FORMATS.map(f=>`<option>${f}</option>`).join('')}</select></label>`:''}<label>Decklist<textarea name="list" rows="9" required placeholder="1 Sol Ring&#10;1 Command Tower&#10;10 Forest"></textarea></label><p id="import-error" role="alert"></p><div id="import-preview" aria-live="polite"></div><button class="primary">Review import</button></form>`);
  const form=$('#import-form'), button=form.querySelector('button');
  let review=null, revision=0, pending=false;
  form.oninput=()=>{revision++;review=null;$('#import-preview').innerHTML='';button.textContent='Review import';};
  form.onsubmit=async e=>{e.preventDefault();if(pending)return;pending=true;button.disabled=true;try{
    const data=new FormData(form), name=target?.name||String(data.get('name')).trim(),format=target?.format||String(data.get('format'));
    if(!name||name.length>100||!FORMATS.includes(format))throw new Error('Enter a deck name and supported format.');
    form.querySelector('#import-error').textContent='';
    if(!review){
      const parsed=parseImport(data.get('list')), version=revision;
      button.textContent='Finding cards…';
      const {cards}=await fetchCollection([...new Set(parsed.map(x=>x.name))]);
      if(form.isConnected===false||$('#dialog').open===false)return;
      if(version!==revision)throw new Error('The list changed during lookup. Review it again.');
      const result=resolveImport(parsed,cards);
      $('#import-preview').innerHTML=`<h3>Import review</h3><p>${result.entries.reduce((n,x)=>n+x.qty,0)} resolved copies for ${esc(name)}. Nothing has been imported.</p><ul>${result.entries.map(x=>`<li>${x.qty} ${esc(x.card.name)} — ${ZONES[x.zone]}</li>`).join('')}${result.problems.map(x=>`<li>${esc(x.name)} — ${x.reason}. Correct the name and review again.</li>`).join('')}</ul><p>Text imports use name-based printings; set and collector suffixes do not select a printing. Functions and bracket assignments require JSON.</p>`;
      if(result.problems.length)throw new Error('Nothing imported. Correct the unresolved or ambiguous names above, then review again.');
      review=result.entries;
      button.textContent='Import reviewed cards';
      return;
    }
    const additions=review;
    if(form.isConnected===false||$('#dialog').open===false)return;
    if(target&&!decks.includes(target))throw new Error('The destination deck no longer exists.');
    if(!target&&decks.length>=200)throw new Error('Maximum 200 decks per workspace.');
    const destination=target||blankDeck(name,format),staged={cards:structuredClone(destination.cards)};
    for(const {card,qty,zone} of additions)addDeckCopies(staged,card,qty,zone);
    destination.cards=staged.cards;destination.updated=new Date().toISOString();if(!target)decks.push(destination);save();$('#dialog').close();openDeck(destination.id);toast(`${additions.reduce((n,e)=>n+e.qty,0)} cards imported`);
  }catch(error){form.querySelector('#import-error').textContent=error.message;}finally{pending=false;button.disabled=false;button.textContent=review?'Import reviewed cards':'Review import';if(review&&form.isConnected!==false)button.focus();}};
}
function restore(){
  showDialog('<h2>Open a workspace file</h2><p>Choose an Arcana JSON file or legacy backup. Review independent deck copies and any collection replacement before saving. Older deck-only files always keep your current collection.</p><input id="backup-file" type="file" accept="application/json,.json" aria-label="Workspace JSON file"><p id="restore-error" role="alert"></p><div id="restore-preview" aria-live="polite"></div><div class="settings-actions"><button id="restore-apply" class="primary" disabled>Apply reviewed workspace</button><button id="restore-current" class="secondary">Save current workspace copy</button><button id="restore-recovery" class="secondary" hidden>Save pending import copy</button></div>');
  const input=$('#backup-file'),apply=$('#restore-apply'),preview=$('#restore-preview'),errorNode=$('#restore-error'),recovery=$('#restore-recovery');
  let staged=null,revision=0;
  $('#restore-current').onclick=()=>saveWorkspaceCopy();
  recovery.onclick=()=>{if(!staged)return;const choice=$('#restore-collection')?.value||'keep',nextCollection=choice==='replace'&&staged.collection!==null?staged.collection:collection;download('arcana-pending-import.json',JSON.stringify(workspaceFile([...decks,...staged.decks],nextCollection),null,2),'application/json');};
  input.onchange=async e=>{
    const version=++revision,file=e.target.files[0];staged=null;apply.disabled=true;recovery.hidden=true;preview.innerHTML='';errorNode.textContent='';
    if(!file)return;
    try {
      if(file.size>15_000_000)throw Error('Backup is too large (maximum 15 MB).');
      const imported=structuredClone(readWorkspaceFile(JSON.parse(await file.text())));
      if(version!==revision||input.isConnected===false||$('#dialog').open===false)return;
      if(!imported.decks.length&&imported.collection===null)throw Error('This file contains no decks. Nothing was changed.');
      if(decks.length+imported.decks.length>200)throw Error('Maximum 200 decks per workspace.');
      for(const d of imported.decks){d.id=crypto.randomUUID();for(const entry of d.cards)entry.zone=zoneFor(entry);}
      staged=imported;
      preview.innerHTML=`<h3>${imported.decks.length?`Add ${imported.decks.length} independent deck ${imported.decks.length===1?'copy':'copies'}?`:'No deck copies in this file'}</h3>${imported.decks.length?`<ul>${imported.decks.map(d=>`<li>${esc(d.name)} · ${count(d)} playing cards</li>`).join('')}</ul><p>Names may repeat. Deck copies do not merge with existing decks.</p>`:''}${imported.collection!==null?`<label>Collection action<select id="restore-collection"><option value="keep">Keep current collection (${collection.reduce((sum,lot)=>sum+lot.qty,0)} copies)</option><option value="replace">Replace with file collection (${imported.collection.reduce((sum,lot)=>sum+lot.qty,0)} copies)</option></select></label><p>The collections are not added together. Review this choice before applying.</p>`:'<p>This older deck-only file leaves your current collection unchanged.</p>'}`;
      apply.disabled=false;apply.focus();
    } catch(error){if(version===revision&&input.isConnected!==false)errorNode.textContent=error.message;}
  };
  apply.onclick=()=>{
    if(!staged||apply.disabled||input.isConnected===false||$('#dialog').open===false)return;
    try {
      const next=validateBackup([...decks,...staged.decks]),choice=$('#restore-collection')?.value||'keep',nextCollection=choice==='replace'&&staged.collection!==null?validateCollection(staged.collection):collection;
      // Persist the staged copy first: a failed write leaves the live workspace untouched.
      localStorage.setItem('arcana.workspace.v2',JSON.stringify(workspaceFile(next,nextCollection)));
      const first=staged.decks[0]?.id;decks=next;collection=nextCollection;staged=null;apply.disabled=true;storageError='';if(first)active=first;updateBackupStatus();
      $('#dialog').close();render();toast('Reviewed workspace changes saved in this browser.');
    }catch(error){
      errorNode.textContent='Nothing added. '+error.message+' Retry, save your current workspace, or save the pending import copy.';
      recovery.hidden=false;
    }
  };
}
function legalitySignature(d) { return d.format+'|'+[...new Set(d.cards.filter(e=>zoneFor(e)!=='maybeboard').map(e=>e.card.id))].sort().join('|'); }
function ensureLegality(d) {
  if (!d.cards.some(e=>zoneFor(e)!=='maybeboard')) return;
  const signature=legalitySignature(d), state=legalityStates.get(d.id);
  if (state?.pending || state?.signature===signature) return;
  legalityStates.set(d.id,{status:'refreshing',signature,pending:true});
  setTimeout(()=>refresh(d),0);
}
function freshnessNotice(d) {
  if (!d.cards.some(e=>zoneFor(e)!=='maybeboard')) return '<p class="hint">No playing-deck or sideboard cards to refresh.</p>';
  const state=legalityStates.get(d.id), status=state?.status;
  const stale=status==='fresh' && Date.now()-state.time>=300_000;
  const message=status==='refreshing'?'Refreshing legality… Editing stays available.':status==='failed'?'Legality refresh unavailable. Last usable data retained.':status==='fresh'&&!stale?'Legality refreshed this session (server cache up to five minutes).':'Legality data is stale; current rules have not been verified.';
  return `<div class="freshness check-${status==='fresh'&&!stale?'success':'warning'}" role="status"><p>${icon(status==='fresh'&&!stale?'check':'book',16)} ${message}</p>${status==='failed'?`<p>${esc(state.error)}</p>`:''}${status==='failed'||stale?'<button class="text-button" data-action="refresh">Retry legality refresh</button>':''}</div>`;
}
function refresh(d=current()) {
  if (!d?.cards.some(e=>zoneFor(e)!=='maybeboard')) return Promise.resolve();
  const previous=legalityStates.get(d.id);
  if (previous?.promise) return previous.promise;
  const entries=d.cards.filter(e=>zoneFor(e)!=='maybeboard').map(e=>({entry:e,card:e.card})), signature=legalitySignature(d), format=d.format;
  const state={status:'refreshing',signature,pending:true};
  legalityStates.set(d.id,state);
  const task=legalityQueue.then(async()=>{
    try {
      const {cards}=await fetchCollection([...new Set(entries.map(({card})=>card.id))].sort(),'ids');
      if (!decks.includes(d)) return;
      const byId=new Map(cards.filter(c=>typeof c?.id==='string').map(c=>[c.id,c]));
      const relevant=entries.filter(({entry,card})=>d.cards.includes(entry) && entry.card===card && zoneFor(entry)!=='maybeboard');
      const problems=[];
      for(const {card} of relevant){
        const c=byId.get(card.id), label=card.name;
        if(!c){problems.push(label+': this printing was not returned.');continue;}
        if((c.oracle_id && card.oracle_id && c.oracle_id!==card.oracle_id) || (c.layout==='reversible_card' && card.oracle_id && c.card_faces?.some(f=>f.oracle_id && f.oracle_id!==card.oracle_id))){problems.push(label+': returned rules identity did not match.');continue;}
        const status=c.legalities?.[format];
        if(!['legal','not_legal','banned','restricted'].includes(status) || (status==='restricted' && format!=='vintage'))problems.push(label+': '+format+' legality was unavailable.');
      }
      if(problems.length)throw Error(problems.slice(0,6).join(' ')+(problems.length>6?' Plus '+(problems.length-6)+' more.':'')+' Stored data kept. Retry legality refresh.');
      if (d.cards.filter(e=>zoneFor(e)!=='maybeboard').some(e=>!entries.some(({entry,card})=>entry===e && card===e.card))) state.signature='';
      const legalityUpdatedAt=new Date().toISOString();
      for (const {entry,card} of relevant) {
        // Only patch the surviving original card; quantities, roles, zones and printing stay live.
        if (d.cards.includes(entry) && entry.card===card) entry.card={...card,legalities:byId.get(card.id).legalities,legalityUpdatedAt};
      }
      state.status='fresh';state.time=Date.now();save();
      setTimeout(()=>{if(current()===d)render();},300_000);
    } catch(error) { state.status='failed';state.error=error.message; }
    finally {state.pending=false;delete state.promise;if(current()===d)render();}
  });
  state.promise=task;legalityQueue=task.catch(()=>{});
  if(current()===d)render();
  return task;
}

async function sample(){if(decks.length>=200){toast('Maximum 200 decks per workspace.');return;}toast('Loading a small example from Scryfall…');try{const names=['Tatyova, Benthic Druid','Sol Ring','Arcane Signet','Cultivate',"Kodama's Reach",'Llanowar Elves','Rampant Growth','Growth Spiral','Beast Within','Counterspell','Eternal Witness','Command Tower','Forest','Island'];const {cards,missing}=await fetchCollection(names);if(missing.length)throw new Error('Example cards could not be loaded. Try again.');const d=blankDeck('The garden grows');d.cards=cards.map(card=>({card,qty:card.name==='Forest'?12:card.name==='Island'?10:1,tags:['Cultivate',"Kodama's Reach",'Rampant Growth','Sol Ring','Arcane Signet','Llanowar Elves'].includes(card.name)?['Ramp']:[],zone:card.name==='Tatyova, Benthic Druid'?'command':'main'}));decks.push(d);active=d.id;save();openDeck(d.id);toast('Example loaded — an unfinished Commander deck to build on');}catch(e){toast(e.message);}}
render();
