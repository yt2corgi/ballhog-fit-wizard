const ORDER = ['hat', 'chain', 'top', 'belt', 'bag', 'bottoms', 'shoes'];
const WIDE = new Set(['top', 'bottoms', 'shoes']);
const SLOT_NAME = { hat: 'Hat', chain: 'Chain', top: 'Top', belt: 'Belt', bag: 'Bag', bottoms: 'Bottoms', shoes: 'Shoes' };
const WAISTS = Array.from({ length: 19 }, (_, i) => 26 + i);
const TOPS = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const SHOES = Array.from({ length: 17 }, (_, i) => 6 + i * 0.5);
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

const ICONS = {
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  reroll: '<path d="M20 11a8 8 0 0 0-14.3-4.6L4 8"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.3 4.6L20 16"/><path d="M20 20v-4h-4"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
  share: '<path d="M12 15V4"/><path d="M8 7.5 12 4l4 3.5"/><path d="M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
  close: '<path d="M6 6l12 12"/><path d="M18 6 6 18"/>',
};

const SHAPES = {
  top: '<path d="M30 15 15 28l9 14 8-6v52h36V36l8 6 9-14-15-13H58q-8 9-16 0z"/>',
  bottoms: '<path d="M30 8h40l8 84H56L50 40l-6 52H22z"/>',
  shoes: '<path d="M12 40v32h76V62q-18-4-30-16L48 34H30q-4 6-18 6z"/>',
  hat: '<path d="M22 62q0-36 30-36 26 0 26 32l16 8q-34 6-72-4z"/>',
  chain: '<circle cx="50" cy="42" r="26" fill="none" stroke="#2c2c2c" stroke-width="5"/><circle cx="50" cy="76" r="8"/>',
  belt: '<rect x="6" y="42" width="88" height="16" rx="3"/><rect x="40" y="36" width="20" height="28" rx="4" fill="none" stroke="#2c2c2c" stroke-width="5"/>',
  bag: '<path d="M30 30q0-18 20-18t20 18l6 4v50q0 6-6 6H30q-6 0-6-6V34z"/>',
};

const $ = id => document.getElementById(id);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function icon(name) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = ICONS[name];
  return svg;
}

function shape(slot) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="#2c2c2c">${SHAPES[slot]}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function read(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

const wait = ms => new Promise(r => setTimeout(r, ms));

function money(n) {
  const value = Number(n) || 0;
  return `$${Number.isInteger(value) ? value : value.toFixed(2)}`;
}

function cutUrl(piece) {
  return `/cut?slot=${piece.slot}&src=${encodeURIComponent(piece.image)}`;
}

async function post(url, body) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(String(res.status));
  return res.json();
}

const state = {
  sizes: read('bh.sizes', null),
  saved: read('bh.saved', []),
  fit: null,
  locks: new Set(),
  seen: [],
  busy: false,
  reel: {},
  pending: null,
};

const cards = {};
const toneCache = new Map();

function toneOf(img) {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, 16, 16);
    const { data } = ctx.getImageData(0, 0, 16, 16);
    let sum = 0;
    let count = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 128) continue;
      sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      count++;
    }
    return count ? sum / count / 255 : 0.5;
  } catch {
    return 0.5;
  }
}

function tileColour(luma) {
  if (luma < 0.22) return '#2c2c2c';
  if (luma < 0.55) return '#191919';
  return '#111111';
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function prepare(piece) {
  const cut = cutUrl(piece);
  try {
    const img = await Promise.race([loadImage(cut), wait(20000).then(() => { throw new Error('slow'); })]);
    const luma = toneOf(img);
    toneCache.set(piece.id, luma);
    return { src: cut, photo: false, luma };
  } catch {
    try {
      await loadImage(piece.image);
    } catch {}
    return { src: piece.image, photo: true, luma: 0.5 };
  }
}

function frame(src, photo) {
  const node = el('div', photo ? 'frame photo' : 'frame');
  const img = el('img');
  img.alt = '';
  img.draggable = false;
  img.src = src;
  node.append(img);
  return node;
}

function fillers(slot, count) {
  const pool = state.reel[slot] || [];
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(pool.length ? pool[Math.floor(Math.random() * pool.length)] : shape(slot));
  }
  return out;
}

