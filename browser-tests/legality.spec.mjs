import { test, expect } from '@playwright/test';
import { cards, prepareApp } from './fixtures.mjs';

test('Checks refreshes uncovered decks and offers retry only after failure', async ({page, isMobile}, testInfo) => {
  const requests = [];
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/api/collection') requests.push(request.postDataJSON().ids);
  });
  await prepareApp(page);
  expect(requests).toHaveLength(1);

  await page.evaluate(([leader, forest]) => {
    const key = 'arcana.workspace.v2';
    const workspace = JSON.parse(localStorage.getItem(key));
    workspace.decks.push({
      id: 'tracked-deck', name: 'Tracked Woodland', format: 'commander', updated: '2026-11-04T00:00:00.000Z',
      cards: [
        {card: leader, qty: 1, tags: ['Draw'], zone: 'command'},
        {card: forest, qty: 99, tags: [], zone: 'main'},
      ],
    });
    localStorage.setItem(key, JSON.stringify(workspace));
    localStorage.setItem('arcana.explorer.v1', JSON.stringify({id: 'tracked-deck', visible: false}));
  }, [cards[0], {...cards[1], name: 'Forest', type_line: 'Basic Land — Forest'}]);

  let failRequest;
  await page.route('**/api/collection', async route => {
    if (!failRequest) {
      await new Promise(resolve => { failRequest = resolve; });
      await route.fulfill({status: 503, json: {error: 'Card lookup is temporarily unavailable. Try again.'}});
      return;
    }
    const {ids} = route.request().postDataJSON();
    await route.fulfill({json: {data: cards.filter(card => ids.includes(card.id)), not_found: []}});
  });
  await page.reload();
  await expect.poll(() => requests.length).toBe(2);
  expect(requests[1]).toEqual([cards[0].id, cards[1].id]);
  await page.getByRole('button', {name: 'Tracked Woodland', exact: true}).click();
  const checks = page.getByRole('tab', {name: 'Checks', exact: true});
  await checks.press('Enter');
  const summary = page.locator('.check-summary');
  await expect(summary).toHaveText('Checking card legality…');
  await expect(summary).toHaveClass('check-summary check-info');
  failRequest();
  const retry = page.getByRole('button', {name: 'Retry legality refresh'});
  await expect(retry).toBeVisible();
  await expect(summary).toHaveText('Checks based on saved data');
  await expect(summary).toHaveClass('check-summary check-info');
  await expect(page.locator('.freshness')).toContainText('Card lookup is temporarily unavailable');
  await expect(page.getByRole('heading', {name: /Manual review/})).toHaveCount(0);
  await page.screenshot({path: testInfo.outputPath('legality-retry.png')});
  if (isMobile) {
    await retry.tap();
  } else {
    await retry.focus();
    await expect(retry).toBeFocused();
    await retry.press('Enter');
  }
  await expect(summary).toHaveText('Supported checks passed');
  await expect(summary).toHaveClass('check-summary check-success');
  await expect(retry).toHaveCount(0);
  await expect(page.locator('.checks')).not.toContainText(/cache|Legality data options|Choose one card stored/i);
  await page.screenshot({path: testInfo.outputPath('legality-refreshed.png')});

  await page.clock.setFixedTime(new Date(Date.now() + 600_000));
  await page.getByRole('tab', {name: 'Cards', exact: true}).click();
  await checks.click();
  await expect(summary).toHaveText('Supported checks passed');
  expect(requests).toHaveLength(3);
  await page.getByRole('button', {name: 'Back to library', exact: true}).click();
  await page.getByRole('button', {name: 'Smoke Garden', exact: true}).click();
  expect(requests).toHaveLength(3);
  await checks.click();
  await expect.poll(() => requests.length).toBe(4);
  await expect(summary).toHaveText('Deck legality issues found');
  await expect(retry).toHaveCount(0);
  const about = page.getByText('About these checks', {exact: true});
  const scope = page.getByText(/Checks cover deck size, commander eligibility/);
  await expect(scope).toBeHidden();
  await about.press('Enter');
  await expect(scope).toBeVisible();
  await page.addStyleTag({content: '.checks {font-size: 200%} .checks select {font-size: inherit}'});
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
  expect(requests).toHaveLength(4);
});
