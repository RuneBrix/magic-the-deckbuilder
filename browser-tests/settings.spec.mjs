import { test, expect } from '@playwright/test';
import { prepareApp } from './fixtures.mjs';

const palettes=['green','blue','white','orange','rose','teal','sepia'];
test.beforeEach(async({page})=>prepareApp(page));
const settings=page=>page.getByRole('button',{name:'Settings',exact:true});
const noOverflow=async page=>expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);

async function checkColors(page) {
  const pairs=await page.evaluate(()=>{
    const css=getComputedStyle(document.documentElement),color=name=>css.getPropertyValue('--'+name).trim();
    const luminance=value=>{
      const hex=value.replace('#','');
      const expanded=hex.length===3?[...hex].map(c=>c+c).join(''):hex;
      const rgb=expanded.match(/../g).map(c=>parseInt(c,16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
      return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
    };
    const ratio=(a,b)=>{const l=[luminance(color(a)),luminance(color(b))].sort((x,y)=>y-x);return (l[0]+.05)/(l[1]+.05);};
    return [
      ...['ground','surface','soft'].flatMap(bg=>['ink','muted','accent'].map(fg=>[fg,bg,ratio(fg,bg),4.5])),
      ...['accent','hover'].map(bg=>['on-accent',bg,ratio('on-accent',bg),4.5]),
      ...['warning','danger','success'].map(fg=>[fg,fg+'-bg',ratio(fg,fg+'-bg'),4.5]),
      ...['ground','surface','soft'].map(bg=>['focus',bg,ratio('focus',bg),3]),
      ['curve','surface',ratio('curve','surface'),3],
    ];
  });
  for(const [fg,bg,ratio,min] of pairs)expect(ratio,`${fg}/${bg}`).toBeGreaterThanOrEqual(min);
  return pairs;
}

test('Settings returns to every workflow and keeps deck, search and collection state',async({page})=>{
  const original=await page.evaluate(()=>JSON.parse(localStorage.getItem('arcana.workspace.v2')).collection);
  for(const name of ['My decks','Search cards','Collection']) {
    await page.getByRole('button',{name,exact:true}).click();
    if(name==='Search cards')await page.locator('#raw').fill('t:creature');
    await settings(page).press('Enter');
    await expect(page.locator('#settings-title')).toBeFocused();
    await expect(settings(page)).toHaveAttribute('aria-current','page');
    await expect(page.getByRole('dialog')).not.toBeVisible();
    await page.getByRole('button',{name:'Back to '+name,exact:true}).click();
    if(name==='Search cards')await expect(page.locator('#raw')).toHaveValue('t:creature');
    await expect(settings(page)).toBeFocused();
  }
  await page.getByRole('button',{name:'My decks',exact:true}).click();
  await page.getByRole('button',{name:'Smoke Garden',exact:true}).click();
  await page.getByRole('tab',{name:'Statistics',exact:true}).click();
  await settings(page).click();
  await settings(page).click(); // Re-entering Settings must not lose its return target.
  await page.getByRole('button',{name:'Back to Smoke Garden',exact:true}).click();
  await expect(page.getByRole('tab',{name:'Statistics',exact:true})).toHaveAttribute('aria-selected','true');
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('arcana.workspace.v2')).collection)).toEqual(original);
});

