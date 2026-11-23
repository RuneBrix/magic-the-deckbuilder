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

test('collection upload recovers from quota failure and persists 1183 rows in Chromium', async ({page},testInfo) => {
  const length = 1183;
  const incoming = Array.from({length}, (_, index) => ({
    ...cards[1], id:'upload-'+index, oracle_id:'upload-'+index, name:'Import Card '+index,
    oracle_text:'Synthetic shared card information for the quota test. '.repeat(100)+'Variant '+index,
  }));
  const byName = new Map(incoming.map(card => [card.name, card]));
  await page.route('**/api/collection', route => {
    const {names} = route.request().postDataJSON();
    if (!names) return route.fallback();
    return route.fulfill({json:{data:names.map(name => byName.get(name)),not_found:[]}});
  });
  const storage = await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    window.allowWorkspaceWrite = false;
    window.workspaceWrites = [];
    Storage.prototype.setItem = function(key, value) {
      if (key === 'arcana.workspace.v2') {
        window.workspaceWrites.push(value.length);
        if (!window.allowWorkspaceWrite) throw new DOMException('Test quota', 'QuotaExceededError');
      }
      return original.call(this, key, value);
    };
    return localStorage.getItem('arcana.workspace.v2');
  });
  await page.getByRole('button',{name:'Collection',exact:true}).click();
  await page.getByRole('button',{name:'Upload card list'}).click();
  await page.getByRole('textbox',{name:'Card list or CSV'}).fill(
    'Count,Card,Notes\n'+incoming.map(({name},i) => (i<11?2:1)+','+name+',Ignore').join('\n')
  );
  const submit = page.locator('#collection-upload-submit');
  await expect(page.locator('#collection-syntax')).toContainText('1183 card rows · 1194 copies');
  await expect(submit).toBeDisabled();
  await page.locator('#collection-accept-ignored').check();
  await submit.press('Enter');
  await page.getByRole('button',{name:'Finish import'}).click();
  await expect(page.locator('#collection-import-error')).toContainText('Browser storage is full');
  await expect(page.locator('#collection-import-preview')).toBeEmpty();
  expect(await page.evaluate(() => localStorage.getItem('arcana.workspace.v2'))).toBe(storage);
  await dialogFits(page);
  await noPageOverflow(page);
  await page.screenshot({path:testInfo.outputPath('collection-upload-quota.png')});
  await page.evaluate(() => { window.allowWorkspaceWrite = true; });
  await submit.click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  const [plain, compact] = await page.evaluate(() => window.workspaceWrites.slice(-2));
  expect(plain).toBeGreaterThan(5 * 1024 * 1024);
  expect(compact).toBeLessThan(plain / 2);
  testInfo.annotations.push({type:'storage measurement',description:plain+' ordinary → '+compact+' packed code units'});
  await expect(page.locator('.collection-total')).toContainText('1197 copies total');
  await page.reload();
  await expect(page.getByRole('button',{name:'Smoke Garden',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Collection',exact:true}).click();
  await expect(page.locator('.collection-total')).toContainText('1197 copies total');
  const portable = await page.evaluate(async () => {
    const {readStoredWorkspace,workspaceFile,readWorkspaceFile} = await import('/core.js');
    const state = readStoredWorkspace(localStorage.getItem('arcana.workspace.v2'));
    const file = workspaceFile(state.decks,state.collection);
    const restored = readWorkspaceFile(JSON.parse(JSON.stringify(file)));
    return {version:file.version,lotCount:restored.collection.length,card:restored.collection[1].card};
  });
  expect(portable).toEqual({version:2,lotCount:1184,card:incoming[0]});
});

test('collection upload shows a correctable row error after an edition lookup', async ({page},testInfo) => {
  await page.route('**/api/collection-sets',route=>route.fulfill({json:[{code:'tst',name:'Smoke Test'}]}));
  let releaseLookup;
  await page.route('**/api/search?**',async route=>{
    await new Promise(resolve=>{releaseLookup=resolve;});
    await route.fulfill({status:404,json:{error:'No cards found.'}});
  });
  await page.getByRole('button',{name:'Collection',exact:true}).click();
  await page.getByRole('button',{name:'Upload card list'}).click();
  await page.getByRole('textbox',{name:'Card list or CSV'}).fill('Qty,Item,Edition_Name\n1,"Unlisted Legendary Creature, With a Very Long Name",Smoke Test');
  await expect(page.locator('#collection-syntax')).toContainText('Waiting for column mappings');
  await expect(page.locator('[data-csv-column="0"]')).toHaveValue('Quantity');
  await expect(page.locator('[data-csv-column="2"]')).toHaveValue('Edition Name');
  await page.locator('[data-csv-column="1"]').selectOption('Name');
  await page.getByRole('button',{name:'Check syntax'}).press('Enter');
  await page.locator('#collection-upload-submit').click();
  await expect.poll(()=>Boolean(releaseLookup)).toBe(true);
  await expect(page.locator('#collection-import-preview')).toContainText('Resolving 1 of 1');
  releaseLookup();
  await expect(page.locator('#collection-import-preview')).toBeEmpty();
  await expect(page.locator('#collection-upload-review')).toContainText('Card name · 1');
  await page.getByRole('button',{name:'Resolve errors'}).click();
  await expect(page.locator('#collection-upload-review')).toContainText('CSV row 2 · Unlisted Legendary Creature, With a Very Long Name · Smoke Test');
  await expect(page.getByRole('button',{name:'Skip row'})).toBeEnabled();
  await dialogFits(page);
  await noPageOverflow(page);
  await page.screenshot({path:testInfo.outputPath('collection-upload-no-match.png')});
});

test('primary function editing and temporary reverse faces preserve stored card data', async ({page,isMobile},testInfo)=>{
  await page.evaluate(()=>{
    const key='arcana.workspace.v2', data=JSON.parse(localStorage.getItem(key));
    const entry=data.decks[0].cards[1];
    entry.tags=['Draw','Legacy secondary'];
    delete entry.card.image_uris;
    entry.card.card_faces=[
      {name:'Smoke front',image_uris:{normal:'https://cards.scryfall.io/front.jpg'}},
      {name:'Smoke reverse',image_uris:{normal:'https://cards.scryfall.io/back.jpg'}},
    ];
    data.decks[0].cards=data.decks[0].cards.slice(0,3);
    localStorage.setItem(key,JSON.stringify(data));
  });
  await page.route('https://cards.scryfall.io/{front,back}.jpg',route=>route.fulfill({contentType:'image/svg+xml',body:`<svg xmlns="http://www.w3.org/2000/svg" width="488" height="680"><rect width="488" height="680" fill="${route.request().url().includes('back')?'#263c61':'#326747'}"/><text x="30" y="340" fill="white" font-size="48">${route.request().url().includes('back')?'Reverse face':'Front face'}</text></svg>`}));
  await page.reload();
  await page.getByRole('button',{name:'Smoke Garden',exact:true}).click();
  await page.getByRole('tab',{name:'Checks',exact:true}).click();
  await expect(page.locator('.check-summary')).not.toContainText('Checking card legality');
  await page.getByRole('tab',{name:'Cards',exact:true}).click();
  const row=page.locator('.visual-card').filter({has:page.getByRole('button',{name:'Inspect Smoke Card 2 in Main deck',exact:true})});
  const flip=row.getByRole('button',{name:'Flip Smoke Card 2',exact:true});
  const before=await row.getAttribute('data-preview-entry');
  const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('arcana.workspace.v2')).decks[0].cards);
  const original=await stored();
  await flip.focus();await flip.press('Enter');
  await expect(row.locator('.card-art img')).toHaveAttribute('src',/back.jpg$/);
  await expect(flip).toHaveAttribute('aria-pressed','true');
  await expect(flip).toBeFocused();
  if(isMobile){
    const box=await flip.boundingBox();
    expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
    await flip.tap();await expect(row.locator('.card-art img')).toHaveAttribute('src',/front.jpg$/);
    await flip.tap();await expect(row.locator('.card-art img')).toHaveAttribute('src',/back.jpg$/);
  }
  if(!isMobile){
    const preview=page.locator('#deck-card-preview');
    await preview.getByRole('button',{name:'Flip Smoke Card 2',exact:true}).click();
    await expect(preview.locator('img')).toHaveAttribute('alt','Smoke reverse');
    await page.getByRole('heading',{name:'Smoke Garden'}).hover();
    await expect(preview.locator('img')).toHaveAttribute('src',/front.jpg$/);
  }
  await page.locator('#editor-layout').focus();
  await expect(row.locator('.card-art img')).toHaveAttribute('src',/front.jpg$/);
  expect(await row.getAttribute('data-preview-entry')).toBe(before);
  expect(await stored()).toEqual(original);
  await page.screenshot({path:testInfo.outputPath('card-faces.png'),fullPage:true});
  await page.locator('#editor-layout').selectOption('visual-vertical');
  await flip.focus();await flip.press('Space');
  await expect(row.locator('.card-art img')).toHaveAttribute('src',/back.jpg$/);
  await page.locator('#editor-layout').selectOption('text-horizontal');
  await expect(page.locator('[data-flip-card]')).toHaveCount(0);
  const entry=page.locator('.text-card').filter({has:page.getByRole('button',{name:'Smoke Card 2',exact:true})});
  await entry.getByRole('button',{name:'Card actions for Smoke Card 2 in Main deck',exact:true}).press('Enter');
  await page.getByRole('menuitem',{name:/Assign card to function/}).press('Enter');
  const functions=page.getByRole('menu',{name:/Functions for Smoke Card 2/});
  const create=functions.getByRole('menuitem',{name:'Add new function…',exact:true});
  await expect(functions.locator('button').first()).toBeFocused();
  await expect(functions.locator('button').first()).toHaveText('Add new function…');
  await expect(create.locator('svg')).toBeVisible();
  await expect(functions.getByRole('menuitemradio',{name:'Draw'})).toHaveAttribute('aria-checked','true');
  await page.keyboard.press('End');
  await expect(functions.getByRole('menuitemradio',{name:'Unassigned'})).toBeFocused();
  await page.keyboard.press('Home');
  await page.keyboard.press('Enter');
  const name=page.getByRole('textbox',{name:'Function name',exact:true});
  await name.fill('Removal, Draw');
  await page.getByRole('button',{name:'Create and assign',exact:true}).click();
  await expect(page.locator('#function-error')).toContainText('commas');
  await page.keyboard.press('Escape');
  await expect(entry.getByRole('button',{name:'Card actions for Smoke Card 2 in Main deck',exact:true})).toBeFocused();
  expect(await stored()).toEqual(original);
  await page.keyboard.press('Enter');
  await page.getByRole('menuitem',{name:/Assign card to function/}).press('Enter');
  await expect(create).toBeFocused();
  await page.keyboard.press('Enter');
  await name.fill('Removal');
  await page.evaluate(()=>{
    const save=Storage.prototype.setItem;
    window.allowFunctionWrite=false;
    Storage.prototype.setItem=function(key,value){
      if(key==='arcana.workspace.v2'&&!window.allowFunctionWrite)throw new DOMException('Test quota','QuotaExceededError');
      return save.call(this,key,value);
    };
  });
  await page.getByRole('button',{name:'Create and assign',exact:true}).click();
  await expect(page.locator('#function-error')).toContainText('Browser storage is full or unavailable');
  await expect(name).toHaveValue('Removal');
  expect(await stored()).toEqual(original);
  await page.evaluate(()=>{window.allowFunctionWrite=true;});
  await page.getByRole('button',{name:'Create and assign',exact:true}).click();
  expect((await stored())[1].tags).toEqual(['Removal','Draw','Legacy secondary']);
  await page.getByRole('button',{name:'Smoke Card 2',exact:true}).click();
  await expect(page.getByRole('textbox',{name:'Primary function',exact:true})).toHaveCount(0);
  await dialogFits(page);
  await page.keyboard.press('Escape');
  await page.getByRole('tab',{name:'Statistics',exact:true}).click();
  await expect(page.locator('#app')).not.toContainText('Legacy secondary');
  await page.reload();
  expect((await stored())[1].tags).toEqual(['Removal','Draw','Legacy secondary']);
  expect((await stored())[1].card.card_faces).toEqual(original[1].card.card_faces);
  await noPageOverflow(page);
});

