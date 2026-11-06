import { LANES, REQUIRED, SLOTS, displaySize, harmony, noteFor, pickVariant } from './rules.js';

const EXPIRY = 45 * 60 * 1000;

export class Pool {
  constructor() {
    this.slots = Object.fromEntries(SLOTS.map(s => [s, new Map()]));
  }

  add(pieces) {
    for (const p of pieces) this.slots[p.slot]?.set(p.id, p);
  }

  remove(id) {
    for (const s of SLOTS) this.slots[s].delete(id);
  }

  list(slot, now = Date.now()) {
    const out = [];
    for (const [id, p] of this.slots[slot]) {
      if (p.source !== 'saved' && now - p.fetchedAt > EXPIRY) {
        this.slots[slot].delete(id);
        continue;
      }
      out.push(p);
    }
    return out;
  }

  size(slot) {
    return this.slots[slot].size;
  }
}

function publicPiece(piece, variant) {
  return {
    id: piece.id,
    slot: piece.slot,
    source: piece.source,
    shop: piece.shop,
    brand: piece.brand,
    title: piece.title,
    url: piece.url,
    image: piece.image,
    price: variant.price || piece.price,
    size: displaySize(piece.slot, variant.label),
    condition: piece.condition,
    colour: piece.colour,
    wash: piece.wash,
    lanes: piece.lanes,
  };
}

const BUDGET_SHARE = { bottoms: 0.25, shoes: 0.4, top: 0.15 };

function spentOn(pieces) {
  return pieces.reduce((sum, p) => sum + (Number(p.price) || 0), 0);
}

function cheapest(pool, slot, lane, mine, avoid) {
  let low = Infinity;
  for (const piece of pool.list(slot)) {
    if (!piece.lanes.includes(lane) || avoid.has(piece.id)) continue;
    const variant = pickVariant(piece, mine);
    if (!variant) continue;
    const price = variant.price || piece.price;
    if (price < low) low = price;
  }
  return low;
}

export function allowance(pool, slot, lane, mine, pieces, avoid, budget) {
  if (!budget) return Infinity;
  const left = budget - spentOn(Object.values(pieces));
  const low = cheapest(pool, slot, lane, mine, avoid);
  if (!REQUIRED.includes(slot)) {
    let reserved = 0;
    for (const other of REQUIRED) if (!pieces[other]) reserved += Math.min(cheapest(pool, other, lane, mine, avoid), budget);
    return left - reserved;
  }
  let reserved = 0;
  for (const other of REQUIRED) {
    if (other === slot || pieces[other]) continue;
    const price = cheapest(pool, other, lane, mine, avoid);
    if (price !== Infinity) reserved += price;
  }
  const room = Math.min(left - reserved, Math.max(budget * BUDGET_SHARE[slot], low));
  return Math.max(room, low);
}