function buildCard(slot) {
  const card = el('article', `card${WIDE.has(slot) ? ' wide' : ''}`);
  card.dataset.slot = slot;
  const tile = el('div', 'tile');
  tile.tabIndex = 0;
  tile.setAttribute('role', 'button');
  tile.setAttribute('aria-label', SLOT_NAME[slot]);
  const reel = el('div', 'reel');
  const actions = el('div', 'tile-actions');
  const lock = el('button', 'mini');
  lock.type = 'button';
  lock.setAttribute('aria-label', `Lock ${SLOT_NAME[slot]}`);
  lock.setAttribute('aria-pressed', 'false');
  lock.append(icon('lock'));
  const reroll = el('button', 'mini');
  reroll.type = 'button';
  reroll.setAttribute('aria-label', `Reroll ${SLOT_NAME[slot]}`);
  reroll.append(icon('reroll'));
  actions.append(reroll, lock);
  tile.append(reel, actions);
  const meta = el('div', 'meta');
  const title = el('div', 'meta-title', ' ');
  const line = el('div', 'meta-line');
  const price = el('b', '', ' ');
  const info = el('span', '', ' ');
  line.append(price, info);
  meta.append(title, line);
  card.append(tile, meta);
  tile.addEventListener('click', () => {
    const piece = state.fit?.pieces[slot];
    if (piece && card.classList.contains('landed')) openPiece(piece);
  });
  tile.addEventListener('keydown', e => {
    if (e.target === tile && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      tile.click();
    }
  });
  lock.addEventListener('click', e => {
    e.stopPropagation();
    toggleLock(slot);
  });
  reroll.addEventListener('click', e => {
    e.stopPropagation();
    rerollOne(slot);
  });
  cards[slot] = { card, tile, reel, title, price, info, lock, anim: null };
  return card;
}

function buildStack() {
  const stack = $('stack');
  if (stack.childElementCount) return;
  for (const slot of ORDER) stack.append(buildCard(slot));
}

function fillMeta(slot, piece) {
  const c = cards[slot];
  c.title.textContent = piece.title;
  c.price.textContent = money(piece.price);
  const parts = [piece.shop];
  if (piece.size) parts.push(piece.size);
  c.info.textContent = parts.join(' · ');
  c.tile.setAttribute('aria-label', `${SLOT_NAME[slot]} ${piece.title} ${money(piece.price)}`);
}

function spin(slot) {
  const c = cards[slot];
  c.anim?.cancel();
  c.card.classList.remove('landed', 'gone');
  c.card.classList.add('spinning');
  c.tile.style.removeProperty('--tile');
  const frames = fillers(slot, 6);
  const strip = el('div', 'strip');
  for (const src of [...frames, ...frames]) strip.append(frame(src));
  c.reel.replaceChildren(strip);
  if (REDUCED) return;
  const h = c.tile.clientHeight;
  c.anim = strip.animate(
    [{ transform: 'translateY(0)' }, { transform: `translateY(${-h * frames.length}px)` }],
    { duration: frames.length * 95, iterations: Infinity, easing: 'linear' },
  );
}

async function land(slot, piece, ready) {
  const c = cards[slot];
  c.anim?.cancel();
  const h = c.tile.clientHeight;
  const before = fillers(slot, 5);
  const strip = el('div', 'strip');
  for (const src of before) strip.append(frame(src));
  strip.append(frame(ready.src, ready.photo));
  c.reel.replaceChildren(strip);
  c.tile.style.setProperty('--tile', tileColour(ready.luma));
  c.card.classList.remove('spinning');
  fillMeta(slot, piece);
  if (!REDUCED) {
    c.anim = strip.animate(
      [{ transform: 'translateY(0)' }, { transform: `translateY(${-h * before.length}px)` }],
      { duration: 620, easing: 'cubic-bezier(0.18, 0.82, 0.26, 1.03)', fill: 'forwards' },
    );
    await c.anim.finished.catch(() => {});
    c.anim.cancel();
  }
  c.reel.replaceChildren(frame(ready.src, ready.photo));
  c.anim = null;
  c.card.classList.add('landed');
}

function vanish(slot) {
  const c = cards[slot];
  c.anim?.cancel();
  c.anim = null;
  c.card.classList.remove('spinning', 'landed');
  c.card.classList.add('gone');
}

function setHead(fit) {
  const head = document.querySelector('.fit-head');
  if (!fit) {
    head.classList.add('loading');
    $('lane').textContent = ' ';
    $('note').textContent = ' ';
    return;
  }
  head.classList.remove('loading');
  $('lane').textContent = fit.laneLabel;
  $('note').textContent = fit.note;
}

function updateTotal() {
  const pieces = state.fit ? Object.values(state.fit.pieces) : [];
  const total = pieces.reduce((sum, p) => sum + (Number(p.price) || 0), 0);
  $('total').textContent = pieces.length ? money(Math.round(total * 100) / 100) : '$0';
  if (state.fit) state.fit.total = Math.round(total * 100) / 100;
  updateSaveButton();
}

