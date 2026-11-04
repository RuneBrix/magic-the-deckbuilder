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
