import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { buildFit, laneCounts, Pool, rerollSlot } from './generator.js';
import { fetchPage, stillAvailable } from './shopify.js';
import { STORES, isAllowedImage } from './stores.js';
import { ebayEnabled, searchEbay } from './ebay.js';
import { applyVerdict, capReached, claudeEnabled, configure as configureClaude, vetPiece } from './claude.js';
import { configure as configureCut, cutout, keyFor } from './cutout.js';
import { checkLinks, loadSaved } from './saved.js';
import { REQUIRED, SLOTS, TOP_SIZES } from './rules.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
try { process.loadEnvFile(path.join(root, '.env')); } catch {}

const PORT = Number(process.env.PORT || 6260);
const CACHE = path.join(root, 'cache');
const SAVED = path.join(root, 'data', 'saved.json');
const SHARES = path.join(CACHE, 'shares');
const REEL = path.join(CACHE, 'reel.json');
fs.mkdirSync(SHARES, { recursive: true });
configureClaude(CACHE);
configureCut({ dir: path.join(CACHE, 'cut'), modelPath: path.join(root, 'models', 'silueta.onnx') });

const pool = new Pool();
pool.add(loadSaved(SAVED));

let reel = {};
try { reel = JSON.parse(fs.readFileSync(REEL, 'utf8')); } catch {}

function rememberReel(fit) {
  for (const piece of Object.values(fit.pieces)) {
    const list = reel[piece.slot] || (reel[piece.slot] = []);
    if (!list.includes(piece.image)) list.unshift(piece.image);
    if (list.length > 16) list.length = 16;
  }
  fs.writeFile(REEL, JSON.stringify(reel), () => {});
}

const rosters = Object.fromEntries(SLOTS.map(s => [s, STORES.filter(st => st.slots.includes(s))]));

function sample(list, n) {
  const copy = [...list];
  const out = [];
  while (copy.length && out.length < n) out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  return out;
}

function pullStore(store, page) {
  return fetchPage(store, page)
    .then(pieces => pool.add(pieces))
    .catch(err => console.error('feed', store.host, err.message));
}

function liveRefresh() {
  const jobs = [];
  const seen = new Set();
  for (const slot of SLOTS) {
    for (const store of sample(rosters[slot], 2)) {
      const page = 1 + Math.floor(Math.random() * store.pages);
      const key = `${store.host}:${page}`;
      if (seen.has(key)) continue;
      seen.add(key);
      jobs.push(pullStore(store, page));
    }
    if (ebayEnabled()) {
      jobs.push(searchEbay(slot).then(p => pool.add(p)).catch(err => console.error('ebay', err.message)));
    }
  }
  return Promise.allSettled(jobs);
}

function poolIsThin(sizes) {
  const counts = laneCounts(pool, sizes);
  const lanes = Object.values(counts);
  return !lanes.some(c => REQUIRED.every(s => c[s] >= 3));
}

async function warmUntil(sizes, ms) {
  const until = Date.now() + ms;
  while (poolIsThin(sizes) && Date.now() < until) {
    await Promise.race([liveRefresh(), new Promise(r => setTimeout(r, 2500))]);
  }
}

const hooks = {
  verify: stillAvailable,
  vet: async piece => {
    if (!claudeEnabled() || capReached()) return null;
    try {
      const verdict = await vetPiece(piece);
      if (verdict) pool.add([applyVerdict(piece, verdict)]);
      return verdict;
    } catch (err) {
      console.error('vet', err.status || err.message);
      return null;
    }
  },
};

function cleanSizes(body) {
  const s = body?.sizes || {};
  const waist = Number(s.waist);
  const shoe = Number(s.shoe);
  const top = String(s.top || '');
  if (!(waist >= 24 && waist <= 50) || !(shoe >= 5 && shoe <= 16) || !TOP_SIZES.includes(top)) return null;
  return { waist, shoe, top };
}

function text(value, max = 300) {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function httpsUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

function cleanPiece(p) {
  if (!p || !SLOTS.includes(p.slot)) return null;
  const url = httpsUrl(p.url);
  const image = httpsUrl(p.image);
  if (!url || !image) return null;
  return {
    id: text(p.id),
    slot: p.slot,
    source: text(p.source, 16),
    shop: text(p.shop, 60),
    brand: text(p.brand, 60),
    title: text(p.title),
    url,
    image,
    price: Number(p.price) || 0,
    size: p.size == null ? null : text(String(p.size), 30),
    condition: text(p.condition, 40),
    colour: text(p.colour, 16),
    wash: p.wash == null ? null : text(p.wash, 16),
    lanes: Array.isArray(p.lanes) ? p.lanes.map(l => text(l, 16)).slice(0, 4) : [],
  };
}

function cleanFit(f) {
  if (!f || typeof f !== 'object' || !f.pieces) return null;
  const pieces = {};
  for (const slot of SLOTS) {
    const clean = cleanPiece(f.pieces[slot]);
    if (clean) pieces[slot] = clean;
  }
  if (!Object.keys(pieces).length) return null;
  return {
    lane: text(f.lane, 16),
    laneLabel: text(f.laneLabel, 60),
    note: text(f.note, 120),
    total: Number(f.total) || 0,
    shops: Number(f.shops) || 0,
    pieces,
  };
}

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '128kb' }));

