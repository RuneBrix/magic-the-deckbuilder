import { test, expect } from '@playwright/test';
import { prepareApp, cards } from './fixtures.mjs';

const beast={...cards[0],id:'11111111-1111-4111-8111-111111111111',oracle_id:'7735eeba-693b-47e2-bd51-414379cf1016',name:'Beast Within',type_line:'Instant'};
test.beforeEach(async({page})=>prepareApp(page));

test('Quick add immediately adds nonfoil with Removal, shows the resolved edition and preserves it on reload',async({page},testInfo)=>{
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
  await expect(dialog).toBeHidden();
  await expect(input).toBeFocused();
  const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('arcana.workspace.v2')));
  let entry=(await stored()).decks[0].cards.find(e=>e.card.name==='Beast Within');
  expect([entry.qty,entry.zone,entry.finish,entry.tags[0]]).toEqual([1,'main','regular','Removal']);
  await input.press('Enter');
  expect((await stored()).decks[0].cards.find(e=>e.card.name==='Beast Within').qty).toBe(1);
  await input.fill('Beast');
  await page.getByRole('option',{name:'Beast Within',exact:true}).click();
  await expect(input).toBeFocused();
  entry=(await stored()).decks[0].cards.find(e=>e.card.name==='Beast Within');
  expect([entry.qty,entry.zone,entry.finish,entry.tags[0]]).toEqual([2,'main','regular','Removal']);
  await page.locator('#editor-layout').selectOption('text-horizontal');
  const row=page.locator('.deck-entry').filter({has:page.locator(`[data-inspect="${beast.id}"]`)});
  await expect(row.locator('.deck-card-variant')).toHaveText('TST · #1');
  await expect(row.locator('.deck-card-name')).toHaveAttribute('title',/Smoke Test.*Nonfoil/);
  await row.scrollIntoViewIfNeeded();
  await page.screenshot({path:testInfo.outputPath('quick-add-result.png')});
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

test('Quick add fails without changing saved or live copies, retries once and explains foil-only printings',async({page},testInfo)=>{
  const foil={...beast,id:'22222222-2222-4222-8222-222222222222',finishes:['foil']};
  await page.route('**/api/search?**',route=>route.fulfill({json:{data:[new URL(route.request().url()).searchParams.get('q').includes('Foil')?foil:beast],total_cards:1,has_more:false}}));
  await page.route('**/api/printings?**',route=>route.fulfill({json:{data:[foil],has_more:false}}));
  await page.getByRole('button',{name:'Smoke Garden',exact:true}).click();
  const input=page.getByRole('combobox',{name:'Quick add card',exact:true});
  const before=await page.evaluate(()=>localStorage.getItem('arcana.workspace.v2'));
  await page.evaluate(()=>{
    const persist=Storage.prototype.setItem;
    window.restoreStorage=()=>Storage.prototype.setItem=persist;
    Storage.prototype.setItem=function(key,value){if(key==='arcana.workspace.v2')throw new DOMException('Quota exceeded','QuotaExceededError');return persist.call(this,key,value);};
  });
  await input.fill('Beast');await page.getByRole('option',{name:'Beast Within',exact:true}).click();
  await expect(page.locator('#quick-add-status')).toContainText('Card was not added. Browser storage');
  expect(await page.evaluate(()=>localStorage.getItem('arcana.workspace.v2'))).toBe(before);
  await expect(page.locator(`[data-inspect="${beast.id}"]`)).toHaveCount(0);
  await expect(input).toBeFocused();
  await page.screenshot({path:testInfo.outputPath('quick-add-storage-error.png')});
  await page.evaluate(()=>window.restoreStorage());
  await input.fill('Beast');await page.getByRole('option',{name:'Beast Within',exact:true}).press('Enter');
  // Option buttons retain their native Enter activation as well as combobox navigation.
  await expect(page.locator('#toast')).toHaveText('Added Beast Within');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('arcana.workspace.v2')).decks[0].cards.find(e=>e.card.name==='Beast Within').qty)).toBe(1);
  await input.fill('Foil');await page.getByRole('option',{name:'Beast Within',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Add card to deck'});
  await expect(dialog.locator('#deck-card-error')).toContainText('no nonfoil version');
  await expect(dialog.getByLabel('Finish',{exact:true})).toHaveValue('foil');
  await dialog.getByRole('button',{name:'Add card(s) to deck',exact:true}).click();
  const entries=await page.evaluate(()=>JSON.parse(localStorage.getItem('arcana.workspace.v2')).decks[0].cards.filter(e=>e.card.name==='Beast Within'));
  expect(entries.map(e=>[e.card.id,e.finish,e.qty])).toEqual([[beast.id,'regular',1],[foil.id,'foil',1]]);
  await expect(input).toBeFocused();
});