test('deck library uses available width and commander suggestions are optional until creation', async ({ page, isMobile }) => {
  if (!isMobile) await page.setViewportSize({ width: 1920, height: 900 });
  const columns = await page.locator('.deck-library').evaluate(grid => getComputedStyle(grid).gridTemplateColumns.split(' ').length);
  expect(columns).toBe(isMobile ? 1 : 6);
  await noPageOverflow(page);

  await page.route('**/api/search?**', route => {
    expect(new URL(route.request().url()).searchParams.get('q')).toBe('game:paper is:commander f:commander name:/Smoke/');
    return route.fulfill({ json: { data: cards.slice(0, 10) } });
  });
  await page.getByRole('button', { name: 'New deck' }).click();
  const dialog = page.getByRole('dialog');
  const name = dialog.getByRole('textbox', { name: 'Deck name' });
  await expect(name).toHaveValue('');
  expect(await name.evaluate(input => {
    const placeholder = getComputedStyle(input, '::placeholder');
    return placeholder.fontStyle === 'italic' && placeholder.color !== getComputedStyle(input).color && placeholder.opacity === '1';
  })).toBe(true);
  await name.fill('Commander draft');
  const input = dialog.getByRole('combobox', { name: 'Search commander names' });
  await input.fill('Smoke');
  const options = dialog.getByRole('listbox', { name: 'Commander suggestions' }).getByRole('option');
  await expect(options).toHaveCount(8);
  await dialogFits(page);
  await input.press('Escape');
  await expect(input).toHaveAttribute('aria-expanded', 'false');
  await expect(dialog).toBeVisible();
  await input.press('ArrowDown');
  await expect(dialog.getByRole('option', { name: 'Smoke Card 1', exact: true })).toHaveAttribute('aria-selected', 'true');
  await input.press('Enter');
  await expect(input).toHaveValue('Smoke Card 1');
  await expect(dialog).toBeVisible();

  await dialog.getByRole('button', { name: 'Choose later' }).click();
  await expect(input).toHaveValue('');
  const create = dialog.getByRole('button', { name: 'Create deck' });
  await expect(create).toBeFocused();
  await input.fill('Smoke');
  await dialog.getByRole('option', { name: 'Smoke Card 1', exact: true }).click();
  await expect(input).toHaveValue('Smoke Card 1');
  await create.click();
  await expect(page.getByRole('heading', { name: 'Commander draft' })).toBeVisible();
  const commandZone = page.getByRole('heading', { name: /Command zone/ }).locator('..');
  await expect(commandZone.getByRole('button',{name:'Inspect Smoke Card 1 in Command zone',exact:true})).toBeVisible();
  await noPageOverflow(page);
});

test('deck navigation, sticky header, statistics and ownership fit the viewport', async ({ page }) => {
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
  await page.getByRole('tab', { name: 'Ownership & costs', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ownership & costs', exact: true })).toBeVisible();
  await noPageOverflow(page);
  await page.getByRole('tab', { name: 'Checks', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'About bracket data' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Current official Commander brackets and Game Changers' })).toBeVisible();
  await noPageOverflow(page);
  await page.getByRole('button', { name: 'Back to library', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'My decks', exact: true })).toBeVisible();
});

test('statistics breakdowns and draw chances work with long labels, keyboard and empty decks', async ({ page, isMobile }, testInfo) => {
  const longFunction = 'Ramp'.repeat(20);
  const tokenId = 'ca8e8a9a-d673-4644-9eec-f4f549307d9b';
  const savedDeckData = () => page.evaluate(() => {
    const { decks, collection } = JSON.parse(localStorage.getItem('arcana.workspace.v2'));
    return [decks, collection];
  });
  await page.evaluate(({ label, tokenId }) => {
    const key = 'arcana.workspace.v2';
    const workspace = JSON.parse(localStorage.getItem(key));
    const entries = workspace.decks[0].cards;
    Object.assign(entries[0].card, { cmc: 9 });
    entries[0].tags = ['Commander only'];
    entries[2].tags = [label, 'Draw'];
    const token = { id: tokenId, name: 'Beast', type_line: 'Token Creature — Beast', component: 'token' };
    Object.assign(entries[1].card, { produced_mana: ['U'], all_parts: [token] });
    Object.assign(entries[2].card, { cmc: 4, type_line: 'Artifact Creature', colors: ['G', 'U'], power: '0', mana_cost: '{G/U}', produced_mana: ['G', 'U'], all_parts: [token] });
    entries.push({ ...entries[2], qty: 10, zone: 'sideboard' }, { ...entries[2], qty: 10, zone: 'maybeboard' });
    workspace.decks.push({ id: 'empty-statistics', name: 'Empty Statistics', format: 'modern', cards: [] });
    localStorage.setItem(key, JSON.stringify(workspace));
  }, { label: longFunction, tokenId });
  await page.reload();
  await page.getByRole('button', { name: 'Smoke Garden', exact: true }).click();
  await page.getByRole('tab', { name: 'Checks', exact: true }).click();
  await expect(page.locator('.check-summary')).not.toContainText('Checking card legality');
  const saved = await savedDeckData();
  await page.getByRole('tab', { name: 'Statistics', exact: true }).click();
  const board = page.locator('.stats-view');
  await expect(board.getByText('Total mana value').locator('..').getByText('91', { exact: true })).toBeVisible();
  await expect(board.getByText('Median mana value').locator('..').getByText('2', { exact: true })).toBeVisible();
  const [curveBox, otherToolsBox] = await Promise.all([board.locator('.stat-tool').first().boundingBox(), board.locator('.stat-tools').boundingBox()]);
  if (isMobile) {
    expect(otherToolsBox.x).toBe(curveBox.x);
    expect(otherToolsBox.y).toBeGreaterThan(curveBox.y + curveBox.height);
  } else {
    expect(otherToolsBox.y).toBe(curveBox.y);
    expect(otherToolsBox.x).toBeGreaterThan(curveBox.x + curveBox.width);
  }
  const toolHeights = await board.locator('.stat-tools > section').evaluateAll(tools => tools.map(tool => tool.offsetHeight));
  expect(toolHeights[1]).toBeGreaterThan(toolHeights[0]);
  await expect(board.getByRole('heading', { name: 'Card functions' })).toBeVisible();
  await expect(board.locator('.mana-pie')).toHaveCount(2);
  const charts = board.locator('.mana-distributions > section');
  const [costBox, productionBox] = await Promise.all([charts.nth(0).boundingBox(), charts.nth(1).boundingBox()]);
  if (isMobile) expect(productionBox.y).toBeGreaterThan(costBox.y + costBox.height);
  else expect(productionBox.x).toBeGreaterThan(costBox.x + costBox.width);
  const beast = board.getByRole('link', { name: 'Beast on Scryfall', exact: true });
  await expect(beast).toHaveCount(1);
  await expect(beast).toHaveAttribute('href', `https://scryfall.com/card/${tokenId}`);
  await beast.focus();
  await expect(beast).toBeFocused();

  const breakdown = page.getByRole('combobox', { name: 'Breakdown', exact: true });
  await breakdown.focus();
  await breakdown.press('ArrowDown');
  await expect(breakdown).toBeFocused();
  const curveGroup = page.getByRole('combobox', { name: 'Group', exact: true });
  await curveGroup.selectOption('U');
  await expect(page.getByRole('img', { name: /Mana curve for Blue:.*4 mana: 1/ })).toBeVisible();
  await breakdown.selectOption('function');
  await curveGroup.selectOption(longFunction);
  await expect(page.getByRole('img', { name: /Mana curve for RampRamp/ })).toBeVisible();
  const drawTable = page.getByRole('table', { name: 'Draw chances by primary function' });
  await expect(drawTable.getByRole('row', { name: new RegExp(longFunction) })).toContainText('17.5%');
  await expect(drawTable.getByText('Commander only')).toHaveCount(0);
  const drawn = page.getByRole('spinbutton', { name: 'Cards drawn' });
  await drawn.focus();
  await drawn.press('Tab');
  const comparison = page.getByRole('combobox', { name: 'Comparison', exact: true });
  await expect(comparison).toBeFocused();
  await drawn.fill('41');
  await expect(drawn).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#draw-status')).toHaveText('Enter a whole number of draws from 0 to 40.');
  await expect(drawTable).toHaveCount(0);
  await drawn.fill('40');
  await comparison.selectOption('at-least');
  await page.getByRole('combobox', { name: 'Group by', exact: true }).selectOption('types');
  await expect(page.getByRole('table', { name: 'Draw chances by card type' }).getByRole('row', { name: /Creature/ })).toContainText('100%');
  await noPageOverflow(page);

  const originalViewport = page.viewportSize();
  const sizes = async () => [
    (await board.locator('.curve .filled').first().boundingBox()).height,
    ...await board.locator('.mana-pie').evaluateAll(pies => pies.map(pie => {
      const { width, height } = pie.getBoundingClientRect();
      if (Math.abs(width - height) > 1) throw Error('Mana pie must stay circular');
      return width;
    })),
  ];
  await page.setViewportSize({ width: 720, height: originalViewport.height });
  const intermediate = await sizes();
  await noPageOverflow(page);
  await page.setViewportSize({ width: 1550, height: originalViewport.height });
  for (const [index, size] of (await sizes()).entries()) expect(size).toBeGreaterThan(intermediate[index] + 25);
  await expect(board.getByRole('img', { name: /Mana curve for RampRamp.*4 mana: 1/ })).toBeVisible();
  await noPageOverflow(page);
  await page.setViewportSize(originalViewport);
  const enlarged = await page.addStyleTag({ content: '#deck-statistics :is(.curve span,.curve small,.mana-legend){font-size:1.5rem}' });
  await noPageOverflow(page);
  await board.locator('#curve-chart').scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('statistics-curve.png') });
  await board.locator('.mana-tool').scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('statistics-mana.png') });
  await enlarged.evaluate(element => element.remove());

  await page.getByRole('button', { name: 'Back to library', exact: true }).click();
  await page.getByRole('button', { name: 'Empty Statistics', exact: true }).click();
  await page.getByRole('tab', { name: 'Statistics', exact: true }).click();
  await expect(page.getByText('Add cards to Main deck to calculate draw chances.')).toBeVisible();
  await expect(page.getByText('No referenced tokens.')).toBeVisible();
  await expect(page.getByText('No recorded colored mana costs.')).toBeVisible();
  await expect(drawn).toBeDisabled();
  await noPageOverflow(page);
  expect(await savedDeckData()).toEqual(saved);
});

