import { test, expect } from '@playwright/test';
import { prepareApp } from './fixtures.mjs';

test.beforeEach(async ({ page }) => {
  await prepareApp(page);
  await page.getByRole('button', { name: 'Explore cards', exact: true }).click();
});

test('empty Explore panels balance their headings and show function selections only when present', async ({ page }, testInfo) => {
  const raw = page.locator('#raw');
  const filters = page.locator('#filters-heading');
  const functions = page.locator('#function-tags-heading');
  expect(Math.abs((await filters.boundingBox()).height - (await functions.boundingBox()).height)).toBeLessThan(2);
  await expect(page.locator('#applied-filter-summary')).toBeHidden();
  await functions.press('Enter');
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
  await functions.press('Enter');
  await functions.press('Enter');
  await expect(page.locator('.selected-functions')).toHaveCount(0);
  await page.getByText('About function data', { exact: true }).press('Enter');
  await expect(page.locator('.function-data-help')).toContainText(/Scryfall|snapshot/);
  await page.screenshot({ path: testInfo.outputPath('function-empty-and-help.png') });
});

test('populated guided filters leave room for focus rings and reachable repeated values', async ({ page }, testInfo) => {
  const query = '(t:creature OR t:elf OR t:druid OR t:legendary) -t:artifact (keyword:flying OR keyword:trample) (mv>=1 mv<=8) (o:"draw a card" fo:"add mana") (m>={U} m>={G}) otag:ramp usd<5';
  const raw = page.locator('#raw');
  await raw.fill(query);
  await page.locator('#filters-heading').press('Enter');
  for (const family of ['type', 'keyword', 'mv', 'colors', 'oracle', 'cost']) {
    await page.locator(`#filter-heading-${family}`).press('Enter');
  }
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
  await page.locator('#filters-heading').press('Enter');
  for (const family of ['type', 'mv', 'oracle', 'cost']) await page.locator(`#filter-heading-${family}`).press('Enter');
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
  await expect(page.locator('#query-notes .query-error')).toContainText('Guided edits are paused');
  await expect(raw).toHaveValue('(t:creature');
});
