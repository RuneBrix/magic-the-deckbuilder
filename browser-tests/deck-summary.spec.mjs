import { test, expect } from '@playwright/test';
import { prepareApp } from './fixtures.mjs';

test.beforeEach(async ({ page }) => prepareApp(page));

test('compact deck summary retains every zone through quantity edits, moves and reload', async ({ page }, testInfo) => {
  await page.evaluate(() => {
    const key = 'arcana.workspace.v2', data = JSON.parse(localStorage.getItem(key));
    data.decks[0].cards = data.decks[0].cards.slice(0, 4);
    data.decks[0].cards[1].qty = 49;
    data.decks[0].cards[2].zone = 'sideboard';
    data.decks[0].cards[3].zone = 'maybeboard';
    localStorage.setItem(key, JSON.stringify(data));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Smoke Garden', exact: true }).click();
  const summary = page.locator('.deck-editor-meta [aria-label="Deck zone counts"]');
  await expect(summary).toHaveText('50 in playing deck (1 command + 49 main) · 1 sideboard · 1 maybeboard');
  await expect(page.locator('.deck-rows .zone-counts')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('compact-zone-summary.png') });
  await page.locator('#editor-layout').selectOption('text-horizontal');
  await page.getByRole('button', { name: 'Add one Smoke Card 2 to Main deck', exact: true }).click();
  await expect(summary).toHaveText('51 in playing deck (1 command + 50 main) · 1 sideboard · 1 maybeboard');
  // A stationary pointer can overlap another flyout trigger when the menu opens.
  // Keep this keyboard move independent of pointer hover and platform geometry.
  await page.mouse.move(0, 0);
  await page.getByRole('button', { name: /Card actions for Smoke Card 2 in Main deck/ }).press('Enter');
  await page.getByRole('menuitem', { name: 'Move to…', exact: true }).press('ArrowRight');
  await page.getByRole('menuitem', { name: 'Maybeboard', exact: true }).press('Enter');
  await expect(summary).toHaveText('1 in playing deck (1 command + 0 main) · 1 sideboard · 51 maybeboard');
  await page.reload();
  await page.getByRole('button', { name: 'Smoke Garden', exact: true }).click();
  await expect(summary).toHaveText('1 in playing deck (1 command + 0 main) · 1 sideboard · 51 maybeboard');
  await page.evaluate(() => {
    const key = 'arcana.workspace.v2', data = JSON.parse(localStorage.getItem(key));
    data.decks[0].format = 'modern';
    localStorage.setItem(key, JSON.stringify(data));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Smoke Garden', exact: true }).click();
  await expect(summary).toHaveText('0 in playing deck · 0 main · 1 command · 1 sideboard · 51 maybeboard');
  await page.evaluate(() => {
    const key = 'arcana.workspace.v2', data = JSON.parse(localStorage.getItem(key));
    data.decks[0].cards = [];
    localStorage.setItem(key, JSON.stringify(data));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Smoke Garden', exact: true }).click();
  await expect(summary).toHaveText('0 in playing deck · 0 main · 0 command · 0 sideboard · 0 maybeboard');
});

test('stack headers align card starts with long functions and partial prices and keep horizontal costs inline', async ({ page, isMobile }, testInfo) => {
  await page.evaluate(() => {
    const key = 'arcana.workspace.v2', data = JSON.parse(localStorage.getItem(key));
    const entries = data.decks[0].cards.slice(1, 5);
    entries[0].tags = ['A very long personal function with many words'];
    entries[0].qty = 500;
    entries[0].card.prices.usd = '123456.78';
    entries[1].tags = entries[0].tags;
    entries[1].qty = 499;
    entries[1].card.prices.usd = null;
    entries[2].tags = ['Draw'];
    entries[3].tags = [];
    data.decks[0].cards = entries;
    data.decks[0].name = 'A deck with a long name that should wrap without hiding the summary';
    localStorage.setItem(key, JSON.stringify(data));
  });
  await page.reload();
  await page.getByRole('button', { name: 'A deck with a long name that should wrap without hiding the summary', exact: true }).click();
  await page.locator('#editor-group').selectOption('role');
  const groups = page.locator('.deck-zone[data-drop-zone="main"] .deck-group');
  const checkGeometry = async (vertical) => {
    const boxes = await groups.evaluateAll(nodes => nodes.map(node => {
      const header = node.querySelector('.deck-group-header'), cards = node.querySelector('.deck-group-items');
      const h = header.getBoundingClientRect(), c = cards.getBoundingClientRect();
      return { x: c.x, y: c.y, bottom: h.bottom, overflow: header.scrollWidth > header.clientWidth };
    }));
    for (const box of boxes) {
      expect(box.overflow).toBe(false);
      expect(box.y).toBeGreaterThanOrEqual(box.bottom);
    }
    if (vertical && !isMobile) {
      expect(new Set(boxes.map(box => Math.round(box.y))).size).toBe(1);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  };
  for (const view of ['visual-vertical', 'text-vertical', 'visual-horizontal', 'text-horizontal']) {
    await page.locator('#editor-layout').selectOption(view);
    await expect(groups.first().locator('.deck-group-price')).toHaveText('61,728,390.00 USD · 499 copies unpriced');
    await checkGeometry(view.endsWith('vertical'));
    if (view.endsWith('horizontal')) {
      const header = groups.nth(1).locator('.deck-group-header');
      const title = await header.locator('h4').boundingBox(), price = await header.locator('p').boundingBox();
      expect(Math.abs(title.y + title.height - price.y - price.height)).toBeLessThan(8);
    }
    if (view === 'visual-vertical') {
      await groups.first().scrollIntoViewIfNeeded();
      await page.screenshot({ path: testInfo.outputPath('aligned-stack-headers.png') });
    }
  }
  // Enlarge actual text rather than only changing the viewport.
  await page.addStyleTag({ content: '.deck-group h4{font-size:32px!important}.deck-group h4 span,.deck-group-price{font-size:24px!important}' });
  await page.locator('#editor-layout').selectOption('visual-vertical');
  await checkGeometry(true);
  await page.locator('#editor-search').fill('no matching card');
  await expect(page.locator('.deck-group-header')).toHaveCount(0);
  await expect(page.getByText('No cards match these filters.')).toBeVisible();
});