test('statistics loads exact token art without applying stale results or rewriting the workspace', async ({ page }, testInfo) => {
  const [beast, variant, noArt, broken, missing, other] = cards.slice(0, 6).map((card, index) => ({
    ...card, id: card.id.replace('-4000-', '-4001-'), name: index < 2 ? 'Beast' : ['Clue', 'Map', 'Treasure', 'Food'][index - 2],
    type_line: 'Token Artifact', image_uris: index === 2 ? {} : { normal: 'https://cards.scryfall.io/token-' + index + '.jpg' },
  }));
  await page.route('https://cards.scryfall.io/token-3.jpg', route => route.fulfill({ status: 404 }));
  const part = card => ({ id: card.id, name: card.name, type_line: card.type_line, component: 'token' });
  await page.evaluate(({ first, second }) => {
    const key = 'arcana.workspace.v2';
    const data = JSON.parse(localStorage.getItem(key));
    data.decks[0].cards[0].card.all_parts = first;
    data.decks[0].cards[1].card.all_parts = [first[0]];
    data.decks.push({ id: 'token-other', name: 'Other Tokens', format: 'modern', cards: [
      { ...data.decks[0].cards[1], card: { ...data.decks[0].cards[1].card, all_parts: second } },
    ] });
    localStorage.setItem(key, JSON.stringify(data));
  }, { first: [beast, variant, noArt, broken, missing].map(part), second: [other].map(part) });
  await page.reload();
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const ids = [beast, variant, noArt, broken, missing].map(card => card.id);
  let firstAttempts = 0;
  await page.route('**/api/collection', async route => {
    const requested = route.request().postDataJSON().ids ?? [];
    if (requested.includes(beast.id)) {
      expect(requested).toEqual(ids);
      if (!firstAttempts++) await gate;
      return route.fulfill({ json: { data: [beast, variant, noArt, broken], not_found: [{ id: missing.id }] } });
    }
    if (requested.includes(other.id)) return route.fulfill({ status: 502, json: { error: 'Synthetic lookup outage' } });
    return route.fallback();
  });
  const open = async name => {
    await page.getByRole('button', { name, exact: true }).click();
    await page.getByRole('tab', { name: 'Statistics', exact: true }).click();
  };
  const back = () => page.getByRole('button', { name: 'Back to library', exact: true }).click();
  const tokens = page.locator('.token-tool');
  const saved = () => page.evaluate(() => localStorage.getItem('arcana.workspace.v2'));
  await open('Smoke Garden');
  const before = await saved();
  await expect.poll(() => firstAttempts).toBe(1);
  await expect(tokens.getByText('Loading artwork…')).toHaveCount(5);
  const staleResponse = page.waitForResponse(response => response.url().endsWith('/api/collection') &&
    response.request().postDataJSON().ids?.includes(beast.id));
  await back();
  await open('Other Tokens');
  await expect(tokens.getByText('Could not load artwork')).toBeVisible();
  release();
  await staleResponse;
  await expect(tokens.getByRole('link', { name: 'Food on Scryfall', exact: true })).toBeVisible();
  await expect(tokens.locator('[data-token-printing]')).toHaveCount(1);

  await back();
  await open('Smoke Garden');
  await expect(tokens.getByRole('link', { name: 'Beast · Smoke Test · #1 · EN on Scryfall', exact: true })).toHaveAttribute('href', 'https://scryfall.com/card/' + beast.id);
  const variantLink = tokens.getByRole('link', { name: 'Beast · Smoke Test · #2 · EN on Scryfall', exact: true });
  await variantLink.focus();
  await expect(variantLink).toBeFocused();
  await tokens.locator('.token-list').scrollIntoViewIfNeeded();
  await expect(tokens.getByRole('img', { name: 'Beast', exact: true })).toHaveCount(2);
  await expect.poll(() => variantLink.getByRole('img').evaluate(img => img.naturalWidth)).toBeGreaterThan(0);
  await expect(tokens.getByText('Artwork unavailable', { exact: true })).toHaveCount(3);
  await noPageOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('statistics-tokens.png') });
  expect(await saved()).toBe(before);
});

test('deck groups show copy counts and prices, and visual cards keep prices visible', async ({ page, isMobile }, testInfo) => {
  await page.evaluate(() => {
    const key = 'arcana.workspace.v2';
    const data = JSON.parse(localStorage.getItem(key));
    const entries = data.decks[0].cards;
    data.decks[0].currency='USD';
    data.decks[0].cards = entries.slice(0, 4);
    entries[2].card.prices.usd = null;
    entries[3].zone = 'maybeboard';
    localStorage.setItem(key, JSON.stringify(data));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Smoke Garden', exact: true }).click();
  const layout = page.locator('#editor-layout');
  const main = page.locator('.deck-zone[data-drop-zone="main"]');
  const group = main.locator('.deck-group');
  const preview = page.locator('#deck-card-preview');
  for (const view of ['visual-horizontal', 'text-horizontal', 'text-vertical', 'visual-vertical']) {
    await layout.selectOption(view);
    await expect(group.getByRole('heading')).toHaveText('Creature · 3 cards');
    await expect(group.locator('.deck-group-price')).toHaveText('$3.00 · 1 copy unpriced');
    await expect(main.locator('.deck-zone-price')).toContainText('$3.00 · 1 copy unpriced');
    if (view.startsWith('text')) await expect(main.locator('.stack-card-meta')).toHaveCount(0);
    await noPageOverflow(page);
  }
  const first = main.locator('.visual-card').first();
  const caption = first.locator('.stack-card-meta');
  await expect(caption).toBeVisible();
  await expect(caption).toHaveText('$1.50');
  if (!isMobile) {
    await first.locator('.card-art').hover({ position: { x: 25, y: 25 } });
    await expect(caption).toBeVisible();
    await expect(caption).toHaveText('$1.50');
    await expect(preview.locator('figcaption span').nth(0)).toHaveText('Draw');
    await expect(preview.locator('figcaption span').nth(1)).toHaveText('$1.50');
    const bottom = (await caption.boundingBox()).y + (await caption.boundingBox()).height;
    expect((await main.locator('.card-art').nth(1).boundingBox()).y).toBeGreaterThan(bottom);
  }
  await page.keyboard.press('Tab');
  await first.focus();
  await expect(caption).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('deck-counts-and-prices.png') });
  await page.locator('#editor-group').selectOption('role');
  await expect(group.getByRole('heading')).toHaveText('Draw · 3 cards');
  await page.locator('#editor-search').fill('Smoke Card 2');
  await expect(group.getByRole('heading')).toHaveText('Draw · 2 shown');
  await expect(main.getByRole('heading', { level: 3 })).toHaveText('Main deck · 3 · 2 shown · $3.00 for shown cards');
  await noPageOverflow(page);
});

test('deck group controls keep copy scope, collapse state and focus across all layouts', async ({ page, context, isMobile }, testInfo) => {
  const longName = 'Elsewhere Observatory // The Long Way Home';
  const longFunction = 'Explore Further Than the Farthest Boundary of the Plane';
  const key = 'arcana.workspace.v2';
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.evaluate(({key,longName,longFunction}) => {
    const data = JSON.parse(localStorage.getItem(key));
    const deck = data.decks[0];
    const [command, first, variant, creature, artifact, land] = deck.cards;
    Object.assign(first.card, {name:longName, layout:'modal_dfc', type_line:'Creature // Land'});
    first.tags = [longFunction];
    first.card.prices.eur = null;
    first.finish = 'regular';
    Object.assign(variant, {card:{...first.card,id:variant.card.id,collector_number:'12a'}, qty:3, finish:'foil', tags:[longFunction]});
    creature.card.name = 'Scout of the North';
    creature.tags = [longFunction];
    Object.assign(artifact.card, {name:'A Beacon',type_line:'Artifact'});
    artifact.tags = ['Ramp'];
    Object.assign(land.card, {name:'A Basin',type_line:'Artifact Land'});
    land.tags = ['Lands'];
    land.qty = 500;
    deck.cards = [command, first, variant, creature, artifact, land, {...first, qty:1, zone:'sideboard'}];
    data.decks.push({...deck, id:'other-deck', name:'Other Deck'});
    localStorage.setItem(key, JSON.stringify(data));
  }, {key,longName,longFunction});
  await page.reload();
  await page.getByRole('button', {name:'Smoke Garden',exact:true}).click();
  const saved = await page.evaluate(key => localStorage.getItem(key), key);
  const main = page.locator('.deck-zone[data-drop-zone="main"]').first();
  const sideboard = page.locator('.deck-zone[data-drop-zone="sideboard"]').first();
  const command = page.locator('.deck-zone[data-drop-zone="command"]').first();
  const filter = page.locator('#editor-search');
  const layout = page.locator('#editor-layout');
  const grouping = page.locator('#editor-group');
  const toast = page.locator('#toast');
  const readClipboard = () => page.evaluate(async () => (await navigator.clipboard.readText()).replaceAll('\r\n','\n'));
  const activate = element => isMobile ? element.tap() : element.press('Enter');

  await expect(command.locator('[data-toggle-deck-group]')).toHaveCount(0);
  for (const [mode, names] of [['type',['Artifact','Creature','Land']], ['role',['Ramp',longFunction,'Lands']]]) {
    await grouping.selectOption(mode);
    const options = main.getByRole('button', {name:`Group actions for ${names[1]} · Main deck`, exact:true});
    const collapse = main.locator('[data-toggle-deck-group]').nth(1);
    const price = main.locator('.deck-group-price').nth(1);
    const copy = main.getByRole('button', {name:'Copy cards',exact:true});
    for (const view of ['visual-horizontal','visual-vertical','text-horizontal','text-vertical']) {
      await layout.selectOption(view);
      expect(await main.locator('[data-deck-group]').evaluateAll(groups => groups.map(group => JSON.parse(group.dataset.deckGroup)[2]))).toEqual(names);
      if (view === 'visual-horizontal') {
        await activate(main.locator('[data-toggle-deck-group]').first());
        await activate(collapse);
        await expect(collapse).toBeFocused();
        await activate(main.locator('[data-toggle-deck-group]').last());
        await expect(main.locator('[data-toggle-deck-group][aria-expanded="false"]')).toHaveCount(3);
        await activate(main.locator('[data-toggle-deck-group]').first());
        await activate(main.locator('[data-toggle-deck-group]').last());
      }
      await expect(collapse).toHaveAttribute('aria-expanded','false');
      await expect(collapse).toContainText('6 cards');
      await expect(price).toBeVisible();
      await expect(sideboard.locator('[data-toggle-deck-group]')).toHaveAttribute('aria-expanded','true');
      const nextGroup = main.locator('[data-deck-group]').last();
      await options.scrollIntoViewIfNeeded();
      const before = await nextGroup.boundingBox();
      if (!isMobile) await options.hover();
      await options.focus();
      expect(await nextGroup.boundingBox()).toEqual(before);
      await activate(options);
      await expect(copy).toBeFocused();
      const menu = main.locator('.deck-group-actions:popover-open');
      await expect(menu).toContainText(`${names[1]} · Main deck`);
      const bounds = await menu.boundingBox();
      const {width,height} = page.viewportSize();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(height);
      await activate(copy);
      await expect(options).toBeFocused();
      await expect(menu).toHaveCount(0);
      await expect(toast).toContainText(`Copied 6 copies from ${names[1]} · Main deck`);
      expect(await readClipboard()).toBe(`5 ${longName}\n1 Scout of the North`);
      await noPageOverflow(page);
    }
  }

  const collapse = main.locator('[data-toggle-deck-group]').nth(1);
  const options = main.getByRole('button', {name:`Group actions for ${longFunction} · Main deck`,exact:true});
  await filter.fill('never matches any group');
  await expect(main.getByText('No cards match these filters.')).toBeVisible();
  await filter.fill('Elsewhere');
  const filteredCollapse = main.locator('[data-toggle-deck-group]');
  await expect(filteredCollapse).toHaveAttribute('aria-expanded','false');
  await expect(filteredCollapse).toContainText('5 shown');
  await activate(options);
  const shown = main.getByRole('button', {name:'Copy shown cards'});
  await shown.press('Escape');
  await expect(options).toBeFocused();
  await activate(options);
  await activate(shown);
  await expect.poll(readClipboard).toBe(`5 ${longName}`);

  const sideOptions = sideboard.getByRole('button', {name:`Group actions for ${longFunction} · Sideboard`,exact:true});
  await activate(sideOptions);
  await expect(sideboard.locator(':popover-open')).toContainText('Sideboard');
  await activate(sideboard.getByRole('button', {name:'Copy shown cards'}));
  await expect.poll(readClipboard).toBe(`1 ${longName}`);

  await page.evaluate(() => {
    navigator.clipboard.writeText = async () => { throw new DOMException('Denied', 'NotAllowedError'); };
    document.documentElement.style.fontSize = '200%';
  });
  await activate(options);
  await page.screenshot({path:testInfo.outputPath('deck-group-actions-enlarged.png')});
  await activate(shown);
  await expect(toast).toHaveText('Could not copy cards. Allow clipboard access in your browser and try again.');
  await expect(options).toBeFocused();
  await noPageOverflow(page);
  await filter.clear();
  await expect(collapse).toHaveAttribute('aria-expanded','false');
  await grouping.selectOption('none');
  await expect(main.locator('[data-toggle-deck-group]')).toHaveCount(0);
  await grouping.selectOption('role');
  await expect(collapse).toHaveAttribute('aria-expanded','false');
  await page.getByRole('button', {name:'Back to library',exact:true}).click();
  await page.getByRole('button', {name:'Other Deck',exact:true}).click();
  await grouping.selectOption('role');
  await expect(collapse).toHaveAttribute('aria-expanded','true');
  await page.getByRole('button', {name:'Back to library',exact:true}).click();
  await page.getByRole('button', {name:'Smoke Garden',exact:true}).click();
  await grouping.selectOption('role');
  await expect(collapse).toHaveAttribute('aria-expanded','false');
  await page.reload();
  await page.getByRole('button', {name:'Smoke Garden',exact:true}).click();
  await grouping.selectOption('role');
  await expect(collapse).toHaveAttribute('aria-expanded','true');
  expect(await page.evaluate(key => localStorage.getItem(key), key)).toBe(saved);
});

