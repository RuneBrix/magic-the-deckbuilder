import { test, expect } from '@playwright/test';
import { cards, prepareApp } from './fixtures.mjs';
import { findTags } from '../public/core.js';

test.beforeEach(async ({ page }) => {
  await prepareApp(page);
  await page.getByRole('button', { name: 'Search cards', exact: true }).click();
});

test('empty Explore tools show only the available actions and no function selections', async ({ page }, testInfo) => {
  const raw = page.locator('#raw');
  const tools = page.locator('#search-tools-heading');
  await expect(page.locator('#applied-filter-summary')).toBeHidden();
  await tools.press('Enter');
  await expect(page.getByLabel('Add filter', { exact: true })).toBeVisible();
  await expect(page.locator('.guided-family')).toHaveCount(0);
  await expect(page.locator('.selected-functions')).toHaveCount(0);
  await expect(page.locator('#tag-match-count')).toBeHidden();
  await expect(page.locator('#function-tags')).not.toContainText(/starting points|Directly tagged cards/);

  await raw.fill('usd<5 (otag:ramp OR otag:draw)');
  const selections = page.locator('.selected-functions');
  await expect(selections).toBeVisible();
  await expect(selections.getByLabel('Combine functions by')).toHaveValue('any');
  expect(await page.locator('.tag-search-label').evaluate(el => parseFloat(getComputedStyle(el).fontSize)))
    .toBeGreaterThan(await selections.locator('h3').evaluate(el => parseFloat(getComputedStyle(el).fontSize)));
  await selections.getByRole('button', { name: 'Remove ramp filter', exact: true }).press('Enter');
  await expect(raw).toHaveValue('usd<5 otag:draw');
  await selections.getByRole('button', { name: 'Remove draw filter', exact: true }).press('Enter');
  await expect(selections).toHaveCount(0);
  await expect(page.getByLabel('Find a function')).toBeFocused();
  await expect(raw).toHaveValue('usd<5');
  await page.locator('#function-tags').screenshot({ path: testInfo.outputPath('function-empty.png') });
  await tools.press('Enter');
  await tools.press('Enter');
  await expect(page.locator('.selected-functions')).toHaveCount(0);
  await page.getByText('About function data', { exact: true }).press('Enter');
  await expect(page.locator('.function-data-help')).toContainText(/Scryfall|snapshot/);
  await page.screenshot({ path: testInfo.outputPath('function-empty-and-help.png') });
});

test('one disclosure exposes both applied summaries when collapsed', async ({ page }, testInfo) => {
  const raw = page.locator('#raw');
  const tools = page.locator('#search-tools-heading');
  const filterSummary = page.locator('#applied-filter-summary');
  const functionSummary = page.locator('#applied-function-summary');
  await expect(tools).toHaveAccessibleDescription('');
  await raw.fill('otag:ramp');
  await expect(filterSummary).toBeHidden();
  await expect(tools).toHaveAccessibleDescription('Functions · Ramp');
  await raw.fill('t:elf (o:draw OR o:discard mv<=3) usd<5 otag:ramp otag:draw otag:very-long-unlisted-function-name');
  await expect(tools).toHaveAccessibleName('Filters and functions');
  await expect(tools).toHaveAccessibleDescription(/Filters · Types · 2 query-only expressions Functions · ramp.*draw.*very long unlisted function name/i);
  await expect(filterSummary).toBeVisible();
  await expect(functionSummary).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('collapsed-search-summaries.png') });
  await tools.press('Enter');
  await expect(tools).toHaveAccessibleDescription('');
  await expect(filterSummary).toBeHidden();
  await expect(functionSummary).toBeHidden();
  await expect(page.locator('#add-guided-filter option[value="oracle"]')).toHaveJSProperty('disabled', true);
  await expect(page.locator('#query-notes')).toContainText('Query-only expressions');
  await expect(page.locator('#selected-functions').getByRole('button', { name: 'Remove ramp filter' })).toBeVisible();
  await tools.press('Space');
  await expect(filterSummary).toBeVisible();
  await expect(functionSummary).toBeVisible();
  await page.getByRole('button', { name: 'Clear search and filters' }).click();
  await expect(filterSummary).toBeHidden();
  await expect(functionSummary).toBeHidden();
});

