// A bounded Scryfall projection, not a replacement for Scryfall's search language.
// Unknown expressions retain their source text; mixed Boolean groups lock affected controls.
export const SEARCH_FAMILIES = ['name','oracle','type','mv','color','identity','cost','symbols','legal','tags'];
const emptyColor = () => ({ mode: 'all', values: [] });
const defaults = () => ({ name:'', oracle:'', types:[], typeMatch:'all', values:[], valueMatch:'all', color:emptyColor(), identity:emptyColor(), cost:'', symbols:{}, legal:'', tags:[], match:'all' });
const unwrap = node => node?.kind === 'group' ? unwrap(node.child) : node;
const unique = values => [...new Set(values)];
const quote = value => JSON.stringify(value);

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
    if(/^(?:name|n|o|oracle|t|type|otag|f|format|c|color|id|identity|m|mana):$/i.test(text)||/^(?:mv|cmc|manavalue)[<>=!:]+$/i.test(text))throw Error('Finish the search condition before searching.');
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
function term(text){
  let m;
  if((m=text.match(/^(name|n|o|oracle|t|type|otag|f|format):(.+)$/i))){
    const value=textValue(m[2]);if(value===null||!value.trim())return null;
    const family=({n:'name',o:'oracle',t:'type',type:'type',otag:'tags',f:'legal',format:'legal'})[m[1].toLowerCase()]||m[1].toLowerCase();
    if(family==='tags'&&!/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(value))return null;
    if(family==='type'&&!/^[a-z0-9][a-z0-9 '\-]*$/i.test(value))return null;
    return {family,mode:'all',values:[family==='tags'||family==='type'||family==='legal'?value.toLowerCase():value]};
  }
  if((m=text.match(/^(?:mv|cmc|manavalue)(<=|>=|!=|=|<|>|:)(\d+(?:\.\d+)?)$/i)))return {family:'mv',mode:'all',values:[{op:m[1]===':'?'=':m[1],value:m[2]}]};
  if((m=text.match(/^(c|color|id|identity)(<=|>=|=|:)([wubrg]+|c|colorless|m|multicolor)$/i))){
    const value=m[3].toUpperCase(),family=/^(c|color)$/i.test(m[1])?'color':'identity';
    if(['C','COLORLESS','M','MULTICOLOR'].includes(value))return [':','='].includes(m[2])?{family,mode:value.startsWith('C')?'colorless':'multi',values:[]}:null;
    return {family,mode:({'<=':'subset','>=':'all','=':'exact',':':'all'})[m[2]],values:unique([...value])};
  }
  if((m=text.match(/^(?:m|mana)>=(?:(\{[wubrgc]\})+|([wubrgc]+))$/i))){
    const symbols=text.slice(text.indexOf('=')+1).replace(/[{}]/g,'').toUpperCase();
    return {family:'symbols',mode:'all',values:[...symbols]};
  }
  if((m=text.match(/^(?:m|mana):((?:\{[a-z0-9/]+\}|[a-z0-9])+)$/i)))return {family:'cost',mode:'all',values:[m[1]]};
  return null;
}
function classify(node){
  node=unwrap(node);if(!node)return null;if(node.kind==='term')return term(node.text);if(!node.children)return null;
  const parts=node.children.map(classify);if(parts.some(p=>!p)||parts.some(p=>p.family!==parts[0].family))return null;
  const family=parts[0].family,mode=node.kind==='or'?'any':'all';
  if(family==='symbols')return mode==='all'?{family,mode,values:[...'WUBRGC'].flatMap(s=>Array(Math.max(...parts.map(p=>p.values.filter(x=>x===s).length))).fill(s))}:null;
  if(['name','oracle','legal','cost'].includes(family))return null;
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
    const m=text.match(/^(name|n|o|oracle|t|type|otag|f|format|legal|c|color|id|identity|m|mana|mv|cmc|manavalue)(?:[<>=!:])/i);
    if(!m)return [];
    const key=m[1].toLowerCase();return /^(m|mana)$/.test(key)?['cost','symbols']:[({n:'name',o:'oracle',t:'type',otag:'tags',f:'legal',format:'legal',c:'color',id:'identity',mana:'cost',cmc:'mv',manavalue:'mv'})[key]||key];
  }
  return unique((node.children||[node.child]).filter(Boolean).flatMap(affected));
}

export function parseQuery(query='') {
  const result={...defaults(),query,locked:[],opaque:[],parts:[],error:''};
  try{
    if(query.length>1500)throw Error('Keep the query within 1,500 characters.');
    const parsed=parse(query),root=unwrap(parsed);if(!root)return result;
    const nodes=root.kind==='and'?root.children:[parsed];
    result.parts=nodes.map(node=>({text:query.slice(node.start,node.end),or:node.kind==='or',condition:classify(node),affected:affected(node)}));
    const groups=new Map();
    for(const part of result.parts){if(part.condition){const key=part.condition.family;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(part.condition);}else result.locked.push(...part.affected);}
    for(const [family,parts] of groups){
      let values=parts.flatMap(p=>p.values);const mode=parts.length===1?parts[0].mode:'all';
      const multiple=parts.length>1;
      if((multiple&&(!['type','tags','mv','symbols','color','identity'].includes(family)||parts.some(p=>p.mode!=='all')))||(family==='mv'&&values.length>2)){result.locked.push(family);continue;}
      if(family==='symbols'&&multiple)values=[...'WUBRGC'].flatMap(s=>Array(Math.max(...parts.map(p=>p.values.filter(x=>x===s).length))).fill(s));
      if(family==='type'){result.types=unique(values);result.typeMatch=mode;}
      else if(family==='tags'){result.tags=unique(values);result.match=mode;}
      else if(family==='mv'){result.values=values;result.valueMatch=mode;}
      else if(family==='color'||family==='identity')result[family]={mode,values};
      else if(family==='symbols'){result.symbols=Object.fromEntries(unique(values).map(s=>[s,values.filter(x=>x===s).length]));if(Object.values(result.symbols).some(n=>n>20))result.locked.push(family);}
      else result[family]=values[0];
    }
    result.locked=unique(result.locked);
    for(const family of result.locked){const blank=defaults();if(family==='type'){result.types=[];result.typeMatch='all';}else if(family==='mv'){result.values=[];result.valueMatch='all';}else result[family]=blank[family];}
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
export function conditionQuery(state,family){
  if(family==='type'&&state.types.some(t=>!/^[a-z0-9][a-z0-9 '\-]*$/i.test(t)))throw Error('Use comma-separated type or subtype names.');
  if(family==='mv'&&state.values.some(v=>v.value!==''&&(!Number.isFinite(Number(v.value))||Number(v.value)<0||!['<','>','<=','>=','=','!='].includes(v.op))))throw Error('Use a nonnegative mana value and a supported comparison.');
  if(family==='symbols'&&Object.values(state.symbols).some(n=>!Number.isInteger(n)||n<0||n>20))throw Error('Use whole symbol counts from 0 to 20.');
  if(family==='cost'&&state.cost.trim()&&!/^(?:\{[a-z0-9/]+\}|[a-z0-9])+$/i.test(state.cost.trim()))throw Error('Use mana symbols such as {1}{G} or {U/B}, without spaces.');
  if(family==='name'||family==='oracle')return state[family].trim()?(family==='name'?'name:':'o:')+quote(state[family].trim()):'';
  if(family==='type')return combine(state.types.map(t=>'t:'+quote(t)),state.typeMatch);
  if(family==='tags')return combine(state.tags.map(t=>'otag:'+t),state.match);
  if(family==='mv')return combine(state.values.filter(v=>v.value!=='').map(v=>'mv'+v.op+Number(v.value)),state.valueMatch);
  if(family==='legal')return state.legal?'f:'+state.legal:'';
  if(family==='cost')return state.cost.trim()?'m:'+state.cost.trim():'';
  if(family==='symbols'){const cost=[...'WUBRGC'].map(s=>('{'+s+'}').repeat(state.symbols[s]||0)).join('');return cost?'m>='+cost:'';}
  if(family==='color'||family==='identity'){
    const {mode,values}=state[family],prefix=family==='color'?'c':'id';
    if(mode==='multi')return prefix+':m';if(mode==='colorless')return prefix+':c';if(!values.length)return '';
    if(mode==='any')return combine(values.map(c=>prefix+':'+c),'any');
    return prefix+({all:'>=',exact:'=',subset:'<='})[mode]+values.join('');
  }
  return '';
}
export function searchOptions(state){
  return SEARCH_FAMILIES.filter(key=>!state.locked.includes(key)&&state.parts.some(p=>p.condition?.family===key)).map(key=>({key,label:({name:'Card name',oracle:'Oracle phrase',type:'Types',mv:'Mana values',color:'Card colors',identity:'Color identity',cost:'Mana cost',symbols:'Mana-symbol minimums',legal:'Format legality',tags:'Function tags'})[key]}));
}