test('ownership zones keep every card visible and retain missing costs across scope changes', async ({ page }) => {
  await page.evaluate(() => {
    const key = 'arcana.workspace.v2';
    const data = JSON.parse(localStorage.getItem(key));
    const [commander, main, maybe] = data.decks[0].cards;
    commander.card.prices.eur = null;
    maybe.zone = 'maybeboard';
    data.decks[0].cards = [commander, main, maybe];
    data.decks[0].budgetCents = 100;
    localStorage.setItem(key, JSON.stringify(data));
  });
  await page.reload();
  const openBudget = async () => {
    await page.getByRole('button', { name: 'Smoke Garden', exact: true }).click();
    await page.getByRole('tab', { name: 'Ownership & costs', exact: true }).click();
  };
  await openBudget();
  const maybe = page.getByRole('checkbox', { name: 'Maybeboard' });
  const maybeRow = page.getByRole('row').filter({ hasText: 'Smoke Card 3' });
  const comparison = page.getByRole('table',{name:'Cost estimates',exact:true});
  await expect(maybe).not.toBeChecked();
  await expect(maybeRow).toContainText('Outside estimate');
  await expect(comparison).toContainText('Cost of missing copies');
  await expect(comparison).toContainText('1 unpriced copy');
  await expect(page.locator('#deck-budget, #budget-basis')).toHaveCount(0);
  await maybe.focus();
  await page.keyboard.press('Space');
  await expect(maybe).toBeChecked();
  await expect(maybe).toBeFocused();
  await expect(maybeRow).not.toContainText('Outside estimate');
  await expect(comparison).toContainText('1 unpriced copy');
  await noPageOverflow(page);
  await page.reload();
  await openBudget();
  await expect(maybe).toBeChecked();
  await expect(page.locator('.planning-table tbody tr')).toHaveCount(3);
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('arcana.workspace.v2')).decks[0].budgetCents)).toBe(100);
  await expect(comparison).toContainText('1 unpriced copy');
});

test('ownership compares selected and cheapest printings without changing deck cards', async ({ page }, testInfo) => {
  await page.evaluate(() => {
    const key = 'arcana.workspace.v2';
    const data = JSON.parse(localStorage.getItem(key));
    const [commander, main, maybe] = data.decks[0].cards;
    commander.card.finishes = ['foil'];
    commander.card.cardmarket_id = 41;
    main.card.prices.eur = '2.25';
    maybe.zone = 'maybeboard';
    data.decks[0].cards = [commander, main, maybe];
    localStorage.setItem(key, JSON.stringify(data));
  });
  await page.reload();
  let attempts = 0;
  let release;
  const waitForCancel = new Promise(resolve => { release = resolve; });
  await page.route('**/api/search?**', async route => {
    if (++attempts === 1) await waitForCancel;
    const query = new URL(route.request().url()).searchParams.get('q');
    expect(query).toContain('game:paper lang:en is:nonfoil unique:prints');
    expect(cards.slice(0,3).some(card=>query.includes(`oracleid:${card.oracle_id}`))).toBe(true);
    const data = ['0.50','0.33','0.25'].map((eur,i)=>({...cards[i],games:['paper'],set_name:'Cheaper set',prices:{eur}}));
    await route.fulfill({ json: { data, has_more: false } });
  });
  await page.getByRole('button', { name: 'Smoke Garden', exact: true }).click();
  await page.getByRole('tab', { name: 'Checks', exact: true }).click();
  await expect(page.locator('.check-summary')).not.toContainText('Checking card legality');
  await page.getByRole('tab', { name: 'Ownership & costs', exact: true }).click();
  const before = await page.evaluate(() => localStorage.getItem('arcana.workspace.v2'));
  const check = page.getByRole('button', { name: 'Check cheapest printings', exact: true });
  const cancel = page.getByRole('button', { name: 'Cancel price check', exact: true });
  const request = page.waitForRequest('**/api/search?**');
  await check.press('Enter');
  await request;
  await expect(cancel).toBeFocused();
  await cancel.press('Enter');
  release();
  await expect(page.getByText('Price check cancelled. Resume keeps completed cards and restarts the interrupted card.')).toBeVisible();
  await page.getByRole('button',{name:'Resume price check',exact:true}).press('Enter');
  await expect(cancel).toHaveCount(0);
  await expect(check).toBeFocused();
  const row = page.getByRole('row').filter({ hasText: 'Smoke Card 2' });
  await expect(row.getByRole('cell').nth(2)).toHaveText('2/2');
  await expect(row.getByRole('cell').nth(3)).toContainText(/2[.,]25/);
  await expect(row.getByRole('cell').nth(4)).toContainText(/0[.,]33.*TST/);
  await expect(page.getByRole('link', { name: 'Cardmarket' })).toHaveAttribute('href', /idProduct=41&isFoil=Y$/);
  const cheapestTotal = page.locator('.planning-summary tr').filter({ hasText: 'Cheapest printings for missing copies' });
  await expect(cheapestTotal).toContainText(/0[.,]50/);
  expect(await page.evaluate(() => localStorage.getItem('arcana.workspace.v2'))).toBe(before);
  await page.getByRole('checkbox', { name: 'Maybeboard' }).check();
  await expect(cheapestTotal).toContainText(/0[.,]75/);
  await noPageOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('budget-comparison.png') });
});

test('deck drag destinations stay still across gaps and let the page scroll outside', async ({ page, isMobile }, testInfo) => {
  test.skip(isMobile, 'Direct dragging uses a desktop pointer');
  if (testInfo.project.name === 'desktop-dark') await page.setViewportSize({ width: 760, height: 720 });
  await page.getByRole('button', { name: 'Smoke Garden', exact: true }).click();
  await page.locator('#editor-layout').selectOption('text-vertical');
  const original = await page.evaluate(() => localStorage.getItem('arcana.workspace.v2'));
  const scrollY = () => page.evaluate(() => window.scrollY);
  const dock = page.locator('#deck-drag-targets');
  const startDrag = async () => {
    const name = page.locator('.deck-workspace [data-inspect]').first();
    await name.scrollIntoViewIfNeeded();
    const box = await name.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 10, box.y + box.height / 2);
    await expect(dock).toBeVisible();
  };
  const sideboard = dock.getByText('Move to Sideboard', { exact: true });
  const mainDeck = dock.getByText('Move to Main deck', { exact: true });
  const checkSizing = async () => {
    const newFunction = await dock.getByText('Add to new function', { exact: true }).boundingBox();
    const zone = await sideboard.boundingBox();
    expect(newFunction.width).toBeCloseTo(zone.width, 0);
    expect(newFunction.height).toBeCloseTo(zone.height, 0);
    const nav=await page.locator('.workspace-nav').boundingBox(),strip=await dock.boundingBox();
    expect(nav.y).toBeCloseTo(0,0);
    expect(strip.y).toBeGreaterThanOrEqual(nav.y+nav.height);
    for(const label of ['Move to Sideboard','Move to Maybeboard']){
      const target=dock.getByText(label,{exact:true});
      expect(await target.evaluate(el=>{
        const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
      })).toBe(true);
    }
    await noPageOverflow(page);
  };

  await startDrag();
  const [left, right] = await Promise.all([mainDeck.boundingBox(), sideboard.boundingBox()]);
  const beforeGap = await scrollY();
  await page.mouse.move((left.x + left.width + right.x) / 2, left.y + left.height / 2);
  await page.evaluate(async () => {
    for (let frame = 0; frame < 8; frame++) await new Promise(requestAnimationFrame);
  });
  expect(await scrollY(), 'scroll offset over the gap between bottom targets').toBe(beforeGap);
  await checkSizing();
  await page.screenshot({ path: testInfo.outputPath('deck-drag-destinations.png') });
  await page.mouse.up();
  await expect(dock).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('arcana.workspace.v2'))).toBe(original);

  await page.locator('#editor-group').selectOption('role');
  await startDrag();
  await checkSizing();
  const beforeEdge = await scrollY();
  const { width, height } = page.viewportSize();
  await page.mouse.move(width / 2, height - 2);
  await expect.poll(scrollY).toBeGreaterThan(beforeEdge);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(dock).toBeHidden();
  await expect(page.locator('#deck-drag-help')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('arcana.workspace.v2'))).toBe(original);
});

test('card menus keep deletion available by keyboard and touch', async ({ page, isMobile }) => {
  await page.getByRole('button', { name: 'Smoke Garden', exact: true }).click();
  const action = page.getByRole('button', { name: 'Card actions for Smoke Card 1 in Command zone', exact: true });
  if (isMobile) await action.tap();
  else await action.press('Enter');
  const move = page.getByRole('menuitem', { name: 'Move to…', exact: true });
  if (isMobile) await move.tap();
  else await move.press('ArrowRight');
  const destinations = page.getByRole('menu', { name: 'Move destinations for Smoke Card 1 in Smoke Garden · Command zone' });
  await expect(destinations.getByRole('menuitem')).toHaveText(['Main deck', 'Sideboard', 'Maybeboard']);
  await expect(destinations).not.toContainText('Move all entry copies');
  await page.keyboard.press('Escape');
  await expect(move).toBeFocused();
  const remove = page.getByRole('menuitem', { name: 'Delete card', exact: true });
  if (isMobile) await remove.tap();
  else await remove.press('Enter');
  await dialogFits(page);
  const keep = page.getByRole('button', { name: 'Keep cards', exact: true });
  await expect(keep).toBeFocused();
  await keep.click();
  await expect(action).toBeVisible();
});

