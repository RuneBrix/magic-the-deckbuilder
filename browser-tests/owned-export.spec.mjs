import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { prepareApp, cards } from './fixtures.mjs';

const longName='An unusually long double-faced card name, the Patient Collector // A Second Face for the Collection';
test.beforeEach(async({page})=>{
  await prepareApp(page);
  await page.evaluate(({card,longName})=>{
    const data=JSON.parse(localStorage.getItem('arcana.workspace.v2'));
    card.name=longName;
    data.decks[0].cards=[{card,qty:500,tags:['My deliberate function','Other'],zone:'main',finish:'regular'},
      {card,qty:2,tags:['Sideboard function'],zone:'sideboard',finish:'regular'},
      {card,qty:1,tags:[],zone:'maybeboard',finish:'regular'}];
    data.collection=[{card:{...card,id:'owned-variant',set:'own',collector_number:'12a',lang:'ja',finishes:['foil']},qty:3,finish:'foil'}];
    localStorage.setItem('arcana.workspace.v2',JSON.stringify(data));
  },{card:cards[1],longName});
  await page.reload();
  await page.getByRole('button',{name:'Smoke Garden',exact:true}).click();
});

async function fits(page){
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(await page.getByRole('dialog').evaluate(el=>{const r=el.getBoundingClientRect();return r.left>=0 && r.right<=innerWidth && r.top>=0 && r.bottom<=innerHeight;})).toBe(true);
}

test('owned printing review cancels, retries failed storage and retains split copies after reload',async({page},testInfo)=>{
  await page.getByRole('tab',{name:'Ownership & costs',exact:true}).click();
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('arcana.workspace.v2')));
  const action=page.getByRole('button',{name:'Match owned printings…',exact:true});
  await action.press('Enter');
  await expect(page.getByRole('button',{name:'Keep printings',exact:true})).toBeFocused();
  await expect(page.getByRole('dialog')).toContainText('3 copies to update · 0 already match · 499 without an eligible owned copy');
  await page.getByText('Review 1 printing change',{exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('OWN 12a / foil / ja');
  await fits(page);await page.screenshot({path:testInfo.outputPath('owned-review.png')});
  await page.getByRole('button',{name:'Keep printings',exact:true}).press('Enter');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('arcana.workspace.v2')))).toEqual(before);
  await action.click();
  await page.evaluate(()=>{
    const write=Storage.prototype.setItem;window.allowOwnedSave=false;
    Storage.prototype.setItem=function(key,value){if(key==='arcana.workspace.v2'&&!window.allowOwnedSave)throw new DOMException('Quota','QuotaExceededError');return write.call(this,key,value);};
  });
  await page.getByRole('button',{name:'Apply 3 copies',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Browser storage is full');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('arcana.workspace.v2')))).toEqual(before);
  await fits(page);await page.screenshot({path:testInfo.outputPath('owned-storage-error.png')});
  await page.evaluate(()=>{window.allowOwnedSave=true;});
  await page.getByRole('button',{name:'Apply 3 copies',exact:true}).press('Enter');
  await expect(page.getByRole('dialog')).toBeHidden();await expect(action).toBeFocused();
  await page.reload();
  const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('arcana.workspace.v2')));
  expect(after.collection).toEqual(before.collection);
  expect(after.decks[0].cards.map(e=>[e.card.id,e.qty,e.zone,e.finish])).toEqual([
    ['owned-variant',3,'main','foil'],[cards[1].id,497,'main','regular'],[cards[1].id,2,'sideboard','regular'],[cards[1].id,1,'maybeboard','regular']]);
  expect(after.decks[0].cards[0].tags).toEqual(['My deliberate function','Other']);
  await testInfo.attach('acceptance-context',{body:JSON.stringify({browser:page.context().browser().version(),viewport:page.viewportSize(),appearance:testInfo.project.use.colorScheme,origin:new URL(page.url()).origin}),contentType:'application/json'});
});

