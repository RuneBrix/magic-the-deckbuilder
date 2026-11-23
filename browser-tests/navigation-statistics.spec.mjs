import { test, expect } from '@playwright/test';
import { prepareApp } from './fixtures.mjs';

test.beforeEach(async({page})=>prepareApp(page));
const openDeck=page=>page.getByRole('button',{name:'Smoke Garden',exact:true}).click();
const noOverflow=async page=>expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);

test('navigation geometry reserves touch targets in a shorter sticky header',async({page,isMobile},testInfo)=>{
  const nav=page.locator('.workspace-nav');
  const height=await nav.evaluate(el=>el.getBoundingClientRect().height);
  await testInfo.attach('navigation-height',{body:JSON.stringify({height,viewport:page.viewportSize()}),contentType:'application/json'});
  await page.screenshot({path:testInfo.outputPath('navigation-height.png')});
  expect(height).toBeLessThanOrEqual(isMobile?108:60);
  for(const name of ['My decks','Search cards','Collection','Settings','Help']) {
    const button=page.getByRole('button',{name,exact:true});
    const box=await button.boundingBox();expect(box.height).toBeGreaterThanOrEqual(44);
    if(isMobile)expect(box.width).toBeGreaterThanOrEqual(44);
    await button.focus();
    expect(await button.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})).toBe(true);
  }
  await noOverflow(page);
});

test('statistics geometry centers a wider board and makes section headings primary',async({page,isMobile},testInfo)=>{
  await page.evaluate(()=>{
    const key='arcana.workspace.v2',data=JSON.parse(localStorage.getItem(key));
    data.decks[0].cards[1].qty=500;data.decks[0].cards[1].tags=['Long function name '.repeat(4).trim()];
    localStorage.setItem(key,JSON.stringify(data));
  });
  await page.reload();await openDeck(page);
  await page.getByRole('tab',{name:'Statistics',exact:true}).click();
  const board=page.locator('#deck-statistics');
  for(const width of isMobile?[390,600]:[1920,900]) {
    await page.setViewportSize({width,height:900});
    await page.screenshot({path:testInfo.outputPath(`statistics-${width}.png`),fullPage:true});
    const metrics=await board.evaluate(el=>{
      const r=el.getBoundingClientRect(),parent=el.parentElement.getBoundingClientRect();
      const heading=el.querySelector('h3'),label=el.querySelector('.stat-pair span');
      return {width:r.width,left:r.left-parent.left,right:parent.right-r.right,heading:parseFloat(getComputedStyle(heading).fontSize),label:parseFloat(getComputedStyle(label).fontSize)};
    });
    expect(Math.abs(metrics.left-metrics.right)).toBeLessThan(2);
    if(width===1920)expect(metrics.width).toBeGreaterThan(1200);
    expect(metrics.heading).toBeGreaterThan(metrics.label);
    await noOverflow(page);
  }
});

test('My decks restores the last open deck while the library and Explore remain explicit',async({page})=>{
  await page.evaluate(()=>{
    const key='arcana.workspace.v2',data=JSON.parse(localStorage.getItem(key));
    data.decks.push({...structuredClone(data.decks[0]),id:'other-deck',name:'Other Garden'});
    localStorage.setItem(key,JSON.stringify(data));
  });
  await page.reload();await openDeck(page);
  await expect(page.getByRole('button',{name:'Find cards to add',exact:true})).toHaveCount(0);
  await page.getByRole('tab',{name:'Statistics',exact:true}).click();
  for(const destination of ['Collection','Search cards','Settings']) {
    await page.getByRole('button',{name:destination,exact:true}).click();
    if(destination==='Search cards') {
      await page.getByRole('combobox',{name:'Track deck',exact:true}).selectOption('other-deck');
      await page.locator('#raw').fill('otag:ramp');
    }
    await page.getByRole('button',{name:'My decks',exact:true}).click();
    await expect(page.locator('#deck-title')).toHaveText('Smoke Garden');
    await expect(page.getByRole('tab',{name:'Statistics',exact:true})).toHaveAttribute('aria-selected','true');
    await expect(page.locator('#deck-title')).toBeFocused();
  }
  const tracker=await page.evaluate(()=>JSON.parse(localStorage.getItem('arcana.explorer.v1')));
  expect(tracker.id).toBe('other-deck');
  await page.getByRole('button',{name:'Back to library',exact:true}).press('Enter');
  await expect(page.locator('#library-title')).toBeFocused();
  await page.getByRole('button',{name:'Other Garden',exact:true}).click();
  await page.getByRole('button',{name:'Collection',exact:true}).click();
  await page.getByRole('button',{name:'My decks',exact:true}).click();
  await expect(page.locator('#deck-title')).toHaveText('Other Garden');
  await page.getByRole('link',{name:'Arcana home — My decks',exact:true}).click();
  await expect(page.locator('#library-title')).toBeFocused();
  await page.getByRole('button',{name:'My decks',exact:true}).click();
  await expect(page.locator('#deck-title')).toHaveText('Other Garden');
  await page.getByLabel('Deck actions for Other Garden',{exact:true}).click();
  await page.locator('[data-manage="delete"]').click();
  await page.getByRole('button',{name:'Delete Other Garden',exact:true}).click();
  await page.getByRole('button',{name:'Collection',exact:true}).click();
  await page.getByRole('button',{name:'My decks',exact:true}).click();
  await expect(page.locator('#library-title')).toBeVisible();
  await openDeck(page);await page.reload();
  await expect(page.locator('#library-title')).toBeVisible();
});


test('enlarged text keeps navigation, deck actions and Statistics tools reachable',async({page,isMobile},testInfo)=>{
  await page.evaluate(()=>{
    const key='arcana.workspace.v2',data=JSON.parse(localStorage.getItem(key));
    data.decks[0].name='A long deck title with creatures, artifacts and enchantments for many new ideas'.padEnd(100,'x');
    localStorage.setItem(key,JSON.stringify(data));
  });
  await page.reload();
  await page.locator('.library-deck h2 button').click();
  await page.setViewportSize({width:isMobile?390:900,height:900});
  await page.addStyleTag({content:'.workspace-nav .nav-item,.stats-view :is(p,label,input,select,.stat-pair,th,td){font-size:28px}.stats-view h3{font-size:36px}'});
  await page.getByRole('tab',{name:'Statistics',exact:true}).click();
  expect(await page.locator('.stat-pair').first().evaluate(el=>getComputedStyle(el).fontSize)).toBe('28px');
  await noOverflow(page);
  await page.locator('#draw-count').focus();
  expect(await page.locator('#draw-count').evaluate(el=>el.getBoundingClientRect().top>=document.querySelector('.workspace-nav').getBoundingClientRect().bottom)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('statistics-enlarged.png')});
  await page.getByRole('button',{name:'Back to library',exact:true}).press('Enter');
  await expect(page.locator('#library-title')).toBeFocused();
  await page.screenshot({path:testInfo.outputPath('navigation-enlarged.png')});
  await noOverflow(page);
});