test('card context menus reuse deck entry and owned lot actions at viewport edges', async ({page,isMobile},testInfo) => {
  test.skip(isMobile,'Desktop mouse context menu');
  await page.evaluate(()=>{
    const key='arcana.workspace.v2', workspace=JSON.parse(localStorage.getItem(key));
    const original=workspace.decks[0].cards[1];
    workspace.decks[0].cards.push({...original,zone:'sideboard',finish:'foil',qty:5});
    workspace.collection.push({...workspace.collection[0],finish:'foil',condition:'heavily_played',qty:7});
    localStorage.setItem(key,JSON.stringify(workspace));
  });
  await page.reload();
  await page.getByRole('button',{name:'Smoke Garden',exact:true}).click();
  const menu=page.locator('#card-actions'), functions=page.locator('#card-submenu');
  const contents=()=>menu.locator(':scope > button').allTextContents();
  const inViewport=element=>element.evaluate(node=>{
    const box=node.getBoundingClientRect();
    return box.left>=0&&box.right<=innerWidth&&box.top>=0&&box.bottom<=innerHeight;
  });
  const art=page.getByRole('button',{name:'Inspect Smoke Card 1 in Command zone',exact:true});
  const action=page.getByRole('button',{name:'Card actions for Smoke Card 1 in Command zone',exact:true});
  await action.click();
  const expected=await contents();
  await page.keyboard.press('Escape');
  await art.click({button:'right'});
  await expect(menu).toHaveAccessibleName('Card actions for Smoke Card 1 in Smoke Garden · Command zone');
  expect(await contents()).toEqual(expected);
  await page.keyboard.press('Escape');
  await expect(action).toBeFocused();
  await art.press('Shift+F10');
  await expect(menu.getByRole('menuitem',{name:'Open details'})).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(art).toBeFocused();
  await art.click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Add one Smoke Card 1 to Command zone'}).click({button:'right'});
  await expect(menu).toBeHidden();

  await page.setViewportSize({width:775,height:660});
  await page.locator('html').evaluate(node=>{node.style.fontSize='200%';});
  await page.locator('#editor-layout').selectOption('text-vertical');
  const sideboardAction=page.getByRole('button',{name:/Card actions for Smoke Card 2 in Sideboard.*Foil/});
  const sideboard=page.locator('.text-card').filter({has:sideboardAction});
  await sideboard.getByRole('button',{name:'Smoke Card 2',exact:true}).click({button:'right'});
  await expect(menu).toHaveAccessibleName('Card actions for Smoke Card 2 in Smoke Garden · Sideboard');
  expect(await inViewport(menu)).toBe(true);
  await menu.getByRole('menuitem',{name:/Assign card to function/}).press('ArrowRight');
  await expect(functions.getByRole('menuitem',{name:'Add new function…'})).toBeFocused();
  expect(await inViewport(functions)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('card-context-menu.png')});
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await expect(sideboardAction).toBeFocused();
  const main=page.getByRole('button',{name:'Card actions for Smoke Card 2 in Main deck',exact:true});
  await main.press('ContextMenu');
  await expect(menu).toHaveAccessibleName('Card actions for Smoke Card 2 in Smoke Garden · Main deck');
  await page.keyboard.press('Escape');
  await expect(main).toBeFocused();
  const selectionKept=await sideboard.getByRole('button',{name:'Smoke Card 2',exact:true}).evaluate(node=>{
    const selection=window.getSelection();
    selection.selectAllChildren(node);
    const nativeAllowed=node.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,button:2}));
    selection.removeAllRanges();
    return nativeAllowed;
  });
  expect(selectionKept).toBe(true);
  await expect(menu).toBeHidden();

  await page.getByRole('button',{name:'Search cards',exact:true}).click();
  await page.getByRole('combobox',{name:'Track deck',exact:true}).selectOption('smoke-deck');
  const tracked=page.locator('#deck-tracker').getByRole('button',{name:'Smoke Card 1',exact:true});
  await tracked.click({button:'right'});
  await expect(menu).toBeHidden();

  await page.getByRole('button',{name:'Collection',exact:true}).click();
  const owned=page.locator('.collection-row[data-owned-row="1"]');
  const ownedArt=owned.getByRole('button',{name:'Edit owned Smoke Card 2'});
  await ownedArt.click({button:'right'});
  await expect(menu.getByRole('menuitem')).toHaveText(['Edit','Remove']);
  await menu.getByRole('menuitem',{name:'Edit',exact:true}).click();
  await expect(page.locator('#owned-qty')).toHaveValue('7');
  await expect(page.locator('#owned-finish')).toHaveValue('foil');
  await page.keyboard.press('Escape');
  await page.locator('#collection-view').selectOption('text');
  await page.locator('tr[data-owned-row="1"]').getByRole('button',{name:'Smoke Card 2'}).click({button:'right'});
  await expect(menu).toBeHidden();
});

test('commander minus confirms from the deck and tracker', async ({ page, isMobile }) => {
  const activate = button => isMobile ? button.tap() : button.press('Enter');
  await page.getByRole('button', { name: 'Smoke Garden', exact: true }).click();
  const minus = page.getByRole('button', { name: 'Remove one Smoke Card 1 from Command zone', exact: true });
  const confirmation = page.getByRole('dialog', { name: 'Remove Smoke Card 1?', exact: true });
  const keep = confirmation.getByRole('button', { name: 'Keep commander', exact: true });
  const storedDeck = () => page.evaluate(() => JSON.parse(localStorage.getItem('arcana.workspace.v2')).decks[0]);
  const original = await storedDeck();
  await activate(minus);
  await expect(confirmation).toContainText('Command zone in Smoke Garden');
  await expect(keep).toBeFocused();
  await activate(keep);
  await expect(minus).toBeFocused();
  expect(await storedDeck()).toEqual(original);

  await page.getByRole('button', { name: 'Search cards', exact: true }).click();
  await page.getByRole('combobox', { name: 'Track deck', exact: true }).selectOption('smoke-deck');
  await activate(minus);
  await expect(keep).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(minus).toBeFocused();
  expect(await storedDeck()).toEqual(original);
  await activate(minus);
  await activate(confirmation.getByRole('button', { name: 'Remove commander', exact: true }));
  await expect(minus).toHaveCount(0);
  expect((await storedDeck()).cards.map(entry=>entry.card.id)).toEqual(original.cards.slice(1).map(entry=>entry.card.id));
});

test('visual card controls retain contrast over light and dark art in all palettes', async ({ page, isMobile }) => {
  await page.getByRole('button', { name: 'Smoke Garden', exact: true }).click();
  await page.mouse.move(1,1);
  const controls = page.getByRole('article', { name: /Smoke Card 1 · Command zone/ }).locator('.card-side-controls button');
  await expect(controls).toHaveCount(3);
  for (const theme of ['light','dark']) for (const palette of ['green','blue','white','orange','rose','teal','sepia']) {
    await page.evaluate(({ theme, palette }) => Object.assign(document.documentElement.dataset, { theme, palette }), { theme, palette });
    const styles = await controls.evaluateAll(buttons => {
      const canvas = document.createElement('canvas');
      canvas.width=canvas.height=1;
      const ctx=canvas.getContext('2d',{willReadFrequently:true});
      const channels = color => {
        ctx.clearRect(0,0,1,1);
        ctx.fillStyle=color;
        ctx.fillRect(0,0,1,1);
        return [...ctx.getImageData(0,0,1,1).data].map(value=>value/255);
      };
      const luminance = rgb => rgb
        .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
        .reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
      return buttons.map(button => {
        const style = getComputedStyle(button), { width, height } = button.getBoundingClientRect();
        const [r,g,b,alpha]=channels(style.backgroundColor);
        const ink=luminance(channels(style.color).slice(0,3));
        const ratios=[0,1].map(art=>{
          const backdrop=luminance([r,g,b].map(channel=>alpha*channel+(1-alpha)*art));
          return (Math.max(ink,backdrop)+.05)/(Math.min(ink,backdrop)+.05);
        });
        return { width, height, alpha, ratio:Math.min(...ratios) };
      });
    });
    for (const { width, height, alpha, ratio } of styles) {
      expect(alpha, `${theme}/${palette}`).toBeCloseTo(.8);
      expect(ratio, `${theme}/${palette}`).toBeGreaterThanOrEqual(4.5);
      expect(width).toBe(isMobile ? 44 : 36);
      expect(height).toBe(width);
    }
  }
  await controls.first().press('Tab');
  await expect(controls.nth(1)).toBeFocused();
  await expect(controls.nth(1)).toHaveCSS('outline-style', 'solid');
  await expect(controls.nth(1)).toHaveCSS('background-color', /^rgb\(/);
});

test('search, printing dialog, keyboard dismissal and reload retain deck data', async ({ page }) => {
  await page.getByRole('button', { name: 'Search cards', exact: true }).click();
  await page.locator('#raw').fill('Smoke');
  await page.locator('#search-form').getByRole('button', { name: 'Search', exact: true }).click();
  await page.getByRole('button', { name: `Inspect ${cards[0].name}`, exact: true }).click();
  await dialogFits(page);
  await expect(page.locator('#printing-status')).toContainText('1 printing loaded');
  await expect(page.locator('#view-printing option')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Smoke Garden', exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('arcana.workspace.v2')).decks[0].cards.length)).toBe(40);
  await noPageOverflow(page);
});

test('card details, additive Add and the entry editor preserve distinct printings and finishes', async ({ page, isMobile }, testInfo) => {
  await page.evaluate(()=>{const data=JSON.parse(localStorage.getItem('arcana.workspace.v2'));data.decks[0].currency='USD';localStorage.setItem('arcana.workspace.v2',JSON.stringify(data));});
  await page.reload();
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('arcana.workspace.v2')));
  const printCard = cards[1];
  const alternate = { ...printCard, id: 'second-printing', set_name: 'Second Release', prices: { usd:'2.50', usd_foil:'6.00' } };
  await page.route('**/api/printings?**', route=>route.fulfill({ json:{data:[printCard,alternate],has_more:false} }));
  await page.getByRole('button',{name:'Smoke Garden',exact:true}).click();
  await page.locator('#editor-layout').selectOption('text-vertical');
  const inspect=page.locator(`[data-inspect="${printCard.id}"]`);
  await inspect.click();
  const dialog=page.getByRole('dialog');
  await dialogFits(page);
  await expect(dialog).toContainText('3 copies owned of this printing.');
  await page.screenshot({path:testInfo.outputPath('card-details.png')});
  await page.locator('#view-printing').selectOption(alternate.id);
  await expect(dialog).toContainText('No copies owned of this printing.');
  await dialog.getByRole('button',{name:'Add this card to collection',exact:true}).click();
  const back=dialog.getByRole('button',{name:'Back to card details',exact:true});
  await back.click();
  await expect(dialog.locator('#view-printing')).toHaveValue(alternate.id);
  await expect(dialog.locator('#detail-add-owned')).toBeFocused();
  await dialog.getByRole('button',{name:'Add card to deck',exact:true}).click();
  await dialogFits(page);
  await expect(dialog.getByLabel('Destination deck')).toHaveValue('smoke-deck');
  await expect(dialog.locator('#add-existing')).toContainText('all zones and printings: 2');
  await dialog.getByLabel('Finish',{exact:true}).selectOption('foil');
  await expect(dialog.locator('#deck-card-price')).toHaveText('$6.00 per copy');
  await expect(dialog.locator('#load-printings')).toBeHidden();
  await page.screenshot({path:testInfo.outputPath('add-card.png')});
  await dialog.getByLabel('Quantity to add').fill('2');
  await dialog.getByLabel('Primary function').fill('Removal');
  expect((await stored()).decks[0].cards).toHaveLength(40);
  await dialog.getByRole('button',{name:'Add card(s) to deck',exact:true}).click();
  await expect(dialog.locator('#view-printing')).toHaveValue(alternate.id);
  await page.keyboard.press('Escape');
  await expect(inspect).toBeFocused();

  const menu=page.locator('article.deck-entry').filter({has:inspect}).getByRole('button',{name:'Card actions for Smoke Card 2 in Main deck',exact:true});
  if(isMobile)await menu.tap();else await menu.press('Enter');
  await page.getByRole('menuitem',{name:'Change in-deck card details',exact:true}).click();
  await dialogFits(page);
  await dialog.getByLabel('Finish',{exact:true}).selectOption('foil');
  await expect(dialog.locator('#deck-card-price')).toContainText('Price unavailable');
  await expect(dialog.locator('#load-printings')).toBeHidden();
  await page.screenshot({path:testInfo.outputPath('edit-printing.png')});
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  expect((await stored()).decks[0].cards[1].finish).toBeUndefined();
  if(isMobile)await menu.tap();else await menu.press('Enter');
  await page.getByRole('menuitem',{name:'Change in-deck card details',exact:true}).click();
  await dialog.getByLabel('Finish',{exact:true}).selectOption('foil');
  await dialog.getByRole('button',{name:'Save printing and finish',exact:true}).click();
  await expect(dialog).toBeHidden();
  await page.reload();
  const result=await stored();
  expect(result.decks[0].cards.filter(entry=>entry.card.oracle_id===printCard.oracle_id)
    .map(entry=>[entry.card.id,entry.qty,entry.finish,entry.tags])).toEqual([
    [printCard.id,2,'foil',['Draw']],
    [alternate.id,2,'foil',['Removal']],
  ]);
  expect(result.collection[0].qty).toBe(3);
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

test('collection captions, row editing and table geometry stay consistent with long metadata', async ({page,isMobile},testInfo)=>{
  await page.evaluate(()=>{
    const key='arcana.workspace.v2',data=JSON.parse(localStorage.getItem(key)),card=data.collection[0].card;
    data.collection=[
      {card:{...card,name:'A very long card name that must remain available in the owned card editor',set_name:'An exceptionally long edition name with many words to test stable table columns',lang:'ja'},qty:7,finish:'foil',condition:'heavily_played'},
      {card:{...card,id:card.id+'-other',name:'Short',set_name:'Other set'},qty:2,finish:'regular'},
      {card:{...card,id:card.id+'-third',name:'Middle',set_name:'Other set'},qty:9999,finish:'etched',condition:'moderately_played',addedAt:'2026-10-01T12:00:00Z',updatedAt:'2026-11-01T12:00:00Z'},
    ];
    localStorage.setItem(key,JSON.stringify(data));
  });
  await page.reload();
  await page.getByRole('button',{name:'Collection',exact:true}).click();
  const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('arcana.workspace.v2')).collection);
  const original=await stored(),row=page.locator('.collection-row[data-owned-row="0"]');
  await expect(row.locator('h3')).toHaveCount(0);await expect(row.locator('.collection-visual-info')).toHaveText('JA · foil · HP');
  await expect(row.locator('abbr')).toHaveText('HP');await expect(row.locator('abbr')).toHaveAttribute('title','Heavily played');
  const captions=await page.locator('.collection-row').evaluateAll(nodes=>nodes.map(node=>({height:node.getBoundingClientRect().height,art:node.querySelector('.collection-art').getBoundingClientRect().height,caption:node.querySelector('.collection-visual-info').getBoundingClientRect().height})));
  expect(new Set(captions.map(value=>value.height)).size).toBe(1);
  for(const caption of captions){expect(caption.caption).toBe(20);expect(caption.height-caption.art).toBeLessThanOrEqual(24);}
  await page.screenshot({path:testInfo.outputPath('collection-captions.png'),fullPage:true});
  await row.locator('.collection-art').click();
  await expect(page.locator('#owned-finish')).toHaveValue('foil');await expect(page.locator('#owned-condition')).toHaveValue('heavily_played');await expect(page.locator('#owned-qty')).toHaveValue('7');
  await page.locator('#owned-plus').click();await page.getByRole('button',{name:'Cancel',exact:true}).click();expect(await stored()).toEqual(original);
  await row.locator('.collection-visual-info').click();await expect(page.locator('#owned-qty')).toHaveValue('7');await page.keyboard.press('Escape');
  const options=row.locator('[data-owned-menu]');await options.focus();await options.press('Enter');
  await expect(page.getByRole('menuitem',{name:'Edit',exact:true})).toBeFocused();await page.keyboard.press('ArrowDown');await expect(page.getByRole('menuitem',{name:'Remove',exact:true})).toBeFocused();await page.keyboard.press('Escape');await expect(options).toBeFocused();
  await row.locator('[data-owned-plus]').click();expect((await stored())[0].qty).toBe(8);await expect(page.getByRole('dialog')).toBeHidden();
  await page.locator('#collection-view').selectOption('text');
  const table=page.locator('.collection-table'),first=table.locator('tbody tr[data-owned-row="0"]');
  const geometry=()=>table.locator('tbody tr').evaluateAll(rows=>rows.map(row=>({height:row.getBoundingClientRect().height,widths:[...row.cells].map(cell=>cell.getBoundingClientRect().width)})));
  const before=await geometry();expect(new Set(before.map(row=>row.height)).size).toBe(1);
  for(const row of before)expect(row.widths).toEqual(before[0].widths);
  await expect(first.locator('td').nth(3).locator('span')).toHaveAttribute('title',/An exceptionally long edition/);
  expect(await first.locator('td').nth(3).locator('span').evaluate(node=>node.scrollWidth>node.clientWidth)).toBe(true);
  // Any non-control cell opens its own lot; keyboard access uses the native name button.
  await first.locator('td').first().click();await expect(page.locator('#owned-qty')).toHaveValue('8');await page.keyboard.press('Escape');
  const name=first.locator('[data-edit-owned]').first();await name.focus();await name.press('Enter');await expect(page.locator('.owned-editor h3')).toHaveText(original[0].card.name);await dialogFits(page);await page.keyboard.press('Escape');
  await page.locator('#collection-sort').selectOption('name');expect(await geometry()).toEqual(before);
  await page.locator('#collection-filter').fill('Short');await expect(table.locator('tbody tr')).toHaveCount(1);expect((await geometry())[0]).toEqual(before[0]);
  await page.locator('#collection-filter').fill('');await page.locator('#collection-group').selectOption('set');
  const grouped=await page.locator('.collection-table tbody tr').evaluateAll(rows=>rows.map(row=>[...row.cells].map(cell=>cell.getBoundingClientRect().width)));
  for(const widths of grouped)expect(widths).toEqual(before[0].widths);
  await page.locator('#collection-group').selectOption('none');
  const scroll=page.locator('.collection-table-scroll');await scroll.evaluate(node=>node.scrollLeft=node.scrollWidth);
  const actions=table.locator('tbody tr').first().locator('.collection-actions');
  expect(await actions.evaluate(node=>{const box=node.getBoundingClientRect();return box.right<=innerWidth&&box.left>=0;})).toBe(true);
  if(isMobile){const box=await actions.getByRole('button',{name:'Edit',exact:true}).boundingBox();expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);}
  await noPageOverflow(page);await page.screenshot({path:testInfo.outputPath('collection-table.png'),fullPage:true});
  const saved=await stored();await page.reload();expect(await stored()).toEqual(saved);
});