test('deck export previews one row and downloads matching TXT, CSV and complete JSON without writes',async({page},testInfo)=>{
  const before=await page.evaluate(()=>localStorage.getItem('arcana.workspace.v2'));
  await page.getByLabel('Deck actions for Smoke Garden',{exact:true}).click();
  await page.getByRole('button',{name:'Export deck',exact:true}).click();
  const format=page.getByRole('combobox',{name:'Format',exact:true});
  await expect(format).toBeFocused();
  const preview=page.getByLabel('Example row',{exact:true});
  await expect(preview).toHaveValue(`Main deck\n500 ${longName}`);
  await page.getByRole('combobox',{name:'Collection status'}).selectOption('missing');
  await expect(preview).toHaveValue(`Main deck\n497 ${longName}`);
  await page.getByRole('combobox',{name:'Section headings'}).selectOption('none');
  await expect(preview).toHaveValue(`500 ${longName}`);
  await page.getByText('Fields to export',{exact:true}).click();
  await page.getByLabel('Quantity',{exact:true}).uncheck();
  await expect(preview).toHaveValue(longName);
  await fits(page);await page.screenshot({path:testInfo.outputPath('deck-export.png')});
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Download TXT',exact:true}).press('Enter');
  const download=await pending;expect(await readFile(await download.path(),'utf8')).toBe(longName);
  await format.selectOption('csv');
  await page.getByLabel('Quantity',{exact:true}).check();
  await page.getByLabel('Set',{exact:true}).check();
  await page.getByRole('combobox',{name:'Section headings'}).selectOption('zone');
  await page.getByRole('combobox',{name:'Categories by type'}).selectOption('include');
  await expect(page.getByRole('dialog').getByRole('status')).toHaveText('Select at least one category to include.');
  await page.getByRole('checkbox',{name:'Creature',exact:true}).check();
  const header='Zone,Quantity,Card name,Set', row=`Main deck,497,"${longName}",TST`;
  await expect(preview).toHaveValue(`${header}\n${row}`);
  const csvPending=page.waitForEvent('download');await page.getByRole('button',{name:'Download CSV',exact:true}).click();
  expect(await readFile(await (await csvPending).path(),'utf8')).toBe(`${header}\r\n${row}\r\nSideboard,2,"${longName}",TST\r\nMaybeboard,1,"${longName}",TST`);
  await page.getByRole('combobox',{name:'Categories by type'}).selectOption('all');
  for(const name of ['Main deck','Command zone','Sideboard','Maybeboard'])await page.getByRole('checkbox',{name,exact:true}).uncheck();
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('Select at least one zone.');
  await expect(page.getByRole('button',{name:'Download CSV',exact:true})).toBeDisabled();
  await page.getByRole('checkbox',{name:'Sideboard',exact:true}).check();
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('No missing copies match this selection.');
  const jsonPending=page.waitForEvent('download');await page.getByRole('button',{name:'Complete JSON backup',exact:true}).click();
  const backup=JSON.parse(await readFile(await(await jsonPending).path(),'utf8'));expect(backup.decks).toEqual(JSON.parse(before).decks);
  expect(await page.evaluate(()=>localStorage.getItem('arcana.workspace.v2'))).toBe(before);
  await page.getByRole('checkbox',{name:'Main deck',exact:true}).check();
  await page.addStyleTag({content:'#dialog label,#dialog p,#dialog button,#dialog summary{font-size:24px}'});
  await fits(page);await page.screenshot({path:testInfo.outputPath('deck-export-enlarged.png')});
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toBeHidden();
});

