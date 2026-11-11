import {test,expect} from '@playwright/test';
import {prepareApp,cards} from './fixtures.mjs';

test.beforeEach(async({page,browser},testInfo)=>{
  await prepareApp(page);
  await testInfo.attach('browser-environment',{
    body:JSON.stringify({date:new Date().toISOString(),browser:browser.version(),viewport:page.viewportSize(),origin:testInfo.project.use.baseURL,appearance:testInfo.project.use.colorScheme}),
    contentType:'application/json',
  });
});

// Moving through Maybeboard intentionally refreshes legality; retain all other data in comparisons.
const savedCards=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('arcana.workspace.v2')).decks[0].cards.map(entry=>{
  const {legalityUpdatedAt,...card}=entry.card;
  return {...entry,card};
}));

async function openDeck(page){
  await page.getByRole('button',{name:'Smoke Garden',exact:true}).click();
  await page.getByRole('tab',{name:'Checks',exact:true}).click();
  await expect(page.locator('.freshness')).toContainText('Legality refreshed this session');
  await page.getByRole('tab',{name:'Cards',exact:true}).click();
}
async function withinViewport(locator){
  await expect(locator).toBeVisible();
  expect(await locator.evaluate(element=>{
    const r=element.getBoundingClientRect();
    return r.left>=0&&r.top>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1;
  })).toBe(true);
}
async function stickyNavigation(page,current){
  const nav=page.locator('.workspace-nav');
  await expect.poll(()=>nav.evaluate(el=>Math.round(el.getBoundingClientRect().top))).toBe(0);
  const active=nav.getByRole('button',{name:current,exact:true});
  await expect(active).toHaveClass(/selected/);
  await expect(active).toHaveAttribute('aria-current',/page|location/);
  await withinViewport(active);
  expect(await active.evaluate(el=>{
    const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
  })).toBe(true);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
}
async function moveCard(page,isMobile,from,to){
  const trigger=page.getByRole('button',{name:`Card actions for Smoke Card 2 in ${from}`,exact:true});
  if(isMobile)await trigger.tap();else await trigger.press('Enter');
  await expect(page.locator('#card-actions')).toBeVisible({timeout:2000});
  const move=page.getByRole('menuitem',{name:'Move to…',exact:true});
  if(isMobile)await move.tap();else await move.press('ArrowRight');
  const destinations=page.locator('#card-submenu');
  // Empty optional zones remain available even while their viewing sections are hidden.
  for(const label of ['Sideboard','Maybeboard'].filter(label=>label!==from))await expect(destinations.getByRole('menuitem',{name:label,exact:true})).toBeVisible();
  const target=destinations.getByRole('menuitem',{name:to,exact:true});
  if(isMobile)await target.tap();else await target.press('Enter');
}

test('optional zones transition in every layout and tracker without changing other entries',async({page,isMobile},testInfo)=>{
  test.setTimeout(60_000);
  await page.evaluate(()=>{
    const key='arcana.workspace.v2',data=JSON.parse(localStorage.getItem(key));
    data.decks[0].cards=data.decks[0].cards.slice(0,3);
    data.decks[0].cards.forEach(entry=>entry.commander=entry.zone==='command');
    localStorage.setItem(key,JSON.stringify(data));
  });
  await page.reload();await openDeck(page);
  const original=await savedCards(page),area=page.locator('.deck-rows');
  for(const layout of ['visual-horizontal','visual-vertical','text-horizontal','text-vertical']){
    await page.locator('#editor-layout').selectOption(layout);
    for(const zone of ['Sideboard','Maybeboard']){
      const section=area.locator('.deck-zone').filter({has:page.getByRole('heading',{name:new RegExp(`^${zone} ·`)})});
      await expect(section).toHaveCount(0);
      await moveCard(page,isMobile,'Main deck',zone);
      await expect(section).toBeVisible();await expect(section).toContainText(`${zone} · 2`);
      await page.locator('#editor-search').fill('no matching cards');
      await expect(section).toContainText('0 shown');
      await expect(section).toContainText('No cards match these filters.');
      await page.locator('#editor-search').fill('');
      await moveCard(page,isMobile,zone,'Main deck');
      await expect(section).toHaveCount(0);
    }
  }
  expect(await savedCards(page)).toEqual(original);
  await page.getByRole('button',{name:'Find cards to add',exact:true}).click();
  const tracker=page.locator('#deck-tracker');
  for(const zone of ['Sideboard','Maybeboard']){
    const heading=tracker.getByRole('heading',{name:new RegExp(`^${zone} ·`)});
    await expect(heading).toHaveCount(0);
    await tracker.getByRole('button',{name:'Smoke Card 2',exact:true}).click();
    await page.locator('#detail-add').click();
    await page.locator('#add-zone').selectOption(zone==='Sideboard'?'sideboard':'maybeboard');
    await page.getByRole('button',{name:'Add card(s) to deck',exact:true}).click();
    await page.keyboard.press('Escape');
    await expect(heading).toContainText(`${zone} · 1`);
    const section=heading.locator('..');
    await section.getByRole('button',{name:`Remove one Smoke Card 2 from ${zone}`,exact:true}).click();
    await expect(heading).toHaveCount(0);
  }
  expect(await savedCards(page)).toEqual(original);
  await stickyNavigation(page,'Explore cards');
  await page.screenshot({path:testInfo.outputPath('optional-zones-tracker.png')});
});

