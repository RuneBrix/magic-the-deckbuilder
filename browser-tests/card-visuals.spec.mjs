import { test, expect } from '@playwright/test';
import { prepareApp } from './fixtures.mjs';

test.beforeEach(async({page})=>prepareApp(page));

test('commander inspection keeps Main deck and neighboring card targets stationary',async({page,isMobile},testInfo)=>{
  test.skip(isMobile,'Pointer-only reproduction; touch is covered by the dense-card checks.');
  await page.evaluate(()=>{const key='arcana.workspace.v2',data=JSON.parse(localStorage.getItem(key));data.decks[0].cards=data.decks[0].cards.slice(0,2);localStorage.setItem(key,JSON.stringify(data));});
  await page.reload();
  await page.getByRole('button',{name:'Smoke Garden',exact:true}).click();
  for(const layout of ['visual-horizontal','visual-vertical']) {
    await page.locator('#editor-layout').selectOption(layout);
    const commander=page.locator('.visual-card[data-preview-entry]').first();
    const positions=()=>page.locator('.deck-zone,.visual-card[data-preview-entry]').evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};}));
    const before=await positions();
    await commander.hover();
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const after=await positions();
    await page.screenshot({path:testInfo.outputPath(`commander-${layout}.png`)});
    expect(after).toEqual(before);
    await page.getByRole('heading',{name:'Smoke Garden',exact:true}).hover();
  }
});