app.post('/api/fit', async (req, res) => {
  const sizes = cleanSizes(req.body);
  if (!sizes) return res.status(400).json({ error: 'sizes' });
  const locked = (req.body.locked || []).map(cleanPiece).filter(Boolean);
  const seen = Array.isArray(req.body.seen) ? req.body.seen.slice(-200).map(s => text(s)) : [];
  const live = liveRefresh();
  if (poolIsThin(sizes)) await warmUntil(sizes, 9000);
  else await Promise.race([live, new Promise(r => setTimeout(r, 500))]);
  const fit = await buildFit(pool, { sizes, locked, seen, hooks });
  if (!REQUIRED.every(s => fit.pieces[s])) console.error('thin fit', fit.lane, Object.keys(fit.pieces));
  rememberReel(fit);
  res.json(fit);
});

app.post('/api/reroll', async (req, res) => {
  const sizes = cleanSizes(req.body);
  const fit = cleanFit(req.body.fit);
  const slot = req.body.slot;
  if (!sizes || !fit || !SLOTS.includes(slot)) return res.status(400).json({ error: 'input' });
  const seen = Array.isArray(req.body.seen) ? req.body.seen.slice(-200).map(s => text(s)) : [];
  liveRefresh();
  const piece = await rerollSlot(pool, { fit, slot, sizes, seen, hooks });
  res.json({ piece });
});

app.get('/api/reel', (req, res) => {
  const out = {};
  for (const slot of SLOTS) {
    out[slot] = (reel[slot] || [])
      .filter(src => fs.existsSync(path.join(CACHE, 'cut', `${keyFor(src, slot)}.webp`)))
      .map(src => `/cut?slot=${slot}&src=${encodeURIComponent(src)}`);
  }
  res.json(out);
});

app.get('/cut', async (req, res) => {
  const src = String(req.query.src || '');
  const slot = SLOTS.includes(req.query.slot) ? req.query.slot : '';
  if (!isAllowedImage(src)) return res.status(400).end();
  try {
    const buffer = await cutout(src, slot);
    res.set('Content-Type', 'image/webp');
    res.set('Cache-Control', 'public, max-age=604800');
    res.send(buffer);
  } catch (err) {
    console.error('cut', err.message);
    res.status(502).end();
  }
});

app.post('/api/share', (req, res) => {
  const fit = cleanFit(req.body.fit);
  if (!fit) return res.status(400).json({ error: 'fit' });
  const id = crypto.randomBytes(5).toString('base64url');
  fs.writeFileSync(path.join(SHARES, `${id}.json`), JSON.stringify(fit));
  res.json({ id, url: `/f/${id}` });
});

app.get('/api/share/:id', (req, res) => {
  if (!/^[\w-]{4,12}$/.test(req.params.id)) return res.status(404).end();
  const file = path.join(SHARES, `${req.params.id}.json`);
  if (!fs.existsSync(file)) return res.status(404).end();
  res.type('json').send(fs.readFileSync(file));
});

app.get('/api/status', (req, res) => {
  res.json({
    stores: STORES.length,
    ebay: ebayEnabled(),
    claude: claudeEnabled(),
    pool: Object.fromEntries(SLOTS.map(s => [s, pool.size(s)])),
  });
});

app.get('/f/:id', (req, res) => res.sendFile(path.join(root, 'public', 'index.html')));
app.use('/fonts', express.static(path.join(root, 'node_modules', '@fontsource-variable', 'figtree', 'files'), { maxAge: '7d' }));
app.use(express.static(path.join(root, 'public')));

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Ballhog Fit Wizard on http://localhost:${PORT}`);
  console.log(`eBay ${ebayEnabled() ? 'on' : 'off'} · Claude check ${claudeEnabled() ? 'on' : 'off'} · ${STORES.length} live stores`);
  liveRefresh();
  const sweep = () => checkLinks(SAVED).then(r => {
    console.log(`saved list checked ${r.checked} links ${r.dead} dead`);
    pool.add(loadSaved(SAVED));
  }).catch(() => {});
  setTimeout(sweep, 60 * 1000).unref();
  setInterval(sweep, 24 * 60 * 60 * 1000).unref();
});
