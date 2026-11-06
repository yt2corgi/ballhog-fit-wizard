import { classify, readWaist, readTop, readShoe } from './rules.js';

const QUERIES = {
  bottoms: ['mens baggy distressed jeans', 'mens baggy wax coated black jeans', 'mens wide leg raw denim jeans', 'true religion baggy jeans mens'],
  top: ['mens vintage graphic tee', 'mens vintage faded college crewneck sweatshirt', 'mens striped graphic long sleeve', 'mens vintage track jacket football'],
  shoes: ['mens chunky high top sneakers', 'mens black leather boots', 'adidas samba mens', 'vans sk8 hi mens'],
  belt: ['mens studded leather belt', 'mens western leather belt'],
  bag: ['black backpack vintage', 'designer backpack mens'],
  hat: ['vintage trucker hat', 'vintage designer cap'],
  chain: ['ball chain necklace mens', 'silver pendant necklace mens'],
};

let token = null;
let tokenUntil = 0;

export function ebayEnabled() {
  return Boolean(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET);
}

async function getToken(fetcher) {
  if (token && Date.now() < tokenUntil) return token;
  const basic = Buffer.from(`${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`).toString('base64');
  const res = await fetcher('https://api.ebay.com/identity/v1/oauth2/token', {
    method: 'POST',
    signal: AbortSignal.timeout(6000),
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
  });
  if (!res.ok) throw new Error(`ebay token ${res.status}`);
  const data = await res.json();
  token = data.access_token;
  tokenUntil = Date.now() + (data.expires_in - 60) * 1000;
  return token;
}

export function sizeFromTitle(slot, title) {
  const t = String(title);
  if (slot === 'bottoms') {
    const m = t.match(/\b(?:W|waist\s*)?(2[6-9]|3\d|4[0-8])\s*[xX]\s*(2[6-9]|3\d|40)\b/) || t.match(/\b(?:size|sz|W)\s*(2[6-9]|3\d|4[0-8])\b/i);
    if (!m) return null;
    const label = m[2] ? `${m[1]} / ${m[2]}` : m[1];
    return readWaist(label) ? label : null;
  }
  if (slot === 'top') {
    const m = t.match(/\b(?:size|sz)\s*(XXXL|XXL|XL|XS|S|M|L|2XL|3XL)\b/i) || t.match(/\b(XXXL|XXL|2XL|3XL|XL|XS)\b/);
    if (!m) return null;
    return readTop(m[1]) ? m[1].toUpperCase() : null;
  }
  if (slot === 'shoes') {
    const m = t.match(/\b(?:size|sz|US|mens?)\s*(\d{1,2}(?:\.5)?)\b/i);
    if (!m) return null;
    return readShoe(m[1]) ? m[1] : null;
  }
  return null;
}

export function normalizeItem(item, hintSlot) {
  const tagged = classify({ title: item.title, type: '', vendor: '', tags: [] });
  if (!tagged || tagged.slot !== hintSlot) return null;
  const image = item.image?.imageUrl || item.thumbnailImages?.[0]?.imageUrl;
  const price = Number(item.price?.value);
  if (!image || !price || (item.price?.currency && item.price.currency !== 'USD')) return null;
  const sized = ['bottoms', 'top', 'shoes'].includes(tagged.slot);
  const label = sized ? sizeFromTitle(tagged.slot, item.title) : null;
  if (sized && !label) return null;
  return {
    id: `e:${item.itemId}`,
    source: 'ebay',
    shop: 'eBay',
    host: 'www.ebay.com',
    title: item.title,
    brand: item.seller?.username || 'eBay',
    url: item.itemWebUrl,
    image,
    thumb: image,
    price,
    condition: item.condition || 'Pre-owned',
    variants: [{ label: label || 'Default Title', available: true, price }],
    ...tagged,
    fetchedAt: Date.now(),
  };
}

export async function searchEbay(slot, fetcher = fetch, pick = Math.random) {
  if (!ebayEnabled()) return [];
  const list = QUERIES[slot];
  const q = list[Math.floor(pick() * list.length)];
  const bearer = await getToken(fetcher);
  const offset = Math.floor(pick() * 4) * 50;
  const params = new URLSearchParams({
    q,
    limit: '50',
    offset: String(offset),
    filter: 'itemLocationCountry:US,deliveryCountry:US,buyingOptions:{FIXED_PRICE},priceCurrency:USD',
  });
  const res = await fetcher(`https://api.ebay.com/buy/browse/v1/item_summary/search?${params}`, {
    signal: AbortSignal.timeout(6000),
    headers: { Authorization: `Bearer ${bearer}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US' },
  });
  if (!res.ok) throw new Error(`ebay search ${res.status}`);
  const data = await res.json();
  return (data.itemSummaries || []).map(i => normalizeItem(i, slot)).filter(Boolean);
}
