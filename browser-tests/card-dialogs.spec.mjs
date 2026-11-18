import { test, expect } from '@playwright/test';
import { cards, prepareApp } from './fixtures.mjs';

test.beforeEach(async ({ page }) => prepareApp(page));

test('Related examples open their own printing and return to the same history, scroll and focus', async ({ page, isMobile }, testInfo) => {
  const double = { ...cards[10], name: 'First Face // Second Face', image_uris: undefined,
    card_faces: ['First Face', 'Second Face'].map(name => ({ name, image_uris: cards[10].image_uris })) };
  const missing = { ...cards[11], name: 'Example without artwork', image_uris: undefined };
  const examples = [double, ...cards.slice(0, 6), missing];
  const searches = [];
  await page.route('**/api/search?**', async route => {
    searches.push(new URL(route.request().url()).searchParams.get('q'));
    await route.fulfill({ json: { data: examples, total_cards: examples.length, has_more: false } });
  });
  await page.route('**/api/printings?**', async route => {
    const oracle = new URL(route.request().url()).searchParams.get('oracle');
    await route.fulfill({ json: { data: examples.filter(card => card.oracle_id === oracle), has_more: false } });
  });
  await page.getByRole('button', { name: 'Explore cards', exact: true }).click();
  const query = 't:elf otag:ramp';
  await page.locator('#raw').fill(query);
  await page.locator('#function-tags > summary').click();
  await page.getByRole('searchbox', { name: 'Find a function' }).fill('sweeper');
  const trigger = page.getByRole('button', { name: 'Browse sweeper relationships', exact: true });
  await trigger.click();
  const related = page.getByRole('dialog', { name: 'Related functions' });
  await expect.poll(() => searches.includes('game:paper otag:sweeper')).toBe(true);
  await related.getByRole('button', { name: 'Removal', exact: true }).click();
  const first = related.getByRole('button', { name: 'First Face // Second Face', exact: true });
  const last = related.getByRole('button', { name: 'Example without artwork', exact: true });
  await expect(first).toBeVisible();
  expect((await first.locator('img').boundingBox()).width).toBeGreaterThan(isMobile ? 115 : 125);
  await first.scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath('related-cards.png') });
  await first.press('Enter');
  let details = page.getByRole('dialog', { name: 'First Face // Second Face — Card details' });
  await expect(details.locator('#detail-images img')).toHaveCount(2);
  await expect(details.locator('#view-printing')).toHaveValue(double.id);
  await page.keyboard.press('Escape');
  await expect(related.locator('#browsed-function')).toHaveText('Removal');
  await expect(first).toBeFocused();

  await last.scrollIntoViewIfNeeded();
  const position = await related.evaluate(dialog => dialog.scrollTop);
  if (isMobile) await last.tap(); else await last.click();
  details = page.getByRole('dialog', { name: 'Example without artwork — Card details' });
  await expect(details.locator('#view-printing')).toHaveValue(missing.id);
  await expect(details.getByText('Artwork unavailable for this printing.')).toBeVisible();
  await details.getByRole('button', { name: 'Back to Related functions', exact: true }).click();
  await expect(last).toBeFocused();
  expect(await related.evaluate(dialog => dialog.scrollTop)).toBe(position);
  await expect(related.getByRole('button', { name: 'Back', exact: true })).toBeEnabled();
  await related.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await expect(trigger).toBeFocused();
  await expect(page.locator('#raw')).toHaveValue(query);
  expect(searches).toEqual(['game:paper otag:sweeper', 'game:paper otag:removal']);
});

