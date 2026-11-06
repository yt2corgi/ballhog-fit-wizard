import { LANES, SLOTS } from './rules.js';
import { isAllowedImage, isAllowedLink } from './stores.js';

const FIELDS = ['id', 'slot', 'source', 'shop', 'brand', 'title', 'url', 'image', 'price', 'size', 'condition', 'colour', 'wash', 'lanes'];

function toBase64Url(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
  const s = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, c => c.charCodeAt(0));
}

async function pipe(bytes, stream) {
  const piped = new Blob([bytes]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(piped).arrayBuffer());
}

export async function encodeFit(fit) {
  const pieces = Object.values(fit.pieces).map(p => FIELDS.map(f => p[f] ?? null));
  const json = JSON.stringify({ l: fit.lane, n: fit.note, p: pieces });
  return toBase64Url(await pipe(new TextEncoder().encode(json), new CompressionStream('deflate-raw')));
}

function clip(value, max = 300) {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

export function cleanPiece(p) {
  if (!p || !SLOTS.includes(p.slot)) return null;
  if (!isAllowedLink(p.url) || !isAllowedImage(p.image)) return null;
  return {
    id: clip(p.id),
    slot: p.slot,
    source: clip(p.source, 16),
    shop: clip(p.shop, 60),
    brand: clip(p.brand, 60),
    title: clip(p.title),
    url: p.url,
    image: p.image,
    price: Number(p.price) || 0,
    size: p.size == null ? null : clip(String(p.size), 30),
    condition: clip(p.condition, 40),
    colour: clip(p.colour, 16),
    wash: p.wash == null ? null : clip(p.wash, 16),
    lanes: Array.isArray(p.lanes) ? p.lanes.map(l => clip(l, 16)).slice(0, 4) : [],
  };
}

export async function decodeFit(text) {
  if (typeof text !== 'string' || text.length > 12000) return null;
  try {
    const bytes = await pipe(fromBase64Url(text), new DecompressionStream('deflate-raw'));
    const data = JSON.parse(new TextDecoder().decode(bytes));
    if (!LANES[data.l] || !Array.isArray(data.p)) return null;
    const pieces = {};
    for (const row of data.p.slice(0, SLOTS.length)) {
      const piece = cleanPiece(Object.fromEntries(FIELDS.map((f, i) => [f, row[i]])));
      if (piece) pieces[piece.slot] = piece;
    }
    if (!Object.keys(pieces).length) return null;
    const total = Object.values(pieces).reduce((sum, p) => sum + p.price, 0);
    return {
      lane: data.l,
      laneLabel: LANES[data.l].label,
      note: clip(data.n, 120),
      pieces,
      total: Math.round(total * 100) / 100,
    };
  } catch {
    return null;
  }
}