test('collection edits replace the clicked card and combine a matching condition without leaving the old lot',async({page})=>{
  await page.evaluate(()=>{
    const key='arcana.workspace.v2',data=JSON.parse(localStorage.getItem(key)),card=data.collection[0].card;
    data.collection=[{card,qty:1,finish:'regular',condition:'near_mint'},{card,qty:2,finish:'regular',condition:'lightly_played'},{card:{...card,id:card.id+'-other',name:'Unrelated'},qty:4,finish:'regular'}];
    localStorage.setItem(key,JSON.stringify(data));
  });
  await page.reload();await page.getByRole('button',{name:'Collection',exact:true}).click();
  const holdings=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('arcana.workspace.v2')).collection),original=await holdings();
  const open=()=>page.locator('[data-owned-row="0"] .collection-art').click();
  await open();await expect(page.getByRole('heading',{name:'Update card in collection',exact:true})).toBeVisible();
  await page.locator('#owned-condition').selectOption('damaged');await expect(page.locator('#owned-qty')).toHaveValue('1');
  await page.getByRole('button',{name:'Cancel',exact:true}).click();expect(await holdings()).toEqual(original);
  await open();await page.locator('#owned-condition').selectOption('damaged');await page.locator('#owned-finish').selectOption('foil');await expect(page.locator('#owned-qty')).toHaveValue('1');
  await page.getByRole('button',{name:'Update card',exact:true}).click();
  let saved=await holdings();expect(saved).toHaveLength(3);expect(saved[0]).toMatchObject({qty:1,finish:'foil',condition:'damaged'});expect(saved.slice(1)).toEqual(original.slice(1));
  await page.reload();await page.getByRole('button',{name:'Collection',exact:true}).click();await open();
  await expect(page.locator('#owned-condition')).toHaveValue('damaged');await expect(page.locator('#owned-finish')).toHaveValue('foil');
  await page.locator('#owned-finish').selectOption('regular');await page.locator('#owned-condition').selectOption('lightly_played');await expect(page.locator('#owned-qty')).toHaveValue('1');
  await expect(page.locator('#owned-existing')).toContainText('combine with 2 copies');
  await page.getByRole('button',{name:'Update card',exact:true}).click();saved=await holdings();
  expect(saved).toHaveLength(2);expect(saved[0]).toMatchObject({qty:3,finish:'regular',condition:'lightly_played'});expect(saved[1]).toEqual(original[2]);
  await page.reload();expect(await holdings()).toEqual(saved);
});

test('Search cards navigation starts fresh and tracker guidance follows the selector', async ({ page }, testInfo) => {
  const searchNav = page.getByRole('button', { name: 'Search cards', exact: true });
  const track = page.getByRole('combobox', { name: 'Track deck', exact: true });
  const raw = page.locator('#raw');
  await page.getByRole('button', { name: 'Smoke Garden', exact: true }).click();
  await page.getByRole('button', { name: 'Search cards', exact: true }).click();
  await page.getByRole('combobox', { name: 'Track deck', exact: true }).selectOption('smoke-deck');
  await expect(track).toHaveValue('smoke-deck');
  await raw.focus();
  await expect(raw).toHaveValue('');
  const target = page.locator('.exploration-target');
  await expect(target.getByText('Default destination: Smoke Garden · Main deck')).toBeVisible();
  const hide = target.getByRole('button', { name: 'Hide tracker' });
  await hide.focus();
  await hide.press('Enter');
  const show = target.getByRole('button', { name: 'Show tracker' });
  await expect(show).toBeFocused();
  await show.press('Enter');
  await expect(page.locator('#deck-tracker')).toBeVisible();
  await noPageOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('explore-with-tracker.png') });

  await raw.fill('t:creature otag:ramp');
  await raw.press('Enter');
  await expect(page.locator('.card-tile')).toHaveCount(3);
  await page.getByRole('button', { name: 'My decks', exact: true }).click();
  await searchNav.focus();
  await searchNav.press('Enter');
  await expect(raw).toBeFocused();
  await expect(raw).toHaveValue('');
  await expect(track).toHaveValue('');
  await expect(page.locator('#search-output')).toBeEmpty();
  const hint = target.getByText('Browse freely. Choose a destination when adding a card.', { exact: true });
  await expect(track).toHaveAccessibleDescription(await hint.textContent());
  const selectorBox = await track.boundingBox();
  const hintBox = await hint.boundingBox();
  expect(hintBox.y).toBeGreaterThanOrEqual(selectorBox.y + selectorBox.height);
  expect(hintBox.x).toBeCloseTo(selectorBox.x, 0);
  await noPageOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('explore-fresh.png') });
});

test('Search cards sorts USD prices in both directions and labels unavailable quotes', async ({ page }, testInfo) => {
  const priced = [
    { ...cards[0], prices: { usd: '0.25' } },
    { ...cards[1], prices: { usd: '12.00' } },
  ];
  const unknown = { ...cards[2], prices: { usd: null, usd_foil: '5.00' } };
  const query = 't:artifact otag:ramp';
  await page.route('**/api/search?**', route => {
    const params = new URL(route.request().url()).searchParams;
    expect(params.get('q')).toBe(query);
    const order = params.get('order');
    const dir = params.get('dir');
    const data = order === 'usd' && dir === 'asc' ? [priced[0], unknown, priced[1]] : [priced[1], unknown, priced[0]];
    return route.fulfill({ json: { data, total_cards: data.length, has_more: false } });
  });
  await page.getByRole('button', { name: 'Search cards', exact: true }).click();
  const raw = page.locator('#raw');
  await raw.fill(query);
  await raw.press('Enter');
  const sort = page.getByRole('combobox', { name: 'Sort cards' });
  await expect(sort).toBeVisible();
  await sort.focus();
  const quotes = page.locator('.card-meta span:last-child');
  await sort.selectOption({ label: '$: low first' });
  await expect(quotes).toHaveText(['$0.25', 'Price unavailable', '$12.00']);
  await expect(sort).toBeFocused();
  await sort.selectOption({ label: '$: high first' });
  await expect(quotes).toHaveText(['$12.00', 'Price unavailable', '$0.25']);
  await expect(sort).toBeFocused();
  await expect(raw).toHaveValue(query);
  await noPageOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('explore-usd-sort.png') });
});

