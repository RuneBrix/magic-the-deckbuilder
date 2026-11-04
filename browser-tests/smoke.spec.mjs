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
