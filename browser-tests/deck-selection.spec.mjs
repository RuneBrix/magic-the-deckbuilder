import { expect, test } from '@playwright/test';
import { cards, prepareApp } from './fixtures.mjs';

const longName='A card with a very long name, Across the Shimmering Isles // Through the Emerald Archive';
test.beforeEach(async({page,context})=>{
  await context.grantPermissions(['clipboard-read','clipboard-write']);
  await prepareApp(page);
  await page.evaluate(({cards,longName})=>{
    const data=JSON.parse(localStorage.getItem('arcana.workspace.v2'));
    const leader={...data.decks[0].cards[0],finish:'regular'};
    const stamp=leader.card.legalityUpdatedAt;
    const card={...cards[1],name:longName,legalityUpdatedAt:stamp};
    const entry=(card,qty,zone,finish,tags)=>({card,qty,zone,finish,tags});
    data.decks[0].cards=[leader,entry(card,2,'main','regular',['Draw','Ramp']),entry(card,1,'main','foil',['Foil group']),
      entry(card,3,'sideboard','regular',['Side function']),entry({...cards[2],type_line:'Land',legalityUpdatedAt:stamp},500,'maybeboard','regular',[]),
      ...cards.slice(3,8).map(card=>entry({...card,legalityUpdatedAt:stamp},1,'main','regular',['Draw']))];
    data.collection=[{card,finish:'regular',qty:1,condition:'near_mint'}, {card,finish:'foil',qty:2}];
    localStorage.setItem('arcana.workspace.v2',JSON.stringify(data));
  },{cards,longName});
  await page.reload();
  await page.getByRole('button',{name:'Smoke Garden',exact:true}).click();
});

const read = page => page.evaluate(()=>JSON.parse(localStorage.getItem('arcana.workspace.v2')));
const mode = page => page.getByRole('combobox',{name:'Mode',exact:true});
const bar = page => page.getByRole('group',{name:'Selected card actions',exact:true});
const card = (page,zone,finish='Nonfoil') => page.getByRole('button',{name:new RegExp(`^Select A card with.* · ${zone} · .* · ${finish}$`)});
const openAction = async(page,name) => {
  await bar(page).getByRole('button',{name:'Actions',exact:true}).click();
  await bar(page).getByRole('button',{name,exact:true}).click();
};

test('selection follows visible entries through sort, layout, filter and navigation',async({page,isMobile},testInfo)=>{
  const before=await read(page);
  const activate=button=>isMobile?button.tap():button.press('Space');
  await expect(mode(page)).toHaveValue('default');
  await mode(page).selectOption('select');
  await expect(bar(page)).toBeHidden();
  const big=page.getByRole('button',{name:/^Select Smoke Card 3 · Maybeboard · 500 copies/});
  await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));
  await activate(big);
  await expect(bar(page).getByRole('status')).toHaveText('1 entry · 500 copies selected');
  await expect.poll(async()=>{
    const a=await big.boundingBox(), b=await bar(page).boundingBox();
    return a.y+a.height+2<=b.y || a.x+a.width<=b.x;
  }).toBe(true);
  await bar(page).getByRole('button',{name:'Clear selection',exact:true}).click();
  const regular=card(page,'Main deck');
  await activate(regular);
  await expect(regular).toHaveAttribute('aria-pressed','true');
  await expect(bar(page).getByRole('status')).toHaveText('1 entry · 2 copies selected');
  await activate(card(page,'Sideboard'));
  await expect(bar(page).getByRole('status')).toHaveText('2 entries · 5 copies selected');
  const individual=page.getByRole('button',{name:/^Card actions for A card with.* in Main deck · .* · Nonfoil$/});
  await individual.click();
  await expect(page.getByRole('menuitem',{name:'Open details',exact:true})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(regular).toHaveAttribute('aria-pressed','true');
  await openAction(page,'Copy card names');
  await expect.poll(async()=>(await page.evaluate(()=>navigator.clipboard.readText())).replaceAll('\r\n','\n'))
    .toBe(`Main deck\n2 ${longName}\n\nSideboard\n3 ${longName}`);
  await expect(bar(page).getByRole('button',{name:'Actions',exact:true})).toBeFocused();
  await page.getByRole('combobox',{name:'View',exact:true}).selectOption('text-vertical');
  await page.getByRole('combobox',{name:'Sort by',exact:true}).selectOption('quantity');
  await expect(regular).toHaveAttribute('aria-pressed','true');
  await activate(big);
  await expect(bar(page).getByRole('status')).toHaveText('3 entries · 505 copies selected');
  await page.addStyleTag({content:'html{font-size:150%}'});
  await big.focus();
  await expect.poll(async()=>{
    const a=await big.boundingBox(), b=await bar(page).boundingBox();
    return a.y+a.height+2<=b.y;
  }).toBe(true);
  const bounds=await bar(page).boundingBox(), viewport=page.viewportSize();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.x+bounds.width).toBeLessThanOrEqual(viewport.width);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const quantity=await big.locator('..').locator('.entry-quantity').boundingBox();
  const mark=await big.locator('.deck-selection-mark').boundingBox();
  expect(mark.x).toBeGreaterThan(quantity.x+quantity.width);
  await expect(page.locator('#toast')).not.toHaveClass(/\bvisible\b/);
  await page.screenshot({path:testInfo.outputPath('selection-enlarged.png')});
  const filter=page.getByRole('searchbox',{name:'Filter cards'});
  await filter.fill('Shimmering Isles');
  await expect(bar(page).getByRole('status')).toHaveText('2 entries · 5 copies selected');
  const main=page.locator('.deck-zone[data-drop-zone="main"]');
  await main.getByRole('button',{name:/^Creature ·/}).click();
  await expect(bar(page).getByRole('status')).toHaveText('1 entry · 3 copies selected');
  await main.getByRole('button',{name:/^Creature ·/}).click();
  await expect(regular).toHaveAttribute('aria-pressed','false');
  await bar(page).getByRole('button',{name:'Clear selection',exact:true}).click();
  await expect(bar(page)).toBeHidden();
  await expect(card(page,'Sideboard')).toBeFocused();
  await activate(regular);
  await bar(page).getByRole('button',{name:'Done',exact:true}).click();
  await expect(mode(page)).toHaveValue('default');
  await mode(page).selectOption('select');
  await activate(regular);
  await page.getByRole('tab',{name:'Statistics',exact:true}).click();
  await page.getByRole('tab',{name:'Cards',exact:true}).click();
  await expect(mode(page)).toHaveValue('default');
  await expect(bar(page)).toBeHidden();
  expect(await read(page)).toEqual(before);
});