test('existing unassigned cards can explicitly use a suggestion while other manual choices survive',async({page},testInfo)=>{
  await page.evaluate(beast=>{
    const key='arcana.workspace.v2',data=JSON.parse(localStorage.getItem(key));
    data.decks[0].cards=[
      {card:beast,qty:1,tags:[],zone:'main'},
      {card:{...beast,id:'legacy-manual'},qty:1,tags:['','Legacy secondary'],zone:'sideboard'},
      {card:{...beast,id:'manual-role'},qty:1,tags:['My answer','Removal'],zone:'maybeboard'},
    ];
    localStorage.setItem(key,JSON.stringify(data));
  },beast);
  await page.reload();await page.getByRole('button',{name:'Smoke Garden',exact:true}).click();
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('arcana.workspace.v2')).decks[0].cards);
  expect(before.map(e=>e.tags)).toEqual([[],['','Legacy secondary'],['My answer','Removal']]);
  await page.getByRole('button',{name:/Card actions for Beast Within in Main deck/}).press('Enter');
  await page.getByRole('menuitem',{name:/Assign card to function/}).press('Enter');
  await page.getByRole('menuitem',{name:'Use suggested function: Removal',exact:true}).press('Enter');
  const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('arcana.workspace.v2')).decks[0].cards);
  expect(after.map(e=>e.tags)).toEqual([['Removal'],['','Legacy secondary'],['My answer','Removal']]);
  await page.locator('#editor-group').selectOption('role');
  await expect(page.locator('.deck-group h4').filter({hasText:'Removal'})).toBeVisible();
  await page.screenshot({path:testInfo.outputPath('suggested-function.png')});
  await page.reload();await page.getByRole('button',{name:'Smoke Garden',exact:true}).click();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('arcana.workspace.v2')).decks[0].cards.map(e=>e.tags))).toEqual(after.map(e=>e.tags));
  await page.getByRole('button',{name:/Card actions for Beast Within in Main deck/}).press('Enter');
  await page.getByRole('menuitem',{name:/Assign card to function/}).press('Enter');
  await page.getByRole('menuitemradio',{name:'Unassigned',exact:true}).press('Enter');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('arcana.workspace.v2')).decks[0].cards[0].tags)).toEqual(['','Removal']);
});

