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
    data.collection=[{card:{...structuredClone(e[1].card),id:'00000000-0000-4000-8000-000000000900'},finish:'foil',qty:1},{card:structuredClone(e[2].card),finish:'regular',qty:12}];
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
  await expect(page.locator('.freshness')).toContainText('Legality refreshed this session');
  await page.getByRole('tab',{name:'Cards',exact:true}).click();
  const saved=()=>page.evaluate(()=>localStorage.getItem('arcana.workspace.v2')),before=await saved();
  const card=n=>page.locator('.deck-entry.visual-card').filter({has:page.locator(`.card-art[data-inspect="00000000-0000-4000-8000-${String(n).padStart(12,'0')}"]`)});
  for(const [n,state] of [[1,'missing'],[2,'partial'],[3,'owned'],[4,'missing'],[5,'missing'],[6,'unavailable'],[7,'excluded']])await expect(card(n).locator('.entry-quantity')).toHaveAttribute('data-ownership',state);
  await expect(card(2).locator('.entry-quantity')).toHaveAccessibleName('2 copies · 1 of 2 copies covered by collection; 1 missing');
  await expect(card(4).locator('.quantity-number')).toHaveText('500');
  await expect(card(2).locator('.stack-card-meta')).toHaveText('$3.00');
  await expect(card(4).locator('.stack-card-meta')).toHaveText('$2.00');
  for(const layout of ['visual-horizontal','visual-vertical']) {
    await page.locator('#editor-layout').selectOption(layout);
    await card(2).focus();
    await expect(page.locator('#deck-card-preview .preview-art')).toHaveAttribute('data-finish','foil');
    await expect(card(2)).toHaveAccessibleName(/Foil/);
    for(const [n,expected] of [[1,'none'],[2,'""'],[4,'""']])expect(await card(n).locator('.card-art').evaluate(el=>getComputedStyle(el,'::after').content)).toBe(expected);
  }
  await page.locator('#editor-layout').selectOption('visual-horizontal');
  for(const theme of ['light','dark'])for(const palette of ['green','blue','white','orange','rose','teal','sepia']) {
    await page.evaluate(({theme,palette})=>Object.assign(document.documentElement.dataset,{theme,palette}),{theme,palette});
    await card(2).focus();
    const contrast=await card(2).locator('.quantity-number').evaluate(el=>{
      const style=getComputedStyle(el),lum=color=>{const rgb=color.match(/[\d.]+/g).slice(0,3).map(c=>Number(c)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
      const values=[lum(style.color),lum(style.backgroundColor)].sort((a,b)=>b-a);return (values[0]+.05)/(values[1]+.05);
    });
    expect(contrast).toBeGreaterThanOrEqual(4.5);
    await page.screenshot({path:testInfo.outputPath(`finishes-${theme}-${palette}.png`)});
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  expect(await card(2).locator('.card-art').evaluate(el=>getComputedStyle(el,'::after').animationName)).toBe('none');
  expect(await saved()).toBe(before);
  await page.getByRole('button',{name:'Collection',exact:true}).click();
  await expect(page.locator('.collection-art[data-finish="foil"]')).toHaveCount(1);
  expect(await saved()).toBe(before);
});
