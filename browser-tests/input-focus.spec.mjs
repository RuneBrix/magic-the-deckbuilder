import { test, expect } from '@playwright/test';
import { prepareApp, cards } from './fixtures.mjs';

test.beforeEach(async ({ page }) => prepareApp(page));

test('Collection keyboard selection stays visible and skips options in the Tab path', async ({ page, isMobile }, testInfo) => {
  let count = 40;
  await page.route('**/api/search?**', route => route.fulfill({ json: { data: cards.slice(0, count), total_cards: count, has_more: false } }));
  await page.getByRole('button', { name: 'Collection', exact: true }).click();
  const before = await page.evaluate(() => localStorage.getItem('arcana.workspace.v2'));
  const initialViewport = page.viewportSize();
  for (const viewport of isMobile ? [initialViewport] : [initialViewport, { width: 820, height: 900 }]) {
    await page.setViewportSize(viewport);
    for (count of [3, 40]) {
      await page.getByRole('button', { name: 'Add owned card', exact: true }).click();
      const input = page.getByRole('combobox', { name: 'Search card names' });
      await input.fill('S');
      await expect(page.locator('#owned-matches [role="option"]')).toHaveCount(count);
      expect(await page.locator('#owned-matches').evaluate(list => {
        const box = list.getBoundingClientRect(), dialog = list.closest('dialog');
        const bounds = dialog.getBoundingClientRect();
        return box.top >= bounds.top && box.bottom <= bounds.bottom && bounds.bottom <= innerHeight
          && dialog.scrollHeight <= dialog.clientHeight && document.documentElement.scrollWidth <= innerWidth;
      })).toBe(true);
      const active = page.locator('#owned-matches [aria-selected="true"]');
      const visible = async () => expect(await active.evaluate(option => {
        const box = option.getBoundingClientRect(), list = option.parentElement.getBoundingClientRect();
        const dialog = option.closest('dialog').getBoundingClientRect();
        return box.top >= list.top && box.bottom <= list.bottom && box.top >= dialog.top && box.bottom <= dialog.bottom;
      })).toBe(true);
      for (let i = 0; i < count + 1; i++) { await input.press('ArrowDown'); await visible(); }
      await expect(active).toHaveText('Smoke Card 1');
      for (let i = 0; i < count + 1; i++) { await input.press('ArrowUp'); await visible(); }
      await expect(active).toHaveText(`Smoke Card ${count}`);
      if (count === 40 && viewport.width === initialViewport.width) {
        await page.screenshot({ path: testInfo.outputPath('collection-suggestions.png') });
      }
      await input.press('Tab');
      await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await expect(input).toBeFocused();
      await input.press('ArrowDown');
      await input.press('Enter');
      await expect(page.getByRole('heading', { name: 'Update collection', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Cancel', exact: true }).click();
      expect(await page.evaluate(() => localStorage.getItem('arcana.workspace.v2'))).toBe(before);
    }
  }
  await page.getByRole('button', { name: 'Add owned card', exact: true }).click();
  const input = page.getByRole('combobox', { name: 'Search card names' });
  await input.fill('S');
  const choice = page.locator('#owned-matches').getByRole('option', { name: 'Smoke Card 2', exact: true });
  if (isMobile) await choice.tap(); else await choice.click();
  await expect(page.getByRole('heading', { name: 'Update collection', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => localStorage.getItem('arcana.workspace.v2'))).toBe(before);
  await page.getByRole('button', { name: 'Add owned card', exact: true }).click();
  await input.fill('S');
  await expect(page.locator('#owned-matches')).toBeVisible();
  await input.press('Escape');
  await expect(page.locator('#owned-matches')).toBeHidden();
  await expect(input).toHaveAttribute('aria-expanded', 'false');
  await expect(input).not.toHaveAttribute('aria-activedescendant');
  await input.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('Search button keeps keyboard position through loading, success, no-match, error and retry', async ({ page }) => {
  let finish;
  let outcome = 'success';
  await page.route('**/api/search?**', async route => {
    await new Promise(resolve => { finish = resolve; });
    await route.fulfill(outcome === 'success' ? { json: { data: cards.slice(0, 3), total_cards: 3, has_more: false } }
      : { status: outcome === 'empty' ? 404 : 500, json: { error: outcome === 'empty' ? 'No cards found' : 'Test search failure' } });
  });
  await page.getByRole('button', { name: 'Explore cards', exact: true }).click();
  const input = page.getByRole('textbox', { name: 'Search cards or use Scryfall syntax' });
  const search = page.locator('#search-form').getByRole('button', { name: 'Search', exact: true });
  for (const key of ['Enter', 'Space']) for (outcome of ['success', 'empty', 'error']) {
    finish = null;
    await input.fill('Smoke');
    await input.press('Tab');
    await expect(search).toBeFocused();
    await search.press(key);
    await expect(page.getByText('Loading cards…', { exact: true })).toBeVisible();
    const focusedWhileLoading = await search.evaluate(button => document.activeElement === button);
    await expect.poll(() => Boolean(finish)).toBe(true);
    finish();
    if (outcome === 'success') await expect(page.locator('.card-tile')).toHaveCount(3);
    else await expect(page.getByRole('heading', { name: outcome === 'empty' ? 'No cards matched' : 'Search couldn’t finish' })).toBeVisible();
    expect(focusedWhileLoading).toBe(true);
    await expect(search).toBeFocused();
    await expect(input).toHaveValue('Smoke');
    await search.press('Tab');
    await expect(page.locator('#search-form [data-action="reset"]')).toBeFocused();
    if (outcome === 'error') {
      outcome = 'success';finish = null;
      const retry = page.getByRole('button', { name: 'Try again', exact: true });
      await retry.focus();await retry.press(key);
      await expect.poll(() => Boolean(finish)).toBe(true);finish();
      await expect(page.locator('.card-tile')).toHaveCount(3);
      await expect(page.locator('body')).not.toBeFocused();
    }
  }
  finish = null;
  await input.focus();await input.press('Enter');
  await expect.poll(() => Boolean(finish)).toBe(true);finish();
  await expect(page.locator('.card-tile')).toHaveCount(3);
  await expect(input).toBeFocused();
});

test('Budget keeps invalid drafts and stable Tab progression while preserving the saved amount', async ({ page }, testInfo) => {
  await page.getByRole('button', { name: 'Smoke Garden', exact: true }).click();
  await page.getByRole('tab', { name: 'Ownership & budget', exact: true }).click();
  const input = page.getByLabel('Budget in EUR');
  await input.fill('100.00');
  await input.press('Tab');
  await expect(page.getByLabel('Compare budget against')).toBeFocused();
  const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('arcana.workspace.v2')).decks[0].budgetCents);
  expect(await saved()).toBe(10000);
  for (const value of ['12.345', '-1', 'not a number']) {
    await input.fill(value);
    await input.press('Shift+Tab');
    await expect(page.getByLabel('Maybeboard', { exact: true })).toBeFocused();
    await expect(input).toHaveValue(value);
    await expect(input).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#deck-budget-error')).toContainText('two decimals');
    await expect(input).toHaveAttribute('aria-describedby', 'deck-budget-error');
    expect(await saved()).toBe(10000);
    await input.focus();await input.press('Tab');
    await expect(page.getByLabel('Compare budget against')).toBeFocused();
    // An unrelated planning render must retain the editable draft too.
    await page.getByLabel('Compare budget against').selectOption('full');
    await expect(input).toHaveValue(value);
    await expect(input).toHaveAttribute('aria-invalid', 'true');
  }
  await input.fill('12.345');await input.press('Tab');
  await page.screenshot({ path: testInfo.outputPath('budget-invalid.png') });
  await page.reload();
  await page.getByRole('button', { name: 'Smoke Garden', exact: true }).click();
  await page.getByRole('tab', { name: 'Ownership & budget', exact: true }).click();
  await expect(input).toHaveValue('100.00');
  for (const [value, cents] of [['25.50', 2550], ['0', 0], ['', undefined]]) {
    await input.fill(value);await input.press('Tab');
    await expect(page.getByLabel('Compare budget against')).toBeFocused();
    await expect(input).toHaveAttribute('aria-invalid', 'false');
    await expect(page.locator('#deck-budget-error')).toBeEmpty();
    expect(await saved()).toBe(cents);
  }
  await page.reload();
  await page.getByRole('button', { name: 'Smoke Garden', exact: true }).click();
  await page.getByRole('tab', { name: 'Ownership & budget', exact: true }).click();
  await expect(input).toHaveValue('');
});
