// One queue and cooldown for every upstream endpoint used by this server.
export function createScryfallClient({fetchImpl=fetch,now=Date.now,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))}={}) {
  const cache=new Map(),pending=new Map();let queue=Promise.resolve(),nextRequest=0,blockedUntil=0;
  const limited=()=>Object.assign(Error('Scryfall paused requests. Resume after the cooldown.'),{status:429,retryAfter:Math.max(1,Math.ceil((blockedUntil-now())/1000))});
  return function request(route,body){
    const key=route+JSON.stringify(body??'');
    const hit=cache.get(key);if(hit&&now()-hit.time<300_000)return Promise.resolve(hit.data);
    if(blockedUntil>now())return Promise.reject(limited());
    if(pending.has(key))return pending.get(key);
    const task=queue.then(async()=>{
      if(blockedUntil>now())throw limited();
      if(nextRequest>now())await sleep(nextRequest-now());
      if(blockedUntil>now())throw limited();
      try{
        const response=await fetchImpl('https://api.scryfall.com'+route,{
          headers:{'User-Agent':'ArcanaDeckbuilder/0.1 (local deckbuilding app)',Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},
          method:body?'POST':'GET',body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(20_000),
        });
        if(response.status===429){
          const retry=response.headers?.get('retry-after'),seconds=Number(retry),date=Date.parse(retry);
          blockedUntil=now()+Math.max(60_000,Number.isFinite(seconds)&&seconds>0?seconds*1000:Number.isFinite(date)?date-now():0);
          throw limited();
        }
        const data=await response.json();
        if(!response.ok)throw Object.assign(Error(data.details||'Scryfall is unavailable.'),{status:response.status});
        cache.set(key,{time:now(),data});if(cache.size>2000)cache.delete(cache.keys().next().value);
        return data;
      }finally{nextRequest=now()+600;}
    });
    queue=task.catch(()=>{});pending.set(key,task);
    task.then(()=>pending.delete(key),()=>pending.delete(key));return task;
  };
}
