import { test, expect } from '@playwright/test';
import { prepareApp } from './fixtures.mjs';

test.beforeEach(async ({ page }) => prepareApp(page));

test('collection entry and revisit render a bounded page at 300 and 1100 lots', async ({ page }, testInfo) => {
  const measurements = [];
  for (const size of [300, 1100]) {
    await page.evaluate(size => {
      const key = 'arcana.workspace.v2', data = JSON.parse(localStorage.getItem(key));
      const card = data.collection[0].card;
      data.collection = Array.from({ length: size }, (_, i) => ({
        card: { ...card, id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, name: `Collection ${String(i + 1).padStart(4, '0')}`, image_uris: { normal: `https://cards.scryfall.io/collection-${i}.jpg` } },
        qty: i % 3 + 1, finish: 'regular',
      }));
      localStorage.setItem(key, JSON.stringify(data));
      localStorage.setItem('arcana.collection-view.v1', JSON.stringify({ view: 'visual', group: 'none', sort: 'name', filter: '' }));
    }, size);
    await page.reload();
    for (const view of ['visual', 'text']) {
      if (view === 'text') await page.locator('#collection-view').selectOption('text');
      for (const visit of ['entry', 'revisit']) {
        await page.getByRole('button', { name: 'My decks', exact: true }).click();
        const result = await page.evaluate(async () => {
          const start = performance.now();
          document.querySelector('[data-view="collection"]').click();
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          return { ms: Math.round(performance.now() - start), rows: document.querySelectorAll('[data-owned-row]').length, images: document.querySelectorAll('#collection-results img').length };
        });
        measurements.push({ size, view, visit, ...result });
      }
    }
  }
  await testInfo.attach('collection-entry-measurements', { body: JSON.stringify(measurements, null, 2), contentType: 'application/json' });
  console.log(JSON.stringify({ project: testInfo.project.name, measurements }));
  for (const sample of measurements) {
    expect(sample.rows).toBe(48);
    expect(sample.images).toBe(sample.view === 'visual' ? 48 : 0);
  }
  await page.screenshot({ path: testInfo.outputPath('collection-paginated-text.png') });
});

