import { test, expect } from '@playwright/test';
import { prepareApp, cards } from './fixtures.mjs';

test.beforeEach(async ({ page }) => prepareApp(page));

async function openDeck(page) {
  await page.getByRole('button', { name: 'Smoke Garden', exact: true }).click();
  await page.getByRole('tab', { name: 'Checks', exact: true }).click();
  await expect(page.locator('.freshness')).toContainText('Legality refreshed this session');
  await page.getByRole('tab', { name: 'Cards', exact: true }).click();
}

async function hitTarget(control, width, height) {
  await control.scrollIntoViewIfNeeded();
  const box = await control.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(width);
  expect(box.height).toBeGreaterThanOrEqual(height);
  expect(await control.evaluate(element => {
    const r = element.getBoundingClientRect();
    return [[2, 2], [r.width - 2, 2], [2, r.height - 2], [r.width - 2, r.height - 2], [r.width / 2, r.height / 2]]
      .every(([x, y]) => element.contains(document.elementFromPoint(r.left + x, r.top + y)));
  })).toBe(true);
  return box;
}

async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test('deck tabs provide one Tab stop, named panels and automatic arrow activation', async ({ page, isMobile }, testInfo) => {
  await openDeck(page);
  const labels = ['Cards', 'Statistics', 'Ownership & budget', 'Checks'];
  const tab = name => page.getByRole('tab', { name, exact: true });
  const snapshots = [];
  const check = async name => {
    await expect(tab(name)).toBeFocused();
    await expect(tab(name)).toHaveAttribute('aria-selected', 'true');
    await expect(tab(name)).toHaveAttribute('tabindex', '0');
    expect(await page.getByRole('tab').evaluateAll(tabs => tabs.filter(t => t.tabIndex === 0).length)).toBe(1);
    for (const other of labels.filter(label => label !== name)) {
      await expect(tab(other)).toHaveAttribute('aria-selected', 'false');
      await expect(tab(other)).toHaveAttribute('tabindex', '-1');
    }
    const panel = page.getByRole('tabpanel', { name, exact: true });
    await expect(panel).toBeVisible();
    expect(await tab(name).getAttribute('aria-controls')).toBe(await panel.getAttribute('id'));
    expect(await panel.getAttribute('aria-labelledby')).toBe(await tab(name).getAttribute('id'));
    expect(await page.locator('[role="tab"]').evaluateAll(tabs => tabs.every(t => Boolean(document.getElementById(t.getAttribute('aria-controls')))))).toBe(true);
  };
  await tab('Cards').focus();
  for (const key of ['ArrowRight', 'ArrowLeft']) {
    for (let step = 1; step <= 4; step++) {
      await page.keyboard.press(key);
      const index = (key === 'ArrowRight' ? step : 4 - step) % 4;
      await check(labels[index]);
    }
  }
  await page.keyboard.press('End');await check('Checks');
  await page.keyboard.press('Home');await check('Cards');
  for (const name of labels) {
    if (isMobile) await tab(name).tap(); else await tab(name).click();
    await check(name);
    snapshots.push(await page.getByRole('tablist', { name: 'Deck sections' }).ariaSnapshot());
    await tab(name).press('Tab');
    const panel = page.getByRole('tabpanel', { name, exact: true });
    await expect(panel).toBeFocused();
    await expect(panel).toHaveCSS('outline-style', 'solid');
    await page.keyboard.press('Tab');
    expect(await panel.evaluate(element => element.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Shift+Tab');await expect(panel).toBeFocused();
    await page.keyboard.press('Shift+Tab');await check(name);
    await expect(tab(name)).toHaveCSS('outline-style', 'solid');
  }
  await tab('Checks').press('Home');
  await tab('Cards').press('Shift+Tab');
  expect(await page.locator('.deck-tabs').evaluate(element => !element.contains(document.activeElement))).toBe(true);
  await page.keyboard.press('Tab');await check('Cards');
  await testInfo.attach('tab-accessibility', { body: snapshots.join('\n---\n'), contentType: 'text/plain' });
  await page.screenshot({ path: testInfo.outputPath('deck-tab-focus.png') });
  await noOverflow(page);
});

test('text-deck touch targets stay distinct in both layouts and at the final row', async ({ page, isMobile }, testInfo) => {
  await openDeck(page);
  const initialViewport = page.viewportSize();
  const activate = control => isMobile ? control.tap() : control.click();
  const quantity = () => page.evaluate(() => JSON.parse(localStorage.getItem('arcana.workspace.v2')).decks[0].cards[1].qty);
  const initialQuantity = await quantity();
  for (const viewport of isMobile ? [initialViewport, { width: 820, height: 900 }] : [initialViewport, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    const touch = await page.evaluate(() => matchMedia('(max-width:600px),(hover:none),(pointer:coarse)').matches);
    for (const layout of ['text-horizontal', 'text-vertical']) {
      await page.getByRole('combobox', { name: 'View', exact: true }).selectOption(layout);
      const minus = page.getByRole('button', { name: 'Remove one Smoke Card 2 from Main deck', exact: true });
      const plus = page.getByRole('button', { name: 'Add one Smoke Card 2 to Main deck', exact: true });
      const menu = page.getByRole('button', { name: 'Card actions for Smoke Card 2 in Main deck', exact: true });
      const size = touch ? 44 : 28;
      const minusBox = await hitTarget(minus, size, size), plusBox = await hitTarget(plus, size, size);
      const menuBox = await hitTarget(menu, size, size);
      expect(plusBox.x - minusBox.x - minusBox.width).toBeGreaterThanOrEqual(4);
      expect(menuBox.x).toBeGreaterThanOrEqual(plusBox.x + plusBox.width);
      if (!touch) { expect(plusBox.width).toBe(28);expect(plusBox.height).toBe(28); }
      await activate(plus);expect(await quantity()).toBe(initialQuantity + 1);
      await activate(minus);expect(await quantity()).toBe(initialQuantity);
      await activate(menu);await expect(page.locator('#card-actions')).toBeVisible();
      await page.locator('#card-actions').getByRole('menuitem', { name: 'Open details', exact: true }).press('Escape');
      // A pointer-opened flyout consumes the first Escape before the root menu.
      if (await page.locator('#card-actions').isVisible()) await page.keyboard.press('Escape');
      await expect(page.locator('#card-actions')).toBeHidden();
      const last = page.locator('.text-card').last();
      await hitTarget(last.locator('.card-menu-trigger'), size, size);
      await hitTarget(last.locator('.card-quantity button').last(), size, size);
      await noOverflow(page);
      if (viewport.width === initialViewport.width) await page.screenshot({ path: testInfo.outputPath(layout + '-targets.png') });
    }
  }
});

test('Collection touch targets preserve compact desktop controls and staged edits', async ({ page, isMobile }, testInfo) => {
  await page.evaluate(cards => {
    const data = JSON.parse(localStorage.getItem('arcana.workspace.v2'));
    data.collection = cards.slice(1, 5).map(card => ({ card, qty: 3, finish: 'regular' }));
    localStorage.setItem('arcana.workspace.v2', JSON.stringify(data));
  }, cards);
  await page.reload();
  await page.getByRole('button', { name: 'Collection', exact: true }).click();
  const initialViewport = page.viewportSize();
  const activate = control => isMobile ? control.tap() : control.click();
  const holdings = () => page.evaluate(() => JSON.parse(localStorage.getItem('arcana.workspace.v2')).collection);
  const before = await holdings();
  for (const viewport of isMobile ? [initialViewport, { width: 820, height: 900 }] : [initialViewport, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    const touch = await page.evaluate(() => matchMedia('(max-width:600px),(hover:none),(pointer:coarse)').matches);
    const row = page.locator('.collection-row').filter({ has: page.getByRole('heading', { name: 'Smoke Card 2', exact: true }) });
    const plus = row.getByRole('button', { name: 'Increase quantity of Smoke Card 2', exact: true });
    const minus = row.getByRole('button', { name: 'Decrease quantity of Smoke Card 2', exact: true });
    const edit = row.getByRole('button', { name: 'Edit', exact: true });
    const remove = row.getByRole('button', { name: 'Remove', exact: true });
    const size = touch ? 44 : 32;
    const minusBox = await hitTarget(minus, size, size), plusBox = await hitTarget(plus, size, size);
    expect(plusBox.x).toBeGreaterThanOrEqual(minusBox.x + minusBox.width + 4);
    const editBox = await hitTarget(edit, size, size), removeBox = await hitTarget(remove, size, size);
    expect(removeBox.x).toBeGreaterThanOrEqual(editBox.x + editBox.width + 8);
    if (!touch) { expect(plusBox.width).toBe(32);expect(plusBox.height).toBe(32);expect(editBox.height).toBe(32); }
    await activate(plus);expect((await holdings())[0].qty).toBe(4);
    await activate(minus);expect((await holdings())[0].qty).toBe(3);
    await activate(edit);await expect(page.getByRole('heading', { name: 'Update collection', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await activate(remove);await expect(page.getByRole('heading', { name: 'Remove owned lot?', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    // Quantity edits may update timestamps; holdings and printings stay the same.
    const withoutDates = lots => lots.map(({ addedAt, updatedAt, ...lot }) => lot);
    expect(withoutDates(await holdings())).toEqual(withoutDates(before));
    const last = page.locator('.collection-row').last();
    await hitTarget(last.getByRole('button', { name: 'Remove', exact: true }), size, size);
    await hitTarget(last.locator('[data-owned-plus]'), size, size);
    if (viewport.width === initialViewport.width) await page.screenshot({ path: testInfo.outputPath('collection-targets.png') });
    await noOverflow(page);
    await page.getByRole('combobox', { name: 'View', exact: true }).selectOption('text');
    await hitTarget(page.locator('.collection-actions').last().getByRole('button', { name: 'Edit', exact: true }), size, size);
    await noOverflow(page);
    await page.getByRole('combobox', { name: 'View', exact: true }).selectOption('visual');
  }
});
