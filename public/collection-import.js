import { parseImport } from './deck-import.js';

export function readCollectionCsv(text) {
  return readDelimitedRecords(text,',','CSV').map(record=>record.values);
}
function readDelimitedRecords(text,separator,label) {
  const records=[];
  let row=[],field='',quoted=false,closed=false,line=1,start=1;
  const quoteError=(csvMessage,detail)=>Error(label==='CSV'?csvMessage:`${label} row ${start}: ${detail}`);
  for(let i=0;i<=text.length;i++){
    const ch=text[i];
    if(quoted){
      if(ch===undefined)throw quoteError('Unclosed CSV quote.','A quoted field has no closing quote.');
      if(ch==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}
      else {
        field+=ch;
        if(ch==='\n'||ch==='\r'&&text[i+1]!=='\n')line++;
      }
      continue;
    }
    if(ch==='"'){if(field||closed)throw quoteError('Unexpected CSV quote.','Unexpected quote in a field.');quoted=true;continue;}
    if(ch===separator||ch==='\n'||ch==='\r'||ch===undefined){
      row.push(field);field='';closed=false;
      if(ch!==separator){
        if(row.some(value=>value.trim()))records.push({values:row,line:start,endLine:line});
        row=[];
        if(ch==='\r'&&text[i+1]==='\n')i++;
        start=++line;
      }
      continue;
    }
    if(closed){if(ch===' '||ch==='\t')continue;throw quoteError('Unexpected text after CSV quote.','Unexpected text after a closing quote.');}field+=ch;
  }
  return records;
}
export const COLLECTION_COLUMNS=['Quantity','Name','Finish','Condition','Language','Edition Name','Collector Number'];
const collectionColumnGroups=[['quantity','qty','count','quantity owned'],['name','card name','card'],['finish','foil'],['condition'],['language','lang'],['edition name','set name','edition code','set code','edition','set','expansion'],['collector number','collector no','card number']];
const normalizeColumn = value => value.trim().toLowerCase().replace(/[_\s-]+/g, ' ');
const columnGroup = value => collectionColumnGroups.findIndex(group => group.includes(normalizeColumn(value)));
const hasRequiredColumns = columns => [0,1].every(group=>columns.some(h=>columnGroup(h)===group));
export const normalizeEdition = value => value.normalize('NFKC').replace(/[’‘]/g, "'").trim().replace(/\s+/g, ' ').toLowerCase();
export function collectionUploadFormat(text) {
  const [,first='',second=''] = text.trimStart().match(/^([^\r\n]+)(?:[\r\n][ \t\r\n]*([^\r\n]+))?/) ?? [];
  const sample = first.trimEnd().replace(/"(?:[^"]|"")*"/g, field=>field.replaceAll('\t',' '));
  const tabs = sample.split('\t');
  const headings = fields => hasRequiredColumns(fields.map(field=>field.trim().replace(/^"|"$/g,'')));
  if (tabs.length>1 && headings(tabs)) return 'tsv';
  if (first.includes(',')&&headings(first.split(','))) return 'csv';
  if (second.includes('\t')&&headings(second.split('\t'))) return 'tsv';
  if (/^\s*(?:\d+|"\d+")[ \t]*,/.test(first)) return 'csv';
  if (tabs.length>1 && first.includes(',') && !sample.replace(/[ \t]*,[ \t]*/g,',').includes('\t')) return 'csv';
  if (tabs.length>2 || tabs.length===2&&(!/^\d+x?$/i.test(tabs[0].trim())||tabs[1].trimStart().startsWith('"'))) return 'tsv';
  return first.includes(',')&&!/^\d+x?\s+/.test(first) ? 'csv' : 'txt';
}
export function prepareCollectionUpload(text,mapping=null,editMapping=false) {
  if(typeof text!=='string'||text.length>15_000_000)throw Error('Upload a text or CSV file up to 15 MB.');
  const source=text.replace(/^\uFEFF/,'');if(!source.trim())throw Error('Choose a file or paste card data.');
  const format=collectionUploadFormat(source);
  if(format==='txt'){
    const rows=[],skipped=[];const lines=source.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);if(lines.length>5100)throw Error('Maximum 5000 card rows.');
    for(const line of lines){
      try{
        const [,cardLine,set,collectorNumber]=line.match(/^(\d+x?\s+.+?)\s+\(([a-z0-9]{2,8})\)(?:\s+(\S+))?$/i)??[];
        const [row]=parseCollectionImport(cardLine??line);
        if(!row||row.zone)throw Error('Expected a card row.');
        rows.push({...row,finishUnspecified:true,...(set?{set}:{}),...(collectorNumber?{collectorNumber}:{})});
      }catch{skipped.push(line);}
    }
    if(!rows.length)throw Error('No valid card rows. Use a quantity followed by a card name.');
    if(rows.length>5000)throw Error('Maximum 5000 card rows.');
    const accepted=['Quantity','Name'];
    if(rows.some(row=>row.set))accepted.push('Set');
    if(rows.some(row=>row.collectorNumber))accepted.push('Collector number');
    return {rows,skipped,accepted,ignored:[]};
  }
  const csv=format==='csv',label=csv?'CSV':'Tab-separated';
  const records=readDelimitedRecords(csv?source.trim():source,csv?',':'\t',label);
  if(csv&&records.length>5001)throw Error('Maximum 5000 card rows.');
  const headerIndex=csv?0:records.findIndex(record=>record.values.length>1);
  const headers=records[headerIndex]?.values ?? [];
  const hasHeaders=hasRequiredColumns(headers);
  const hasNumericCell=headers.some(h=>/^\d+$/.test(h.trim()));
  const suggestHeaders=hasHeaders||!hasNumericCell||csv&&headers.some(h=>columnGroup(h)>=0);
  const mappingOptions={
    format,preview:records.slice(headerIndex,headerIndex+3).map(record=>record.values),width:headers.length,suggestHeaders,
    suggestedColumns:headers.map(h=>suggestHeaders?(COLLECTION_COLUMNS[columnGroup(h)]||''):(/^\d+$/.test(h.trim())?'Quantity':'')),
  };
  if(editMapping||!hasHeaders&&!mapping)return {needsMapping:true,...mappingOptions};
  const columns=mapping?mapping.columns:headers;
  if(!Array.isArray(columns)||columns.length!==headers.length)throw Error('Map every '+label+' column.');
  const actualHeaders=mapping?columns.map(value=>value||'Ignored'):headers;
  if(!hasRequiredColumns(actualHeaders))throw Error('Assign one Quantity column and one Name column before checking syntax.');
  const withHeader=mapping?.header??true;
  const accepted=actualHeaders.filter(h=>columnGroup(h)>=0);
  const ignored=actualHeaders.flatMap((h,i)=>columnGroup(h)>=0?[]:[mapping?(mapping.header?headers[i]:'Column '+(i+1)):h]);
  if(csv){
    const firstRow=withHeader?2:1;
    const rows=parseCollectionRecords(actualHeaders,records.slice(firstRow-1).map(record=>record.values),firstRow,true);
    return {rows,skipped:[],accepted,ignored,format,firstRow};
  }

  const parse=collectionRecordParser(actualHeaders,label,true);
  const isHeader=record=>withHeader&&record?.values.length===headers.length&&record.values.every((value,i)=>normalizeColumn(value)===normalizeColumn(headers[i]));
  const arcanaHeadings=withHeader&&headers.some(value=>normalizeColumn(value)==='card name')&&hasHeaders;
  const rows=[],skipped=[],rowNumbers=[];
  for(const [i,record] of records.entries()){
    const {values,line}=record;
    if((withHeader&&i===headerIndex)||isHeader(record))continue;
    // Sectioned Arcana exports put a title before each (repeated) header.
    if(arcanaHeadings&&values.length===1&&isHeader(records[i+1])&&(i===0||line>records[i-1].endLine+1))continue;
    if(rows.length+skipped.length===5000)throw Error('Maximum 5000 card rows.');
    try{rows.push(parse(values,line));rowNumbers.push(line);}
    catch(error){skipped.push(error.message+' · '+values.join(' / ').slice(0,160));}
  }
  if(!rows.length)throw Error(skipped[0]||'No card rows after the column headings.');
  return {rows,skipped,accepted,ignored,format,rowNumbers};
}
export function parseCollectionImport(text) {
  if(typeof text!=='string'||text.length>15_000_000)throw Error('Collection import exceeds 15 MB.');
  const source=text.replace(/^\uFEFF/,'');
  const first=source.trimStart().split(/\r?\n/,1)[0];
  if(!first.includes(',')||/^\d+x?\s+/.test(first))return parseImport(source).map(row=>({...row,finish:'regular'}));
  const [headers,...rows]=readCollectionCsv(source);
  return parseCollectionRecords(headers||[],rows,2);
}
function parseCollectionRecords(headers,rows,firstRow,upload=false) {
  if(!rows.length||rows.length>5000)throw Error('Import 1–5000 CSV rows.');
  const parse=collectionRecordParser(headers,'CSV',upload);
  return rows.map((values,index)=>parse(values,index+firstRow));
}
function collectionRecordParser(headers,label,upload) {
  const groups=headers.map(columnGroup);
  const [qty,name,finish,condition,language,set,collectorNumber]=collectionColumnGroups.map((_,i)=>groups.indexOf(i));
  const cols={qty,name,finish,condition,language,set,collectorNumber};
  if(cols.qty<0||cols.name<0)throw Error(label+' needs Quantity and Name columns.');
  for(const [index,names] of collectionColumnGroups.entries())if(groups.indexOf(index)!==groups.lastIndexOf(index))throw Error('Duplicate or conflicting '+label+' columns: '+names.join(' / '));
  const finishes={normal:'regular',regular:'regular',nonfoil:'regular','non-foil':'regular',false:'regular',no:'regular','0':'regular',foil:'foil',true:'foil',yes:'foil','1':'foil',etched:'etched','etched foil':'etched','foil etched':'etched'};
  const conditions={nm:'near_mint',mint:'near_mint','near mint':'near_mint',lp:'lightly_played','lightly played':'lightly_played',mp:'moderately_played','moderately played':'moderately_played',hp:'heavily_played','heavily played':'heavily_played',damaged:'damaged',dmg:'damaged',d:'damaged'};
  const languages={english:'en',german:'de',french:'fr',italian:'it',spanish:'es',portuguese:'pt',japanese:'ja',korean:'ko',russian:'ru','simplified chinese':'zhs','traditional chinese':'zht',hebrew:'he',latin:'la',greek:'grc',arabic:'ar',sanskrit:'sa',phyrexian:'ph'};
  return (values,line)=>{
    const get=key=>cols[key]<0?'':(values[cols[key]]||'').trim(),prefix=label+' row '+line+': ';
    if(values.length!==headers.length)throw Error(prefix+'expected '+headers.length+' columns, found '+values.length+(label==='CSV'?'. Check for missing fields or quote values that contain commas.':'. Check the tabs between fields.'));
    const qty=Number(get('qty')),name=get('name');if(!/^\d+$/.test(get('qty'))||!Number.isInteger(qty)||qty<1||qty>9999||!name)throw Error(prefix+'invalid quantity or name.');
    const finish=finishes[get('finish').toLowerCase()||'normal'];if(!finish)throw Error(prefix+'unknown finish '+get('finish'));
    const rawCondition=get('condition').toLowerCase().replace(/_/g,' '),condition=rawCondition?conditions[rawCondition]:undefined;if(rawCondition&&!condition)throw Error(prefix+'unknown condition '+get('condition'));
    const rawLanguage=get('language').toLowerCase(),language=languages[rawLanguage]||rawLanguage;if(language&&!['en','de','fr','it','es','pt','ja','ko','ru','zhs','zht','he','la','grc','ar','sa','ph'].includes(language))throw Error(prefix+'unknown language '+get('language'));
    const number=get('collectorNumber');
    if(number&&!get('set'))throw Error(prefix+'include a set with the collector number.');
    return {name,qty,finish,...(upload&&!get('finish')?{finishUnspecified:true}:{}),...(number?{collectorNumber:number}:{}),...(condition?{condition}:{}),...(language?{language}:{}),...(get('set')?{set:get('set')}:{})};
  };
}