function setBusy(on) {
  state.busy = on;
  $('again').disabled = on;
  $('generate').disabled = on;
}

function showFitView() {
  $('idle').hidden = true;
  $('fit').hidden = false;
  $('dock').hidden = false;
  $('brand').hidden = false;
  buildStack();
}

function remember(fit) {
  for (const p of Object.values(fit.pieces)) state.seen.push(p.id);
  if (state.seen.length > 200) state.seen = state.seen.slice(-200);
}

async function refreshReel() {
  try {
    const res = await fetch('/api/reel');
    if (res.ok) state.reel = await res.json();
  } catch {}
}

async function generate() {
  if (state.busy) return;
  if (!state.sizes) {
    openSizes(true);
    return;
  }
  setBusy(true);
  showFitView();
  if (location.pathname !== '/') history.replaceState(null, '', '/');
  const lockedSlots = ORDER.filter(s => state.locks.has(s) && state.fit?.pieces[s]);
  const locked = lockedSlots.map(s => state.fit.pieces[s]);
  const spinning = ORDER.filter(s => !lockedSlots.includes(s));
  setHead(null);
  $('total').textContent = ' ';
  for (const slot of spinning) spin(slot);
  const started = performance.now();
  let fit;
  try {
    fit = await post('/api/fit', { sizes: state.sizes, locked, seen: state.seen });
  } catch {
    await settleAfterError(spinning);
    showToast('Could not reach the shops · Try again');
    setBusy(false);
    return;
  }
  const preparing = Object.fromEntries(spinning.filter(s => fit.pieces[s]).map(s => [s, prepare(fit.pieces[s])]));
  const elapsed = performance.now() - started;
  if (elapsed < 900) await wait(900 - elapsed);
  state.fit = fit;
  remember(fit);
  setHead(fit);
  const landings = [];
  for (const slot of spinning) {
    const piece = fit.pieces[slot];
    if (!piece) {
      vanish(slot);
      continue;
    }
    const ready = await preparing[slot];
    landings.push(land(slot, piece, ready));
    if (!REDUCED) await wait(170);
  }
  updateTotal();
  await Promise.all(landings);
  setBusy(false);
  refreshReel();
}

async function settleAfterError(slots) {
  const pieces = state.fit?.pieces || {};
  for (const slot of slots) {
    const piece = pieces[slot];
    if (piece) {
      const ready = await prepare(piece);
      land(slot, piece, ready);
    } else {
      vanish(slot);
    }
  }
  if (state.fit) {
    setHead(state.fit);
    updateTotal();
  } else {
    $('idle').hidden = false;
    $('fit').hidden = true;
    $('dock').hidden = true;
    $('brand').hidden = true;
  }
}

async function rerollOne(slot) {
  if (state.busy || !state.fit) return;
  setBusy(true);
  const current = state.fit.pieces[slot];
  spin(slot);
  let piece = null;
  const started = performance.now();
  try {
    const out = await post('/api/reroll', { sizes: state.sizes, fit: state.fit, slot, seen: state.seen });
    piece = out.piece;
  } catch {}
  const target = piece || current;
  const ready = await prepare(target);
  const elapsed = performance.now() - started;
  if (elapsed < 600) await wait(600 - elapsed);
  if (piece) {
    state.fit.pieces[slot] = piece;
    state.seen.push(piece.id);
  } else {
    showToast('Nothing else in your size right now');
  }
  await land(slot, target, ready);
  updateTotal();
  setBusy(false);
  refreshReel();
}

function toggleLock(slot) {
  const on = !state.locks.has(slot);
  if (on) state.locks.add(slot);
  else state.locks.delete(slot);
  const c = cards[slot];
  c.lock.classList.toggle('on', on);
  c.lock.setAttribute('aria-pressed', String(on));
}

function fitKey(fit) {
  return ORDER.map(s => fit.pieces[s]?.id || '').join('|');
}

function isSaved(fit) {
  const key = fitKey(fit);
  return state.saved.some(f => fitKey(f) === key);
}

function updateSaveButton() {
  const saved = state.fit ? isSaved(state.fit) : false;
  $('save').setAttribute('aria-pressed', String(saved));
  $('save').setAttribute('aria-label', saved ? 'Remove from saved' : 'Save fit');
  $('savedBtn').hidden = state.saved.length === 0;
}

