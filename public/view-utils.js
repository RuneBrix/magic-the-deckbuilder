// Shared, side-effect-free HTML and display formatting.
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export function mana(cost = '', decorative = false) {
  const names={W:'White',U:'Blue',B:'Black',R:'Red',G:'Green',C:'Colorless'};
  return [...cost.matchAll(/\{([^}]+)\}/g)].map(([,symbol])=>`<span class="mana mana-${/^[WUBRG]$/.test(symbol)?symbol:'C'}${names[symbol]?' mana-symbol':''}" ${decorative?'aria-hidden="true"':`role="img" aria-label="${esc(names[symbol]||symbol)}"`} title="${esc(names[symbol]||symbol)}">${names[symbol]?'':esc(symbol)}</span>`).join('');
}
export const euro=cents=>new Intl.NumberFormat(undefined,{style:'currency',currency:'EUR'}).format(cents/100);
export function printingLabel(c, { language = true } = {}) { return `${c.set_name || c.set || 'Unknown set'} · #${c.collector_number || '?'}${language?' · '+String(c.lang || 'en').toUpperCase():''}${c.released_at?' · '+c.released_at:''}`; }
