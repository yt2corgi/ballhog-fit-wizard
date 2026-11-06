import fs from 'node:fs';
import { classify } from './rules.js';

export function loadSaved(file) {
  let items = [];
  try {
    items = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
  return items.map(toPiece).filter(Boolean);
}

export function toPiece(item) {
  if (item.dead) return null;
  const tagged = classify({ title: item.title, type: item.type || '', vendor: item.brand || '', tags: [], colourOption: item.colour || '' });
  if (!tagged) return null;
  return {
    id: `h:${item.url}`,
    source: 'saved',
    shop: item.shop,
    title: item.title,
    brand: item.brand || item.shop,
    url: item.url,
    image: item.image,
    thumb: item.image,
    price: Number(item.price),
    condition: item.condition || 'New',
    variants: [],
    sizeKnown: false,
    ...tagged,
    fetchedAt: Date.now(),
  };
}

export async function checkLinks(file, fetcher = fetch) {
  let items;
  try {
    items = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return { checked: 0, dead: 0 };
  }
  const newest = Math.max(0, ...items.map(i => Date.parse(i.checkedAt || 0) || 0));
  if (Date.now() - newest < 20 * 60 * 60 * 1000) return { checked: 0, dead: 0 };
  let dead = 0;
  for (const item of items) {
    try {
      const res = await fetcher(item.url, {
        method: 'GET',
        redirect: 'follow',
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BallhogFitWizard/0.1)', Accept: 'text/html' },
      });
      res.body?.cancel?.();
      item.dead = res.status === 404 || res.status === 410;
      item.checkedAt = new Date().toISOString();
      if (item.dead) dead++;
    } catch {
      item.checkedAt = new Date().toISOString();
    }
    await new Promise(r => setTimeout(r, 400));
  }
  fs.writeFileSync(file, JSON.stringify(items, null, 2));
  return { checked: items.length, dead };
}
