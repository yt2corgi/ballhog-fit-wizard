import { budgetFits, buildFit, laneCounts, Pool, rerollSlot } from './generator.js';
import { fetchPage, savedPiece, stillAvailable } from './feeds.js';
import { REQUIRED, SLOTS } from './rules.js';
import { STORES } from './stores.js';

const pool = new Pool();
const rosters = Object.fromEntries(SLOTS.map(s => [s, STORES.filter(st => st.slots.includes(s))]));
const hooks = { verify: stillAvailable };

const savedReady = fetch(new URL('../data/saved.json', import.meta.url))
  .then(r => r.json())
  .then(items => pool.add(items.map(savedPiece).filter(Boolean)))
  .catch(() => {});

function sample(list, n) {
  const copy = [...list];
  const out = [];
  while (copy.length && out.length < n) out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  return out;
}

function pull(store) {
  const page = 1 + Math.floor(Math.random() * store.pages * 2);
  return fetchPage(store, page).then(pieces => pool.add(pieces)).catch(() => {});
}

function refreshAll() {
  const chosen = new Set();
  for (const slot of SLOTS) for (const store of sample(rosters[slot], 2)) chosen.add(store);
  return Promise.allSettled([...chosen].map(pull));
}

function refreshSome() {
  return Promise.allSettled(sample(STORES, 3).map(pull));
}

function isThin(sizes) {
  return !Object.values(laneCounts(pool, sizes)).some(c => REQUIRED.every(s => c[s] >= 3));
}

async function warm(sizes, ms) {
  const until = Date.now() + ms;
  while (isThin(sizes) && Date.now() < until) {
    await Promise.race([refreshAll(), new Promise(r => setTimeout(r, 2500))]);
  }
}

export function forget(id) {
  pool.remove(id);
}

let started = false;

export async function generate({ sizes, locked, seen, budget }) {
  await savedReady;
  const live = started ? refreshSome() : refreshAll();
  started = true;
  if (isThin(sizes)) await warm(sizes, 9000);
  else await Promise.race([live, new Promise(r => setTimeout(r, 500))]);
  if (budget) {
    const until = Date.now() + 8000;
    while (!budgetFits(pool, sizes, budget, locked, seen) && Date.now() < until) {
      await Promise.race([refreshAll(), new Promise(r => setTimeout(r, 2500))]);
    }
  }
  return buildFit(pool, { sizes, locked, seen, hooks, budget });
}

export async function reroll({ sizes, fit, slot, seen, budget }) {
  await savedReady;
  refreshSome();
  return rerollSlot(pool, { fit, slot, sizes, seen, hooks, budget });
}
