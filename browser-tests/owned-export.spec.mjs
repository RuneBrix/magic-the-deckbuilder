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

test('text export previews missing copies and independent zone and format options without writes',async({page},testInfo)=>{
  const before=await page.evaluate(()=>localStorage.getItem('arcana.workspace.v2'));
  await page.getByLabel('Deck actions for Smoke Garden',{exact:true}).click();
  await page.getByRole('button',{name:'Export deck',exact:true}).click();
  await expect(page.getByRole('button',{name:'Download text decklist',exact:true})).toBeFocused();
  const preview=page.getByLabel('Text decklist',{exact:true});
  await expect(preview).toHaveValue(`Main deck\n500 ${longName}\n\nSideboard\n2 ${longName}\n\nMaybeboard\n1 ${longName}`);
  await page.getByLabel('Only copies missing from Collection',{exact:true}).check();
  await expect(preview).toHaveValue(`Main deck\n497 ${longName}\n\nSideboard\n2 ${longName}\n\nMaybeboard\n1 ${longName}`);
  await page.getByLabel('Zone headings',{exact:true}).uncheck();
  await expect(preview).toHaveValue(`500 ${longName}`);
  await page.getByLabel('Quantities',{exact:true}).uncheck();
  await expect(preview).toHaveValue(longName);
  await fits(page);await page.screenshot({path:testInfo.outputPath('text-export.png')});
  const pending=page.waitForEvent('download');await page.getByRole('button',{name:'Download text decklist',exact:true}).press('Enter');
  const download=await pending;expect(await readFile(await download.path(),'utf8')).toBe(longName);
  for(const name of ['Main deck','Command zone','Sideboard','Maybeboard'])await page.getByRole('checkbox',{name,exact:true}).uncheck();
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('Select at least one zone.');
  await expect(page.getByRole('button',{name:'Download text decklist',exact:true})).toBeDisabled();
  await page.getByRole('checkbox',{name:'Sideboard',exact:true}).check();
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('No missing copies in the selected zones.');
  const jsonPending=page.waitForEvent('download');await page.getByRole('button',{name:'Complete JSON backup',exact:true}).click();
  const backup=JSON.parse(await readFile(await(await jsonPending).path(),'utf8'));expect(backup.decks).toEqual(JSON.parse(before).decks);
  expect(await page.evaluate(()=>localStorage.getItem('arcana.workspace.v2'))).toBe(before);
  await page.getByRole('checkbox',{name:'Main deck',exact:true}).check();
  await page.addStyleTag({content:'#dialog label,#dialog p,#dialog button,#dialog summary{font-size:24px}'});
  await fits(page);await page.screenshot({path:testInfo.outputPath('text-export-enlarged.png')});
  await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toBeHidden();
});
