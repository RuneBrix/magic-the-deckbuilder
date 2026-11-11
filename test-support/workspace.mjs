import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { randomUUID } from 'node:crypto';
import * as core from '../public/core.js';
import * as viewUtils from '../public/view-utils.js';
import * as collectionView from '../public/collection-view.js';
import * as statisticsView from '../public/statistics-view.js';
import * as deckPrices from '../public/deck-prices.js';
import { budgetPanel } from '../public/budget-view.js';
import { TYPE_CATALOG, KEYWORD_CATALOG } from '../public/filter-catalog.js';

const source = (await readFile(new URL('../public/app.js', import.meta.url), 'utf8')).replace(/^import .*;\r?\n/gm, '');

// Exercise the browser module's preferences and rendering without a DOM dependency.
export function workspace({ savedTheme = null, savedDecks = null, savedWorkspace = null, savedTracker = null, savedPalette = null, dark = false, blocked = false, initialView = 'explore' } = {}) {
  const writes = [], nodes = new Map(), timers=[], events={};
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, {
      innerHTML: '', content: '', addEventListener(type, fn) { this[type] = fn; },
      contains() { return false; }, querySelector: node, querySelectorAll:()=>[], scrollIntoView() {}, dataset:{}, isConnected:true,
      matches(){return Boolean(this.popoverOpen);}, showPopover(){this.popoverOpen=true;}, hidePopover(){this.popoverOpen=false;}, getBoundingClientRect(){return {left:50,right:300,top:50,bottom:450,height:400,width:250};},
      setAttribute() {}, showModal() {}, focus() {}, close() {},
      classList: { add() {}, remove() {}, toggle() {} }, style: { setProperty() {} },
    });
    return nodes.get(selector);
  };
  const media = { matches: dark, addEventListener(type, fn) { this[type] = fn; } };
  const document = { querySelector: node, querySelectorAll:()=>[], scrollIntoView() {}, documentElement: { dataset: {} }, activeElement: null };
  const context = vm.createContext({ ...core, ...viewUtils, ...collectionView, ...statisticsView, ...deckPrices, budgetPanel, TYPE_CATALOG, KEYWORD_CATALOG, document, addEventListener:(type,fn)=>{events[type]=fn;}, matchMedia: () => media,
    localStorage: {
      getItem(key) { if (blocked) throw Error('Storage blocked'); return key === 'arcana.palette.v1' ? savedPalette : key === 'arcana.theme.v1' ? savedTheme : key === 'arcana.explorer.v1' ? savedTracker : key==='arcana.workspace.v2'?savedWorkspace:key==='arcana.decks.v1'?savedDecks:null; },
      setItem(key, value) { if (blocked) throw Error('Storage blocked'); writes.push([key, value]); },
    },
    innerWidth:1280,innerHeight:900,
    setTimeout: (fn,ms) => {timers.push({fn,ms});return timers.length;}, clearTimeout() {}, AbortController, URLSearchParams, structuredClone, crypto: { randomUUID },
  });
  vm.runInContext(source, context);
  // Most tests exercise exploration; initialView: null leaves the real startup untouched.
  if (initialView) vm.runInContext(`view=${JSON.stringify(initialView)};render()`, context);
  return { context, document, media, node, writes, timers, events };
}

export function startCardDrag(w,key) {
  w.context.requestAnimationFrame=fn=>{w.dragFrame=fn;return 1;};w.context.cancelAnimationFrame=()=>{w.dragFrame=null;};
  w.node('#editor-card-area').contains=()=>true;w.document.elementFromPoint=()=>null;
  const ghost=w.node('#dragged-card');ghost.remove=()=>{ghost.removed=true;};
  w.document.body={append(node){assert.equal(node,ghost);}};
  const source={dataset:{previewEntry:key},setPointerCapture(){},getBoundingClientRect(){return {left:50,top:50,width:190,height:264};},cloneNode(){return ghost;},contains(){return false;},classList:{add(){},remove(){}},closest(selector){return selector==='button'?null:this;}};
  w.node('#app').pointerdown({target:source,pointerId:1,pointerType:'mouse',button:0,clientX:100,clientY:100});
  w.events.pointermove({pointerId:1,clientX:110,clientY:110,preventDefault(){}});
  return source;
}
export function dropCard(w,dataset) {
  const target={dataset,classList:{add(){},remove(){}},closest(){return this;}};
  w.document.elementFromPoint=()=>target;
  w.events.pointerup({pointerId:1,clientX:300,clientY:400,preventDefault(){}});
}


export const editorCard=(id,type='Creature')=>({id,oracle_id:id,name:id,type_line:type,cmc:2,color_identity:['G'],colors:['G'],mana_cost:'{1}{G}',oracle_text:'',legalities:{commander:'legal'}});
export const editorDeck=()=>({id:'editor',name:'Garden',format:'commander',cards:[{card:editorCard('Leader','Legendary Creature'),qty:1,tags:['Draw'],zone:'command'},{card:editorCard('Ramp spell','Sorcery'),qty:2,tags:['Removal','Ramp'],zone:'main'}]});
export function formValues(w,values){w.context.FormData=class{get(key){return Object.hasOwn(values,key)?values[key]:'';}};}
export async function chooseWorkspaceFile(w,data,{size=100}={}){
  const input=w.node('#backup-file');
  await input.onchange({target:{files:[{size,text:async()=>JSON.stringify(data)}]}});
}
