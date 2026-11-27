import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { cards, prepareApp } from './fixtures.mjs';

test.beforeEach(async ({page})=>prepareApp(page));
const stored = page => page.evaluate(()=>JSON.parse(localStorage.getItem('arcana.workspace.v2')));
async function fits(page) {
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const box=await page.getByRole('dialog').isVisible()?await page.getByRole('dialog').boundingBox():null;
  if(box)expect(box.x>=0 && box.y>=0 && box.x+box.width<=page.viewportSize().width && box.y+box.height<=page.viewportSize().height).toBe(true);
}

test('collection upload keeps a text selection when the drag ends on the backdrop',async({page,isMobile})=>{
  test.skip(isMobile,'Mouse text selection');
  await page.getByRole('button',{name:'Collection',exact:true}).click();
  await page.getByRole('button',{name:'Upload card list',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Upload collection'});
  const list=dialog.getByRole('textbox',{name:'Card list or CSV'});
  await list.fill('1x Arcane Signet (tmc)\n1x Assault Strobe (som)');
  const text=await list.boundingBox(),modal=await dialog.boundingBox();
  const outside=modal.x+modal.width+8,y=text.y+20;
  await page.mouse.move(text.x+15,y);
  await page.mouse.down();
  await page.mouse.move(outside,y,{steps:8});
  await page.mouse.up();
  await expect(dialog).toBeVisible();
  expect(await list.evaluate(el=>el.selectionEnd-el.selectionStart)).toBeGreaterThan(0);
  await page.mouse.click(outside,y);
  await expect(dialog).toBeHidden();
});

test('collection upload gives a correction instruction and only Abort import for 83 lookup issues',async({page},testInfo)=>{
  const initial=(await stored(page)).collection;
  const queries=[];
  let nameBatches=0;
  await page.route('**/api/collection-sets',route=>route.fulfill({json:[{code:'tmc',name:'Smoke Commander'}]}));
  await page.route('**/api/search?**',route=>{
    queries.push(new URL(route.request().url()).searchParams.get('q'));
    return route.fulfill({status:404,json:{error:'No cards found.'}});
  });
  await page.route('**/api/collection',route=>{
    if(!route.request().postDataJSON().names)return route.fallback();
    nameBatches++;
    return route.fulfill({json:{data:[],not_found:[]}});
  });
  await page.getByRole('button',{name:'Collection',exact:true}).click();
  await page.getByRole('button',{name:'Upload card list',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Upload collection'});
  await dialog.getByRole('textbox',{name:'Card list or CSV'}).fill(Array.from({length:83},(_,i)=>`1x Unknown Card ${i} (tmc)`).join('\n'));
  await expect(dialog.locator('.collection-upload-columns')).toContainText('Quantity, Name, Set');
  await dialog.getByRole('button',{name:'Upload',exact:true}).click();
  await expect(dialog.getByRole('heading',{name:'Correct the list before importing'})).toBeFocused();
  await expect(dialog.locator('.collection-upload-blocked')).toContainText('More than 20 rows');
  await expect(dialog.locator('.collection-upload-blocked')).toContainText('Correct the card names');
  await expect(dialog.getByRole('listitem')).toHaveText('Can’t find card name · 83');
  await expect(dialog.getByRole('button')).toHaveText(['Abort import']);
  expect(queries).toHaveLength(5);
  expect(queries[0]).toContain('!"Unknown Card 0" set:tmc');
  expect(nameBatches).toBe(2);
  await fits(page);
  await dialog.screenshot({path:testInfo.outputPath('upload-correction-required.png')});
  await dialog.getByRole('button',{name:'Abort import'}).press('Enter');
  await expect(dialog).toBeHidden();
  expect((await stored(page)).collection).toEqual(initial);
});

test('collection uploads show additive totals, protect replacement and retain unrelated decks',async({page},testInfo)=>{
  const original=(await stored(page)).decks;
  await page.getByRole('button',{name:'Collection',exact:true}).click();
  await page.getByRole('button',{name:'Upload card list',exact:true}).click();
  await page.getByLabel('Card list or CSV').fill('2 Smoke Card 2');
  await expect(page.locator('#collection-impact')).toContainText('3 → 5');
  await expect(page.locator('#collection-impact')).toContainText('Re-uploading');
  await page.locator('#collection-upload-submit').click();
  await page.getByRole('button',{name:'Finish import'}).click();
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
  await page.getByRole('button',{name:'Finish import'}).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect((await stored(page)).collection[0].qty).toBe(1);
  expect((await stored(page)).decks).toEqual(original);
  await page.reload();expect((await stored(page)).collection[0].qty).toBe(1);
});

test('collection upload reviews printing choices and missing names before saving',async({page},testInfo)=>{
  const initial=await stored(page);
  await page.route('**/api/collection-sets',route=>route.fulfill({json:[{code:'alt',name:'Alternate Edition'}]}));
  await page.route('**/api/search?**',route=>route.fulfill({status:404,json:{error:'No cards found.'}}));
  await page.getByRole('button',{name:'Collection',exact:true}).click();
  await page.getByRole('button',{name:'Upload card list',exact:true}).click();
  await page.getByLabel('Card list or CSV').fill('Quantity,Name,Edition Name\n2,Smoke Card 2,Alternate Edition\n1,Unknown Card,Alternate Edition');
  await page.locator('#collection-upload-submit').click();
  const review=page.locator('#collection-upload-review');
  await expect(review).toContainText('Can’t find the requested printing · 1');
  await expect(review).toContainText('Can’t find card name · 1');
  await expect(review).not.toContainText('Smoke Card');
  expect(await stored(page)).toEqual(initial);

  await page.getByRole('button',{name:'Resolve errors'}).press('Enter');
  const printing=page.getByLabel('Printing and finish');
  await printing.selectOption({label:'Smoke Test #2 · en · foil'});
  await expect(review.getByAltText(cards[1].name)).toBeVisible();
  await fits(page);
  await page.screenshot({path:testInfo.outputPath('collection-printing-resolution.png')});
  await page.getByRole('button',{name:'Use this printing'}).click();
  await expect(review).toContainText('Unknown Card');
  await page.getByRole('button',{name:'Skip row'}).click();
  await expect(review).toContainText('1 row explicitly skipped');
  expect(await stored(page)).toEqual(initial);
  await page.getByRole('button',{name:'Finish import'}).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect((await stored(page)).collection.at(-1)).toMatchObject({card:{id:cards[1].id},qty:2,finish:'foil'});
});

test('collection uploads Arcana deck TXT downloads with and without printing fields',async({page})=>{
  const name='Arcane Signet, Across the Archive';
  const printing={...cards[1],id:'00000000-0000-4000-8000-000000004002',name,set:'soc',set_name:'Smoke Commander',collector_number:'12a',lang:'ja',finishes:['foil']};
  await page.evaluate(printing=>{
    const key='arcana.workspace.v2',data=JSON.parse(localStorage.getItem(key));
    const card={...printing,legalityUpdatedAt:data.decks[0].cards[0].card.legalityUpdatedAt};
    const entry={card,qty:2,tags:[],zone:'main',finish:'foil'};
    data.decks[0].cards=[entry,{...entry,qty:1,zone:'sideboard'}];
    localStorage.setItem(key,JSON.stringify(data));
  },printing);
  await page.reload();
  await page.getByRole('button',{name:'Smoke Garden',exact:true}).click();
  await page.getByLabel('Deck actions for Smoke Garden',{exact:true}).click();
  await page.getByRole('button',{name:'Export deck',exact:true}).click();
  const download = async () => {
    const pending=page.waitForEvent('download');
    await page.getByRole('button',{name:'Download TXT',exact:true}).press('Enter');
    return readFile(await (await pending).path());
  };
  await page.getByLabel('Section headings').selectOption('none');
  const plain=await download();
  expect(plain.toString()).toBe(`3 ${name}`);
  await page.getByLabel('Section headings').selectOption('zone');
  await page.getByText('Fields to export',{exact:true}).click();
  for(const field of ['Set','Collector number','Finish','Language'])await page.getByRole('checkbox',{name:field,exact:true}).check();
  const metadata=await download();
  expect(metadata.toString()).toContain(`2\t${name}\tSOC\t12a\tfoil\tja`);
  await page.keyboard.press('Escape');

  const inventory=(await stored(page)).collection;
  await page.getByRole('button',{name:'Collection',exact:true}).click();
  const open=page.getByRole('button',{name:'Upload card list',exact:true});
  const file=page.getByLabel('TXT or CSV file');
  const submit=page.locator('#collection-upload-submit');
  const syntax=page.locator('#collection-syntax');
  const review=page.locator('#collection-upload-review');
  await open.click();
  await file.setInputFiles({name:'deck.txt',mimeType:'text/plain',buffer:plain});
  await expect(syntax).toHaveText('Syntax valid · 1 card row · 3 copies.');
  await submit.click();
  await expect(review).toContainText('3 copies ready to add');
  await review.getByRole('button',{name:'Abort import'}).click();
  expect((await stored(page)).collection).toEqual(inventory);
  await open.click();
  await file.setInputFiles({name:'deck-with-printings.txt',mimeType:'text/plain',buffer:metadata});
  await expect(syntax).toHaveText('Syntax valid · 2 card rows · 3 copies.');
  await expect(page.locator('#collection-notices')).toContainText('Quantity, Card name, Set, Collector number, Finish, Language');
  await expect(page.locator('#collection-accept-ignored')).toHaveCount(0);
  await page.getByRole('button',{name:'Change tab-separated columns'}).press('Enter');
  await expect(page.getByLabel('First row contains column headings')).toBeFocused();
  await expect(page.getByLabel('First row contains column headings')).toBeChecked();
  await page.getByRole('button',{name:'Check syntax'}).press('Enter');
  await expect(submit).toBeEnabled();
  await submit.click();
  expect((await stored(page)).collection).toEqual(inventory);
  await page.getByRole('button',{name:'Finish import'}).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  await page.reload();
  expect((await stored(page)).collection.at(-1)).toMatchObject({qty:3,finish:'foil',card:{id:printing.id,lang:'ja',set:'soc',collector_number:'12a'}});
});

test('collection upload separates syntax, omissions, and lookup review for pasted tab-separated data',async({page,isMobile},testInfo)=>{
  const name='Arcane Signet, Across a Very Long Path Through the Archive';
  const printing={...cards[1],id:'00000000-0000-4000-8000-000000004003',name,set:'soc',set_name:'Smoke Commander',collector_number:'12a',lang:'ja',finishes:['foil']};
  const otherPrintings=[
    {...printing,id:'other-set',set:'tst',collector_number:'11'},
    {...printing,id:'other-finish',collector_number:'14',finishes:['nonfoil']},
  ];
  const queries=[];
  await page.route('**/api/collection-sets',route=>route.fulfill({json:[{code:'soc',name:'Smoke Commander'}]}));
  await page.route('**/api/search?**',route=>{
    queries.push(new URL(route.request().url()).searchParams.get('q'));
    return route.fulfill({json:{data:[...otherPrintings,printing],has_more:false}});
  });
  await page.route('**/api/collection',route=>{
    if(!route.request().postDataJSON().names?.includes(name))return route.fallback();
    return route.fulfill({json:{data:[printing],not_found:[]}});
  });
  const original=(await stored(page)).collection;
  await page.getByRole('button',{name:'Collection',exact:true}).click();
  await page.getByRole('button',{name:'Upload card list',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Upload collection'});
  const examples=dialog.locator('.import-examples');
  const summary=examples.locator('summary');
  const submit=dialog.locator('#collection-upload-submit');
  const syntax=dialog.locator('#collection-syntax');
  const list=dialog.getByRole('textbox',{name:'Card list or CSV'});
  await expect(list).toBeEmpty();
  await expect(syntax).toBeHidden();
  await expect(submit).toBeDisabled();
  if(!isMobile)expect((await dialog.boundingBox()).width).toBeGreaterThanOrEqual(650);
  await summary.press('Enter');
  await expect(summary).toBeFocused();
  await expect(examples).toHaveAttribute('open','');
  await expect(examples.getByText('Tab-separated TXT',{exact:true})).toBeVisible();
  const examplesGap=await examples.evaluate(el=>el.querySelector('figure').getBoundingClientRect().top-el.querySelector('summary').getBoundingClientRect().bottom);
  expect(examplesGap).toBeLessThanOrEqual(8);
  expect(await examples.evaluate(el=>parseFloat(getComputedStyle(el).borderBottomWidth))).toBeGreaterThan(0);
  const rows=[
    `2\t${name}\tSOC\t12a\tFoil\tJapanese\tgift`,
    '1\tBroken row\tSOC',
    `1\t${name}\tSmoke Commander\t14\tFoil\tja\tgift`,
    `1\t${name}\tWrong Set\t12a\tFoil\tja\tgift`,
  ];
  await list.fill(rows.join('\r\n'));
  await expect(dialog.getByLabel('First row contains column headings')).not.toBeChecked();
  for(const [index,field] of ['Quantity','Name','Edition Name','Collector Number','Finish','Language'].entries()) {
    await dialog.locator(`[data-csv-column="${index}"]`).selectOption(field);
  }
  await dialog.getByRole('button',{name:'Check syntax'}).press('Enter');
  await expect(dialog.getByRole('button',{name:'Change tab-separated columns'})).toBeFocused();
  await expect(syntax).toHaveText('Syntax valid · 3 card rows · 4 copies.');
  await expect(dialog.locator('.collection-upload-columns')).toContainText('Quantity, Name, Edition Name, Collector Number, Finish, Language');
  const problems=dialog.locator('#collection-notices .collection-upload-problems');
  await expect(problems).toContainText('Column 7');
  await expect(problems).toContainText('Tab-separated row 2');
  await expect(submit).toBeDisabled();
  expect(queries).toEqual([]);
  await dialog.getByLabel('Upload action').selectOption('replace');
  await expect(problems.getByRole('heading',{name:'Rows to correct'})).toBeVisible();
  await expect(dialog.locator('#collection-accept-ignored')).toHaveCount(0);
  await expect(submit).toBeDisabled();
  await dialog.getByLabel('Upload action').selectOption('add');
  await dialog.screenshot({path:testInfo.outputPath('upload-feedback.png')});
  await page.evaluate(()=>{
    const root=document.documentElement;
    root.style.fontSize=`${parseFloat(getComputedStyle(root).fontSize)*2}px`;
  });
  await fits(page);
  expect(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
  await problems.screenshot({path:testInfo.outputPath('upload-omissions-enlarged.png')});
  const confirm=problems.getByRole('checkbox',{name:'Upload valid rows using only the processed columns'});
  await confirm.press('Space');
  await expect(submit).toBeEnabled();
  await summary.press('Enter');
  await expect(examples).not.toHaveAttribute('open');
  await submit.press('Enter');
  const review=dialog.locator('#collection-upload-review');
  await expect(review.getByRole('heading',{name:'Import check complete'})).toBeFocused();
  await expect(review).toContainText('Can’t find the requested printing · 1');
  await expect(review).toContainText('Requested finish unavailable · 1');
  expect(queries).toHaveLength(1);
  expect(queries[0]).toContain('set:soc lang:ja');
  expect((await stored(page)).collection).toEqual(original);
  await dialog.getByRole('button',{name:'Resolve errors'}).click();
  await expect(review).toContainText('Tab-separated row 4');
  await expect(review).toContainText('Set is unrecognized');
  await dialog.getByRole('button',{name:'Skip row'}).click();
  await expect(review).toContainText('Tab-separated row 3');
  await expect(review).toContainText('does not support the requested finish');
  await dialog.getByRole('button',{name:'Skip row'}).click();
  await expect(review).toContainText('3 rows explicitly skipped');
  await expect(review).toContainText('2 copies ready to add');
  await dialog.getByRole('button',{name:'Finish import'}).press('Enter');
  await expect(dialog).toBeHidden();
  expect((await stored(page)).collection.at(-1)).toMatchObject({qty:2,finish:'foil',card:{id:printing.id,collector_number:'12a',lang:'ja'}});
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
  const issue=page.getByText('Zirda, the Dawnwaker: companion predicate is unsupported; review the starting deck manually.',{exact:true});
  await expect(issue).toBeHidden();
  await select.selectOption({label:'Zirda, the Dawnwaker'});
  await expect(page.getByLabel('Designated companion')).toBeFocused();
  await expect(issue).toBeVisible();
  expect((await stored(page)).decks[0].cards.at(-1).companion).toBe(true);
  await fits(page);await page.screenshot({path:testInfo.outputPath('companion-checks.png'),fullPage:true});
  await page.reload();await page.getByRole('button',{name:'Smoke Garden',exact:true}).click();await page.getByRole('tab',{name:'Checks',exact:true}).click();
  await expect(page.getByLabel('Designated companion')).toHaveValue(/companion/);
  await page.getByLabel('Designated companion').selectOption('');
  await expect(issue).toBeHidden();
  expect((await stored(page)).decks[0].cards.at(-1).companion).toBeUndefined();
});
