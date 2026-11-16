import {test,expect} from '@playwright/test';
import {prepareApp,cards} from './fixtures.mjs';

test('deck currency and basic-land exclusions stay consistent across costs, Cards and reload',async({page,isMobile},testInfo)=>{
  await prepareApp(page);
  await page.evaluate(()=>{
    const key='arcana.workspace.v2',data=JSON.parse(localStorage.getItem(key)),d=data.decks[0];
    d.cards=d.cards.slice(0,4);
    d.cards[1].card.name='A long card name that still keeps cost and copy information readable';
    d.cards[1].qty=500;
    d.cards[2].card.type_line='Basic Snow Land — Forest';
    d.cards[2].card.name='Snow-Covered Forest';
    d.cards[2].qty=20;
    d.cards[2].card.prices={eur:null,usd:null};
    d.cards[3].card.prices={eur:'4.00',usd:null};
    localStorage.setItem(key,JSON.stringify(data));
  });
  await page.reload();
  const open=async()=>{
    await page.getByRole('button',{name:'Smoke Garden',exact:true}).click();
    await page.getByRole('tab',{name:'Ownership & costs',exact:true}).click();
  };
  await open();
  const stored=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('arcana.workspace.v2')));
  const before=await stored();
  const costs=page.getByRole('table',{name:'Cost estimates',exact:true});
  const currency=page.getByRole('combobox',{name:'Deck currency',exact:true});
  await expect(currency).toHaveValue('EUR');
  await expect(costs).toContainText('€630.25');
  await expect(costs).not.toContainText('unpriced');
  await expect(page.getByRole('table',{name:'Copy quantities',exact:true})).toContainText('522');
  await expect(page.getByText('20 basic-land copies are excluded', {exact:false})).toBeVisible();
  await expect(page.getByRole('row').filter({hasText:'Snow-Covered Forest'})).toContainText('Basic land · excluded');
  await currency.focus();
  await currency.selectOption('USD');
  await expect(currency).toBeFocused();
  const currencyBox=await currency.boundingBox(),matchingLabel=await page.getByRole('combobox',{name:'Ownership matching'}).locator('..').boundingBox();
  expect(matchingLabel.y-currencyBox.y-currencyBox.height).toBeGreaterThanOrEqual(8);
  await expect(costs).toContainText('$751.50');
  await expect(costs).toContainText('1 unpriced copy');
  await expect(page.getByRole('button',{name:'Refresh $ prices',exact:true})).toBeVisible();
  await page.route('**/api/search?**',route=>route.fulfill({json:{data:cards.slice(0,2).map(card=>({...card,games:['paper']})),has_more:false}}));
  await page.getByRole('button',{name:'Check cheapest printings',exact:true}).click();
  await expect(page.getByRole('button',{name:'Check cheapest printings',exact:true})).toBeVisible();
  await expect(costs.getByRole('row').filter({hasText:'Cheapest printings estimate'})).toContainText('$751.50');
  await expect(costs.getByRole('row').filter({hasText:'Cheapest printings estimate'})).toContainText('1 unpriced copy');
  await currency.selectOption('EUR');
  await expect(costs.getByRole('row').filter({hasText:'Cheapest printings estimate'})).toContainText('—');
  await currency.selectOption('USD');
  await page.screenshot({path:testInfo.outputPath('currency-costs.png'),fullPage:true});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  await page.getByRole('tab',{name:'Cards',exact:true}).click();
  for(const layout of ['visual-horizontal','visual-vertical','text-horizontal','text-vertical']){
    await page.locator('#editor-layout').selectOption(layout);
    await expect(page.locator('.deck-zone-price').nth(1)).toContainText('$750.00 · 1 copy unpriced');
    await page.locator('#editor-order').selectOption('price-desc');
    if(!isMobile){
      const target=layout.startsWith('visual')?page.getByRole('article',{name:/^A long card name/}):page.locator('.deck-card-name').filter({hasText:'A long card name'});
      await target.first().focus();
      await expect(page.locator('#deck-card-preview')).toContainText('$1.50');
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  }
  await page.getByRole('tab',{name:'Ownership & costs',exact:true}).click();
  await page.addStyleTag({content:':root{font-size:28px}.planning :is(th,td,button,label,summary,legend,select){font-size:1rem}.planning small{font-size:.86rem}'});
  await expect(currency).toBeVisible();
  await currency.focus();await expect(currency).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('currency-enlarged.png'),fullPage:true});
  await page.reload();await open();
  await expect(currency).toHaveValue('USD');
  await expect(costs).toContainText('$751.50');
  const after=await stored();
  const withoutCheckTime=entries=>entries.map(entry=>{const {legalityUpdatedAt,...card}=entry.card;return {...entry,card};});
  expect(withoutCheckTime(after.decks[0].cards)).toEqual(withoutCheckTime(before.decks[0].cards));
  expect(after.collection).toEqual(before.collection);
  await testInfo.attach('currency-environment',{body:JSON.stringify({browser:page.context().browser().version(),viewport:page.viewportSize(),touch:isMobile,origin:new URL(page.url()).origin,colorScheme:await page.evaluate(()=>matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light')},null,2),contentType:'application/json'});
});
