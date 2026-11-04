import { test, expect } from '@playwright/test';
import { prepareApp, cards } from './fixtures.mjs';

async function noPageOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
async function dialogFits(page) {
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate(element => {
    const box = element.getBoundingClientRect();
    return box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight;
  })).toBe(true);
}
test.beforeEach(async ({ page }) => prepareApp(page));

test('deck navigation, sticky header, statistics and budget fit the viewport', async ({ page }) => {
  await page.getByRole('button', { name: 'Smoke Garden', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Smoke Garden', exact: true })).toBeVisible();
  await page.locator('#editor-layout').selectOption('text-vertical');
  await noPageOverflow(page);
  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(0);
  await expect.poll(() => page.locator('.workspace-nav').evaluate(element => Math.round(element.getBoundingClientRect().top))).toBe(0);
  await page.getByRole('tab', { name: 'Statistics', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mana curve', exact: true })).toBeVisible();
  await noPageOverflow(page);
  await page.getByRole('tab', { name: 'Ownership & budget', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ownership & budget', exact: true })).toBeVisible();
  await noPageOverflow(page);
  await page.getByRole('button', { name: 'My decks', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My decks', exact: true })).toBeVisible();
});

test('search, printing dialog, keyboard dismissal and reload retain deck data', async ({ page }) => {
  await page.getByRole('button', { name: 'Explore cards', exact: true }).click();
  await page.locator('#raw').fill('Smoke');
  await page.locator('#search-form').getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('button', { name: `Inspect ${cards[0].name}`, exact: true }).click();
  await dialogFits(page);
  await page.getByRole('button', { name: 'Browse printings', exact: true }).click();
  await expect(page.locator('#view-printing option')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Smoke Garden', exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('arcana.workspace.v2')).decks[0].cards.length)).toBe(40);
  await noPageOverflow(page);
});

test('collection table and staged editor cancel preserve quantities', async ({ page }) => {
  await page.getByRole('button', { name: 'Collection', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Collection', exact: true })).toBeVisible();
  await page.locator('#collection-view').selectOption('text');
  await expect(page.locator('.collection-table tbody tr')).toHaveCount(1);
  await noPageOverflow(page);
  await page.locator('[data-edit-owned="0"]').first().click();
  await expect(page.locator('#owned-version option')).toHaveCount(1);
  await dialogFits(page);
  await page.locator('#owned-plus').click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Collection', exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('arcana.workspace.v2')).collection[0].qty)).toBe(3);
  await expect(page.locator('.collection-table tbody tr')).toHaveCount(1);
});

test('Explore fills available width and keeps selected functions inside their disclosure', async ({ page }, testInfo) => {
  await page.route('**/api/search?**', route => route.fulfill({ json: { data: cards.slice(0, 12), total_cards: 12, has_more: false } }));
  await page.getByRole('button', { name: 'Explore cards', exact: true }).click();
  await expect(page.locator('#results-area')).toBeHidden();
  await expect(page.locator('#broadening-tools')).toBeHidden();
  await expect(page.getByText('Discover cards', { exact: true })).toHaveCount(0);
  await page.locator('#raw').fill('t:creature (otag:ramp OR otag:draw)');
  await page.locator('#search-form').getByRole('button', { name: 'Search', exact: true }).click();
  await expect(page.locator('.card-tile')).toHaveCount(12);
  const functions = page.locator('#function-tags');
  const chips = functions.locator('#selected-functions');
  await expect(chips).toBeHidden();
  const summary = functions.locator(':scope > summary');
  await summary.focus();
  await page.keyboard.press('Space');
  await expect(chips).toBeVisible();
  await noPageOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('explore-functions.png') });
  await expect(chips.getByLabel('Combine functions by')).toHaveValue('any');
  await chips.getByLabel('Combine functions by').selectOption('all');
  await expect(page.locator('#raw')).toHaveValue('t:creature (otag:ramp otag:draw)');
  await chips.getByRole('button', { name: 'Remove ramp filter', exact: true }).click();
  await expect(page.locator('#raw')).toHaveValue('t:creature otag:draw');
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(chips).toBeHidden();
  await expect(page.locator('#raw')).toHaveValue('t:creature otag:draw');
  await noPageOverflow(page);
  const columns = () => page.locator('.card-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  if (testInfo.project.name.startsWith('desktop')) {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.locator('#tracked-deck').selectOption('');
    expect((await page.locator('.explorer').boundingBox()).width).toBe(1920);
    const fullColumns = await columns();
    await page.screenshot({ path: testInfo.outputPath('explore-wide.png') });
    await page.locator('#tracked-deck').selectOption('smoke-deck');
    expect(await columns()).toBeLessThan(fullColumns);
    await expect(page.locator('#deck-tracker')).toBeVisible();
    await noPageOverflow(page);
    await page.screenshot({ path: testInfo.outputPath('explore-tracker.png') });
  } else {
    expect(await columns()).toBe(2);
    await page.screenshot({ path: testInfo.outputPath('explore-phone.png') });
  }
  await page.getByRole('button', { name: 'Clear search and filters', exact: true }).click();
  await expect(page.locator('#results-area')).toBeHidden();
  await expect(page.locator('#broadening-tools')).toBeHidden();
});

test('repeatable mana and Oracle filters synchronize, scroll locally and preserve advanced syntax', async ({ page }, testInfo) => {
  const queries=[];
  page.on('request', request => {const url=new URL(request.url());if(url.pathname==='/api/search')queries.push(url.searchParams.get('q'));});
  await page.getByRole('button', { name: 'Explore cards', exact: true }).click();
  await page.locator('#tracked-deck').selectOption('');
  await page.locator('#search-filters > summary').click();
  const mv=page.locator('[data-family="mv"]'), oracle=page.locator('[data-family="oracle"]');
  await expect(mv.locator('input')).toHaveCount(1);
  await expect(oracle.locator('input')).toHaveCount(1);
  await mv.getByLabel('Combine mana value filter by').selectOption('any');
  const requestsBeforeAdd=queries.length;
  for(let i=0;i<5;i++){
    await mv.getByRole('button',{name:'Add additional mana value filter',exact:true}).focus();
    await page.keyboard.press('Enter');
    await expect(mv.locator(`[name="mv-${i+1}"]`)).toBeFocused();
  }
  expect(queries.length).toBe(requestsBeforeAdd);
  await mv.locator('[name="mv-0"]').fill('1');
  await mv.locator('[name="mv-1"]').fill('2');
  await mv.locator('[name="mv-5"]').fill('6');
  await oracle.getByLabel('Combine oracle filter by').selectOption('any');
  await oracle.getByRole('button',{name:'Add additional oracle filter',exact:true}).click();
  await expect(oracle.locator('[name="oracle-1"]')).toBeFocused();
  await oracle.locator('[name="oracle-mode-1"]').selectOption('fo');
  await oracle.locator('[name="oracle-0"]').fill('Whenever ~ attacks');
  await oracle.locator('[name="oracle-1"]').fill('flying');
  await page.locator('#guided-form').getByRole('button',{name:'Search with these filters',exact:true}).click();
  const expected='(mv>=1 OR mv>=2 OR mv>=6) (o:"Whenever ~ attacks" OR fo:"flying")';
  await expect(page.locator('#raw')).toHaveValue(expected);
  await expect.poll(()=>queries.at(-1)).toBe(expected);
  expect(await mv.locator('.filter-rows').evaluate(el=>el.clientHeight<=244&&el.scrollHeight>el.clientHeight)).toBe(true);
  await noPageOverflow(page);
  await page.screenshot({path:testInfo.outputPath('repeatable-filters.png'),fullPage:true});
  await page.locator('#raw').fill(expected+' usd<5');
  await expect(mv.locator('input')).toHaveCount(3);
  await expect(oracle.locator('input')).toHaveCount(2);
  await oracle.locator('[name="oracle-1"]').fill('haste');
  await expect(page.locator('#raw')).toHaveValue('(mv>=1 OR mv>=2 OR mv>=6) (o:"Whenever ~ attacks" OR fo:"haste") usd<5');
  await page.locator('#raw').fill('fo:/draw (one|two)/ mv>=1 mv<=5 mv!=3');
  await expect(oracle.locator('input')).toBeDisabled();
  await expect(mv.locator('input')).toHaveCount(3);
  await mv.locator('[name="mv-2"]').fill('4');
  await expect(page.locator('#raw')).toHaveValue('fo:/draw (one|two)/ (mv>=1 mv<=5 mv!=4)');
  await page.getByRole('button',{name:'Clear search and filters',exact:true}).click();
  await expect(mv.locator('input')).toHaveCount(1);
  await expect(oracle.locator('input')).toHaveCount(1);
});

test('additional mana and Oracle rows can be removed by keyboard without changing other filters', async ({ page }, testInfo) => {
  await page.getByRole('button',{name:'Explore cards',exact:true}).click();
  await page.locator('#raw').fill('(mv=1 OR mv=2 OR mv=3) (o:"draw" fo:"flying" o:"~ attacks") usd<5');
  await page.locator('#search-filters > summary').click();
  const mv=page.locator('[data-family="mv"]'),oracle=page.locator('[data-family="oracle"]');
  for(const section of [mv,oracle]){
    await expect(section.locator('.filter-column-head')).toHaveCount(1);
    await expect(section.locator('[data-remove-filter]:enabled')).toHaveCount(3);
    expect(await section.locator('.repeatable-filter-row').evaluateAll(rows=>{
      const boxes=rows.map(row=>row.getBoundingClientRect());
      return Math.abs((boxes[1].top-boxes[0].bottom)-(boxes[2].top-boxes[1].bottom))<1 && rows.every(row=>{
        const controls=[...row.children].map(el=>el.getBoundingClientRect());
        return controls.every(box=>Math.abs(box.top-controls[0].top)<1)&&Math.abs(controls[2].width-controls[2].height)<1;
      });
    })).toBe(true);
  }
  await expect(oracle.getByText('Text source',{exact:true})).toHaveCount(1);
  await expect(oracle.getByText('Rules-text phrase',{exact:true})).toHaveCount(1);
  await mv.getByRole('button',{name:'Remove mana value filter 2',exact:true}).focus();
  await page.keyboard.press('Enter');
  await expect(mv.locator('input')).toHaveCount(2);
  await expect(mv.locator('[name="mv-1"]')).toBeFocused();
  await expect(mv.locator('[name="mv-1"]')).toHaveValue('3');
  await expect(page.locator('#raw')).toHaveValue('(mv=1 OR mv=3) (o:"draw" fo:"flying" o:"~ attacks") usd<5');
  await oracle.getByRole('button',{name:'Remove oracle filter 3',exact:true}).click();
  await expect(oracle.locator('[name="oracle-1"]')).toBeFocused();
  await expect(oracle.locator('[name="oracle-mode-1"]')).toHaveValue('fo');
  await expect(page.locator('#raw')).toHaveValue('(mv=1 OR mv=3) (o:"draw" fo:"flying") usd<5');
  await noPageOverflow(page);
  await page.screenshot({path:testInfo.outputPath('remove-filters.png'),fullPage:true});
  await mv.getByRole('button',{name:'Remove mana value filter 2',exact:true}).click();
  await expect(mv.locator('[name="mv-0"]')).toBeFocused();
  await oracle.getByRole('button',{name:'Remove oracle filter 2',exact:true}).click();
  await expect(oracle.locator('[name="oracle-0"]')).toBeFocused();
  await expect(page.locator('#raw')).toHaveValue('mv=1 o:"draw" usd<5');
  await expect(mv.locator('[data-remove-filter]')).toBeDisabled();
  await expect(oracle.locator('[data-remove-filter]')).toBeDisabled();
  await oracle.getByRole('button',{name:'Add additional oracle filter',exact:true}).click();
  await oracle.getByRole('button',{name:'Remove oracle filter 2',exact:true}).click();
  await expect(oracle.locator('input')).toHaveCount(1);
  await expect(page.locator('#raw')).toHaveValue('mv=1 o:"draw" usd<5');
  for(const [section,family] of [[oracle,'oracle'],[mv,'mana value']]){
    await section.getByRole('button',{name:family==='oracle'?'Add additional oracle filter':'Add additional mana value filter',exact:true}).click();
    await section.getByRole('button',{name:'Remove '+family+' filter 1',exact:true}).focus();
    await page.keyboard.press('Enter');
    await expect(section.locator('input')).toHaveCount(1);
    await expect(section.locator('input')).toBeFocused();
    await expect(section.locator('input')).toHaveValue('');
    await expect(section.locator('[data-remove-filter]')).toBeDisabled();
  }
  await expect(page.locator('#raw')).toHaveValue('usd<5');
});