test('Add filter opens each supported type without adding an empty constraint', async ({ page, isMobile }, testInfo) => {
  const queries = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname === '/api/search') queries.push(url.searchParams.get('q'));
  });
  const raw = page.locator('#raw');
  const toggle = page.locator('#search-tools-heading');
  const add = page.getByLabel('Add filter', { exact: true });
  const panels = page.locator('.search-panel-columns > section');
  const boxes = () => panels.evaluateAll(nodes => nodes.map(node => node.getBoundingClientRect().toJSON()));
  await toggle.press('Enter');
  await toggle.press('Tab');
  await expect(add).toBeFocused();
  for (const [family, firstField] of [
    ['name', 'name'], ['type', 'types'], ['keyword', 'keywords'], ['mv', 'mv-op-0'], ['colors', 'color-target'],
    ['oracle', 'oracle-mode-0'], ['activation', 'activation-kind'], ['cost', 'cost-symbol-0'], ['legal', 'legal'],
  ]) {
    await add.selectOption(family);
    await expect(page.locator(`[data-guided-family="${family}"] [name="${firstField}"]`)).toBeFocused();
    await expect(add.locator(`option[value="${family}"]`)).toHaveJSProperty('disabled', true);
  }
  await expect(raw).toHaveValue('');
  expect(queries).toEqual([]);
  const [filters, functions] = await boxes();
  if (isMobile) {
    expect(functions.y).toBeGreaterThanOrEqual(filters.bottom - 1);
  } else {
    expect(functions.y).toBeCloseTo(filters.y, 0);
    expect(functions.height).toBeCloseTo(filters.height, 0);
    expect(functions.x).toBeGreaterThanOrEqual(filters.right - 1);
    const columns = await page.locator('.guided-grid').evaluate(grid => getComputedStyle(grid).gridTemplateColumns.split(' ').filter(width => width !== '0px').length);
    expect(columns).toBe(2);
    await page.setViewportSize({ width: 820, height: 900 });
    const [stackedFilters, stackedFunctions] = await boxes();
    expect(stackedFunctions.y).toBeGreaterThanOrEqual(stackedFilters.bottom - 1);
    await page.setViewportSize({ width: 1280, height: 900 });
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('on-demand-filters.png'), fullPage: true });

  await raw.fill('otag:ramp    usd<5');
  await page.getByRole('button', { name: 'Remove card name filter', exact: true }).press('Enter');
  await expect(add).toBeFocused();
  await expect(add.locator('option[value="name"]')).toHaveJSProperty('disabled', false);
  await expect(raw).toHaveValue('otag:ramp    usd<5');
  expect(queries).toEqual([]);
  await raw.fill('(t:elf OR keyword:flying) f:modern otag:ramp usd<5');
  await expect(page.getByLabel('Legal in format')).toHaveValue('modern');
  await expect(page.locator('[name="types"]')).toBeDisabled();
  await page.getByRole('button', { name: 'Clear all guided filters', exact: true }).click();
  await expect(add).toBeFocused();
  await expect(raw).toHaveValue('(t:elf OR keyword:flying) otag:ramp usd<5');
  await expect(page.locator('.guided-family')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Remove ramp filter', exact: true })).toBeVisible();
  await raw.fill('(name:unfinished');
  await expect(add).toBeDisabled();
  await expect(page.locator('#query-error')).toContainText('Guided edits are paused');
});

test('Find a function excludes selections and recovers from an empty last page', async ({ page, isMobile }) => {
  const matches = findTags('ramp');
  const selected = matches.slice(0, matches.length - 13);
  const last = matches.at(-1).id;
  const raw = page.locator('#raw');
  await raw.fill(['t:artifact', ...selected.map(tag => `otag:${tag.id}`)].join(' '));
  await page.locator('#search-tools-heading').press('Enter');
  const lookup = page.getByLabel('Find a function', { exact: true });
  const pager = page.locator('#tag-page');
  await lookup.fill('ramp');
  await expect(page.locator('#tag-match-count')).toHaveText('13 matching tags');
  await pager.selectOption('2');
  const candidate = page.getByRole('button', { name: `Add ${last} filter`, exact: true });
  await expect(candidate).toHaveText('Add');
  const card = candidate.locator('xpath=../..');
  await expect(card.getByRole('button', { name: `Browse ${last} relationships`, exact: true })).toHaveText('Related');
  if (isMobile) await candidate.tap(); else await candidate.press('Enter');
  await expect(lookup).toBeFocused();
  await expect(pager).toHaveCount(0);
  await expect(page.locator('.tag-options li')).toHaveCount(12);
  await expect(candidate).toHaveCount(0);
  const chip = page.getByRole('button', { name: `Remove ${last} filter`, exact: true });
  await chip.press('Enter');
  await expect(lookup).toBeFocused();
  await pager.selectOption('2');
  await expect(candidate).toBeVisible();
  await raw.fill(`otag:${findTags('connive')[0].id}`);
  await lookup.fill('connive');
  await expect(page.getByText('All matching functions are selected.')).toBeVisible();
  await expect(page.getByRole('button', { name: /unlisted function/ })).toHaveCount(0);
});

