import { writeFile } from 'node:fs/promises';
import { createScryfallClient } from '../scryfall-client.mjs';

const request = createScryfallClient();
const typeCatalogs = ['supertypes', 'card-types', 'artifact-types', 'battle-types', 'creature-types',
  'enchantment-types', 'land-types', 'planeswalker-types', 'spell-types'];
async function catalog(names) {
  const values = new Set();
  for (const name of names) {
    const { data, total_values: count } = await request('/catalog/' + name);
    if (!Array.isArray(data) || !data.length || data.length !== count || data.some(value => typeof value !== 'string' || !value.trim())) {
      throw Error('Invalid Scryfall catalog: ' + name);
    }
    for (const value of data) values.add(value);
  }
  return [...values].sort((a, b) => a.localeCompare(b, 'en'));
}
const types = await catalog(typeCatalogs);
const keywords = await catalog(['keyword-abilities']);
const format = (name, values) => {
  const rows = [];
  for (let i = 0; i < values.length; i += 6) rows.push('  ' + values.slice(i, i + 6).map(value => JSON.stringify(value)).join(', ') + ',');
  return 'export const ' + name + ' = [\n' + rows.join('\n') + '\n];\n';
};
const date = new Date().toISOString().slice(0, 10);
await writeFile(new URL('../public/filter-catalog.js', import.meta.url),
  '// Scryfall catalogs snapshot (' + date + '). Regenerate with node scripts/update-filter-catalog.mjs.\n'
  + format('TYPE_CATALOG', types) + '\n' + format('KEYWORD_CATALOG', keywords));
console.log('Saved %d types and %d keyword abilities.', types.length, keywords.length);
