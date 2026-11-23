import { test, expect } from '@playwright/test';
import { prepareApp } from './fixtures.mjs';

test('ownership costs sort without changing allocations and fit long, empty and failed states', async ({ page, isMobile }, testInfo) => {
  await prepareApp(page);
  if (!isMobile) await page.setViewportSize({width:testInfo.project.name==='desktop-light'?1920:900,height:1000});
  await page.evaluate(()=>{
    const key='arcana.workspace.v2',data=JSON.parse(localStorage.getItem(key)),d=data.decks[0];
    d.cards=d.cards.slice(0,4);
    d.cards.forEach((e,i)=>{e.qty=[1,12,2,2][i];e.zone=['command','main','sideboard','main'][i];e.card.prices.eur=[null,'2.25','0.50','2.25'][i];});
    d.cards[2].card.name='A very long card name with a deliberately extended title for ownership table wrapping';
    d.cards[2].card.oracle_id=d.cards[1].card.oracle_id;
    localStorage.setItem(key,JSON.stringify(data));
  });
  await page.reload();
  const open=async()=>{
    await page.getByRole('button',{name:'Smoke Garden',exact:true}).click();
    await page.getByRole('tab',{name:'Ownership & costs',exact:true}).click();
  };
  await open();
  const copies=page.getByRole('table',{name:'Copy quantities',exact:true});
  const costs=page.getByRole('table',{name:'Cost estimates',exact:true});
  const missing=costs.getByRole('row').filter({hasText:'Cost of missing copies'});
  const cheapestEstimate=costs.getByRole('row').filter({hasText:'Cheapest printings for missing copies'});
  await expect(copies.getByRole('cell')).toHaveText(['17','3','14']);
  await expect(missing).toContainText(/25[.,]75/);
  await expect(missing).toContainText('1 unpriced copy');
  const snapshot=await page.evaluate(()=>localStorage.getItem('arcana.workspace.v2'));
  const rows=page.locator('.planning-table tbody tr');
  const owned=name=>rows.filter({hasText:name}).getByRole('cell').nth(2);
  await expect(owned('Smoke Card 1')).toHaveText('No');
  await expect(owned('Smoke Card 2')).toHaveText('3/12');
  await expect(owned('A very long')).toHaveText('0/2');
  const ownedSort=page.locator('[data-cost-sort="owned"]');
  await page.locator('[data-cost-sort="card"]').scrollIntoViewIfNeeded();
  await expect(ownedSort).toBeInViewport({ratio:.9});
  expect(await ownedSort.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  const names=()=>rows.locator('th').allTextContents();
  const price=page.locator('[data-cost-sort="price"]');
  await price.focus();await price.press('Enter');
  await expect(price).toBeFocused();
  await expect(price.locator('..')).toHaveAttribute('aria-sort','ascending');
  expect((await names()).map(n=>n.startsWith('A very')?'Long':n)).toEqual(['Long','Smoke Card 2','Smoke Card 4','Smoke Card 1']);
  if(isMobile)await price.tap();else await price.press('Enter');
  await expect(price.locator('..')).toHaveAttribute('aria-sort','descending');
  expect((await names()).map(n=>n.startsWith('A very')?'Long':n)).toEqual(['Smoke Card 2','Smoke Card 4','Long','Smoke Card 1']);
  await expect(missing).toContainText(/25[.,]75/);
  expect(await page.evaluate(()=>localStorage.getItem('arcana.workspace.v2'))).toBe(snapshot);
  await ownedSort.press('Enter');
  await ownedSort.press('Enter');
  await expect(ownedSort.locator('..')).toHaveAttribute('aria-sort','descending');
  await expect(rows.first()).toContainText('Smoke Card 2');
  const main=page.getByRole('checkbox',{name:'Main deck',exact:true});
  await main.uncheck();
  await expect(owned('Smoke Card 2')).toHaveText('—');
  await expect(owned('A very long')).toHaveText('2/2');
  const matching=page.getByRole('combobox',{name:'Ownership matching'});
  await matching.selectOption('printing');
  await expect(owned('A very long')).toHaveText('0/2');
  await matching.selectOption('rules');
  await main.check();
  const cardSort=page.locator('[data-cost-sort="card"]');
  await cardSort.scrollIntoViewIfNeeded();
  const before=await rows.first().boundingBox();
  await cardSort.hover();await cardSort.focus();
  expect(await rows.first().boundingBox()).toEqual(before);
  // Corresponding numeric fields stay aligned even when the card name wraps.
  const x=await rows.evaluateAll(rows=>rows.map(row=>[...row.cells].map(cell=>Math.round(cell.getBoundingClientRect().right))));
  for(const row of x)expect(row).toEqual(x[0]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(!isMobile)expect(await page.locator('.planning').evaluate(el=>el.clientWidth/el.parentElement.clientWidth)).toBeGreaterThan(.95);
  await page.evaluate(()=>scrollTo(0,0));
  await page.screenshot({path:testInfo.outputPath('ownership-costs.png')});
  await page.locator('.planning-table').scrollIntoViewIfNeeded();
  await page.screenshot({path:testInfo.outputPath('ownership-table.png')});
  const cheapest=page.locator('[data-cost-sort="cheapest"]');
  await cheapest.scrollIntoViewIfNeeded();
  await expect(cheapest).toBeInViewport();
  if(isMobile)await cheapest.tap();else await cheapest.press('Enter');
  await expect(cheapest).toBeFocused();
  await page.addStyleTag({content:':root{font-size:28px}.planning :is(th,td,button,label,summary,legend){font-size:1rem}.planning small{font-size:.86rem}'});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(await missing.locator('th').evaluate(el=>parseFloat(getComputedStyle(el).fontSize))).toBe(28);
  await page.screenshot({path:testInfo.outputPath('ownership-enlarged.png')});
  await page.reload();await open();
  await page.route('**/api/collection',route=>route.fulfill({status:500,json:{error:'Offline fixture'}}));
  await page.getByRole('button',{name:'Refresh € prices',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Last usable prices were retained');
  await expect(missing).toContainText(/25[.,]75/);
  for(const coverage of ['none','full']){
    await page.evaluate(coverage=>{
      const key='arcana.workspace.v2',data=JSON.parse(localStorage.getItem(key));
      data.collection=coverage==='none'?[]:data.decks[0].cards.map(e=>({card:e.card,qty:e.qty,finish:'regular'}));
      localStorage.setItem(key,JSON.stringify(data));
    },coverage);
    await page.reload();await open();
    await expect(copies.getByRole('cell')).toHaveText(coverage==='none'?['17','0','17']:['17','17','0']);
    if(coverage==='full'){
      await expect(owned('Smoke Card 1')).toHaveText('Yes');
      await expect(owned('Smoke Card 2')).toHaveText('12/12');
      await expect(missing).toContainText(/0[.,]00/);
      await expect(cheapestEstimate).toContainText('€0.00');
      await expect(cheapestEstimate).not.toContainText('unpriced');
    } else {
      await page.route('**/api/search?**',route=>route.fulfill({json:{data:[],has_more:false}}));
      await page.getByRole('button',{name:'Check cheapest printings',exact:true}).click();
      await expect(cheapestEstimate).toContainText('Unavailable');
      await expect(cheapestEstimate).toContainText('17 unpriced copies');
    }
  }
  await page.evaluate(()=>{const key='arcana.workspace.v2',data=JSON.parse(localStorage.getItem(key));data.decks[0].cards=[];localStorage.setItem(key,JSON.stringify(data));});
  await page.reload();await open();
  await expect(copies.getByRole('cell')).toHaveText(['0','0','0']);
  await expect(page.getByRole('button',{name:'Refresh € prices',exact:true})).toBeDisabled();
  await expect(page.getByText('Add cards to see ownership and costs here.',{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