function ranked(pool, slot, lane, mine, chosen, avoid, random, maxPrice = Infinity) {
  const usedShops = new Map();
  for (const p of chosen) usedShops.set(p.shop, (usedShops.get(p.shop) || 0) + 1);
  const shopLuck = new Map();
  const out = [];
  for (const piece of pool.list(slot)) {
    if (!piece.lanes.includes(lane)) continue;
    if (avoid.has(piece.id)) continue;
    const variant = pickVariant(piece, mine);
    if (!variant) continue;
    if ((variant.price || piece.price) > maxPrice) continue;
    if (!shopLuck.has(piece.shop)) shopLuck.set(piece.shop, random() * 8);
    let score = (piece.score || 0) + (piece.weight || 0) + variant.score + harmony(piece, chosen);
    score -= (usedShops.get(piece.shop) || 0) * 3;
    if (lane === 'football' && slot === 'bag' && piece.backpack) score += 3;
    score += shopLuck.get(piece.shop) + random() * 3;
    if (maxPrice !== Infinity && maxPrice > 0) score -= ((variant.price || piece.price) / maxPrice) * 5;
    out.push({ piece, variant, score });
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

async function pickFor(pool, slot, lane, mine, chosen, avoid, hooks, random, maxPrice) {
  const list = ranked(pool, slot, lane, mine, chosen, avoid, random, maxPrice);
  for (const entry of list.slice(0, 4)) {
    if (hooks.vet) {
      const verdict = await hooks.vet(entry.piece);
      if (verdict && !verdict.keep) {
        pool.remove(entry.piece.id);
        continue;
      }
    }
    return { out: publicPiece(entry.piece, entry.variant), piece: entry.piece, label: entry.variant.label };
  }
  return null;
}

async function soldOut(picks, hooks) {
  if (!hooks.verify) return [];
  const checks = await Promise.all(Object.entries(picks).map(async ([slot, pick]) => ({
    slot,
    live: await hooks.verify(pick.piece, pick.label),
  })));
  return checks.filter(c => !c.live).map(c => c.slot);
}

export function laneCounts(pool, mine) {
  const counts = {};
  for (const lane of Object.keys(LANES)) {
    counts[lane] = {};
    for (const slot of SLOTS) {
      counts[lane][slot] = pool.list(slot).filter(p => p.lanes.includes(lane) && pickVariant(p, mine)).length;
    }
  }
  return counts;
}

function coreCost(pool, lane, mine, locked, avoid) {
  let cost = spentOn(locked);
  for (const slot of REQUIRED) {
    if (locked.some(p => p.slot === slot)) continue;
    cost += cheapest(pool, slot, lane, mine, avoid);
  }
  return cost;
}

export function budgetFits(pool, mine, budget, locked = [], seen = []) {
  const avoid = new Set(seen);
  return Object.keys(LANES).some(lane => coreCost(pool, lane, mine, locked, avoid) <= budget);
}

function chooseLane(locked, pool, mine, random, budget, avoid) {
  let options = Object.keys(LANES);
  for (const piece of locked) {
    const narrowed = options.filter(l => piece.lanes?.includes(l));
    if (narrowed.length) options = narrowed;
  }
  const counts = laneCounts(pool, mine);
  const usable = options.filter(l => REQUIRED.every(s => counts[l][s] > 0 || locked.some(p => p.slot === s)));
  const from = usable.length ? usable : options;
  if (budget) {
    const costs = from.map(lane => [lane, coreCost(pool, lane, mine, locked, avoid)]);
    const fits = costs.filter(([, cost]) => cost <= budget).map(([lane]) => lane);
    if (fits.length) return fits[Math.floor(random() * fits.length)];
    return costs.sort((a, b) => a[1] - b[1])[0][0];
  }
  return from[Math.floor(random() * from.length)];
}

const ORDER = ['bottoms', 'shoes', 'top', 'belt', 'bag', 'hat', 'chain'];

function summarize(lane, pieces, random) {
  const list = SLOTS.map(s => pieces[s]).filter(Boolean);
  const shops = new Set(list.map(p => p.shop));
  const total = list.reduce((sum, p) => sum + (p.price || 0), 0);
  return {
    lane,
    laneLabel: LANES[lane].label,
    note: noteFor(lane, random),
    pieces,
    total: Math.round(total * 100) / 100,
    shops: shops.size,
  };
}

export async function buildFit(pool, { sizes, locked = [], seen = [], hooks = {}, random = Math.random, budget = null }) {
  const avoid = new Set(seen);
  const lane = chooseLane(locked, pool, sizes, random, budget, avoid);
  const pieces = {};
  for (const piece of locked) pieces[piece.slot] = piece;
  const picks = {};
  const fill = async slot => {
    const maxPrice = allowance(pool, slot, lane, sizes, pieces, avoid, budget);
    const pick = await pickFor(pool, slot, lane, sizes, Object.values(pieces), avoid, hooks, random, maxPrice);
    if (pick) {
      picks[slot] = pick;
      pieces[slot] = pick.out;
    }
  };
  for (const slot of ORDER) {
    if (!pieces[slot]) await fill(slot);
  }
  for (let round = 0; round < 3; round++) {
    const gone = await soldOut(picks, hooks);
    if (!gone.length) break;
    for (const slot of gone) {
      pool.remove(picks[slot].piece.id);
      avoid.add(picks[slot].piece.id);
      delete picks[slot];
      delete pieces[slot];
      await fill(slot);
    }
  }
  return summarize(lane, pieces, random);
}

export async function rerollSlot(pool, { fit, slot, sizes, seen = [], hooks = {}, random = Math.random, budget = null }) {
  const others = Object.values(fit.pieces).filter(p => p.slot !== slot);
  const current = fit.pieces[slot];
  const avoid = new Set(seen);
  if (current) avoid.add(current.id);
  for (let round = 0; round < 4; round++) {
    const maxPrice = budget ? budget - spentOn(others) : Infinity;
    const pick = await pickFor(pool, slot, fit.lane, sizes, others, avoid, hooks, random, maxPrice);
    if (!pick) return null;
    const live = hooks.verify ? await hooks.verify(pick.piece, pick.label) : true;
    if (live) return pick.out;
    pool.remove(pick.piece.id);
    avoid.add(pick.piece.id);
  }
  return null;
}
