import { classify } from './rules.js';

const PAGE_TTL = 10 * 60 * 1000;
const PAGE_SIZE = 120;
const cache = new Map();
const inflight = new Map();

function sizeOptionIndex(product) {
  return (product.options || []).findIndex(o => /size|waist/i.test(o.name || ''));
}

function colourOptionIndex(product) {
  return (product.options || []).findIndex(o => /colou?r|wash/i.test(o.name || ''));
}

function imageUrl(src, width = 720) {
  if (!src) return null;
  return `${src.split('?')[0]}?width=${width}`;
}

export function normalizeProduct(product, store) {
  const sizeIdx = sizeOptionIndex(product);
  const colourIdx = colourOptionIndex(product);
  const first = product.variants?.[0];
  const colourOption = colourIdx >= 0 ? first?.[`option${colourIdx + 1}`] : '';
  const tags = Array.isArray(product.tags) ? product.tags : String(product.tags || '').split(',').map(t => t.trim());
  const tagged = classify({
    title: product.title,
    type: product.product_type,
    vendor: product.vendor,
    tags,
    colourOption,
  });
  if (!tagged) return null;
  if (!store.slots.includes(tagged.slot)) return null;
  const image = product.images?.[0]?.src;
  if (!image) return null;
  const variants = (product.variants || []).map(v => ({
    label: sizeIdx >= 0 ? v[`option${sizeIdx + 1}`] : v.title,
    available: v.available,
    price: Number(v.price),
  }));
  const prices = variants.map(v => v.price).filter(Boolean);
  if (!prices.length) return null;
  return {
    id: `s:${store.host}:${product.id}`,
    source: 'shopify',
    shop: store.name,
    host: store.host,
    handle: product.handle,
    title: product.title,
    brand: product.vendor || store.name,
    url: `https://${store.host}/products/${product.handle}`,
    image: imageUrl(image),
    price: Math.min(...prices),
    condition: 'New',
    variants,
    sizeOption: sizeIdx >= 0,
    weight: store.weight || 0,
    ...tagged,
    fetchedAt: Date.now(),
  };
}

export function savedPiece(item) {
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
    price: Number(item.price),
    condition: item.condition || 'New',
    variants: [],
    sizeKnown: false,
    weight: -2,
    ...tagged,
    fetchedAt: Date.now(),
  };
}

export async function fetchPage(store, page, fetcher = fetch) {
  const key = `${store.host}:${page}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < PAGE_TTL) return hit.pieces;
  if (inflight.has(key)) return inflight.get(key);
  const run = (async () => {
    const res = await fetcher(`https://${store.host}/products.json?limit=${PAGE_SIZE}&page=${page}`, {
      signal: AbortSignal.timeout(8000),
      credentials: 'omit',
    });
    if (!res.ok) throw new Error(`${store.host} ${res.status}`);
    const data = await res.json();
    const pieces = (data.products || []).map(p => normalizeProduct(p, store)).filter(Boolean);
    cache.set(key, { at: Date.now(), pieces });
    return pieces;
  })().finally(() => inflight.delete(key));
  inflight.set(key, run);
  return run;
}

export async function stillAvailable(piece, sizeLabel, fetcher = fetch) {
  if (piece.source !== 'shopify') return true;
  try {
    const res = await fetcher(`https://${piece.host}/products/${piece.handle}.js`, {
      signal: AbortSignal.timeout(2500),
      credentials: 'omit',
    });
    if (res.status === 404) return false;
    if (!res.ok) return true;
    const data = await res.json();
    if (data.available === false) return false;
    if (!sizeLabel) return true;
    const match = (data.variants || []).filter(v => [v.option1, v.option2, v.option3, v.title].includes(sizeLabel));
    if (!match.length) return true;
    return match.some(v => v.available !== false);
  } catch {
    return true;
  }
}