test('selected cards can create or join a function and move with exact-variant merging',async({page})=>{
  const before=await read(page);
  await mode(page).selectOption('select');
  await card(page,'Main deck').click();
  await card(page,'Main deck','Foil').click();
  await openAction(page,'Assign to function…');
  const dialog=page.getByRole('dialog');
  const functions=dialog.getByRole('combobox',{name:'Function',exact:true});
  await functions.selectOption('new');
  await dialog.getByRole('textbox',{name:'New function name'}).fill('New priority');
  await dialog.getByRole('button',{name:'Assign function',exact:true}).click();
  await expect(dialog).toBeHidden();
  await card(page,'Main deck').click();
  await openAction(page,'Assign to function…');
  await functions.selectOption({label:'Side function'});
  await dialog.getByRole('button',{name:'Assign function',exact:true}).click();
  await card(page,'Main deck').click();
  await card(page,'Main deck','Foil').click();
  await openAction(page,'Move to zone…');
  await dialog.getByRole('combobox',{name:'Destination zone'}).selectOption('sideboard');
  await expect(dialog.getByRole('status')).toHaveText('Move 3 copies to Sideboard.');
  await dialog.getByRole('button',{name:'Move cards',exact:true}).click();
  await expect(dialog).toBeHidden();
  const after=await read(page);
  const matches=after.decks[0].cards.filter(entry=>entry.card.name===longName);
  expect(matches.map(entry=>[entry.zone,entry.finish,entry.qty,entry.tags])).toEqual([
    ['sideboard','foil',1,['New priority','Foil group']],['sideboard','regular',5,['Side function','New priority','Draw','Ramp']]]);
  expect(after.collection).toEqual(before.collection);
  expect(after.decks[0].cards.filter(entry=>entry.card.name!==longName)).toEqual(before.decks[0].cards.filter(entry=>entry.card.name!==longName));
});

test('collection and removal actions stage only the reviewed copies and retry without duplicate writes',async({page},testInfo)=>{
  const before=await read(page);
  await mode(page).selectOption('select');
  await card(page,'Main deck').click();
  await card(page,'Main deck','Foil').click();
  await openAction(page,'Add to Collection…');
  const dialog=page.getByRole('dialog');
  await expect(dialog).toContainText('2 entries · 3 copies selected');
  await expect(dialog).toContainText('condition unrecorded');
  await page.evaluate(()=>{
    const write=Storage.prototype.setItem;window.allowBatchSave=false;
    Storage.prototype.setItem=function(key,value){if(key==='arcana.workspace.v2'&&!window.allowBatchSave)throw new DOMException('Quota','QuotaExceededError');return write.call(this,key,value);};
  });
  await dialog.getByRole('button',{name:'Add copies',exact:true}).click();
  await expect(dialog.getByRole('alert')).toContainText('Could not save Collection');
  expect(await read(page)).toEqual(before);
  await page.evaluate(()=>{window.allowBatchSave=true;});
  await dialog.getByRole('button',{name:'Add copies',exact:true}).click();
  await expect(dialog).toBeHidden();
  const added=await read(page);
  expect(added.decks).toEqual(before.decks);
  expect(added.collection.map(lot=>[lot.finish,lot.qty,lot.condition])).toEqual([
    ['regular',1,'near_mint'],['foil',3,undefined],['regular',2,undefined]]);
  await card(page,'Main deck','Foil').click();
  await openAction(page,'Remove from deck…');
  await expect(dialog).toContainText('Main deck · 1 copy');
  await expect(dialog.getByRole('button',{name:'Keep cards',exact:true})).toBeFocused();
  await page.screenshot({path:testInfo.outputPath('selection-removal.png')});
  await page.keyboard.press('Escape');
  expect(await read(page)).toEqual(added);
  await openAction(page,'Remove from deck…');
  await dialog.getByRole('button',{name:'Remove copies',exact:true}).click();
  await page.reload();
  const after=await read(page);
  const withoutRefresh=entries=>entries.map(({card:{legalityUpdatedAt,...card},...entry})=>({...entry,card}));
  expect(withoutRefresh(after.decks[0].cards)).toEqual(withoutRefresh(before.decks[0].cards.filter(entry=>!(entry.zone==='main'&&entry.finish==='foil'))));
  expect(after.collection).toEqual(added.collection);
});