test('Search cards fills available width and keeps selected functions inside their disclosure', async ({ page }, testInfo) => {
  await page.route('**/api/search?**', route => route.fulfill({ json: { data: cards.slice(0, 12), total_cards: 12, has_more: false } }));
  await page.getByRole('button', { name: 'Search cards', exact: true }).click();
  await expect(page.locator('#search-output')).toBeEmpty();
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
  const matching = chips.getByLabel('Combine functions by');
  await expect(matching).toHaveValue('any');
  await matching.focus();
  await matching.selectOption('all');
  await expect(page.locator('#raw')).toHaveValue('t:creature (otag:ramp otag:draw)');
  await expect(page.locator('.card-tile')).toHaveCount(12);
  await expect(matching).toBeFocused();
  await chips.getByRole('button', { name: 'Remove ramp filter', exact: true }).press('Enter');
  await expect(page.locator('#raw')).toHaveValue('t:creature otag:draw');
  await expect(page.locator('.card-tile')).toHaveCount(12);
  await expect(functions.getByLabel('Find a function')).toBeFocused();
  await summary.focus();
  await page.keyboard.press('Enter');
  await expect(chips).toBeHidden();
  await expect(page.locator('#raw')).toHaveValue('t:creature otag:draw');
  await noPageOverflow(page);
  const columns = () => page.locator('.card-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  if (testInfo.project.name.startsWith('desktop')) {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.locator('#tracked-deck').selectOption('');
    // Body width excludes the scrollbar gutter reserved for modal scroll locking.
    const availableWidth = await page.locator('body').evaluate(body => body.clientWidth);
    expect((await page.locator('.explorer').boundingBox()).width).toBe(availableWidth);
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
  await expect(page.locator('#search-output')).toBeEmpty();
});

test('function pages and related browsing preserve the search until a filter is applied', async ({ page }, testInfo) => {
  const queries = [];
  const exampleQuery = slug => `game:paper otag:${slug}`;
  let removalAttempts = 0;
  let releaseSweeper;
  const waitForNavigation = new Promise(resolve => { releaseSweeper = resolve; });
  await page.route('**/api/search?**', async route => {
    const query = new URL(route.request().url()).searchParams.get('q');
    queries.push(query);
    if (query === exampleQuery('sweeper')) {
      await waitForNavigation;
      return route.fulfill({ json: { data: [cards[20]], total_cards: 1, has_more: false } });
    }
    if (query === exampleQuery('removal') && ++removalAttempts === 1) {
      return route.fulfill({ status: 502, json: { error: 'Fixture unavailable' } });
    }
    return route.fulfill({ json: { data: cards.slice(0, 12), total_cards: 12, has_more: false } });
  });
  await page.getByRole('button', { name: 'Search cards' }).click();
  const raw = page.locator('#raw');
  await raw.fill('t:creature (otag:ramp OR otag:draw)');
  await page.locator('#function-tags > summary').press('Enter');
  const lookup = page.getByRole('searchbox', { name: 'Find a function' });
  const grid = page.locator('.tag-options');
  const tiles = grid.locator('li');
  const pager = page.locator('#tag-page');
  await lookup.fill('a');
  await expect(tiles).toHaveCount(40);
  await expect(tiles.first()).toContainText(/\d+ cards?/);
  const phone = page.viewportSize().width < 600;
  const geometry = await tiles.evaluateAll(nodes => nodes.map(node => {
    const { x, y, width, height } = node.getBoundingClientRect();
    return { x, y, width, height };
  }));
  expect(new Set(geometry.map(rect => rect.x)).size).toBe(phone ? 2 : 5);
  expect(new Set(geometry.map(rect => rect.y)).size).toBe(phone ? 20 : 8);
  expect(Math.max(...geometry.map(rect => rect.width)) - Math.min(...geometry.map(rect => rect.width))).toBeLessThan(1);
  expect(Math.max(...geometry.map(rect => rect.height)) - Math.min(...geometry.map(rect => rect.height))).toBeLessThan(1);
  const firstTag = await tiles.first().getByRole('button', { name: /relationships/ }).getAttribute('data-browse-tag');
  await pager.focus();
  await pager.press('ArrowDown');
  await pager.press('Enter');
  await expect(pager).toBeFocused();
  await expect(pager).toHaveValue('2');
  await expect(tiles.first().getByRole('button', { name: /relationships/ })).not.toHaveAttribute('data-browse-tag', firstTag);
  await lookup.fill('a ');
  await expect(pager).toHaveValue('1');
  await noPageOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('function-grid.png') });
  expect(queries).toEqual([]);

  await lookup.fill('sweeper');
  const trigger = page.getByRole('button', { name: 'Browse sweeper relationships', exact: true });
  await trigger.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Related functions' });
  const heading = dialog.locator('#browsed-function');
  await expect(heading).toBeFocused();
  await expect(dialog.getByText('Loading example cards…')).toBeVisible();
  await expect.poll(() => queries.includes(exampleQuery('sweeper'))).toBe(true);
  await dialog.getByRole('button', { name: 'Removal', exact: true }).click();
  await expect(dialog.getByText('Example cards are unavailable.')).toBeVisible();
  releaseSweeper();
  await dialog.getByRole('button', { name: 'Try again' }).click();
  const examples = dialog.locator('.tag-example-grid li');
  await expect(examples).toHaveCount(8);
  await expect(examples.first()).toHaveText('Smoke Card 1');
  await expect.poll(() => examples.locator('img').evaluateAll(images => images.filter(img => img.naturalWidth > 0).length)).toBe(8);
  const rowPositions = await examples.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().y));
  expect(new Set(rowPositions).size).toBe(phone ? 4 : 2);
  await expect(dialog.getByText(/Direct taggings in the/)).toBeVisible();
  await dialogFits(page);
  await dialog.screenshot({ path: testInfo.outputPath('function-overlay.png') });
  await dialog.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(heading).toHaveText(/board wipes|sweeper/i);
  await dialog.getByRole('button', { name: 'Forward', exact: true }).click();
  await expect(heading).toHaveText('Removal');
  await dialog.getByLabel('Narrower functions').selectOption('sweeper');
  await expect(heading).toBeFocused();
  await expect(heading).toHaveText(/board wipes|sweeper/i);
  await expect(raw).toHaveValue('t:creature (otag:ramp OR otag:draw)');
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();

  await trigger.click();
  await dialog.getByRole('button', { name: 'Add filter', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(raw).toHaveValue('t:creature (otag:ramp OR otag:draw OR otag:sweeper)');
  await expect(trigger).toBeFocused();
  await expect(page.getByRole('button', { name: 'Remove sweeper filter', exact: true })).toHaveCount(2);
});

test('Search cards accepts primary and guided keyboard submission and adds unlisted functions inline', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: 'Search cards', exact: true }).click();
  const filters = page.locator('#search-filters'), raw = page.locator('#raw');
  await raw.fill('name:"Sol Ring" usd<5');
  await expect(page.locator('#applied-filter-summary')).toHaveText('Card name · 1 query-only expression');
  await page.locator('#search-submit').click();
  await expect(page.locator('.card-tile')).toHaveCount(3);
  await expect(filters).not.toHaveAttribute('open', '');

  await filters.locator(':scope > summary').press('Space');
  const nameFilter = filters.locator('.guided-family').first();
  await expect(nameFilter.locator('summary')).toHaveText('Card name');
  const name = nameFilter.getByLabel('Name phrase', { exact: true });
  await expect(name).toBeHidden();
  await nameFilter.locator('summary').press('Enter');
  await expect(name).toHaveValue('Sol Ring');
  await name.fill('Forest');
  await name.press('Enter');
  await expect(raw).toHaveValue('name:"Forest" usd<5');
  await expect(name).toBeVisible();
  await expect(filters.locator('[data-guided-family="type"] input:visible')).toHaveCount(0);
  const columns = await filters.locator('.guided-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(columns > 1).toBe(testInfo.project.name.startsWith('desktop'));

  await page.locator('#function-tags > summary').press('Enter');
  const lookup = page.getByRole('searchbox', { name: 'Find a function' });
  const matches = page.locator('#tag-match-count');
  await expect(matches).toBeHidden();
  await lookup.fill('blink');
  await expect(matches).toHaveText(/^[1-9][\d,.]* matching tags?$/);
  await expect(page.getByRole('button', { name: 'Add flicker filter', exact: true })).toBeVisible();
  await lookup.fill('tag:invalid');
  await expect(matches).toHaveText('0 matching tags');
  await expect(page.getByRole('button', { name: /as an unlisted function/ })).toHaveCount(0);
  await lookup.fill('arcana example function');
  const add = page.getByRole('button', { name: 'Add “arcana example function” as an unlisted function', exact: true });
  await expect(add).toBeVisible();
  await expect(raw).toHaveValue('name:"Forest" usd<5');
  await noPageOverflow(page);
  await page.screenshot({ path: testInfo.outputPath('explore-filter-panels.png'), fullPage:true });
  await add.press('Enter');
  await expect(raw).toHaveValue('name:"Forest" usd<5 otag:arcana-example-function');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Remove arcana-example-function filter', exact: true })).toBeFocused();
  await expect(name).toBeVisible();
});