test('shared and dedicated modal windows keep the background at its starting scroll position', async ({ page, isMobile }, testInfo) => {
  await page.getByRole('button', { name: 'Smoke Garden', exact: true }).click();
  const snapshot = () => page.evaluate(() => ({
    top: scrollY, width: document.querySelector('main').getBoundingClientRect().width,
  }));
  const wheel = async (x, y, delta) => {
    await page.mouse.move(x, y);
    await page.mouse.wheel(0, delta);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  };
  const center = Math.floor(page.viewportSize().height / 2);
  const confirm = page.getByRole('button', { name: 'Remove one Smoke Card 1 from Command zone', exact: true });
  await confirm.scrollIntoViewIfNeeded();
  await confirm.focus();
  const startConfirm = await snapshot();
  await confirm.press('Enter');
  const dedicated = page.locator('#commander-removal');
  await expect(dedicated).toBeVisible();
  await wheel(4, center, 440);
  if (isMobile) {
    const touch = await page.context().newCDPSession(page);
    await touch.send('Input.synthesizeScrollGesture', { x: 4, y: center, yDistance: -320, gestureSourceType: 'touch' });
    await touch.detach();
  }
  expect(await snapshot()).toEqual(startConfirm);
  await dedicated.getByRole('button', { name: 'Keep commander' }).click();
  await expect(confirm).toBeFocused();
  expect(await snapshot()).toEqual(startConfirm);

  await page.locator('.deck-menu > summary').click();
  await page.getByRole('button', { name: 'Import cards', exact: true }).click();
  const shared = page.locator('#dialog');
  await expect(shared.getByRole('heading', { name: 'Import cards' })).toBeVisible();
  const startImport = await snapshot();
  await wheel(4, center, 480);
  expect(await snapshot()).toEqual(startImport);
  await page.keyboard.press('Escape');
  await expect(shared).toBeHidden();
  expect(await snapshot()).toEqual(startImport);

  const card = page.locator('.deck-entry button[data-inspect]').last();
  await card.scrollIntoViewIfNeeded();
  await card.focus();
  const startCard = await snapshot();
  expect(startCard.top).toBeGreaterThan(0);
  await card.press('Enter');
  await expect(shared.getByRole('heading', { name: /^Smoke Card \d+$/ })).toBeVisible();
  await wheel(4, center, -550);
  expect(await snapshot()).toEqual(startCard);
  await shared.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await expect(card).toBeFocused();
  expect(await snapshot()).toEqual(startCard);

  await page.setViewportSize({ width: page.viewportSize().width, height: 600 });
  await page.locator('.deck-menu > summary').click();
  await page.getByRole('button', { name: 'Export deck', exact: true }).click();
  await expect(shared.getByRole('heading', { name: 'Export Smoke Garden', exact: true })).toBeVisible();
  await shared.locator('.planning-help > summary').press('Enter');
  const preview = shared.getByRole('textbox', { name: 'Text decklist' });
  await preview.press('ControlOrMeta+A');
  expect(await preview.evaluate(el => el.value.slice(el.selectionStart, el.selectionEnd))).toContain('Smoke Card 1');
  await shared.evaluate(dialog => { dialog.scrollTop = 0; });
  const startExport = await snapshot();
  const box = await shared.boundingBox();
  await wheel(box.x + 18, box.y + box.height / 2, 520);
  await expect.poll(() => shared.evaluate(dialog => dialog.scrollTop)).toBeGreaterThan(0);
  await wheel(box.x + 18, box.y + box.height / 2, 1900);
  expect(await snapshot()).toEqual(startExport);
  await page.screenshot({ path: testInfo.outputPath('internally-scrolled-export.png') });
  await page.keyboard.press('Escape');
  await expect(shared).toBeHidden();
  expect(await snapshot()).toEqual(startExport);
  await wheel(4, center, 500);
  await expect.poll(async () => (await snapshot()).top).toBeGreaterThan(startExport.top);
});

test('a pointer drag starting on blank space or artwork does not select the page', async ({ page, isMobile }) => {
  test.skip(isMobile, 'Mouse selection; touch activation is exercised in other card checks.');
  await page.getByRole('button', { name: 'Smoke Garden', exact: true }).click();
  const heading = page.locator('#deck-title');
  const { left, right, y } = await heading.evaluate(node => {
    const range = document.createRange();
    range.selectNodeContents(node);
    const rect = range.getBoundingClientRect();
    return { left: rect.left, right: rect.right, y: rect.y + rect.height / 2 };
  });
  const drag = async (x, y, toX, toY) => {
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(toX, toY, { steps: 12 });
    await page.mouse.up();
  };
  const selection = () => page.evaluate(() => getSelection().toString());
  await drag(left - 10, y, right + 1, y);
  expect(await selection()).toBe('');
  await drag(left + 1, y, right - 1, y);
  expect(await selection()).toBe('Smoke Garden');

  const field = page.getByRole('searchbox', { name: 'Filter cards', exact: true });
  await field.fill('Smoke Card');
  await field.press('ControlOrMeta+A');
  expect(await field.evaluate(el => el.value.slice(el.selectionStart, el.selectionEnd))).toBe('Smoke Card');
  await field.fill('');
  await page.getByRole('button', { name: 'Explore cards', exact: true }).click();
  await page.locator('#raw').fill('Smoke');
  await page.locator('#raw').press('Enter');
  const art = page.locator('.card-tile img').first();
  await art.scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    window.nativeImageDrags = 0;
    addEventListener('dragstart', event => { if (!event.defaultPrevented) window.nativeImageDrags++; });
  });
  const box = await art.boundingBox();
  await drag(box.x + 32, box.y + 35, box.x + 45, box.y + 120);
  expect(await page.evaluate(() => window.nativeImageDrags)).toBe(0);
  expect(await selection()).toBe('');
});