test('group grid, export and staged removal keep the selected zone and filter scope',async({page,isMobile},testInfo)=>{
  await page.evaluate(hiddenCard=>{
    const data=JSON.parse(localStorage.getItem('arcana.workspace.v2'));
    const main=data.decks[0].cards[0];
    main.qty=3;
    data.decks[0].cards.push({...main,qty:2,finish:'foil'}, {...main,qty:4,card:hiddenCard});
    localStorage.setItem('arcana.workspace.v2',JSON.stringify(data));
  },cards[2]);
  await page.reload();
  await page.getByRole('button',{name:'Smoke Garden',exact:true}).click();
  const read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('arcana.workspace.v2')));
  const before=await read();
  const activate=button=>isMobile?button.tap():button.press('Enter');
  const dialog=page.getByRole('dialog');
  const filter=page.getByRole('searchbox',{name:'Filter cards'});
  const typeMenu=page.getByRole('button',{name:'Group actions for Creature · Main deck',exact:true});
  await filter.fill('Patient Collector');
  const openAction=async (menu,label)=>{
    await activate(menu);
    await activate(page.getByRole('button',{name:label,exact:true}));
  };
  await openAction(typeMenu,'View shown cards as grid');
  await expect(dialog).toContainText('Main deck · 5 copies matching the filter');
  await expect(dialog.getByRole('img',{name:longName,exact:true})).toHaveCount(2);
  await expect(dialog.locator('figcaption')).toHaveCount(2);
  await fits(page);
  await page.screenshot({path:testInfo.outputPath('group-grid.png')});
  await page.keyboard.press('Escape');
  await expect(typeMenu).toBeFocused();

  const grouping=page.getByRole('combobox',{name:'Group by',exact:true});
  await grouping.selectOption('role');
  const functionMenu=page.getByRole('button',{name:'Group actions for My deliberate function · Main deck',exact:true});
  await openAction(functionMenu,'Export shown cards…');
  const csv=page.waitForEvent('download');await activate(dialog.getByRole('button',{name:'Download CSV',exact:true}));
  const output=await readFile(await (await csv).path(),'utf8');
  expect(output).toContain(`3,"${longName}",TST,2,nonfoil,en`);
  expect(output).toContain(`2,"${longName}",TST,2,foil,en`);
  expect(output.split('\r\n')).toHaveLength(3);
  await page.keyboard.press('Escape');await expect(functionMenu).toBeFocused();
  expect(await read()).toEqual(before);

  await grouping.selectOption('type');
  await openAction(typeMenu,'Remove group cards…');
  const scope=dialog.getByRole('combobox',{name:'Cards to remove'});
  await expect(scope).toHaveValue('shown');
  await expect(dialog.getByRole('button',{name:'Keep cards'})).toBeFocused();
  await scope.selectOption('whole');
  await expect(dialog.getByRole('button',{name:'Remove 9 copies'})).toBeVisible();
  await activate(dialog.getByRole('button',{name:'Keep cards'}));
  expect(await read()).toEqual(before);
  await openAction(typeMenu,'Remove group cards…');
  await page.evaluate(()=>{
    const write=Storage.prototype.setItem;window.allowGroupSave=false;
    Storage.prototype.setItem=function(key,value){if(key==='arcana.workspace.v2'&&!window.allowGroupSave)throw new DOMException('Quota','QuotaExceededError');return write.call(this,key,value);};
  });
  const remove=dialog.getByRole('button',{name:'Remove 5 copies'});
  await activate(remove);
  await expect(dialog.getByRole('alert')).toContainText('Browser storage is full');
  expect(await read()).toEqual(before);
  await fits(page);
  await page.evaluate(()=>{window.allowGroupSave=true;});
  await activate(remove);
  await expect(dialog).toBeHidden();await expect(filter).toBeFocused();
  const remaining=before.decks[0].cards.filter(entry=>entry.zone!=='main'||entry.card.name!==longName);
  expect((await read()).decks[0].cards).toEqual(remaining);
  await page.reload();
  const after=await read();
  const withoutRefresh=entries=>entries.map(({card:{legalityUpdatedAt,...card},...entry})=>({...entry,card}));
  expect(after.collection).toEqual(before.collection);
  expect(withoutRefresh(after.decks[0].cards)).toEqual(withoutRefresh(remaining));
});