test('type and keyword chips suggest locally, synchronize, and clear independently', async ({ page, isMobile }, testInfo) => {
  await page.getByRole('button', { name: 'Search cards', exact: true }).click();
  const raw = page.locator('#raw');
  await raw.fill('usd<5 o:/draw a card/');
  await page.locator('#search-filters > summary').click();
  await page.locator('#filter-heading-type').click();
  await page.locator('#filter-heading-keyword').click();
  const include = page.locator('[name="types"]'), exclude = page.locator('[name="excludedTypes"]');
  const keywords = page.locator('[name="keywords"]');
  await include.fill('e');
  await expect(page.locator('#types-suggestions button').first()).toBeVisible();
  await expect(raw).toHaveValue('usd<5 o:/draw a card/');
  await include.fill('elf');
  await include.press('ArrowDown');
  await expect(page.locator('#types-suggestions').getByRole('button', { name: 'Elf', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(include).toBeFocused();
  await expect(include).toHaveValue('');
  await include.fill('creature');
  await page.locator('#types-suggestions').getByRole('button', { name: 'Creature', exact: true }).click();
  await page.getByLabel('Combine types by').selectOption('any');
  await exclude.fill('artifact');
  const artifact = page.locator('#excludedTypes-suggestions').getByRole('button', { name: 'Artifact', exact: true });
  if (isMobile) await artifact.tap(); else await artifact.click();
  await keywords.fill('first strike');
  await keywords.press('Enter');
  await keywords.fill('flying');
  await page.locator('#keywords-suggestions').getByRole('button', { name: 'Flying', exact: true }).click();
  await page.getByLabel('Combine keywords by').selectOption('any');
  await expect(raw).toHaveValue('usd<5 o:/draw a card/ (t:"elf" OR t:"creature") -t:"artifact" (keyword:"first strike" OR keyword:"flying")');
  await include.fill('elf');
  await expect(page.locator('#types-suggestions').getByRole('status')).toHaveText('No matching suggestions.');
  await include.fill('el');
  await expect(page.locator('#types-suggestions').getByRole('button', { name: 'Elk', exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('explore-type-suggestions.png') });
  await include.press('Escape');
  await expect(page.locator('#types-suggestions')).toBeHidden();
  await page.screenshot({ path: testInfo.outputPath('explore-type-keyword-chips.png') });
  await page.getByRole('button', { name: 'Clear Types and subtypes search text', exact: true }).press('Enter');
  await expect(include).toBeFocused();
  await expect(include).toHaveValue('');
  await expect(raw).toHaveValue('usd<5 o:/draw a card/ (t:"elf" OR t:"creature") -t:"artifact" (keyword:"first strike" OR keyword:"flying")');
  await page.getByRole('button', { name: 'Clear selected types and subtypes', exact: true }).click();
  await expect(include).toBeFocused();
  await expect(raw).toHaveValue('usd<5 o:/draw a card/ -t:"artifact" (keyword:"first strike" OR keyword:"flying")');
  await page.getByRole('button', { name: 'Remove Artifact from Do not include', exact: true }).click();
  await expect(exclude).toBeFocused();
  await expect(raw).toHaveValue('usd<5 o:/draw a card/ (keyword:"first strike" OR keyword:"flying")');
  await page.getByRole('button', { name: 'Clear selected keyword abilities', exact: true }).click();
  await expect(raw).toHaveValue('usd<5 o:/draw a card/');
  await raw.fill('(t:creature OR -t:artifact) -kw:flying');
  await expect(include).toBeDisabled();
  await expect(keywords).toBeDisabled();
  await noPageOverflow(page);
});

test('guided clear controls reset only the requested value and return focus', async ({ page }) => {
  await page.getByRole('button', { name: 'Search cards', exact: true }).click();
  const raw = page.locator('#raw');
  await raw.fill('name:"Sol Ring" mv>=2 mv<=5 o:"draw" fo:"flying" c:m id>=W m>={U} m>={C} f:modern usd<5');
  await page.locator('#search-filters > summary').click();
  for (const family of ['name', 'mv', 'oracle', 'colors', 'cost', 'legal']) {
    await page.locator('#filter-heading-' + family).click();
  }
  for (const [label, field] of [
    ['name phrase', 'name'], ['mana value 1', 'mv-0'], ['rules-text phrase 2', 'oracle-1'],
    ['Card color', 'color-mode'], ['mana amount 1', 'cost-0'], ['format legality', 'legal'],
  ]) {
    await page.getByRole('button', { name: 'Clear ' + label, exact: true }).click();
    await expect(page.locator('#guided-form [name="' + field + '"]')).toBeFocused();
  }
  await expect(page.locator('[name="mv-1"]')).toHaveValue('5');
  await expect(page.locator('[name="oracle-mode-1"]')).toHaveValue('fo');
  await expect(page.locator('[name="color-W"]')).toBeEnabled();
  await page.getByRole('combobox',{name:'Match by',exact:true}).selectOption('identity');
  await expect(page.getByRole('combobox',{name:'Match by',exact:true})).toBeFocused();
  await expect(page.locator('[name="identity-W"]')).toBeChecked();
  await page.getByRole('button', {name:'Clear Color identity',exact:true}).click();
  await expect(page.locator('[name="identity-mode"]')).toBeFocused();
  await expect(page.locator('[name="identity-W"]')).not.toBeChecked();
  await expect(raw).toHaveValue('mv<=5 o:"draw" m>={C} usd<5');
  await expect(page.locator('#applied-filter-summary')).toBeHidden();
  await page.locator('#filters-heading').press('Enter');
  await expect(page.locator('#applied-filter-summary')).toContainText('Mana values');
  await noPageOverflow(page);
});

test('one Colors panel and repeatable mana costs preserve query semantics', async ({page}) => {
  const queries=[];
  page.on('request', request => {
    const url=new URL(request.url());
    if(url.pathname==='/api/search')queries.push(url.searchParams.get('q'));
  });
  await page.getByRole('button', {name:'Search cards',exact:true}).click();
  await page.locator('#search-filters > summary').click();
  const raw=page.locator('#raw');
  await raw.fill('id:w usd<5');
  await page.locator('#filter-heading-colors').click();
  const target=page.getByRole('combobox',{name:'Match by',exact:true});
  const matching=page.getByRole('combobox',{name:'Matching mode',exact:true});
  await expect(target).toHaveValue('identity');
  await expect(matching).toHaveValue('subset');
  await target.selectOption('color');
  await expect(raw).toHaveValue('id:w usd<5');
  await matching.selectOption('multi');
  await expect(raw).toHaveValue('id:w usd<5 c:m');
  await expect(page.getByRole('checkbox',{name:'White',exact:true})).toBeDisabled();

  await page.locator('#filter-heading-cost').click();
  await page.getByLabel('Mana amount 1',{exact:true}).fill('0');
  await expect(page.locator('#guided-error')).toContainText('from 1 to 20');
  await expect(raw).toHaveValue('id:w usd<5 c:m');
  await page.getByLabel('Mana amount 1',{exact:true}).fill('2');
  await expect(page.locator('#guided-error')).toBeEmpty();
  await page.getByRole('button',{name:'Add mana cost',exact:true}).click();
  await expect(page.getByLabel('Mana amount 2',{exact:true})).toBeFocused();
  await page.getByLabel('Mana symbol 2',{exact:true}).selectOption('C');
  await page.getByLabel('Mana cost comparison 2',{exact:true}).selectOption('=');
  await page.getByLabel('Mana amount 2',{exact:true}).fill('1');
  await page.getByRole('combobox',{name:'Combine mana cost filter by',exact:true}).selectOption('any');
  const expected='id:w usd<5 c:m (m>={2} OR (m>={C} -m>={C}{C}))';
  await expect(raw).toHaveValue(expected);
  await expect.poll(()=>queries.at(-1)).toBe(expected);
  await noPageOverflow(page);
  await raw.fill(expected+' f:commander');
  await expect(page.getByLabel('Mana symbol 2',{exact:true})).toHaveValue('C');
  await expect(page.getByLabel('Mana cost comparison 2',{exact:true})).toHaveValue('=');
  await page.getByRole('button',{name:'Remove mana cost filter 1',exact:true}).click();
  await expect(page.getByLabel('Mana amount 1',{exact:true})).toBeFocused();
  await expect(raw).toHaveValue('id:w usd<5 c:m (m>={C} -m>={C}{C}) f:commander');
  await raw.fill('c:r (id:w OR t:land) m:{1}{G}');
  await expect(page.getByLabel('Mana amount 1',{exact:true})).toBeDisabled();
  await target.selectOption('identity');
  await expect(matching).toBeDisabled();
  await expect(raw).toHaveValue('c:r (id:w OR t:land) m:{1}{G}');
});

test('repeatable mana and Oracle filters synchronize, scroll locally and preserve advanced syntax', async ({ page }, testInfo) => {
  const queries=[];
  page.on('request', request => {const url=new URL(request.url());if(url.pathname==='/api/search')queries.push(url.searchParams.get('q'));});
  await page.getByRole('button', { name: 'Search cards', exact: true }).click();
  await page.locator('#tracked-deck').selectOption('');
  await page.locator('#search-filters > summary').click();
  await page.locator('#filter-heading-mv').click();
  await page.locator('#filter-heading-oracle').click();
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
  await oracle.locator('[name="oracle-1"]').press('Enter');
  const expected='(mv>=1 OR mv>=2 OR mv>=6) (o:"Whenever ~ attacks" OR fo:"flying")';
  await expect(page.locator('#raw')).toHaveValue(expected);
  await expect.poll(()=>queries.at(-1)).toBe(expected);
  expect(await mv.locator('.filter-rows').evaluate(el=>el.clientHeight<=280&&el.scrollHeight>el.clientHeight)).toBe(true);
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
  await page.getByRole('button',{name:'Search cards',exact:true}).click();
  await page.locator('#raw').fill('(mv=1 OR mv=2 OR mv=3) (o:"draw" fo:"flying" o:"~ attacks") usd<5');
  await page.locator('#search-filters > summary').click();
  await page.locator('#filter-heading-mv').click();
  await page.locator('#filter-heading-oracle').click();
  const mv=page.locator('[data-family="mv"]'),oracle=page.locator('[data-family="oracle"]');
  for(const section of [mv,oracle]){
    await expect(section.locator('.filter-column-head')).toHaveCount(1);
    await expect(section.locator('[data-remove-filter]:enabled')).toHaveCount(3);
    expect(await section.locator('.repeatable-filter-row').evaluateAll(rows=>{
      const boxes=rows.map(row=>row.getBoundingClientRect());
      return Math.abs((boxes[1].top-boxes[0].bottom)-(boxes[2].top-boxes[1].bottom))<1 && rows.every(row=>{
        const controls=[...row.children].map(el=>el.getBoundingClientRect());
        const stacked=row.querySelector('.filter-row-label')?.checkVisibility();
        const aligned=stacked ? controls[0].bottom<=controls[1].top && Math.abs(controls[1].bottom-controls[2].bottom)<1
          : controls.every(box=>Math.abs(box.top-controls[0].top)<1);
        return aligned&&Math.abs(controls[2].width-controls[2].height)<1;
      });
    })).toBe(true);
  }
  const stacked=await oracle.locator('.filter-column-head:visible').count()===0;
  await expect(oracle.locator('.oracle-source>.filter-row-label:visible')).toHaveCount(stacked?3:0);
  await expect(oracle.locator('.guided-entry .filter-row-label:visible')).toHaveCount(stacked?3:0);
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


test('scoped clearing and activated abilities preserve the editable query and focus', async ({ page, isMobile }, testInfo) => {
  await page.getByRole('button', {name:'Search cards',exact:true}).click();
  const raw=page.locator('#raw');
  await raw.fill('t:elf t:creature -t:artifact keyword:flying mv>=2 mv<=5 c>=G id<=GU o:"draw" otag:ramp usd<5');
  const filtersPanel=page.locator('#search-filters');
  await filtersPanel.evaluate(panel=>{
    // Change the filter before either disclosure's queued toggle event runs.
    panel.querySelector(':scope > summary').click();
    panel.querySelector('#filter-heading-activation').click();
    const activation=panel.querySelector('select[name="activation-kind"]');
    activation.value='tap';
    activation.dispatchEvent(new Event('input',{bubbles:true}));
    activation.dispatchEvent(new Event('change',{bubbles:true}));
  });
  await expect(filtersPanel).toHaveJSProperty('open',true);
  await expect(page.getByLabel('Activation cost includes')).toBeVisible();
  await expect(page.locator('#result-count')).toHaveText('3 cards found');
  await expect(raw).toHaveValue(/t:elf t:creature.*otag:ramp usd<5/);
  await page.getByLabel('Activation cost includes').selectOption('both');
  const payment=page.getByLabel('Mana symbols in cost (optional)');
  await payment.fill('3U');
  await payment.press('Tab');
  await expect(page.locator('#result-count')).toHaveText('3 cards found');
  await expect(payment).toHaveValue('3U');
  const submitted=await raw.inputValue();
  expect(submitted).toContain('\\{T\\}');
  expect(submitted).toContain('\\{3\\}\\{U\\}');
  await payment.fill('3/U');
  await expect(page.locator('#guided-error')).toContainText('Enter mana as 3U or GG');
  await expect(raw).toHaveValue(submitted);
  await payment.fill('3U');
  await expect(page.locator('#guided-error')).toBeEmpty();
  await page.locator('#filter-heading-mv').click();
  await page.getByRole('button',{name:'Clear mana value',exact:true}).press('Enter');
  await expect(page.locator('#filter-heading-mv')).toBeFocused();
  await expect(raw).not.toHaveValue(/mv[<>=]/);
  await expect(raw).toHaveValue(/otag:ramp/);
  await page.locator('#filter-heading-colors').click();
  await page.getByRole('button',{name:'Clear colors',exact:true}).click();
  await expect(raw).not.toHaveValue(/c>=G|id<=GU/);
  await page.locator('#filter-heading-activation').scrollIntoViewIfNeeded();
  const ability=page.locator('[data-guided-family="activation"]');
  await ability.screenshot({path:testInfo.outputPath('activated-ability-filters.png')});
  if(!isMobile){
    await page.evaluate(()=>document.documentElement.style.zoom=2);
    await noPageOverflow(page);
    await payment.focus();
    await expect(payment).toBeFocused();
    await ability.screenshot({path:testInfo.outputPath('activated-ability-enlarged.png')});
    await page.evaluate(()=>document.documentElement.style.zoom=1);
  }
  const clearGuided=page.getByRole('button',{name:'Clear all guided filters',exact:true});
  if(isMobile)await clearGuided.tap();else await clearGuided.click();
  await expect(page.getByRole('button',{name:'Clear all guided filters',exact:true})).toBeFocused();
  await expect(raw).toHaveValue('otag:ramp usd<5');
  await page.locator('#function-tags > summary').click();
  const lookup=page.getByRole('searchbox',{name:'Find a function'});
  await lookup.fill('removal');
  await page.getByRole('button',{name:'Clear function filters',exact:true}).press('Enter');
  await expect(lookup).toBeFocused();
  await expect(lookup).toHaveValue('removal');
  await expect(raw).toHaveValue('usd<5');
  await raw.fill('(t:elf OR otag:ramp) mv=2 o:/add/ usd<5');
  await page.getByRole('button',{name:'Clear all guided filters',exact:true}).click();
  await expect(raw).toHaveValue('(t:elf OR otag:ramp) o:/add/ usd<5');
  await page.getByRole('button',{name:'Clear search and filters',exact:true}).click();
  await expect(raw).toHaveValue('');
  await expect(page.locator('#search-output')).toBeEmpty();
  await noPageOverflow(page);
});
