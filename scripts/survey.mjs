import { STORES } from '../server/stores.js';
import { fetchPage } from '../server/shopify.js';
import { LANES, SLOTS } from '../server/rules.js';

const pieces = [];
const perStore = {};
await Promise.all(STORES.map(async store => {
  let currency = '?';
  try {
    const meta = await (await fetch(`https://${store.host}/meta.json`, { signal: AbortSignal.timeout(6000), headers: { 'User-Agent': 'BallhogFitWizard/0.1' } })).json();
    currency = meta.currency || meta.money_format || '?';
  } catch {}
  let got = 0;
  let errors = 0;
  const pages = Math.min(store.pages, 3);
  for (let page = 1; page <= pages; page++) {
    try {
      const list = await fetchPage(store, page);
      pieces.push(...list);
      got += list.length;
    } catch {
      errors++;
    }
  }
  perStore[store.host] = { currency, got, errors };
}));
console.table(perStore);
const table = {};
for (const lane of Object.keys(LANES)) {
  table[lane] = {};
  for (const slot of SLOTS) table[lane][slot] = pieces.filter(p => p.slot === slot && p.lanes.includes(lane)).length;
}
console.table(table);
const show = process.argv[2] ? [process.argv[2]] : ['bottoms', 'top', 'shoes', 'belt', 'bag', 'hat', 'chain'];
for (const slot of show) {
  const list = pieces.filter(p => p.slot === slot).sort(() => Math.random() - 0.5).slice(0, 18);
  console.log(`\n== ${slot}`);
  for (const p of list) console.log(`${p.shop.padEnd(20).slice(0, 20)} $${String(p.price).padEnd(8)} ${p.colour.padEnd(8)} ${p.lanes.join(',').padEnd(30)} ${p.title.slice(0, 60)} | ${p.variants.slice(0, 4).map(v => v.label).join(' ; ').slice(0, 40)}`);
}