test('Explore ignores empty search submits and retains results until clear', async ({ page }) => {
  const queries = [];
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname === '/api/search') queries.push(url.searchParams.get('q'));
  });
  const raw = page.locator('#raw');
  const search = page.locator('#search-submit');
  await expect(page.getByRole('button', { name: 'Search with these filters' })).toHaveCount(0);
  await search.click();
  await raw.fill('   ');
  await raw.press('Enter');
  await expect(page.locator('#results-area')).toHaveCount(0);
  await raw.fill('(t:elf');
  await raw.press('Enter');
  await expect(page.locator('#query-error')).toContainText('Guided edits are paused');
  await raw.fill('otag:ramp');
  await raw.press('Enter');
  await expect(page.locator('.card-tile')).toHaveCount(3);
  await raw.fill('');
  await search.click();
  await expect(page.locator('.card-tile')).toHaveCount(3);
  await expect(page.locator('.query-stale')).toContainText('previous query');
  await page.getByRole('button', { name: 'Clear search and filters' }).click();
  await search.click();
  await expect(page.locator('#results-area')).toHaveCount(0);
  expect(queries).toEqual(['otag:ramp']);
});

test('Explore pins the query within setup and leaves results and focused controls reachable', async ({ page }, testInfo) => {
  let finishFirstPage;
  const firstPage = new Promise(resolve => { finishFirstPage = resolve; });
  await page.route('**/api/search?*', async route => {
    const url = new URL(route.request().url());
    if (url.searchParams.get('q') === 'no-matches') {
      await route.fulfill({ status: 404, json: { error: 'No cards' } });
      return;
    }
    const next = Number(url.searchParams.get('page')) > 1;
    if (!next) await firstPage;
    await route.fulfill({ json: { data: next ? cards.slice(24) : cards.slice(0, 24), total_cards: 40, has_more: !next } });
  });
  const raw = page.locator('#raw');
  const queryForm = page.locator('#search-form');
  const tools = page.locator('#search-tools-heading');
  const results = page.locator('#search-output');
  const geometry = () => page.evaluate(() => ({
    form: document.querySelector('#search-form').getBoundingClientRect().toJSON(),
    nav: document.querySelector('.workspace-nav').getBoundingClientRect().bottom,
    results: document.querySelector('#search-output').getBoundingClientRect().top,
  }));
  const assertPinned = async () => {
    await expect.poll(async () => {
      const { form, nav } = await geometry();
      return Math.abs(form.top - nav);
    }).toBeLessThan(2);
  };
  await raw.fill('t:elf otag:ramp otag:draw usd<5');
  await tools.press('Enter');
  await page.evaluate(() => window.scrollTo(0, 0));
  const original = (await geometry()).form.top;
  await page.evaluate(() => {
    window.scrollTo(0, document.querySelector('#search-form').getBoundingClientRect().top + scrollY + 150);
  });
  await assertPinned();
  await raw.fill('(t:elf');
  await expect(queryForm.locator('#query-error')).toContainText('Guided edits are paused');
  await expect(queryForm.locator('#query-error')).toBeInViewport();
  await assertPinned();
  await raw.fill('t:elf otag:ramp otag:draw usd<5');
  await expect(queryForm.locator('#query-error')).toBeEmpty();
  await raw.press('Enter');
  await expect(results.locator('[data-state="loading"]')).toBeVisible();
  await assertPinned();
  finishFirstPage();
  await expect(results.locator('.card-tile')).toHaveCount(24);
  await assertPinned();
  await page.screenshot({ path: testInfo.outputPath('sticky-search-setup.png') });
  await results.locator('.card-tile').last().scrollIntoViewIfNeeded();
  await expect.poll(async () => (await geometry()).form.bottom).toBeLessThan((await geometry()).nav);
  await results.getByRole('button', { name: /more/i }).click();
  await expect(results.locator('.card-tile')).toHaveCount(40);
  const boundary = await geometry();
  expect(boundary.form.bottom).toBeLessThanOrEqual(boundary.results + 1);

  await page.evaluate(() => {
    const setup = document.querySelector('.search-setup');
    window.scrollTo(0, setup.getBoundingClientRect().top + scrollY + 150);
  });
  await assertPinned();
  await queryForm.locator('.reset-query').focus();
  await page.keyboard.press('Tab');
  const notes = page.locator('#query-notes summary');
  await expect(notes).toBeFocused();
  await expect.poll(async () => {
    const { form, nav } = await geometry();
    return (await notes.boundingBox()).y - Math.max(form.bottom, nav);
  }).toBeGreaterThanOrEqual(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(async () => Math.abs((await geometry()).form.top - original)).toBeLessThan(2);
  await raw.fill('no-matches');
  await raw.press('Enter');
  await expect(results.locator('[data-state="no-match"]')).toBeVisible();
});

test('populated guided filters leave room for focus rings and reachable repeated values', async ({ page }, testInfo) => {
  const query = '(t:creature OR t:elf OR t:druid OR t:legendary) -t:artifact (keyword:flying OR keyword:trample) (mv>=1 mv<=8) (o:"draw a card" fo:"add mana") (m>={U} m>={G}) otag:ramp usd<5';
  const raw = page.locator('#raw');
  await raw.fill(query);
  await page.locator('#search-tools-heading').press('Enter');
  await page.getByLabel('Add filter', { exact: true }).selectOption('colors');
  for (const family of ['mv', 'oracle', 'cost']) {
    const panel = page.locator(`[data-guided-family="${family}"]`);
    for (let i = 0; i < 5; i++) await panel.locator(`[data-add-filter="${family}"]`).click();
    const rows = panel.locator('.repeatable-filter-row');
    const positions = await rows.evaluateAll(nodes => nodes.map(el => {
      const rect = el.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom };
    }));
    const inputs = panel.locator(`input[name^="${family}-"]`);
    for (const index of [0, 3, 6]) {
      const input = inputs.nth(index);
      await input.focus();
      await page.keyboard.press('Tab');
      await page.keyboard.press('Shift+Tab');
      await expect(input).toBeFocused();
      const clipped = await input.evaluate(el => {
        const rect = el.getBoundingClientRect(), style = getComputedStyle(el);
        const ring = parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset);
        const list = el.closest('.filter-rows'), box = list.getBoundingClientRect();
        return rect.left - ring < box.left - .5 || rect.right + ring > box.right + .5
          || rect.top - ring < box.top - .5 || rect.bottom + ring > box.bottom + .5;
      });
      expect(clipped, `${family} row ${index + 1} clips its focus outline`).toBe(false);
      await expect(input).toHaveCSS('outline-style', 'solid');
    }
    expect(positions[1].top - positions[0].bottom).toBeGreaterThanOrEqual(12);
    await inputs.last().fill(family === 'oracle' ? 'whenever ~ attacks' : '2');
    await expect(inputs.last()).toHaveValue(family === 'oracle' ? 'whenever ~ attacks' : '2');
    await panel.locator('[data-remove-filter]').last().press('Enter');
    await expect(rows).toHaveCount(6);
  }
  await expect(raw).toHaveValue(query);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#filter-heading-cost').scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('populated-filter-focus.png'), fullPage: true });
});