test('text import and unfiltered Explore use the same defaults and retain printing metadata',async({page},testInfo)=>{
  await page.route('**/api/collection',route=>route.fulfill({json:{data:[beast],not_found:[]}}));
  await page.route('**/api/search?**',route=>route.fulfill({json:{data:[beast],total_cards:1,has_more:false}}));
  await page.route('**/api/printings?**',route=>route.fulfill({json:{data:[beast],has_more:false}}));
  await page.getByRole('button',{name:'Smoke Garden',exact:true}).click();
  await page.getByLabel('Deck actions for Smoke Garden',{exact:true}).click();
  await page.getByRole('button',{name:'Import cards',exact:true}).click();
  let dialog=page.getByRole('dialog');
  await dialog.getByLabel('Decklist',{exact:true}).fill('1 Beast Within');
  await dialog.getByRole('button',{name:'Review import',exact:true}).click();
  await dialog.getByRole('button',{name:'Import reviewed cards',exact:true}).click();
  const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('arcana.workspace.v2')).decks[0].cards.find(e=>e.card.name==='Beast Within'));
  let entry=await read();
  expect([entry.qty,entry.finish,entry.tags[0]]).toEqual([1,'regular','Removal']);
  await page.locator('#editor-layout').selectOption('text-vertical');
  await expect(page.locator('.deck-entry').filter({has:page.locator(`[data-inspect="${beast.id}"]`)}).locator('.deck-card-variant')).toHaveText('TST · #1');
  await page.getByRole('button',{name:'Explore cards',exact:true}).click();
  await page.locator('#raw').fill('Beast Within');
  await page.locator('#search-form').getByRole('button',{name:'Search',exact:true}).click();
  await page.locator(`[data-add="${beast.id}"]`).click();
  dialog=page.getByRole('dialog',{name:'Add card to deck'});
  await dialog.getByLabel('Destination deck').selectOption('smoke-deck');
  await expect(dialog.locator('#add-function-hint')).toContainText('Automatic primary: Removal');
  await dialog.getByRole('button',{name:'Add card(s) to deck',exact:true}).click();
  entry=await read();
  expect([entry.qty,entry.finish,entry.tags[0],entry.card.set]).toEqual([2,'regular','Removal','tst']);
  await page.reload();await page.getByRole('button',{name:'Smoke Garden',exact:true}).click();
  await page.locator('#editor-layout').selectOption('text-horizontal');
  await page.locator(`[data-inspect="${beast.id}"]`).scrollIntoViewIfNeeded();
  await page.screenshot({path:testInfo.outputPath('resolved-import-printing.png')});
  expect(await read()).toEqual(entry);
});

test('legacy and double-faced text entries keep honest metadata and stable controls with long values',async({page},testInfo)=>{
  const name='A very long double-faced card name // A much longer reverse land name';
  const release='A long edition name with extended collector information';
  await page.evaluate(({card,name,release})=>{
    const key='arcana.workspace.v2',data=JSON.parse(localStorage.getItem(key));
    const double={...card,id:'long-double',name,layout:'modal_dfc',set:undefined,set_name:release,collector_number:'12345',card_faces:[{name:'Front',type_line:'Creature',mana_cost:'{G}',image_uris:card.image_uris},{name:'Reverse',type_line:'Land',image_uris:card.image_uris}]};
    const old={...card,id:'old-incomplete',name:'Older incomplete card'};
    delete old.set;delete old.set_name;delete old.collector_number;delete old.finishes;
    data.decks[0].cards=[{card:double,qty:142,tags:[],zone:'main'},{card:old,qty:1,tags:[],zone:'sideboard'}];
    localStorage.setItem(key,JSON.stringify(data));
  },{card:cards[0],name,release});
  await page.reload();await page.getByRole('button',{name:'Smoke Garden',exact:true}).click();
  await page.locator('#editor-layout').selectOption('text-horizontal');
  const long=page.locator('[data-inspect="long-double"]'),old=page.locator('[data-inspect="old-incomplete"]');
  await expect(long).toHaveAccessibleName(name);
  await expect(long).toHaveAttribute('title',new RegExp(release+'.*#12345.*Nonfoil'));
  await expect(old.locator('.deck-card-variant')).toHaveText('Set unknown · Finish unknown');
  await expect(old).toHaveAttribute('title',/Unknown set.*Finish unknown/);
  await long.focus();
  const before=await old.boundingBox();
  await long.hover();
  expect(await old.boundingBox()).toEqual(before);
  await long.screenshot({path:testInfo.outputPath('long-printing-caption.png')});
  await old.screenshot({path:testInfo.outputPath('legacy-unknown-caption.png')});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(testInfo.project.name.startsWith('desktop')){
    await page.evaluate(()=>document.documentElement.style.zoom=2);
    await long.focus();
    await long.evaluate(el=>el.scrollIntoView({block:'center'}));
    await expect(long).toBeFocused();
    await expect(long).toBeInViewport();
    expect((await long.boundingBox()).width).toBeGreaterThan(160);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:testInfo.outputPath('enlarged-printing-caption.png')});
  }
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
