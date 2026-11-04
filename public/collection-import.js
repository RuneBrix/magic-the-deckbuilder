import { parseImport } from './deck-import.js';

export function readCollectionCsv(text) {
  const rows=[];let row=[],field='',quoted=false,closed=false;
  for(let i=0;i<=text.length;i++){
    const ch=text[i];
    if(quoted){if(ch===undefined)throw Error('Unclosed CSV quote.');if(ch==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=ch;continue;}
    if(ch==='"'){if(field||closed)throw Error('Unexpected CSV quote.');quoted=true;continue;}
    if(ch===','||ch==='\n'||ch==='\r'||ch===undefined){row.push(field);field='';closed=false;if(ch!==','){if(row.some(value=>value.trim()))rows.push(row);row=[];if(ch==='\r'&&text[i+1]==='\n')i++;}continue;}
    if(closed){if(ch===' '||ch==='\t')continue;throw Error('Unexpected text after CSV quote.');}field+=ch;
  }
  return rows;
}
export const COLLECTION_COLUMNS=['Quantity','Name','Finish','Condition','Language','Edition Name'];
const collectionColumnGroups=[['quantity','qty'],['name','card name'],['finish','foil'],['condition'],['language','lang'],['edition name','set name','edition code','set code','edition','set']];
export function prepareCollectionUpload(text,mapping=null) {
  if(typeof text!=='string'||text.length>15_000_000)throw Error('Upload a text or CSV file up to 15 MB.');
  const source=text.replace(/^\uFEFF/,'').trim();if(!source)throw Error('Choose a file or paste card data.');
  const first=source.split(/\r?\n/,1)[0],csv=first.includes(',')&&!/^\d+x?\s+/.test(first);
  if(!csv){
    const rows=[],skipped=[];const lines=source.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);if(lines.length>5100)throw Error('Maximum 5000 card rows.');
    for(const line of lines){try{if(/^(Main deck|Mainboard|Sideboard|Command zone|Commander|Maybeboard):?$/i.test(line))throw Error('Zone heading');rows.push(...parseCollectionImport(line));}catch{skipped.push(line);}}
    if(!rows.length)throw Error('No valid card rows. Use a quantity followed by a card name.');
    if(rows.length>5000)throw Error('Maximum 5000 card rows.');return {rows,skipped,accepted:['Quantity','Name'],ignored:[]};
  }
  const records=readCollectionCsv(source);if(records.length>5001)throw Error('Maximum 5000 card rows.');
  const normalize=value=>value.trim().toLowerCase().replace(/[_-]/g,' ');
  const headers=records[0]||[],hasHeaders=collectionColumnGroups.slice(0,2).every(group=>headers.some(h=>group.includes(normalize(h))));
  if(!hasHeaders&&!mapping)return {needsMapping:true,preview:records.slice(0,3),width:headers.length,suggestHeaders:!/^\d+$/.test(headers[0]||'')};
  const columns=mapping?mapping.columns:headers;
  if(!Array.isArray(columns)||columns.length!==headers.length)throw Error('Map every CSV column.');
  const actualHeaders=mapping?columns.map(value=>value||'Ignored'):headers;
  if(!collectionColumnGroups.slice(0,2).every(group=>actualHeaders.some(h=>group.includes(normalize(h)))))throw Error('Assign one Quantity column and one Name column before checking syntax.');
  const data=mapping&&!mapping.header?records:records.slice(1);
  const encode=values=>values.map(value=>'"'+String(value).replaceAll('"','""')+'"').join(',');
  const rows=parseCollectionImport([encode(actualHeaders),...data.map(encode)].join('\n'));
  const accepted=actualHeaders.filter(h=>collectionColumnGroups.some(group=>group.includes(normalize(h))));
  const ignored=actualHeaders.flatMap((h,i)=>collectionColumnGroups.some(group=>group.includes(normalize(h)))?[]:[mapping?(mapping.header?headers[i]:'Column '+(i+1)):h]);
  return {rows,skipped:[],accepted,ignored};
}
export function parseCollectionImport(text) {
  if(typeof text!=='string'||text.length>15_000_000)throw Error('Collection import exceeds 15 MB.');
  const source=text.replace(/^\uFEFF/,'');
  const header=source.split(/\r?\n/,1)[0];
  if(!/(?:^|,)\s*"?(?:quantity|qty)"?\s*(?:,|$)/i.test(header)||!/(?:^|,)\s*"?(?:name|card name)"?\s*(?:,|$)/i.test(header))return parseImport(source).map(row=>({...row,finish:'regular'}));
  const rows=readCollectionCsv(source);
  const headers=rows.shift()?.map(value=>value.trim().toLowerCase().replace(/[_-]/g,' '));
  if(!headers||!rows.length||rows.length>5000)throw Error('Import 1–5000 CSV rows.');
  const column=(...names)=>headers.findIndex(h=>names.includes(h));
  const cols={qty:column('quantity','qty'),name:column('name','card name'),finish:column('finish','foil'),condition:column('condition'),language:column('language','lang'),set:column('edition name','set name','edition code','set code','edition','set')};
  if(cols.qty<0||cols.name<0)throw Error('CSV needs Quantity and Name columns.');
  for(const names of [['quantity','qty'],['name','card name'],['finish','foil'],['condition'],['language','lang'],['edition name','set name','edition code','set code','edition','set']])if(headers.filter(h=>names.includes(h)).length>1)throw Error('Duplicate or conflicting CSV columns: '+names.join(' / '));
  const finishes={normal:'regular',regular:'regular',nonfoil:'regular','non-foil':'regular',false:'regular',no:'regular','0':'regular',foil:'foil',true:'foil',yes:'foil','1':'foil',etched:'etched','etched foil':'etched','foil etched':'etched'};
  const conditions={nm:'near_mint',mint:'near_mint','near mint':'near_mint',lp:'lightly_played','lightly played':'lightly_played',mp:'moderately_played','moderately played':'moderately_played',hp:'heavily_played','heavily played':'heavily_played',damaged:'damaged',dmg:'damaged',d:'damaged'};
  const languages={english:'en',german:'de',french:'fr',italian:'it',spanish:'es',portuguese:'pt',japanese:'ja',korean:'ko',russian:'ru','simplified chinese':'zhs','traditional chinese':'zht',hebrew:'he',latin:'la',greek:'grc',arabic:'ar',sanskrit:'sa',phyrexian:'ph'};
  return rows.map((values,index)=>{
    const get=key=>cols[key]<0?'':(values[cols[key]]||'').trim(),label='CSV row '+(index+2)+': ';
    if(values.length!==headers.length)throw Error(label+'column count differs from header.');
    const qty=Number(get('qty')),name=get('name');if(!/^\d+$/.test(get('qty'))||!Number.isInteger(qty)||qty<1||qty>9999||!name)throw Error(label+'invalid quantity or name.');
    const finish=finishes[get('finish').toLowerCase()||'normal'];if(!finish)throw Error(label+'unknown finish '+get('finish'));
    const rawCondition=get('condition').toLowerCase().replace(/_/g,' '),condition=rawCondition?conditions[rawCondition]:undefined;if(rawCondition&&!condition)throw Error(label+'unknown condition '+get('condition'));
    const rawLanguage=get('language').toLowerCase(),language=languages[rawLanguage]||rawLanguage;if(language&&!['en','de','fr','it','es','pt','ja','ko','ru','zhs','zht','he','la','grc','ar','sa','ph'].includes(language))throw Error(label+'unknown language '+get('language'));
    return {name,qty,finish,...(condition?{condition}:{}),...(language?{language}:{}),...(get('set')?{set:get('set')}:{})};
  });
}
