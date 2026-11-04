export function parseImport(text) {
  const lines = text.split(/\r?\n/).map(l=>l.trim()).filter(l=>l&&!l.startsWith('//')&&!l.startsWith('#'));
  const heading = /^(Main deck|Mainboard|Sideboard|Command zone|Commander|Maybeboard):?$/i;
  const zoned = lines.some(l=>heading.test(l));
  if (!lines.length || lines.length > 310) throw Error('Import 1–300 card lines.');
  let zone = 'main', lineCount = 0;
  const entries = new Map();
  for (const line of lines) {
    const section = line.match(heading);
    if (section) { zone = /maybeboard/i.test(section[1]) ? 'maybeboard' : /sideboard/i.test(section[1]) ? 'sideboard' : /command/i.test(section[1]) ? 'command' : 'main'; continue; }
    if (++lineCount > 300) throw Error('Import 1–300 card lines.');
    const match = line.match(/^(\d+)x?\s+(.+?)(?:\s+\([A-Za-z0-9]+\)\s+\S+)?$/);
    if (!match || +match[1] < 1 || +match[1] > 500) throw Error(`Cannot read “${line}”. Use “1 Card Name” per line, with optional Main deck, Sideboard, Command zone or Maybeboard headings.`);
    const name=match[2], key=zone+'|'+name.toLowerCase(), previous=entries.get(key);
    entries.set(key,{name,qty:(previous?.qty||0)+Number(match[1]),...(zoned?{zone}:{})});
    if(entries.get(key).qty>500)throw Error('Maximum 500 copies per card in a zone.');
  }
  if(!entries.size)throw Error('Import 1–300 card lines.');
  return [...entries.values()];
}
