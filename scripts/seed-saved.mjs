import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify } from '../server/rules.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, 'data', 'saved.json');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

const ASOS = ['baggy distressed jeans men', 'extreme baggy jeans men', 'baggy coated jeans men', 'mens vintage graphic t-shirt', 'mens washed sweatshirt college', 'mens track top', 'mens studded belt', 'mens black backpack', 'mens chain necklace', 'mens trucker cap'];
const PACSUN = ['baggy distressed jeans', 'baggy black jeans', 'mens graphic tee', 'mens crewneck sweatshirt', 'mens belt', 'mens backpack', 'mens trucker hat'];

async function page(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(20000),
    headers: { 'User-Agent': UA, Accept: 'text/html', 'Accept-Language': 'en-US' },
  });
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res.text();
}

function asosProducts(html) {
  const start = html.indexOf('"products":[');
  if (start < 0) return [];
  let depth = 0;
  let i = start + '"products":'.length;
  const from = i;
  let inString = false;
  for (; i < html.length; i++) {
    const c = html[i];
    if (inString) {
      if (c === '\\') i++;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === '[' || c === '{') depth++;
    else if (c === ']' || c === '}') {
      depth--;
      if (depth === 0) break;
    }
  }
  return JSON.parse(html.slice(from, i + 1));
}

async function fromAsos() {
  const out = [];
  for (const q of ASOS) {
    try {
      const html = await page(`https://www.asos.com/us/search/?q=${encodeURIComponent(q)}`);
      for (const p of asosProducts(html).slice(0, 24)) {
        if (p.isOutlet) continue;
        out.push({
          shop: 'ASOS',
          brand: p.brandName,
          title: p.description,
          colour: p.colour,
          price: p.reducedPrice || p.price,
          url: `https://www.asos.com/us/${p.url.split('#')[0]}`,
          image: `https://${p.image}?$n_640w$&wid=640&fit=constrain`,
          condition: 'New',
        });
      }
    } catch (err) {
      console.error('asos', q, err.message);
    }
    await new Promise(r => setTimeout(r, 1200));
  }
  return out;
}

function attr(block, name) {
  return block.match(new RegExp(`${name}="([^"]*)"`))?.[1];
}

function decode(s) {
  return String(s || '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
}

async function fromPacsun() {
  const out = [];
  for (const q of PACSUN) {
    try {
      const html = await page(`https://www.pacsun.com/search?q=${encodeURIComponent(q)}`);
      const blocks = html.split('<div class="product-tile"').slice(1, 25);
      for (const block of blocks) {
        const title = decode(attr(block, 'data-product_name'));
        const price = Number((attr(block, 'data-price') || '').replace(/[^0-9.]/g, ''));
        const href = block.match(/<a href="(\/[^"]+\.html)"/)?.[1];
        const img = block.match(/https:\/\/www\.pacsun\.com\/dw\/image\/[^"' ,]+/)?.[0];
        if (!title || !price || !href || !img) continue;
        out.push({
          shop: 'PacSun',
          brand: decode(attr(block, 'data-brand')) || 'PacSun',
          title,
          colour: decode(attr(block, 'data-product_color')),
          price,
          url: `https://www.pacsun.com${href}`,
          image: decode(img),
          condition: 'New',
        });
      }
    } catch (err) {
      console.error('pacsun', q, err.message);
    }
    await new Promise(r => setTimeout(r, 1200));
  }
  return out;
}

const all = [...(await fromAsos()), ...(await fromPacsun())];
const seen = new Set();
const kept = [];
const counts = {};
for (const item of all) {
  if (seen.has(item.url)) continue;
  seen.add(item.url);
  const tagged = classify({ title: item.title, type: '', vendor: item.brand, tags: [], colourOption: item.colour });
  if (!tagged) continue;
  kept.push(item);
  counts[`${item.shop}:${tagged.slot}`] = (counts[`${item.shop}:${tagged.slot}`] || 0) + 1;
}
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, JSON.stringify(kept, null, 2));
console.log(`pulled ${all.length} kept ${kept.length}`);
console.log(counts);