test('sticky navigation keeps long surfaces, focus, overlays and trackers reachable',async({page,isMobile},testInfo)=>{
  await page.evaluate(()=>{
    const key='arcana.workspace.v2',data=JSON.parse(localStorage.getItem(key));
    for(let i=1;i<18;i++)data.decks.push({...structuredClone(data.decks[0]),id:'library-'+i,name:'Library deck '+i});
    localStorage.setItem(key,JSON.stringify(data));
  });
  await page.reload();
  await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));
  expect(await page.evaluate(()=>scrollY)).toBeGreaterThan(0);
  await stickyNavigation(page,'My decks');
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  const dialog=page.getByRole('dialog');
  await withinViewport(dialog);
  await dialog.locator('.backup-help > summary').press('Enter');
  await dialog.locator('.backup-help p').last().scrollIntoViewIfNeeded();
  await withinViewport(dialog.locator('.backup-help p').last());
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button',{name:'Settings',exact:true})).toBeFocused();
  await stickyNavigation(page,'My decks');
  await page.getByRole('button',{name:'My decks',exact:true}).click();
  await openDeck(page);
  await page.locator('#editor-layout').selectOption('text-vertical');
  const original=await savedCards(page);
  const lastName=page.locator('.deck-workspace .deck-card-name').last();
  await lastName.focus();
  await withinViewport(lastName);
  expect(await lastName.evaluate(el=>el.getBoundingClientRect().top>=document.querySelector('.workspace-nav').getBoundingClientRect().bottom)).toBe(true);
  await stickyNavigation(page,'My decks');
  const action=lastName.locator('..').getByRole('button',{name:/Card actions/});
  await action.press('Enter');
  await withinViewport(page.locator('#card-actions'));
  await page.getByRole('menuitem',{name:'Open details',exact:true}).press('Enter');
  await withinViewport(dialog);
  await page.keyboard.press('Escape');
  await action.press('Enter');
  await page.evaluate(()=>scrollBy(0,-100));
  await expect(page.locator('#card-actions')).toBeHidden();
  if(!isMobile){
    await page.locator('.deck-workspace .deck-card-name').nth(15).focus();
    const preview=page.locator('.deck-hover-preview');
    await expect(preview).toBeVisible();
    expect(await preview.evaluate(el=>el.getBoundingClientRect().top>=document.querySelector('.workspace-nav').getBoundingClientRect().bottom)).toBe(true);
  }
  await page.getByRole('link',{name:'Bracket discussion guidance',exact:true}).click();
  const discussion=page.locator('#bracket-discussion');
  await expect(discussion).toBeFocused();
  expect(await discussion.evaluate(el=>el.getBoundingClientRect().top>=document.querySelector('.workspace-nav').getBoundingClientRect().bottom)).toBe(true);
  await page.getByRole('tab',{name:'Cards',exact:true}).click();
  await page.getByRole('button',{name:'Find cards to add',exact:true}).click();
  await page.route('**/api/search?**',route=>route.fulfill({json:{data:cards,total_cards:cards.length,has_more:false}}));
  await page.locator('#raw').fill('Smoke');
  await page.locator('#search-form').getByRole('button',{name:'Search',exact:true}).click();
  await expect(page.locator('.card-grid > article')).toHaveCount(24);
  if(isMobile){
    await page.getByRole('button',{name:'View tracker · Smoke Garden',exact:true}).click();
    await withinViewport(page.locator('#tracker-heading'));
  }else{
    await page.evaluate(()=>scrollTo(0,700));
    const top=await page.locator('#deck-tracker').evaluate(el=>el.getBoundingClientRect().top);
    const bottom=await page.locator('.workspace-nav').evaluate(el=>el.getBoundingClientRect().bottom);
    expect(top).toBeCloseTo(bottom,0);
  }
  await stickyNavigation(page,'Explore cards');
  await page.screenshot({path:testInfo.outputPath('navigation-tracker.png')});
  if(isMobile){
    const lastCopyControl=page.locator('#deck-tracker [data-zone-plus]').last();
    await lastCopyControl.focus();
    await withinViewport(lastCopyControl);
    expect(await lastCopyControl.evaluate(el=>{
      const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
    })).toBe(true);
  }
  expect(await savedCards(page)).toEqual(original);
  // Measure the wrapped header after a real resize rather than relying on a fixed CSS height.
  await page.setViewportSize({width:isMobile?540:760,height:720});
  await page.evaluate(()=>scrollTo(0,500));
  await stickyNavigation(page,'Explore cards');
  await expect.poll(()=>page.evaluate(()=>Math.abs(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-height'))-document.querySelector('.workspace-nav').getBoundingClientRect().height))).toBeLessThan(1);
});