function toggleSave() {
  if (!state.fit || state.busy) return;
  const key = fitKey(state.fit);
  if (isSaved(state.fit)) {
    state.saved = state.saved.filter(f => fitKey(f) !== key);
    showToast('Removed from saved');
  } else {
    state.saved = [JSON.parse(JSON.stringify(state.fit)), ...state.saved].slice(0, 100);
    showToast('Saved');
  }
  write('bh.saved', state.saved);
  updateSaveButton();
}

async function shareFit() {
  if (!state.fit || state.busy) return;
  try {
    const out = await post('/api/share', { fit: state.fit });
    const link = `${location.origin}${out.url}`;
    try {
      await navigator.clipboard.writeText(link);
      showToast('Link copied');
    } catch {
      showToast(link);
    }
  } catch {
    showToast('Could not make a link · Try again');
  }
}

async function showStatic(fit) {
  state.fit = fit;
  state.locks.clear();
  showFitView();
  setHead(fit);
  for (const slot of ORDER) {
    const c = cards[slot];
    c.lock.classList.remove('on');
    c.lock.setAttribute('aria-pressed', 'false');
    const piece = fit.pieces[slot];
    if (!piece) {
      vanish(slot);
      continue;
    }
    c.card.classList.remove('gone');
    c.card.classList.add('spinning');
    c.reel.replaceChildren(frame(shape(slot)));
    prepare(piece).then(ready => {
      if (state.fit !== fit) return;
      c.reel.replaceChildren(frame(ready.src, ready.photo));
      c.tile.style.setProperty('--tile', tileColour(ready.luma));
      c.card.classList.remove('spinning');
      c.card.classList.add('landed');
      fillMeta(slot, piece);
    });
  }
  updateTotal();
}

let sheetClose = null;
let sheetFocus = null;

function openSheet(content, label, onClose) {
  const body = $('sheetBody');
  body.replaceChildren(content);
  body.scrollTop = 0;
  const sheet = $('sheet');
  sheet.setAttribute('aria-label', label);
  sheetClose = onClose || null;
  sheetFocus = document.activeElement;
  $('scrim').hidden = false;
  sheet.hidden = false;
  sheet.style.removeProperty('transform');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      $('scrim').classList.add('open');
      sheet.classList.add('open');
      const first = body.querySelector('button, a');
      first?.focus({ preventScroll: true });
    });
  });
}

function closeSheet() {
  const sheet = $('sheet');
  if (sheet.hidden) return;
  sheet.classList.remove('open', 'dragging');
  sheet.style.removeProperty('transform');
  $('scrim').classList.remove('open');
  setTimeout(() => {
    if (!sheet.classList.contains('open')) {
      sheet.hidden = true;
      $('scrim').hidden = true;
    }
  }, 400);
  const done = sheetClose;
  sheetClose = null;
  sheetFocus?.focus?.({ preventScroll: true });
  done?.();
}

function row(name, value) {
  const node = el('div', 'row');
  node.append(el('span', '', name), el('span', '', value));
  return node;
}

function openPiece(piece) {
  const box = el('div');
  const photo = el('img', 'sheet-photo');
  photo.alt = piece.title;
  photo.src = piece.image;
  const rows = el('div', 'rows');
  if (piece.size) rows.append(row('Size', piece.size));
  else if (['top', 'bottoms', 'shoes'].includes(piece.slot)) rows.append(row('Size', 'Check at shop'));
  if (piece.condition) rows.append(row('Condition', piece.condition));
  rows.append(row('Shop', piece.shop));
  if (piece.brand && piece.brand !== piece.shop) rows.append(row('Brand', piece.brand));
  const link = el('a', 'cta', `View at ${piece.shop}`);
  link.href = piece.url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  box.append(photo, el('div', 'sheet-title', piece.title), el('div', 'sheet-price', money(piece.price)), rows, link);
  openSheet(box, piece.title);
}

function pillGroup(values, current, format, onPick) {
  const group = el('div', 'pills');
  for (const value of values) {
    const pill = el('button', 'pill', format(value));
    pill.type = 'button';
    pill.setAttribute('aria-pressed', String(value === current));
    pill.addEventListener('click', () => {
      for (const other of group.children) other.setAttribute('aria-pressed', 'false');
      pill.setAttribute('aria-pressed', 'true');
      onPick(value);
    });
    group.append(pill);
  }
  return group;
}

