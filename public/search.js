// A bounded Scryfall projection, not a replacement for Scryfall's search language.
// Unknown expressions retain their source text; mixed Boolean groups lock affected controls.
export const SEARCH_FAMILIES = ['name','oracle','type','keyword','mv','color','identity','cost','legal','tags'];
export const COST_SYMBOLS = ['generic', ...'WUBRGCSXYZ', 'W/U','W/B','B/R','B/G','U/B','U/R','R/G','R/W','G/W','G/U','G/U/P','G/W/P',
  ...[...'WUBRG'].flatMap(color=>['C/'+color,'2/'+color,color+'/P']), 'C/P'];
export const MAX_COST_AMOUNT = 20;
const emptyColor = () => ({ mode: 'all', values: [] });
const defaults = () => ({ name:'', oracle:[], oracleMatch:'all', types:[], excludedTypes:[], typeMatch:'all', keywords:[], keywordMatch:'all', values:[], valueMatch:'all', color:emptyColor(), identity:emptyColor(), cost:[], costMatch:'all', legal:'', tags:[], match:'all' });
const unwrap = node => node?.kind === 'group' ? unwrap(node.child) : node;
const unique = values => [...new Set(values)];
const quote = value => JSON.stringify(value);
const chipValue = value => /^[\p{L}\p{N}][\p{L}\p{N} '!’.\-]*$/u.test(value);

function tokenize(source) {
  const tokens=[];
  for(let i=0;i<source.length;){
    if(/\s/.test(source[i])){i++;continue;}
    const start=i;
    if('()'.includes(source[i])){tokens.push({text:source[i++],start,end:i});continue;}
    let quoted=false, regex=false;
    while(i<source.length){
      const c=source[i];
      if((quoted||regex)&&c==='\\'){i+=2;continue;}
      if(!regex&&c==='"')quoted=!quoted;
      else if(!quoted&&c==='/'&&(regex||source[i-1]===':'))regex=!regex;
      if(!quoted&&!regex&&(/\s/.test(c)||'()'.includes(c)))break;
      i++;
    }
    if(quoted||regex)throw Error('Finish the quoted text or regular expression before searching.');
    const text=source.slice(start,i);
    if(/^(?:name|n|o|oracle|fo|fulloracle|t|type|-t|-type|kw|keyword|otag|f|format|c|color|id|identity):$/i.test(text)||/^-?(?:mv|cmc|manavalue|m|mana)[<>=!:]+$/i.test(text))throw Error('Finish the search condition before searching.');
    tokens.push({text,start,end:i});
  }
  return tokens;
}
function parse(source) {
  const tokens=tokenize(source);let position=0,depth=0;
  const peek=()=>tokens[position]?.text.toUpperCase();
  function factor(){
    const token=tokens[position++];if(!token||['AND','OR',')'].includes(token.text.toUpperCase()))throw Error('Add a condition on both sides of AND / OR.');
    if(token.text==='('){if(++depth>40)throw Error('Use fewer nested groups.');const child=or();if(peek()!==')')throw Error('Close the open parenthesis before searching.');const end=tokens[position++].end;depth--;return {kind:'group',child,start:token.start,end};}
    if(['NOT','-','!'].includes(token.text.toUpperCase())){const child=factor();return {kind:'not',child,start:token.start,end:child.end};}
    return {kind:'term',text:token.text,start:token.start,end:token.end};
  }
  function and(){const children=[factor()];while(position<tokens.length&&!['OR',')'].includes(peek())){if(peek()==='AND')position++;children.push(factor());}return children.length===1?children[0]:{kind:'and',children,start:children[0].start,end:children.at(-1).end};}
  function or(){const children=[and()];while(peek()==='OR'){position++;children.push(and());}return children.length===1?children[0]:{kind:'or',children,start:children[0].start,end:children.at(-1).end};}
  if(!tokens.length)return null;
  const root=or();if(position!==tokens.length)throw Error('Remove the unmatched closing parenthesis.');return root;
}
function textValue(value){if(value.startsWith('"')){try{return JSON.parse(value);}catch{return null;}}return /["/]/.test(value)?null:value;}
function costThreshold(text) {
  const match=text.match(/^(-?)(?:m|mana)>=(.+)$/i);
  if(!match)return null;
  const body=match[2].toUpperCase();
  const generic=body.match(/^\{([1-9]\d*)\}$|^([1-9]\d*)$/);
  const tokens=body.startsWith('{')?body.match(/\{[A-Z0-9/]+\}/g):[...body];
  if(!generic&&(!tokens||tokens.join('')!==body||!tokens.every(token=>token===tokens[0])))return null;
  const symbol=generic?'generic':tokens[0].replace(/[{}]/g,'');
  const op=match[1]?'<=':'>=';
  const amount=(generic?Number(generic[1]||generic[2]):tokens.length)-(match[1]?1:0);
  return COST_SYMBOLS.includes(symbol)&&amount<=MAX_COST_AMOUNT?{symbol,op,amount:String(amount)}:null;
}
function term(text){
  let m;
  if((m=text.match(/^(name|n|o|oracle|fo|fulloracle|-?t|-?type|kw|keyword|otag|f|format):(.+)$/i))){
    const value=textValue(m[2]);if(value===null||!value.trim())return null;
    const operator=m[1].toLowerCase();
    const family=({n:'name',o:'oracle',fo:'oracle',fulloracle:'oracle',t:'type','-t':'type','-type':'type',kw:'keyword',otag:'tags',f:'legal',format:'legal'})[operator]||operator;
    if(family==='oracle')return {family,mode:'all',values:[{mode:/^(fo|fulloracle)$/i.test(m[1])?'fo':'o',text:value}]};
    if(family==='tags'&&!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(value))return null;
    if(['type','keyword'].includes(family)&&!chipValue(value))return null;
    if(operator.startsWith('-'))return {family,mode:'all',values:[],excluded:[value.toLowerCase()]};
    return {family,mode:'all',values:[family==='name'?value:value.toLowerCase()]};
  }
  if((m=text.match(/^(?:mv|cmc|manavalue)(<=|>=|!=|=|<|>|:)(\d+(?:\.\d+)?)$/i)))return {family:'mv',mode:'all',values:[{op:m[1]===':'?'=':m[1],value:m[2]}]};
  if((m=text.match(/^(c|color|id|identity)(<=|>=|=|:)([wubrg]+|c|colorless|m|multicolor)$/i))){
    const value=m[3].toUpperCase(),family=/^(c|color)$/i.test(m[1])?'color':'identity';
    if(['C','COLORLESS','M','MULTICOLOR'].includes(value))return [':','='].includes(m[2])?{family,mode:value.startsWith('C')?'colorless':'multi',values:[]}:null;
    const mode=({'<=':'subset','>=':'all','=':'exact',':':family==='identity'?'subset':'all'})[m[2]];
    return {family,mode,values:unique([...value])};
  }
  const threshold=costThreshold(text);
  if(threshold)return {family:'cost',mode:'all',values:[threshold]};
  return null;
}
function combineTypes(parts, mode) {
  const positive = parts.filter(part => part.values.length);
  const excluded = unique(parts.flatMap(part => part.excluded || []));
  if (mode === 'any' && excluded.length) return null;
  if (mode === 'all' && positive.length === 1) mode = positive[0].mode;
  if (positive.some(part => part.mode !== mode && part.values.length > 1)) return null;
  return { family: 'type', mode, values: unique(positive.flatMap(part => part.values)), excluded };
}
function classify(node){
  node=unwrap(node);if(!node)return null;if(node.kind==='term')return term(node.text);if(!node.children)return null;
  const parts=node.children.map(classify);if(parts.some(p=>!p)||parts.some(p=>p.family!==parts[0].family))return null;
  const family=parts[0].family,mode=node.kind==='or'?'any':'all';
  if(family==='type')return combineTypes(parts,mode);
  if(['name','legal'].includes(family))return null;
  if(family==='cost'&&mode==='all'&&parts.length===2&&parts.every(part=>part.values.length===1)){
    const [lower,upper]=parts.map(part=>part.values[0]);
    if(lower.op==='>='&&upper.op==='<='&&lower.symbol===upper.symbol&&lower.amount===upper.amount){
      return {family,mode,values:[{...lower,op:'='}]};
    }
  }
  if(['color','identity'].includes(family)){
    if(parts.some(p=>p.mode!=='all'||(mode==='any'&&p.values.length!==1)))return null;
    return {family,mode,values:unique(parts.flatMap(p=>p.values))};
  }
  if(parts.some(p=>p.mode!==mode&&p.values.length>1))return null;
  return {family,mode,values:parts.flatMap(p=>p.values)};
}
function affected(node){
  if(node.kind==='term'){
    const text=node.text.replace(/^[-!]/,'');
    const known=term(text);if(known)return [known.family];
    const m=text.match(/^(name|n|o|oracle|fo|fulloracle|t|type|kw|keyword|otag|f|format|legal|c|color|id|identity|m|mana|mv|cmc|manavalue)(?:[<>=!:])/i);
    if(!m)return [];
    const key=m[1].toLowerCase();return [({n:'name',o:'oracle',fo:'oracle',fulloracle:'oracle',t:'type',kw:'keyword',otag:'tags',f:'legal',format:'legal',c:'color',id:'identity',m:'cost',mana:'cost',cmc:'mv',manavalue:'mv'})[key]||key];
  }
  return unique((node.children||[node.child]).filter(Boolean).flatMap(affected));
}

export function parseQuery(query='') {
  const result={...defaults(),query,locked:[],opaque:[],parts:[],error:''};
  try{
    if(query.length>1500)throw Error('Keep the query within 1,500 characters.');
    const parsed=parse(query),root=unwrap(parsed);if(!root)return result;
    const nodes=root.kind==='and'&&!(parsed.kind==='group'&&classify(parsed)?.family==='cost')?root.children:[parsed];
    result.parts=nodes.map(node=>({text:query.slice(node.start,node.end),or:node.kind==='or',condition:classify(node),affected:affected(node)}));
    const groups=new Map();
    for(const part of result.parts){if(part.condition){const key=part.condition.family;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(part.condition);}else result.locked.push(...part.affected);}
    for(const [family,parts] of groups){
      if(family==='type'){
        const type=combineTypes(parts,'all');
        if(!type){result.locked.push(family);continue;}
        result.types=type.values;result.excludedTypes=type.excluded;result.typeMatch=type.mode;
        continue;
      }
      const values=parts.flatMap(p=>p.values),mode=parts.length===1?parts[0].mode:'all';
      const multiple=parts.length>1;
      if(multiple&&(!['keyword','tags','mv','oracle','cost','color','identity'].includes(family)||parts.some(p=>p.mode!=='all'))){result.locked.push(family);continue;}
      if(family==='keyword'){result.keywords=unique(values);result.keywordMatch=mode;}
      else if(family==='tags'){result.tags=unique(values);result.match=mode;}
      else if(family==='mv'){result.values=values;result.valueMatch=mode;}
      else if(family==='oracle'){result.oracle=values;result.oracleMatch=mode;}
      else if(family==='color'||family==='identity')result[family]={mode,values};
      else if(family==='cost'){result.cost=values;result.costMatch=mode;}
      else result[family]=values[0];
    }
    result.locked=unique(result.locked);
    for(const family of result.locked){const blank=defaults();if(family==='type'){result.types=[];result.excludedTypes=[];result.typeMatch='all';}else if(family==='keyword'){result.keywords=[];result.keywordMatch='all';}else if(family==='mv'){result.values=[];result.valueMatch='all';}else result[family]=blank[family];}
    result.opaque=result.parts.filter(p=>!p.condition||result.locked.includes(p.condition.family)).map(p=>p.text);
  }catch(error){result.error=error.message;result.locked=[...SEARCH_FAMILIES];result.opaque=query?[query]:[];}
  return result;
}

export function replaceCondition(state,family,clause) {
  if(!SEARCH_FAMILIES.includes(family)||state.error||state.locked.includes(family))throw Error('Edit this expression in the search query; the guided controls cannot represent it.');
  const parts=[];let replaced=false;
  for(const part of state.parts){
    if(part.condition?.family===family){if(!replaced&&clause)parts.push({text:clause,or:false});replaced=true;}else parts.push(part);
  }
  if(!replaced&&clause)parts.push({text:clause,or:false});
  const query=parts.map(p=>parts.length>1&&p.or?'('+p.text+')':p.text).join(' ');
  return parseQuery(query);
}
const combine=(values,mode)=>values.length>1?'('+values.join(mode==='any'?' OR ':' ')+')':values[0]||'';
function costClause({symbol,op,amount}) {
  const count=Number(amount);
  if(!COST_SYMBOLS.includes(symbol)||!['>=','<=','='].includes(op)||!Number.isInteger(count)||count<(op==='>='?1:0)||count>MAX_COST_AMOUNT){
    throw Error(`Use a whole mana amount from ${op==='>='?1:0} to ${MAX_COST_AMOUNT}.`);
  }
  // Scryfall's direct equality compares the full cost. Negate the next minimum for a per-symbol ceiling.
  const minimum=n=>'m>='+(symbol==='generic'?`{${n}}`:`{${symbol}}`.repeat(n));
  if(op==='>=')return minimum(count);
  const ceiling='-'+minimum(count+1);
  return op==='='&&count>0?`(${minimum(count)} ${ceiling})`:ceiling;
}
export function conditionQuery(state,family){
  if(family==='type'&&[...state.types,...state.excludedTypes].some(t=>!chipValue(t)))throw Error('Use type or subtype names.');
  if(family==='keyword'&&state.keywords.some(t=>!chipValue(t)))throw Error('Use keyword ability names.');
  if(family==='mv'&&state.values.some(v=>v.value!==''&&(!Number.isFinite(Number(v.value))||Number(v.value)<0||!['<','>','<=','>=','=','!='].includes(v.op))))throw Error('Use a nonnegative mana value and a supported comparison.');
  if(family==='name')return state.name.trim()?'name:'+quote(state.name.trim()):'';
  if(family==='oracle'){
    if(state.oracle.some(row=>!['o','fo'].includes(row.mode)))throw Error('Choose Oracle or Full oracle for each phrase.');
    return combine(state.oracle.filter(row=>row.text.trim()).map(row=>row.mode+':'+quote(row.text.trim())),state.oracleMatch);
  }
  if(family==='type')return [combine(state.types.map(t=>'t:'+quote(t)),state.typeMatch),...state.excludedTypes.map(t=>'-t:'+quote(t))].filter(Boolean).join(' ');
  if(family==='keyword')return combine(state.keywords.map(t=>'keyword:'+quote(t)),state.keywordMatch);
  if(family==='tags')return combine(state.tags.map(t=>'otag:'+t),state.match);
  if(family==='mv')return combine(state.values.filter(v=>v.value!=='').map(v=>'mv'+v.op+Number(v.value)),state.valueMatch);
  if(family==='legal')return state.legal?'f:'+state.legal:'';
  if(family==='cost')return combine(state.cost.filter(row=>row.amount!=='').map(costClause),state.costMatch);
  if(family==='color'||family==='identity'){
    const {mode,values}=state[family],prefix=family==='color'?'c':'id';
    if(mode==='multi')return prefix+':m';if(mode==='colorless')return prefix+':c';if(!values.length)return '';
    if(mode==='any')return combine(values.map(c=>prefix+'>='+c),'any');
    return prefix+({all:'>=',exact:'=',subset:'<='})[mode]+values.join('');
  }
  return '';
}
export function searchOptions(state){
  return SEARCH_FAMILIES.filter(key=>!state.locked.includes(key)&&state.parts.some(p=>p.condition?.family===key)).map(key=>({key,label:({name:'Card name',oracle:'Oracle phrase',type:'Types',keyword:'Keywords',mv:'Mana values',color:'Card colors',identity:'Color identity',cost:'Mana cost',legal:'Format legality',tags:'Function tags'})[key]}));
}
