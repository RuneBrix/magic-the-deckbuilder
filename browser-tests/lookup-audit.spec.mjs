import { test, expect } from '@playwright/test';
import { prepareApp, cards } from './fixtures.mjs';

const name='Dawn, the Patient Keeper of a Very Long Collection Name // Dusk, the Returning Watcher';
const foil={...cards[2],name,finishes:['foil'],card_faces:[{name:'Dawn',type_line:'Creature'},{name:'Dusk',type_line:'Creature'}]};
const etched={...foil,id:cards[3].id,set:'alt',collector_number:'12a',lang:'ja',finishes:['etched']};
const stored=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('arcana.workspace.v2')));
function workspaceContents({decks,collection}) {
  return {collection,decks:decks.map(deck=>({...deck,cards:deck.cards.map(entry=>{
    const {legalityUpdatedAt,...card}=entry.card;
    return {...entry,card};
  })}))};
}

async function blockWrites(page){
  await page.evaluate(()=>{
    const original=Storage.prototype.setItem;window.rejectWorkspaceWrite=true;
    Storage.prototype.setItem=function(key,value){if(key==='arcana.workspace.v2'&&window.rejectWorkspaceWrite)throw new DOMException('Synthetic quota','QuotaExceededError');return original.call(this,key,value);};
  });
}
async function fits(page){
  expect(await page.locator('#dialog').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&el.scrollWidth<=el.clientWidth;})).toBe(true);
}
test.beforeEach(async({page})=>prepareApp(page));

test('manual Collection finish choices, cancel and quota retry preserve exact printing context',async({page},testInfo)=>{
  await testInfo.attach('environment',{body:JSON.stringify({browser:page.context().browser().version(),viewport:page.viewportSize(),appearance:testInfo.project.use.colorScheme,origin:new URL(page.url()).origin}),contentType:'application/json'});
  await page.route('**/api/search?*',route=>route.fulfill({json:{data:[foil],has_more:false}}));
  await page.route('**/api/printings?*',route=>route.fulfill({json:{data:[foil,etched],has_more:false}}));
  await page.getByRole('button',{name:'Collection',exact:true}).click();
  const before=await stored(page);
  const open=async()=>{
    await page.getByRole('button',{name:'Add owned card',exact:true}).click();
    await page.getByRole('combobox',{name:'Search card names'}).fill('Dawn');
    await page.getByRole('option',{name,exact:true}).click();
    await expect(page.locator('#owned-finish')).toHaveValue('foil');
    await expect(page.locator('#owned-finish option')).toHaveCount(1);
    await expect(page.locator('#owned-version option')).toHaveCount(2);
    await page.locator('#owned-version').selectOption(etched.id);
    await expect(page.locator('#owned-finish')).toHaveValue('etched');
    await page.locator('#owned-qty').fill('2');
  };
  await open();await page.getByRole('button',{name:'Cancel',exact:true}).press('Enter');expect(await stored(page)).toEqual(before);
  await open();await blockWrites(page);
  await page.getByRole('button',{name:'Update collection',exact:true}).press('Enter');
  await expect(page.locator('#owned-error')).toContainText('original collection is unchanged');expect(await stored(page)).toEqual(before);
  await fits(page);await page.screenshot({path:testInfo.outputPath('owned-quota-retry.png')});
  await page.evaluate(()=>window.rejectWorkspaceWrite=false);
  await page.getByRole('button',{name:'Update collection',exact:true}).press('Enter');
  await expect(page.locator('#dialog')).not.toBeVisible();
  const saved=await stored(page);expect(saved.decks).toEqual(before.decks);
  expect(saved.collection.at(-1)).toMatchObject({card:etched,qty:2,finish:'etched'});
  await page.reload();expect(workspaceContents(await stored(page))).toEqual(workspaceContents(saved));
});

test('reviewed double-faced deck import retries a rejected save once and survives reload',async({page},testInfo)=>{
  await testInfo.attach('environment',{body:JSON.stringify({browser:page.context().browser().version(),viewport:page.viewportSize(),appearance:testInfo.project.use.colorScheme,origin:new URL(page.url()).origin}),contentType:'application/json'});
  await page.route('**/api/collection',route=>{
    const names=route.request().postDataJSON().names;
    return names?route.fulfill({json:{data:[],not_found:names.map(name=>({name}))}}):route.fallback();
  });
  let unavailable=true;
  await page.route('**/api/search?*',route=>{
    const query=new URL(route.request().url()).searchParams.get('q');
    if(!query.includes(name))return route.fallback();
    if(unavailable)return route.fulfill({status:502,json:{error:'Synthetic lookup outage'}});
    return route.fulfill({json:{data:[foil],has_more:false}});
  });
  const before=await stored(page);
  await page.getByRole('button',{name:'Import deck',exact:true}).click();
  await page.getByRole('textbox',{name:'Deck name',exact:true}).fill('Lookup audit');
  const list=page.getByRole('textbox',{name:'Decklist',exact:true});
  const review=page.getByRole('button',{name:'Review import',exact:true});
  const alert=page.locator('#import-form').getByRole('alert');
  await list.fill('Maybeboard\n2 '+name+'\n1 Missing card with a long name');
  await review.press('Enter');
  await expect(alert).toContainText('Card lookup is unavailable');
  unavailable=false;
  await review.press('Enter');
  await expect(alert).toContainText('Missing card with a long name');
  await expect(alert).not.toContainText(name);
  await fits(page);
  await page.screenshot({path:testInfo.outputPath('import-missing-name.png')});
  await list.fill('Maybeboard\n2 '+name);
  await review.press('Enter');
  const status=page.locator('#import-form').getByRole('status');
  await expect(status).toHaveText('2 copies ready to import into Lookup audit.');
  await expect(page.getByRole('button',{name:'Import reviewed cards',exact:true})).toBeFocused();
  await fits(page);
  await page.screenshot({path:testInfo.outputPath('import-ready.png')});
  expect(await stored(page)).toEqual(before);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button',{name:'Import deck',exact:true})).toBeFocused();
  expect(await stored(page)).toEqual(before);
  await page.getByRole('button',{name:'Import deck',exact:true}).click();
  await page.getByRole('textbox',{name:'Deck name',exact:true}).fill('Lookup audit');
  await list.fill('Maybeboard\n2 '+name);
  await review.press('Enter');
  await blockWrites(page);await page.getByRole('button',{name:'Import reviewed cards',exact:true}).press('Enter');
  await expect(page.locator('#import-error')).toContainText('Workspace unchanged');expect(await stored(page)).toEqual(before);
  await page.addStyleTag({content:'#dialog p,#dialog label,#dialog button{font-size:24px}'});
  await page.getByRole('button',{name:'Import reviewed cards',exact:true}).scrollIntoViewIfNeeded();
  await fits(page);await page.screenshot({path:testInfo.outputPath('import-quota-enlarged.png')});
  await page.evaluate(()=>window.rejectWorkspaceWrite=false);
  await page.getByRole('button',{name:'Import reviewed cards',exact:true}).press('Enter');
  await expect(page.locator('#dialog')).not.toBeVisible();const saved=await stored(page);
  await expect(page.locator('#toast')).toHaveText('2 copies imported into Lookup audit.');
  expect(saved.decks).toHaveLength(before.decks.length+1);expect(saved.collection).toEqual(before.collection);
  expect(saved.decks.at(-1).cards[0]).toMatchObject({card:foil,qty:2,finish:'foil',zone:'maybeboard'});
  await page.reload();expect(workspaceContents(await stored(page))).toEqual(workspaceContents(saved));
});
