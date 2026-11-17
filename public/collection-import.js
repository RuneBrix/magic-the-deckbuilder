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
const collectionColumnGroups=[['quantity','qty','count','quantity owned'],['name','card name','card'],['finish','foil'],['condition'],['language','lang'],['edition name','set name','edition code','set code','edition','set','expansion']];
const normalizeColumn = value => value.trim().toLowerCase().replace(/[_\s-]+/g, ' ');
const columnGroup = value => collectionColumnGroups.findIndex(group => group.includes(normalizeColumn(value)));
export const normalizeEdition = value => value.normalize('NFKC').replace(/[’‘]/g, "'").trim().replace(/\s+/g, ' ').toLowerCase();
export function prepareCollectionUpload(text,mapping=null,editMapping=false) {
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
  const headers=records[0]||[];
  const hasHeaders=[0,1].every(group=>headers.some(h=>columnGroup(h)===group));
  const suggestHeaders=headers.some(h=>columnGroup(h)>=0)||!headers.some(h=>/^\d+$/.test(h.trim()));
  const mappingOptions={
    preview:records.slice(0,3),width:headers.length,suggestHeaders,
    suggestedColumns:headers.map(h=>suggestHeaders?(COLLECTION_COLUMNS[columnGroup(h)]||''):(/^\d+$/.test(h.trim())?'Quantity':'')),
  };
  if(editMapping||!hasHeaders&&!mapping)return {needsMapping:true,...mappingOptions};
  const columns=mapping?mapping.columns:headers;
  if(!Array.isArray(columns)||columns.length!==headers.length)throw Error('Map every CSV column.');
  const actualHeaders=mapping?columns.map(value=>value||'Ignored'):headers;
  if(![0,1].every(group=>actualHeaders.some(h=>columnGroup(h)===group)))throw Error('Assign one Quantity column and one Name column before checking syntax.');
  const data=mapping&&!mapping.header?records:records.slice(1);
  const rows=parseCollectionRecords(actualHeaders,data,mapping?.header===false?1:2);
  const accepted=actualHeaders.filter(h=>columnGroup(h)>=0);
  const ignored=actualHeaders.flatMap((h,i)=>columnGroup(h)>=0?[]:[mapping?(mapping.header?headers[i]:'Column '+(i+1)):h]);
  return {rows,skipped:[],accepted,ignored,csv:true,firstRow:mapping?.header===false?1:2};
}
export function parseCollectionImport(text) {
  if(typeof text!=='string'||text.length>15_000_000)throw Error('Collection import exceeds 15 MB.');
  const source=text.replace(/^\uFEFF/,'');
  const first=source.trimStart().split(/\r?\n/,1)[0];
  if(!first.includes(',')||/^\d+x?\s+/.test(first))return parseImport(source).map(row=>({...row,finish:'regular'}));
  const [headers,...rows]=readCollectionCsv(source);
  return parseCollectionRecords(headers||[],rows,2);
}
function parseCollectionRecords(headers,rows,firstRow) {
  if(!rows.length||rows.length>5000)throw Error('Import 1–5000 CSV rows.');
  const groups=headers.map(columnGroup);
  const [qty,name,finish,condition,language,set]=collectionColumnGroups.map((_,i)=>groups.indexOf(i));
  const cols={qty,name,finish,condition,language,set};
  if(cols.qty<0||cols.name<0)throw Error('CSV needs Quantity and Name columns.');
  for(const [index,names] of collectionColumnGroups.entries())if(groups.indexOf(index)!==groups.lastIndexOf(index))throw Error('Duplicate or conflicting CSV columns: '+names.join(' / '));
  const finishes={normal:'regular',regular:'regular',nonfoil:'regular','non-foil':'regular',false:'regular',no:'regular','0':'regular',foil:'foil',true:'foil',yes:'foil','1':'foil',etched:'etched','etched foil':'etched','foil etched':'etched'};
  const conditions={nm:'near_mint',mint:'near_mint','near mint':'near_mint',lp:'lightly_played','lightly played':'lightly_played',mp:'moderately_played','moderately played':'moderately_played',hp:'heavily_played','heavily played':'heavily_played',damaged:'damaged',dmg:'damaged',d:'damaged'};
  const languages={english:'en',german:'de',french:'fr',italian:'it',spanish:'es',portuguese:'pt',japanese:'ja',korean:'ko',russian:'ru','simplified chinese':'zhs','traditional chinese':'zht',hebrew:'he',latin:'la',greek:'grc',arabic:'ar',sanskrit:'sa',phyrexian:'ph'};
  return rows.map((values,index)=>{
    const get=key=>cols[key]<0?'':(values[cols[key]]||'').trim(),label='CSV row '+(index+firstRow)+': ';
    if(values.length!==headers.length)throw Error(label+'expected '+headers.length+' columns, found '+values.length+'. Check for missing fields or quote values that contain commas.');
    const qty=Number(get('qty')),name=get('name');if(!/^\d+$/.test(get('qty'))||!Number.isInteger(qty)||qty<1||qty>9999||!name)throw Error(label+'invalid quantity or name.');
    const finish=finishes[get('finish').toLowerCase()||'normal'];if(!finish)throw Error(label+'unknown finish '+get('finish'));
    const rawCondition=get('condition').toLowerCase().replace(/_/g,' '),condition=rawCondition?conditions[rawCondition]:undefined;if(rawCondition&&!condition)throw Error(label+'unknown condition '+get('condition'));
    const rawLanguage=get('language').toLowerCase(),language=languages[rawLanguage]||rawLanguage;if(language&&!['en','de','fr','it','es','pt','ja','ko','ru','zhs','zht','he','la','grc','ar','sa','ph'].includes(language))throw Error(label+'unknown language '+get('language'));
    return {name,qty,finish,...(condition?{condition}:{}),...(language?{language}:{}),...(get('set')?{set:get('set')}:{})};
  });
}