test('collection pagination keeps global ordering, filtered totals and valid pages after edits and removal', async ({ page }, testInfo) => {
  await page.evaluate(() => {
    const key = 'arcana.workspace.v2', data = JSON.parse(localStorage.getItem(key)), card = data.collection[0].card;
    data.collection = Array.from({ length: 97 }, (_, i) => ({
      card: { ...card, id: `00000000-0000-4000-8000-${String(i + 1).padStart(12, '0')}`, name: `Lot ${String(i + 1).padStart(3, '0')}`, set_name: i % 2 ? 'Odd edition with a long name that wraps across the available width' : 'Even edition', collector_number: String(i + 1) },
      qty: 2, finish: 'regular',
    }));
    localStorage.setItem(key, JSON.stringify(data));
    localStorage.setItem('arcana.collection-view.v1', JSON.stringify({ view: 'visual', group: 'none', sort: 'name', filter: '' }));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Collection', exact: true }).click();
  const top = page.getByRole('navigation', { name: 'Collection pages (top)', exact: true });
  const bottom = page.getByRole('navigation', { name: 'Collection pages (bottom)', exact: true });
  const rows = page.locator('[data-owned-row]'), total = page.locator('.collection-total');
  const expectCentered = async () => {
    const grids = await page.locator('.collection-view-visual').evaluateAll(nodes => nodes.map(grid => {
      const { left, right } = grid.getBoundingClientRect();
      const cards = Array.from(grid.children, card => card.getBoundingClientRect());
      const firstRow = cards.filter(card => card.top === cards[0].top);
      return {
        marginDifference: Math.abs((firstRow[0].left - left) - (right - firstRow.at(-1).right)),
        aligned: cards.every((card, i) => card.left === firstRow[i % firstRow.length].left),
      };
    }));
    expect(grids.length).toBeGreaterThan(0);
    for (const grid of grids) {
      expect(grid.marginDifference).toBeLessThanOrEqual(1);
      expect(grid.aligned).toBe(true);
    }
  };
  await expect(total).toHaveText('194 copies total');
  await expect(rows).toHaveCount(48);
  const viewport = page.viewportSize();
  for (const width of [1080, 1120, 1280, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await expectCentered();
  }
  await page.setViewportSize(viewport);
  await expect(top.getByRole('button', { name: 'Previous' })).toBeDisabled();
  // A keyboard page change keeps the next action focused and above the sticky header.
  const next = top.getByRole('button', { name: 'Next', exact: true });
  await next.focus(); await next.press('Enter');
  await expect(next).toBeFocused(); await expect(top.getByRole('combobox')).toHaveValue('2');
  await expect(rows.first()).toHaveAttribute('data-owned-row', '48');
  expect(await next.evaluate(node => node.getBoundingClientRect().top >= document.querySelector('.workspace-nav').getBoundingClientRect().bottom)).toBe(true);
  await bottom.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(rows).toHaveCount(1); await expect(top.getByRole('combobox')).toHaveValue('3');
  await expectCentered();
  await expect(top.getByRole('combobox')).toBeFocused();
  await expect(next).toBeDisabled(); await expect(top).toContainText('Lots 97–97 of 97');
  const actions = rows.getByRole('button', { name: 'Card actions for owned Lot 097' });
  await actions.press('Enter');
  await expect(page.getByRole('menuitem', { name: 'Edit', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(actions).toBeFocused();
  // Edit the final lot using its real inventory index, then remove it and clamp the page.
  await rows.locator('[data-owned-plus]').click(); await expect(total).toHaveText('195 copies total');
  await page.locator('#collection-view').selectOption('text');
  await rows.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.locator('#owned-qty')).toHaveValue('3');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await rows.getByRole('button', { name: 'Remove', exact: true }).click();
  await page.getByRole('button', { name: 'Remove lot', exact: true }).click();
  await expect(top.getByRole('combobox')).toHaveValue('2'); await expect(rows).toHaveCount(48);
  await expect(total).toHaveText('192 copies total');
  await page.locator('#collection-sort').selectOption('name-desc');
  await expect(top.getByRole('combobox')).toHaveValue('1'); await expect(rows.first()).toHaveAttribute('data-owned-row', '95');
  await top.getByRole('combobox').selectOption('2');
  await page.locator('#collection-group').selectOption('set');
  await expect(top.getByRole('combobox')).toHaveValue('1');
  expect(await rows.evaluateAll(nodes => nodes.every(node => Number(node.dataset.ownedRow) % 2 === 1))).toBe(true);
  await page.locator('#collection-filter').fill('Lot 00');
  await expect(page.locator('#collection-filter')).toBeFocused();
  await expect(total).toHaveText('18 copies match · 192 copies total'); await expect(rows).toHaveCount(9);
  await expect(top.getByRole('combobox')).toHaveValue('1');
  await page.locator('#collection-view').selectOption('visual');
  await expect(page.locator('.collection-view-visual')).toHaveCount(2);
  await expectCentered();
  await page.locator('#collection-filter').fill('no matches');
  await expect(total).toHaveText('0 copies match · 192 copies total'); await expect(rows).toHaveCount(0);
  await expect(next).toBeDisabled(); await expect(top.getByRole('button', { name: 'Previous' })).toBeDisabled();
  await page.locator('#collection-filter').fill('');
  await page.locator('#collection-view').selectOption('visual');
  await expectCentered();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath('collection-paginated-visual.png') });
  await page.reload(); await page.getByRole('button', { name: 'Collection', exact: true }).click();
  await expect(top.getByRole('combobox')).toHaveValue('1'); await expect(total).toHaveText('192 copies total');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('arcana.workspace.v2')).collection.length)).toBe(96);
  // Added summaries and page controls reflow at intermediate/narrow widths and enlarged text.
  for (const width of [768, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.addStyleTag({ content: '.collection-pagination,.collection-pagination :is(button,label,select){font-size:24px}.collection-total{font-size:28px}' });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const controls = await top.locator('button, select').evaluateAll(nodes => nodes.map(node => {
      const box = node.getBoundingClientRect();
      return { left: box.left, right: box.right, height: box.height };
    }));
    for (const box of controls) { expect(box.left).toBeGreaterThanOrEqual(0); expect(box.right).toBeLessThanOrEqual(width); expect(box.height).toBeGreaterThanOrEqual(44); }
    await top.getByRole('combobox').focus();
    const before = await top.boundingBox(); await next.hover(); expect(await top.boundingBox()).toEqual(before);
    await page.screenshot({ path: testInfo.outputPath(`collection-enlarged-${width}.png`) });
  }
  await page.evaluate(() => {
    const key = 'arcana.workspace.v2', data = JSON.parse(localStorage.getItem(key));
    data.collection = []; localStorage.setItem(key, JSON.stringify(data));
  });
  await page.reload(); await page.getByRole('button', { name: 'Collection', exact: true }).click();
  await expect(total).toHaveText('0 copies total'); await expect(page.getByText('No owned cards yet. Add a card or upload a card list.')).toBeVisible();
  await expect(top.getByRole('button', { name: 'Previous' })).toBeDisabled(); await expect(next).toBeDisabled();
});
