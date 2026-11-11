import { test, expect } from '@playwright/test';
import { prepareApp, cards } from './fixtures.mjs';

const beast={...cards[0],id:'11111111-1111-4111-8111-111111111111',oracle_id:'7735eeba-693b-47e2-bd51-414379cf1016',name:'Beast Within',type_line:'Instant'};
test.beforeEach(async({page})=>prepareApp(page));

test('Quick add uses the shared confirmation, assigns Removal offline and preserves it on reload',async({page},testInfo)=>{
  const requests=[];
  await page.route('**/api/search?**',route=>{
    requests.push(new URL(route.request().url()).searchParams.get('q'));
    return route.fulfill({json:{data:[beast,...cards.slice(0,10)],total_cards:11,has_more:false}});
  });
  await page.route('**/api/printings?**',route=>route.fulfill({json:{data:[beast],has_more:false}}));
  await page.getByRole('button',{name:'Smoke Garden',exact:true}).click();
  const input=page.getByRole('combobox',{name:'Quick add card',exact:true});
  await input.fill('So');await page.waitForTimeout(300);
  expect(requests).toHaveLength(0);
  await expect(page.getByRole('listbox',{name:'Card name suggestions'})).toBeHidden();
  await input.fill('Sol');
  await expect(page.getByRole('option',{name:'Beast Within',exact:true})).toBeVisible();
  expect(requests).toEqual(['game:paper name:/Sol/']);
  await expect(page.locator('#quick-add-matches [role=option]')).toHaveCount(8);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('quick-add-suggestions.png')});
  await input.press('ArrowDown');
  await expect(input).toHaveAttribute('aria-activedescendant','quick-add-option-0');
  await input.press('Enter');
  const dialog=page.getByRole('dialog');
  await expect(dialog.getByRole('heading',{name:'Add card to deck',exact:true})).toBeVisible();
  await expect(dialog.getByLabel('Destination deck')).toHaveValue('smoke-deck');
  await expect(dialog.locator('#add-function-hint')).toContainText('Automatic primary: Removal');
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  await expect(input).toBeFocused();
  const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('arcana.workspace.v2')));
  expect((await stored()).decks[0].cards.some(e=>e.card.name==='Beast Within')).toBe(false);
  await input.fill('Beast');
  await page.getByRole('option',{name:'Beast Within',exact:true}).click();
  await dialog.getByLabel('Quantity to add').fill('2');
  await dialog.getByLabel('Finish',{exact:true}).selectOption('foil');
  await dialog.getByLabel('Destination zone').selectOption('sideboard');
  await dialog.getByRole('button',{name:'Add card(s) to deck',exact:true}).click();
  await expect(input).toBeFocused();
  let entry=(await stored()).decks[0].cards.find(e=>e.card.name==='Beast Within');
  expect([entry.qty,entry.zone,entry.finish,entry.tags[0]]).toEqual([2,'sideboard','foil','Removal']);
  // The source snapshot stays available even when upstream requests fail.
  await page.route('**/api/**',route=>route.fulfill({status:503,json:{error:'Offline'}}));
  await page.reload();await page.getByRole('button',{name:'Smoke Garden',exact:true}).click();
  await page.locator('#editor-group').selectOption('role');
  await expect(page.locator('.deck-group h4').filter({hasText:'Removal'})).toBeVisible();
  await input.fill('Error');
  await expect(page.locator('#quick-add-status')).toContainText('Could not search card names');
  entry=(await stored()).decks[0].cards.find(e=>e.card.name==='Beast Within');
  expect(entry.tags[0]).toBe('Removal');
});

test('Quick add dismisses suggestions with Escape and rejects stale searches and departed views',async({page})=>{
  let oldRoute;
  await page.route('**/api/search?**',async route=>{
    const q=new URL(route.request().url()).searchParams.get('q');
    if(q.includes('Old')){oldRoute=route;return;}
    return route.fulfill({json:{data:q.includes('None')?[]:[beast],total_cards:1,has_more:false}});
  });
  await page.getByRole('button',{name:'Smoke Garden',exact:true}).click();
  const input=page.getByRole('combobox',{name:'Quick add card',exact:true});
  await input.fill('Old');await expect.poll(()=>Boolean(oldRoute)).toBe(true);
  await input.fill('New');
  await expect(page.getByRole('option',{name:'Beast Within',exact:true})).toBeVisible();
  await oldRoute.fulfill({json:{data:[{...beast,name:'Stale card'}],total_cards:1,has_more:false}}).catch(()=>{});
  await expect(page.getByRole('option',{name:'Stale card',exact:true})).toHaveCount(0);
  await input.press('Escape');
  await expect(page.locator('#quick-add-matches')).toBeHidden();
  await input.fill('None');await expect(page.locator('#quick-add-status')).toHaveText('No cards match that name.');
  await input.fill('Old');
  await page.getByRole('button',{name:'My decks',exact:true}).click();
  await expect(page.getByRole('heading',{name:'My decks',exact:true})).toBeVisible();
  await expect(page.getByRole('dialog')).toBeHidden();
});
