import { test, expect } from '@playwright/test';
import { prepareApp } from './fixtures.mjs';

test.beforeEach(async ({page})=>prepareApp(page));
const stored = page => page.evaluate(()=>JSON.parse(localStorage.getItem('arcana.workspace.v2')));
async function fits(page) {
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const box=await page.getByRole('dialog').isVisible()?await page.getByRole('dialog').boundingBox():null;
  if(box)expect(box.x>=0 && box.y>=0 && box.x+box.width<=page.viewportSize().width && box.y+box.height<=page.viewportSize().height).toBe(true);
}

test('collection uploads show additive totals, protect replacement and retain unrelated decks',async({page},testInfo)=>{
  const original=(await stored(page)).decks;
  await page.getByRole('button',{name:'Collection',exact:true}).click();
  await page.getByRole('button',{name:'Upload card list',exact:true}).click();
  await page.getByLabel('Card list or CSV').fill('2 Smoke Card 2');
  await expect(page.locator('#collection-impact')).toContainText('3 → 5');
  await expect(page.locator('#collection-impact')).toContainText('Re-uploading');
  await page.locator('#collection-upload-submit').click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect((await stored(page)).collection[0].qty).toBe(5);
  await page.getByRole('button',{name:'Upload card list',exact:true}).click();
  await page.getByLabel('Card list or CSV').fill('2 Smoke Card 2');
  await page.getByLabel('Upload action').selectOption('replace');
  await expect(page.locator('#collection-impact')).toContainText('Replace 5 current copies');
  await expect(page.getByRole('button',{name:'Save current workspace copy',exact:true})).toBeVisible();
  await page.locator('#collection-upload-submit').click();
  await expect(page.locator('#collection-import-error')).toContainText('Confirm replacing');
  expect((await stored(page)).collection[0].qty).toBe(5);
  await fits(page);
  await page.screenshot({path:testInfo.outputPath('replacement.png'),fullPage:true});
  await page.keyboard.press('Escape');
  expect((await stored(page)).collection[0].qty).toBe(5);
  await page.getByRole('button',{name:'Upload card list',exact:true}).click();
  await page.getByLabel('Upload action').selectOption('replace');
  await page.getByLabel('Card list or CSV').fill('1 Smoke Card 2');
  const confirm=page.getByRole('checkbox',{name:'I confirm replacing the entire inventory with this upload'});
  await confirm.focus();await page.keyboard.press('Space');
  await page.locator('#collection-upload-submit').focus();await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect((await stored(page)).collection[0].qty).toBe(1);
  expect((await stored(page)).decks).toEqual(original);
  await page.reload();expect((await stored(page)).collection[0].qty).toBe(1);
});

test('Checks companion designation persists and keeps unsupported restrictions explicit',async({page},testInfo)=>{
  await page.evaluate(()=>{
    const key='arcana.workspace.v2',data=JSON.parse(localStorage.getItem(key));
    const card={...data.decks[0].cards[1].card,id:'companion',oracle_id:'companion',name:'Zirda, the Dawnwaker',keywords:['Companion'],oracle_text:'Companion — Each permanent card in your starting deck has an activated ability.'};
    data.decks[0].cards.push({card,qty:1,tags:[],zone:'sideboard'});localStorage.setItem(key,JSON.stringify(data));
  });
  await page.reload();
  await page.getByRole('button',{name:'Smoke Garden',exact:true}).click();
  await page.getByRole('tab',{name:'Checks',exact:true}).click();
  const select=page.getByLabel('Designated companion');
  await select.selectOption({label:'Zirda, the Dawnwaker'});
  await expect(page.getByLabel('Designated companion')).toBeFocused();
  await expect(page.getByText('Zirda, the Dawnwaker: companion predicate is unsupported; review the starting deck manually.',{exact:true})).toBeVisible();
  expect((await stored(page)).decks[0].cards.at(-1).companion).toBe(true);
  await fits(page);await page.screenshot({path:testInfo.outputPath('companion-checks.png'),fullPage:true});
  await page.reload();await page.getByRole('button',{name:'Smoke Garden',exact:true}).click();await page.getByRole('tab',{name:'Checks',exact:true}).click();
  await expect(page.getByLabel('Designated companion')).toHaveValue(/companion/);
  await page.getByLabel('Designated companion').selectOption('');
  expect((await stored(page)).decks[0].cards.at(-1).companion).toBeUndefined();
});
