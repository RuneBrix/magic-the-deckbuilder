const id = index => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
export const cards = Array.from({ length: 40 }, (_, index) => ({
  id: id(index + 1), oracle_id: id(index + 101), name: `Smoke Card ${index + 1}`,
  type_line: index === 0 ? 'Legendary Creature' : 'Creature', cmc: 2,
  color_identity: ['G'], colors: ['G'], mana_cost: '{1}{G}', oracle_text: 'Draw a card.',
  set: 'tst', set_name: 'Smoke Test', collector_number: String(index + 1), lang: 'en',
  finishes: ['nonfoil', 'foil'], rarity: 'common', prices: { eur: '1.25', usd: '1.50' },
  legalities: { commander: 'legal', modern: 'legal' },
  image_uris: { normal: 'https://cards.scryfall.io/smoke.jpg' },
}));
export const deck = {
  id: 'smoke-deck', name: 'Smoke Garden', format: 'commander',
  cards: cards.map((card, index) => ({ card, qty: index === 1 ? 2 : 1, tags: ['Draw'], zone: index ? 'main' : 'command' })),
};
export const workspace = {
  format: 'arcana-workspace', version: 2, exportedAt: '2026-11-04T12:00:00.000Z',
  decks: [deck], collection: [{ card: cards[1], qty: 3, finish: 'regular' }],
};

export async function prepareApp(page) {
  page.on('pageerror', error => { throw error; });
  await page.addInitScript(data => {
    if (!localStorage.getItem('arcana-smoke-seeded')) {
      localStorage.setItem('arcana.workspace.v2', JSON.stringify(data));
      localStorage.setItem('arcana-smoke-seeded', 'yes');
    }
  }, workspace);
  await page.route(/^https:\/\//, route => route.fulfill({
    contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="488" height="680"><rect width="488" height="680" fill="#326747"/></svg>',
  }));
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    let data;
    if (url.pathname === '/api/collection') {
      const request = route.request().postDataJSON();
      data = { data: cards.filter(card => request.ids?.includes(card.id) || request.names?.includes(card.name)), not_found: [] };
    } else if (url.pathname === '/api/printings') {
      data = { data: cards.filter(card => card.oracle_id === url.searchParams.get('oracle')), has_more: false };
    } else if (url.pathname === '/api/search') {
      data = { data: cards.slice(0, 3), total_cards: 3, has_more: false };
    } else {
      throw Error(`Unexpected API request: ${url.pathname}`);
    }
    await route.fulfill({ json: data });
  });
  await page.goto('/');
}