test('dense visual cards retain first, middle, last and following-section geometry through pointer and focus',async({page,isMobile},testInfo)=>{
  await page.evaluate(()=>{const key='arcana.workspace.v2',data=JSON.parse(localStorage.getItem(key));data.decks[0].cards.at(-1).zone='sideboard';localStorage.setItem(key,JSON.stringify(data));});
  await page.reload();await page.getByRole('button',{name:'Smoke Garden',exact:true}).click();
  for(const layout of ['visual-horizontal','visual-vertical']) {
    await page.locator('#editor-layout').selectOption(layout);
    const cards=page.locator('.deck-entry.visual-card'),main=page.locator('.deck-zone[data-drop-zone="main"] .visual-card');
    const positions=()=>page.locator('.deck-zone,.deck-entry.visual-card').evaluateAll(nodes=>nodes.map(el=>{const r=el.getBoundingClientRect();return [r.x+scrollX,r.y+scrollY,r.width,r.height];}));
    const before=await positions(),count=await main.count();
    for(const index of [0,1,2,Math.floor(count/2),count-1,0,count-1]) {
      const card=main.nth(index);
      if(!isMobile)await card.locator('.card-art').hover();
      await card.focus();
      expect(await positions()).toEqual(before);
      const control=card.locator('.card-menu-trigger');
      await control.scrollIntoViewIfNeeded();
      expect(await control.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(true);
      expect(await positions()).toEqual(before);
    }
    await main.last().locator('.card-menu-trigger').press('Enter');
    await expect(page.getByRole('menuitem',{name:'Open details',exact:true})).toBeVisible();
    await page.keyboard.press('Escape');
    expect(await positions()).toEqual(before);
    await expect(cards.locator('.stack-card-meta')).toHaveCount(40);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
    await page.screenshot({path:testInfo.outputPath(`dense-${layout}.png`)});
  }
});

test('finish treatments and ownership markers preserve quotes, inventory and contrast in all palettes',async({page,isMobile},testInfo)=>{
  test.setTimeout(60000);
  await page.evaluate(()=>{
    const key='arcana.workspace.v2',data=JSON.parse(localStorage.getItem(key));
    data.decks[0].cards=data.decks[0].cards.slice(0,7);
    const e=data.decks[0].cards;data.decks[0].currency='USD';
    e[0].finish='regular';e[1].finish='foil';e[1].qty=2;e[1].card.prices.usd_foil='3.00';
    e[2].finish='regular';e[2].qty=12;e[3].finish='etched';e[3].qty=500;e[3].card.prices.usd_etched='2.00';e[3].card.finishes=['nonfoil','foil','etched'];
    e[4].card={...structuredClone(e[1].card),id:e[4].card.id};e[4].finish='regular';e[4].qty=1;e[4].zone='sideboard';
    delete e[5].card.oracle_id;e[6].zone='maybeboard';
    data.collection=[
      {card:{...structuredClone(e[1].card),id:'00000000-0000-4000-8000-000000000900'},finish:'foil',qty:1},
      {card:{...structuredClone(e[2].card),id:'00000000-0000-4000-8000-000000000901'},finish:'regular',qty:12},
      {card:structuredClone(e[0].card),finish:'foil',qty:1},
    ];
    for(const entry of e)entry.card.image_uris={normal:`https://cards.scryfall.io/visual-${entry.card.collector_number}.jpg`};
    localStorage.setItem(key,JSON.stringify(data));
  });
  await page.route('**/api/collection',async route=>{
    const ids=route.request().postDataJSON().ids;
    const cards=await page.evaluate(()=>JSON.parse(localStorage.getItem('arcana.workspace.v2')).decks[0].cards.map(e=>e.card));
    await route.fulfill({json:{data:cards.filter(card=>ids.includes(card.id)),not_found:[]}});
  });
  await page.route('https://cards.scryfall.io/visual-*.jpg',route=>route.fulfill({contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="488" height="680"><rect width="488" height="680" fill="#263c61"/><rect x="15" y="25" width="458" height="55" fill="#f7eed3"/><text x="32" y="63" font-size="28">Synthetic card artwork</text><path d="M30 360 220 100 460 360Z" fill="#71996c"/><rect x="15" y="390" width="458" height="265" fill="#fffdf7"/><text x="30" y="430" font-size="24">Draw a card.</text><text x="30" y="470" font-size="24">A readable rules-text fixture.</text></svg>'}));
  await page.reload();await page.getByRole('button',{name:'Smoke Garden',exact:true}).click();
  await page.getByRole('tab',{name:'Checks',exact:true}).click();
  await expect(page.locator('.check-summary')).not.toContainText('Checking card legality');
  await page.getByRole('tab',{name:'Cards',exact:true}).click();
  const saved=()=>page.evaluate(()=>localStorage.getItem('arcana.workspace.v2')),before=await saved();
  const card=n=>page.locator('.deck-entry.visual-card').filter({has:page.locator(`.card-art[data-inspect="00000000-0000-4000-8000-${String(n).padStart(12,'0')}"]`)});
  const toggle=page.getByRole('checkbox',{name:'Show ownership'});
  const legend=page.locator('.deck-ownership-legend');
  const badge=n=>card(n).locator('.entry-quantity');
  const badgeStyles=()=>badge(2).evaluate(el=>({bg:getComputedStyle(el).backgroundColor,clip:getComputedStyle(el).clipPath,width:el.offsetWidth,height:el.offsetHeight}));
  await expect(toggle).not.toBeChecked();
  await expect(legend).toBeHidden();
  const neutral=await badgeStyles();
  expect(neutral.clip).toBe('none');
  if(isMobile)await toggle.tap();else await toggle.press('Space');
  await expect(toggle).toBeChecked();
  await expect(legend).toBeVisible();
  await expect(legend.getByRole('listitem')).toHaveText(['All in this printing','Covered with other printings','Copies missing']);
  if(!isMobile)await expect(toggle).toBeFocused();
  const colored=await badgeStyles();
  expect(colored.bg).not.toBe(neutral.bg);
  expect([colored.width,colored.height]).toEqual([neutral.width,neutral.height]);
  for(const [n,state] of [[1,'owned'],[2,'partial'],[3,'alternate'],[4,'missing'],[5,'missing'],[6,'unavailable'],[7,'excluded']])await expect(badge(n)).toHaveAttribute('data-ownership',state);
  await expect(badge(2)).toHaveAccessibleName('2 copies · 1 of 2 owned (1 in other printings, 1 missing)');
  await expect(card(3).locator('.card-art')).toHaveAccessibleDescription('12 of 12 owned (12 in other printings)');
  await expect(badge(4)).toHaveText('500');
  expect((await badge(4).boundingBox()).width).toBeGreaterThan((await badge(1).boundingBox()).width);
  await expect(card(4).locator('[data-zone-plus]')).toBeDisabled();
  await expect(card(2).locator('.stack-card-meta')).toHaveText('$3.00');
  await expect(card(4).locator('.stack-card-meta')).toHaveText('$2.00');
  for(const layout of ['visual-horizontal','visual-vertical']) {
    await page.locator('#editor-layout').selectOption(layout);
    await expect(legend).toBeVisible();
    await card(2).focus();
    await expect(page.locator('#deck-card-preview .preview-art')).toHaveAttribute('data-finish','foil');
    await expect(card(2)).toHaveAccessibleName(/Foil/);
    for(const [n,expected] of [[1,'none'],[2,'""'],[4,'""']])expect(await card(n).locator('.card-art').evaluate(el=>getComputedStyle(el,'::after').content)).toBe(expected);
  }
  for(const layout of ['text-horizontal','text-vertical']) {
    await page.locator('#editor-layout').selectOption(layout);
    await expect(legend).toHaveCount(0);
  }
  await page.locator('#editor-layout').selectOption('visual-horizontal');
  await expect(toggle).toBeChecked();
  const zones=page.locator('[data-toggle-deck-zone]');
  for(const zone of await zones.all())await zone.click();
  await expect(legend).toBeHidden();
  for(const zone of await zones.all())await zone.click();
  await expect(legend).toBeVisible();
  const swatchColors=element=>element.evaluate(el=>{
    const {backgroundColor,borderColor}=getComputedStyle(el);
    return [backgroundColor,borderColor];
  });
  for(const theme of ['light','dark'])for(const palette of ['green','blue','white','orange','rose','teal','sepia']) {
    await page.evaluate(({theme,palette})=>Object.assign(document.documentElement.dataset,{theme,palette}),{theme,palette});
    await card(2).focus();
    const contrast=await page.locator('.deck-entry.visual-card .entry-quantity').evaluateAll(badges=>badges.map(el=>{
      const style=getComputedStyle(el),lum=color=>{const rgb=color.match(/[\d.]+/g).slice(0,3).map(c=>Number(c)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
      const values=[lum(style.color),lum(style.backgroundColor)].sort((a,b)=>b-a);return (values[0]+.05)/(values[1]+.05);
    }));
    expect(Math.min(...contrast)).toBeGreaterThanOrEqual(4.5);
    for(const [state,n] of [['owned',1],['alternate',3],['missing',2],['missing',4]]) {
      expect(await swatchColors(legend.locator(`[data-ownership="${state}"]`))).toEqual(await swatchColors(badge(n)));
    }
    await page.screenshot({path:testInfo.outputPath(`finishes-${theme}-${palette}.png`)});
  }
  await page.addStyleTag({content:'.deck-ownership-legend,.deck-ownership-toggle{font-size:24px}'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  await legend.scrollIntoViewIfNeeded();
  await page.screenshot({path:testInfo.outputPath('ownership-legend-enlarged.png')});
  await page.emulateMedia({reducedMotion:'reduce'});
  expect(await card(2).locator('.card-art').evaluate(el=>getComputedStyle(el,'::after').animationName)).toBe('none');
  await page.locator('#editor-search').fill('No matching card');
  await expect(legend).toBeHidden();
  await page.locator('#editor-search').fill('Smoke Card 2');
  await expect(badge(5)).toHaveAttribute('data-ownership','missing');
  await expect(legend).toBeVisible();
  await toggle.uncheck();
  await expect(legend).toBeHidden();
  await expect(page.locator('.deck-entry [data-ownership]')).toHaveCount(0);
  await expect(card(2).locator('.card-art')).not.toHaveAttribute('aria-description');
  expect(await saved()).toBe(before);
  await page.getByRole('button',{name:'Collection',exact:true}).click();
  await expect(page.locator('.collection-art[data-finish="foil"]')).toHaveCount(2);
  expect(await saved()).toBe(before);
});