test('guided filters reflow at intermediate widths and enlarged text without changing the query', async ({ page, isMobile }, testInfo) => {
  test.skip(isMobile, 'Desktop reflow and zoom; phone interaction is covered separately.');
  const query = 't:"an extremely long custom type name for testing selected chips" (mv>=2 mv<=6) o:"whenever ~ attacks, draw a card" m>={U} otag:ramp';
  const raw = page.locator('#raw');
  await raw.fill(query);
  await page.locator('#search-tools-heading').press('Enter');
  const evidence = [];
  for (const width of [1920, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    const zoom = width === 1280 ? 2 : 1;
    await page.evaluate(zoom => document.documentElement.style.zoom = zoom, zoom);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator('.filter-rows').evaluateAll(nodes => nodes.every(el => el.scrollWidth <= el.clientWidth))).toBe(true);
    await expect(raw).toHaveValue(query);
    const phrase = page.locator('[name="oracle-0"]');
    await phrase.focus();
    await expect(phrase).toBeFocused();
    const entry = page.locator('[data-guided-family="oracle"]');
    evidence.push({ width, zoom, columns: await page.locator('.guided-grid').evaluate(el => getComputedStyle(el).gridTemplateColumns) });
    await entry.screenshot({ path: testInfo.outputPath(`oracle-${width}-${zoom}x.png`) });
  }
  await testInfo.attach('reflow-evidence', { body: JSON.stringify(evidence), contentType: 'application/json' });
  await raw.fill('(t:creature');
  await expect(page.locator('#query-error')).toContainText('Guided edits are paused');
  await expect(raw).toHaveValue('(t:creature');
});