test('all fourteen appearance palettes cover pages, forms, dialogs, charts and focus',async({page},testInfo)=>{
  const evidence=[];
  await page.getByRole('button',{name:'Smoke Garden',exact:true}).click();
  const manaColor=await page.locator('.mana-G').first().evaluate(el=>[getComputedStyle(el).color,getComputedStyle(el).backgroundColor]);
  for(const theme of ['light','dark'])for(const palette of palettes) {
    await settings(page).click();
    await page.locator('#theme').selectOption(theme);
    await page.locator('#palette').selectOption(palette);
    await expect(page.locator('html')).toHaveAttribute('data-palette',palette);
    await expect(page.locator('#palette option')).toHaveCount(7);
    await page.locator('#palette').focus();
    evidence.push({theme,palette,pairs:await checkColors(page)});
    await noOverflow(page);
    await page.screenshot({path:testInfo.outputPath(`settings-${theme}-${palette}.png`)});
    await page.getByRole('button',{name:'Back to Smoke Garden',exact:true}).click();
    await page.getByRole('tab',{name:'Statistics',exact:true}).click();
    await noOverflow(page);
    await page.getByRole('tab',{name:'Cards',exact:true}).click();
    expect(await page.locator('.mana-G').first().evaluate(el=>[getComputedStyle(el).color,getComputedStyle(el).backgroundColor])).toEqual(manaColor);
    await noOverflow(page);
    await page.getByRole('button',{name:'Help',exact:true}).click();
    const dialog=page.getByRole('dialog');
    await expect(dialog).toContainText('Welcome to Arcana');
    await expect(dialog).not.toContainText('snapshot');
    await dialog.locator('button').first().focus();
    await page.screenshot({path:testInfo.outputPath(`guide-${theme}-${palette}.png`)});
    await page.keyboard.press('Escape');
  }
  await testInfo.attach('palette-contrast',{body:JSON.stringify(evidence),contentType:'application/json'});
  await page.reload();await settings(page).click();
  await expect(page.locator('#theme')).toHaveValue('dark');
  await expect(page.locator('#palette')).toHaveValue('sepia');
  await page.locator('#theme').selectOption('light');
  await expect(page.locator('#palette')).toHaveValue('sepia');
  await page.locator('#theme').selectOption('dark');
  await expect(page.locator('#palette')).toHaveValue('sepia');
});

test('older palette preferences migrate and Settings backup controls reflow with enlarged text',async({page},testInfo)=>{
  const longName='A very long garden deck name with creatures, artifacts and enchantments for a collection of new ideas'.slice(0,100);
  await page.evaluate(name=>{
    localStorage.setItem('arcana.palette.v1','orange');localStorage.setItem('arcana.theme.v1','dark');
    const data=JSON.parse(localStorage.getItem('arcana.workspace.v2'));data.decks[0].name=name;
    localStorage.setItem('arcana.workspace.v2',JSON.stringify(data));
  },longName);
  await page.reload();await settings(page).click();
  await expect(page.locator('#palette')).toHaveValue('orange');
  await page.locator('#theme').selectOption('light');
  await expect(page.locator('#palette')).toHaveValue('green');
  await page.locator('#palette').selectOption('blue');
  await page.reload();await settings(page).click();
  await expect(page.locator('#palette')).toHaveValue('blue');
  await page.locator('#theme').selectOption('dark');
  await expect(page.locator('#palette')).toHaveValue('orange');
  await page.getByRole('button',{name:'Back to My decks',exact:true}).click();
  await page.getByRole('button',{name:longName,exact:true}).click();
  await settings(page).click();
  await page.addStyleTag({content:':root{font-size:28px} .settings-page :is(p,label,button,select,summary){font-size:1rem}'});
  expect(await page.locator('.settings-page p').first().evaluate(el=>getComputedStyle(el).fontSize)).toBe('28px');
  await noOverflow(page);
  await page.getByRole('button',{name:'Back to '+longName,exact:true}).focus();
  await page.screenshot({path:testInfo.outputPath('settings-long-return.png')});
  await page.locator('.backup-help summary').press('Enter');
  await page.locator('.backup-help p').last().scrollIntoViewIfNeeded();
  await noOverflow(page);
  await page.locator('#settings-backup').scrollIntoViewIfNeeded();
  const download=page.waitForEvent('download');
  await page.locator('#settings-backup').press('Enter');
  await download;
  await expect(page.locator('#backup-status')).toContainText('No further workspace changes');
  await page.locator('#settings-restore').click();
  await expect(page.getByRole('dialog')).toContainText('Open a workspace file');
  await page.locator('#backup-file').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from('{}')});
  await expect(page.locator('#restore-error')).not.toBeEmpty();
  await page.screenshot({path:testInfo.outputPath('settings-file-error.png')});
  await page.keyboard.press('Escape');
  await expect(page.locator('#settings-restore')).toBeFocused();
  await page.screenshot({path:testInfo.outputPath('settings-enlarged.png')});
});