function openSizes(thenGenerate) {
  const draft = { waist: state.sizes?.waist ?? null, top: state.sizes?.top ?? null, shoe: state.sizes?.shoe ?? null };
  const box = el('div');
  const save = el('button', 'cta size-save', thenGenerate ? 'Save and generate' : 'Save');
  save.type = 'button';
  save.style.width = '100%';
  const check = () => { save.disabled = !(draft.waist && draft.top && draft.shoe); };
  box.append(
    el('div', 'sheet-heading', 'Your sizes'),
    el('p', 'sheet-sub', 'Jeans and tops come a little big on purpose'),
    el('div', 'size-label', 'Waist'),
    pillGroup(WAISTS, draft.waist, String, v => { draft.waist = v; check(); }),
    el('div', 'size-label', 'Top'),
    pillGroup(TOPS, draft.top, String, v => { draft.top = v; check(); }),
    el('div', 'size-label', 'Shoe'),
    pillGroup(SHOES, draft.shoe, String, v => { draft.shoe = v; check(); }),
    save,
  );
  check();
  save.addEventListener('click', () => {
    if (save.disabled) return;
    state.sizes = { ...draft };
    write('bh.sizes', state.sizes);
    updateSizesChip();
    closeSheet();
    if (thenGenerate) generate();
  });
  openSheet(box, 'Your sizes');
}

function updateSizesChip() {
  const chip = $('sizesBtn');
  chip.hidden = !state.sizes;
  if (state.sizes) chip.textContent = `${state.sizes.waist} · ${state.sizes.top} · ${state.sizes.shoe}`;
}

function openSaved() {
  const box = el('div');
  box.append(el('div', 'sheet-heading', 'Saved'));
  const draw = () => {
    box.querySelectorAll('.saved-row').forEach(n => n.remove());
    if (!state.saved.length) {
      closeSheet();
      return;
    }
    state.saved.forEach((fit, index) => {
      const item = el('div', 'saved-row');
      item.tabIndex = 0;
      item.setAttribute('role', 'button');
      const thumbs = el('div', 'saved-thumbs');
      for (const slot of ['top', 'bottoms', 'shoes']) {
        const piece = fit.pieces[slot];
        if (!piece) continue;
        const img = el('img');
        img.alt = '';
        img.loading = 'lazy';
        img.src = cutUrl(piece);
        thumbs.append(img);
      }
      const text = el('div', 'saved-text');
      text.append(el('strong', '', fit.laneLabel), el('span', '', money(fit.total)));
      const remove = el('button', 'mini');
      remove.type = 'button';
      remove.setAttribute('aria-label', 'Remove from saved');
      remove.append(icon('close'));
      remove.addEventListener('click', e => {
        e.stopPropagation();
        state.saved.splice(index, 1);
        write('bh.saved', state.saved);
        updateSaveButton();
        draw();
      });
      const openIt = () => {
        closeSheet();
        showStatic(JSON.parse(JSON.stringify(fit)));
      };
      item.addEventListener('click', openIt);
      item.addEventListener('keydown', e => {
        if (e.target === item && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          openIt();
        }
      });
      item.append(thumbs, text, remove);
      box.append(item);
    });
  };
  draw();
  openSheet(box, 'Saved fits');
}

let toastTimer = 0;

function showToast(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 2400);
}

function wireDrag() {
  const handle = $('handle');
  const sheet = $('sheet');
  let startY = null;
  let delta = 0;
  handle.addEventListener('pointerdown', e => {
    startY = e.clientY;
    delta = 0;
    handle.setPointerCapture(e.pointerId);
    sheet.classList.add('dragging');
  });
  handle.addEventListener('pointermove', e => {
    if (startY === null) return;
    delta = Math.max(0, e.clientY - startY);
    sheet.style.transform = `translate(-50%, ${delta}px)`;
  });
  const end = () => {
    if (startY === null) return;
    startY = null;
    sheet.classList.remove('dragging');
    sheet.style.removeProperty('transform');
    if (delta > 80 || delta === 0) closeSheet();
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
}

async function boot() {
  $('save').append(icon('heart'));
  $('share').append(icon('share'));
  $('generate').addEventListener('click', generate);
  $('again').addEventListener('click', generate);
  $('save').addEventListener('click', toggleSave);
  $('share').addEventListener('click', shareFit);
  $('sizesBtn').addEventListener('click', () => openSizes(false));
  $('savedBtn').addEventListener('click', openSaved);
  $('scrim').addEventListener('click', closeSheet);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeSheet();
  });
  wireDrag();
  updateSizesChip();
  updateSaveButton();
  refreshReel();
  const shared = location.pathname.match(/^\/f\/([\w-]+)$/);
  if (shared) {
    try {
      const res = await fetch(`/api/share/${shared[1]}`);
      if (!res.ok) throw new Error('missing');
      showStatic(await res.json());
    } catch {
      history.replaceState(null, '', '/');
      showToast('That fit link has expired');
    }
  }
}

boot();
