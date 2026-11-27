import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { prepareApp, cards } from './fixtures.mjs';

const reported=JSON.parse(await readFile(new URL('../test/fixtures/karona-functions.json',import.meta.url),'utf8')).cards;
const resolved=reported.map(({card})=>({...card,image_uris:cards[0].image_uris,legalities:{commander:'legal'}}));
test.beforeEach(async({page})=>{
  await prepareApp(page);
  await page.route('**/api/collection',route=>route.request().postDataJSON().names
    ? route.fulfill({json:{data:resolved,not_found:[]}}) : route.fallback());
});
const saved=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('arcana.workspace.v2')));
async function review(page){
  await page.getByLabel('Deck actions for Smoke Garden',{exact:true}).click();
  await page.getByRole('button',{name:'Assign missing functions…',exact:true}).click();
  return page.getByRole('dialog',{name:'Assign missing functions',exact:true});
}

test('fresh Karona card imports assign every reported card and expose the new function groups',async({page},testInfo)=>{
  await page.getByRole('button',{name:'Smoke Garden',exact:true}).click();
  await page.getByLabel('Deck actions for Smoke Garden',{exact:true}).click();
  await page.getByRole('button',{name:'Import cards',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await dialog.getByLabel('Decklist',{exact:true}).fill(reported.map(({card})=>'1 '+card.name).join('\n'));
  await dialog.getByRole('button',{name:'Review import',exact:true}).click();
  await dialog.getByRole('button',{name:'Import reviewed cards',exact:true}).click();
  const entries=(await saved(page)).decks[0].cards;
  for(const {card,expectedFunction} of reported)expect(entries.find(entry=>entry.card.id===card.id).tags[0],card.name).toBe(expectedFunction);
  await page.locator('#editor-group').selectOption('role');
  for(const name of ['Untap','Combat control','Card advantage','Ramp','Protection']){
    await expect(page.locator('.deck-group h4').filter({hasText:new RegExp('^'+name)})).toHaveCount(1);
  }
  await page.getByRole('tab',{name:'Statistics',exact:true}).click();
  // The statistics surface exposes the same primary labels as deck grouping.
  await expect(page.locator('#deck-statistics')).toContainText('Card advantage');
  await expect(page.locator('#deck-statistics')).toContainText('Combat control');
  await page.screenshot({path:testInfo.outputPath('karona-function-statistics.png')});
  await page.reload();await page.getByRole('button',{name:'Smoke Garden',exact:true}).click();
  const reloaded=(await saved(page)).decks[0].cards;
  for(const {card,expectedFunction} of reported)expect(reloaded.find(entry=>entry.card.id===card.id).tags[0]).toBe(expectedFunction);
});

test('existing missing functions require review, preserve manual choices and survive save failure and retry',async({page},testInfo)=>{
  await page.evaluate(resolved=>{
    const key='arcana.workspace.v2',data=JSON.parse(localStorage.getItem(key));
    data.decks[0].cards=resolved.map(card=>({card,qty:1,tags:[],zone:'main'}));
    data.decks[0].cards.push({card:resolved[0],qty:3,tags:['My function','Secondary'],zone:'sideboard'});
    data.decks[0].cards.push({card:resolved[1],qty:2,tags:['','Secondary'],zone:'maybeboard'});
    localStorage.setItem(key,JSON.stringify(data));
  },resolved);
  await page.reload();await page.getByRole('button',{name:'Smoke Garden',exact:true}).click();
  const roles=data=>data.decks[0].cards.map(({card,qty,tags,zone,finish})=>({id:card.id,qty,tags,zone,finish}));
  const before=roles(await saved(page)),collection=(await saved(page)).collection;
  let dialog=await review(page);
  await expect(dialog).toContainText('10 unassigned card entries (10 copies)');
  await expect(dialog.locator('.function-suggestions li')).toHaveCount(10);
  const list=dialog.getByRole('list',{name:'Suggested function assignments'});
  await list.focus();await list.press('ArrowDown');
  await expect(list).toBeFocused();
  await expect(list).toHaveCSS('outline-style','solid');
  if(await list.evaluate(el=>el.scrollHeight>el.clientHeight)){
    await list.press('End');
    await expect.poll(()=>list.evaluate(el=>el.scrollTop)).toBeGreaterThan(0);
    await list.press('Home');
  }
  const box=await dialog.boundingBox(),viewport=page.viewportSize();
  expect(box.x>=0 && box.y>=0 && box.x+box.width<=viewport.width && box.y+box.height<=viewport.height).toBe(true);
  await dialog.screenshot({path:testInfo.outputPath('review-karona-functions.png')});
  await list.evaluate(el=>el.style.fontSize='26px');
  await list.press('End');
  expect(await list.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  const enlarged=await dialog.boundingBox();
  expect(enlarged.y>=0 && enlarged.y+enlarged.height<=viewport.height).toBe(true);
  await dialog.screenshot({path:testInfo.outputPath('enlarged-function-review.png')});
  await list.evaluate(el=>el.style.fontSize='');
  await dialog.getByRole('button',{name:'Cancel',exact:true}).press('Enter');
  expect(roles(await saved(page))).toEqual(before);
  dialog=await review(page);
  await page.evaluate(()=>{
    const persist=Storage.prototype.setItem;
    window.restoreFunctionStorage=()=>Storage.prototype.setItem=persist;
    Storage.prototype.setItem=function(key,value){if(key==='arcana.workspace.v2')throw new DOMException('Quota exceeded','QuotaExceededError');return persist.call(this,key,value);};
  });
  await dialog.getByRole('button',{name:'Assign suggested functions',exact:true}).press('Enter');
  await expect(dialog.locator('#function-suggestions-error')).toContainText('Browser storage is full or unavailable');
  expect(roles(await saved(page))).toEqual(before);
  await dialog.screenshot({path:testInfo.outputPath('function-save-error.png')});
  await page.evaluate(()=>window.restoreFunctionStorage());
  await dialog.getByRole('button',{name:'Assign suggested functions',exact:true}).press('Enter');
  await expect(dialog).toBeHidden();
  const after=await saved(page);
  expect(after.decks[0].cards.slice(0,10).map(entry=>entry.tags[0])).toEqual(reported.map(row=>row.expectedFunction));
  expect(roles(after).slice(10)).toEqual(before.slice(10));
  expect(after.collection).toEqual(collection);
  await expect(page.getByLabel('Deck actions for Smoke Garden',{exact:true})).toBeFocused();
  await page.reload();await page.getByRole('button',{name:'Smoke Garden',exact:true}).click();
  expect(roles(await saved(page))).toEqual(roles(after));
  await review(page);
  await expect(page.locator('#toast')).toContainText('No suggestions for unassigned cards');
  await page.evaluate(()=>{
    const key='arcana.workspace.v2',data=JSON.parse(localStorage.getItem(key));data.decks[0].cards[0].tags=[];localStorage.setItem(key,JSON.stringify(data));
  });
  await page.reload();await page.getByRole('button',{name:'Smoke Garden',exact:true}).click();
  dialog=await review(page);
  await expect(dialog).toContainText('1 unassigned card entry (1 copy)');
  await dialog.getByRole('button',{name:'Cancel',exact:true}).press('Enter');
});

test('a scoped function group rename preserves variants and future Ramp defaults', async ({page,isMobile},testInfo) => {
  const strongBack=resolved.find(card=>card.name==='Strong Back');
  await page.route('**/api/search?**',route=>new URL(route.request().url()).searchParams.get('q')?.includes('Strong Back')
    ? route.fulfill({json:{data:[strongBack],total_cards:1,has_more:false}}) : route.fallback());
  await page.evaluate(()=>{
    const key='arcana.workspace.v2',data=JSON.parse(localStorage.getItem(key));
    const [command,visible,variant,hidden,other,land]=data.decks[0].cards;
    visible.card.name='Visible rock';
    visible.tags=['Ramp','Draw'];
    visible.finish='regular';
    Object.assign(variant,{card:{...visible.card,id:variant.card.id,collector_number:'2a'},qty:3,finish:'foil',tags:['Ramp']});
    hidden.tags=['Ramp'];
    hidden.qty=500;
    other.tags=['Momentum'];
    land.tags=['Lands'];
    data.decks[0].cards=[command,visible,variant,hidden,other,{...visible,zone:'sideboard'}, {...land,zone:'maybeboard'}];
    data.decks.push({...data.decks[0],id:'another-deck',name:'Another deck'});
    localStorage.setItem(key,JSON.stringify(data));
  });
  await page.reload();
  await page.getByRole('button',{name:'Smoke Garden',exact:true}).click();
  const groupBy=page.locator('#editor-group');
  const options=page.getByRole('button',{name:'Group actions for Ramp · Main deck',exact:true});
  const rename=page.getByRole('button',{name:'Rename function group…',exact:true});
  const dialog=page.getByRole('dialog',{name:'Rename function group',exact:true});
  const name=dialog.getByRole('textbox',{name:'Function name'});
  const save=dialog.getByRole('button',{name:'Rename group',exact:true});
  const filter=page.getByRole('searchbox',{name:'Filter cards'});
  const activate=element=>isMobile ? element.tap() : element.press('Enter');
  const before=await saved(page);
  const mainGroups=page.locator('#deck-zone-main-cards [data-toggle-deck-group]');

  await activate(page.getByRole('button',{name:'Group actions for Creature · Main deck',exact:true}));
  await expect(rename).toHaveCount(0);
  await page.keyboard.press('Escape');
  await groupBy.selectOption('role');
  await expect(mainGroups).toHaveText([/^Momentum ·/, /^Ramp ·/]);
  await activate(page.getByRole('button',{name:'Group actions for Lands · Maybeboard',exact:true}));
  await expect(rename).toHaveCount(0);
  await page.keyboard.press('Escape');

  for(const layout of ['visual-horizontal','visual-vertical','text-horizontal','text-vertical']){
    await page.locator('#editor-layout').selectOption(layout);
    await activate(options);
    if(!isMobile){
      await expect(page.getByRole('button',{name:'Copy cards',exact:true})).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(rename).toBeFocused();
    }
    await activate(rename);
    await expect(name).toBeFocused();
    await expect(name).toHaveValue('Ramp');
    if(isMobile) await activate(dialog.getByRole('button',{name:'Cancel',exact:true}));
    else await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(options).toBeFocused();
  }
  expect(await saved(page)).toEqual(before);

  await activate(mainGroups.filter({hasText:'Momentum'}));
  await activate(mainGroups.filter({hasText:'Ramp'}));
  await filter.fill('Visible rock');
  await activate(options);
  await activate(rename);
  await expect(dialog).toContainText('505 copies in the whole group, including cards hidden by the filter.');
  await name.fill(' momentum ');
  await activate(save);
  await expect(dialog.getByRole('alert')).toContainText('already exists in this zone');
  await name.fill('Mana rock');
  await page.evaluate(()=>{
    document.documentElement.style.fontSize='200%';
    const persist=Storage.prototype.setItem;
    window.restoreRenameStorage=()=>Storage.prototype.setItem=persist;
    Storage.prototype.setItem=function(key,value){
      if(key==='arcana.workspace.v2')throw new DOMException('Quota exceeded','QuotaExceededError');
      return persist.call(this,key,value);
    };
  });
  await activate(save);
  await expect(dialog.getByRole('alert')).toContainText('Browser storage is full or unavailable');
  await expect(name).toHaveValue('Mana rock');
  expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await dialog.screenshot({path:testInfo.outputPath('rename-group-save-error.png')});
  expect(await saved(page)).toEqual(before);
  await page.evaluate(()=>window.restoreRenameStorage());
  await activate(save);
  await expect(dialog).toBeHidden();
  const renamed=page.getByRole('button',{name:'Group actions for Mana rock · Main deck',exact:true});
  await expect(renamed).toBeFocused();
  await page.evaluate(()=>document.documentElement.style.fontSize='');
  await filter.fill('');
  await expect(mainGroups).toHaveText([/^Mana rock ·/, /^Momentum ·/]);
  for (const heading of await mainGroups.all()) await expect(heading).toHaveAttribute('aria-expanded','false');
  const after=await saved(page);
  expect(after.decks[0].cards).toEqual(before.decks[0].cards.map((entry,index)=>index>=1 && index<=3
    ? {...entry,tags:['Mana rock',...entry.tags.slice(1)]} : entry));
  expect(after.decks[1]).toEqual(before.decks[1]);
  expect(after.collection).toEqual(before.collection);

  await page.getByLabel('Deck actions for Smoke Garden',{exact:true}).click();
  await page.getByRole('button',{name:'Import cards',exact:true}).click();
  await page.getByRole('textbox',{name:'Decklist',exact:true}).fill('1 Inquisitive Glimmer');
  await page.getByRole('button',{name:'Review import',exact:true}).click();
  await page.getByRole('button',{name:'Import reviewed cards',exact:true}).click();
  await page.getByRole('combobox',{name:'Quick add card'}).fill('Strong Back');
  await activate(page.getByRole('option',{name:'Strong Back',exact:true}));
  await expect(renamed).toBeVisible();
  await expect(options).toBeVisible();
  await expect(page.getByRole('button',{name:'Group actions for Ramp · Sideboard',exact:true})).toBeVisible();
  await page.reload();
  await page.getByRole('button',{name:'Smoke Garden',exact:true}).click();
  const persisted=(await saved(page)).decks[0].cards;
  expect(persisted.filter(entry=>entry.zone==='main' && entry.tags[0]==='Mana rock').map(entry=>entry.qty)).toEqual([2,3,500]);
  expect(persisted.filter(entry=>entry.zone==='main' && entry.tags[0]==='Ramp').map(entry=>entry.card.name)).toEqual(['Inquisitive Glimmer','Strong Back']);
});
