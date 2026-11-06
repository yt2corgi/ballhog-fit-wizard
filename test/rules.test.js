import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { classify, displaySize, fitVariant, harmony, isBlocked, pickVariant, readShoe, readTop, readWaist } from '../public/lib/rules.js';
import { budgetFits, buildFit, Pool, rerollSlot } from '../public/lib/generator.js';
import { normalizeProduct, savedPiece } from '../public/lib/feeds.js';
import { cornerColour, legBand, maskFromOutput, pieceColour } from '../public/lib/pixels.js';
import { cleanPiece, decodeFit, encodeFit } from '../public/lib/share.js';
import { isAllowedImage, isAllowedLink, STORES } from '../public/lib/stores.js';

const mine = { waist: 32, top: 'L', shoe: 10 };

test('classify puts pieces in the right slot', () => {
  assert.equal(classify({ title: 'Ultra Baggy Repaired Denim - Blue', type: 'Denim' }).slot, 'bottoms');
  assert.equal(classify({ title: 'Studded Leather Belt' }).slot, 'belt');
  assert.equal(classify({ title: 'Coffin Backpack' }).slot, 'bag');
  assert.equal(classify({ title: 'Ball Chain Necklace' }).slot, 'chain');
  assert.equal(classify({ title: 'Wu-Tang Clan Trucker Hat', type: 'Hats_CT' }).slot, 'hat');
  assert.equal(classify({ title: 'Solemn Echo Tee', type: 'Short Sleeve Tees' }).slot, 'top');
  assert.equal(classify({ title: 'Vans Sk8-Hi Black', type: 'Footwear' }).slot, 'shoes');
});

test('classify sends denim to the right lanes', () => {
  assert.ok(classify({ title: 'Baggy Distressed Jeans Light Wash' }).lanes.includes('washed'));
  assert.ok(classify({ title: 'Baggy Waxed Black Jeans' }).lanes.includes('wax'));
  assert.ok(classify({ title: 'Baggy Raw Indigo Denim Jeans' }).lanes.includes('football'));
  assert.ok(classify({ title: 'Baggy Thrashed Jeans' }).lanes.includes('crewneck'));
  assert.ok(!classify({ title: 'Baggy Waxed Black Jeans' }).lanes.includes('washed'));
});

test('classify rejects slim cuts and non clothing', () => {
  assert.equal(classify({ title: 'Skinny Distressed Jeans' }), null);
  assert.equal(classify({ title: 'Regular Fit Jeans' }), null);
  assert.equal(classify({ title: 'Baggy Denim Shorts' }), null);
  assert.equal(classify({ title: 'H3Star Towels' }), null);
  assert.equal(classify({ title: 'Digital Gift Card' }), null);
  assert.equal(classify({ title: 'Air Jordan T-Shirt' }).slot, 'top');
  assert.equal(classify({ title: 'Chain Stitch Hoodie' }).slot, 'top');
  assert.equal(classify({ title: 'Gamble Heart Cap Sleeve Tee' }), null);
  assert.equal(classify({ title: 'Kurt Geiger Mini Kensington Boots Grade-School', type: 'Footwear' }), null);
  assert.equal(classify({ title: 'Sorel x Aries Mens Daystorm Chukka Boot', type: 'Footwear' }), null);
  assert.equal(classify({ title: 'Settlement Backpack Diaper Bag' }), null);
  assert.equal(classify({ title: 'Ripstop Belt Bag' }), null);
  assert.ok(!classify({ title: 'Vintage Crew Tee' }).lanes.includes('crewneck'));
});

test('jnco rave widths and novelty collabs are out', () => {
  assert.equal(classify({ title: 'Polar Bear. 28". Vintage Stone.', type: 'Jeans', vendor: 'JNCO' }), null);
  assert.equal(classify({ title: 'Minecraft Herschel Classic XL Backpack' }), null);
  assert.equal(classify({ title: 'Persona 5 Royal x King Ice Necklace' }), null);
  const tagged = classify({ title: 'Cheyenne. 20". Superdark Stone.', type: 'Jeans', vendor: 'JNCO' });
  assert.equal(tagged.slot, 'bottoms');
  assert.ok(tagged.lanes.includes('football'));
});

test('size labels read cleanly', () => {
  assert.equal(displaySize('top', 'Size US L'), 'L');
  assert.equal(displaySize('belt', 'Size OS'), null);
  assert.equal(displaySize('hat', '1 SIZE'), null);
  assert.equal(displaySize('shoes', '43'), 'EU 43');
  assert.equal(displaySize('shoes', '10.5'), '10.5');
  assert.equal(displaySize('bottoms', '32'), '32');
});

test('blocks ultra fast fashion and womenswear', () => {
  assert.ok(isBlocked({ title: 'Baggy Jeans', vendor: 'SHEIN' }));
  assert.ok(isBlocked({ title: "WOMEN - WOMEN'S VINTAGE CUT LEATHER PANT" }));
  assert.ok(isBlocked({ title: 'Baggy Jeans', tags: ['women'] }));
  assert.ok(!isBlocked({ title: 'Baggy Jeans', tags: ['women', 'men'] }));
});

test('reads size labels', () => {
  assert.deepEqual(readWaist('32 / 34'), { waist: 32, inseam: 34 });
  assert.deepEqual(readWaist('32'), { waist: 32, inseam: null });
  assert.equal(readWaist('M').waist, 32);
  assert.equal(readTop('Large'), 'L');
  assert.equal(readTop('2XL'), 'XXL');
  assert.equal(readTop('X-Large'), 'XL');
  assert.equal(readTop('XX-Large'), 'XXL');
  assert.equal(readTop('Size US S'), 'S');
  assert.equal(readTop('50'), 'L');
  assert.equal(readShoe('10.5'), 10.5);
  assert.equal(readShoe('US 10'), 10);
  assert.equal(readShoe('M 10 / W 11.5'), 10);
  assert.equal(readShoe('UK 9'), 10);
  assert.equal(readShoe('43'), 10);
});

test('sizes up bottoms and tops but keeps shoes exact', () => {
  assert.ok(fitVariant('bottoms', '36', mine) >= 0);
  assert.equal(fitVariant('bottoms', '30', mine), -1);
  assert.equal(fitVariant('bottoms', '38', mine), -1);
  assert.ok(fitVariant('bottoms', '34 / 34', mine) > fitVariant('bottoms', '34 / 30', mine));
  assert.ok(fitVariant('top', 'XL', mine) > fitVariant('top', 'L', mine));
  assert.equal(fitVariant('top', 'M', mine), -1);
  assert.equal(fitVariant('shoes', '10', mine), 1);
  assert.equal(fitVariant('shoes', '10.5', mine), -1);
});

test('pickVariant skips sold out sizes', () => {
  const piece = { slot: 'shoes', variants: [{ label: '10', available: false, price: 100 }, { label: '11', available: true, price: 100 }] };
  assert.equal(pickVariant(piece, mine), null);
  piece.variants[0].available = true;
  assert.equal(pickVariant(piece, mine).label, '10');
});

test('harmony favours neutrals and punishes a second accent', () => {
  const chosen = [{ colour: 'red' }];
  assert.ok(harmony({ colour: 'red', slot: 'top' }, chosen) > harmony({ colour: 'green', slot: 'top' }, chosen));
  assert.ok(harmony({ colour: 'black', slot: 'top' }, chosen) > harmony({ colour: 'green', slot: 'top' }, chosen));
  assert.ok(harmony({ colour: 'pink', slot: 'belt' }, []) < harmony({ colour: 'black', slot: 'belt' }, []));
});

function fixture(slot, id, extra = {}) {
  const price = extra.price ?? 50;
  return {
    id,
    slot,
    source: 'shopify',
    shop: extra.shop || `Shop ${id}`,
    title: id,
    url: `https://mnml.la/${id}`,
    image: `https://cdn.shopify.com/${id}.jpg`,
    colour: 'black',
    wash: slot === 'bottoms' ? 'mid' : null,
    lanes: ['washed'],
    score: 1,
    variants: [{ label: slot === 'bottoms' ? '34' : slot === 'top' ? 'XL' : slot === 'shoes' ? '10' : 'Default Title', available: true, price }],
    fetchedAt: Date.now(),
    ...extra,
    price,
  };
}

const ALL = ['hat', 'chain', 'top', 'belt', 'bag', 'bottoms', 'shoes'];

function fullPool() {
  const pool = new Pool();
  for (const slot of ALL) pool.add([fixture(slot, `${slot}1`), fixture(slot, `${slot}2`)]);
  return pool;
}

function pricedPool() {
  const pool = new Pool();
  const prices = { hat: [30, 120], chain: [35, 200], top: [28, 450], belt: [25, 450], bag: [60, 900], bottoms: [49, 1090], shoes: [75, 3755] };
  for (const slot of ALL) {
    pool.add(prices[slot].map((price, i) => fixture(slot, `${slot}${i}`, { price })));
  }
  return pool;
}

test('buildFit fills every slot and totals the price', async () => {
  const fit = await buildFit(fullPool(), { sizes: mine });
  assert.equal(Object.keys(fit.pieces).length, 7);
  assert.equal(fit.total, 350);
  assert.equal(fit.lane, 'washed');
  assert.ok(!/[,.]/.test(fit.note));
});

test('buildFit keeps locked pieces and skips seen ones', async () => {
  const locked = { ...fixture('top', 'mytop'), size: 'XL' };
  const fit = await buildFit(fullPool(), { sizes: mine, locked: [locked], seen: ['bottoms1'] });
  assert.equal(fit.pieces.top.id, 'mytop');
  assert.equal(fit.pieces.bottoms.id, 'bottoms2');
});

test('sold out picks get replaced after the parallel check', async () => {
  let checks = 0;
  const fit = await buildFit(fullPool(), {
    sizes: mine,
    hooks: {
      verify: async p => {
        checks++;
        return p.id !== 'top1' && p.id !== 'bottoms1' && p.id !== 'top2' ? true : p.id === 'top2';
      },
    },
    random: () => 0,
  });
  assert.equal(fit.pieces.top.id, 'top2');
  assert.equal(fit.pieces.bottoms.id, 'bottoms2');
  assert.ok(checks >= 7);
});

test('rerollSlot never returns the current piece', async () => {
  const pool = fullPool();
  const fit = await buildFit(pool, { sizes: mine });
  const next = await rerollSlot(pool, { fit, slot: 'top', sizes: mine });
  assert.notEqual(next.id, fit.pieces.top.id);
});

test('fits prefer pieces from different shops', async () => {
  const pool = new Pool();
  for (const slot of ['top', 'bottoms', 'shoes']) {
    pool.add(['A', 'B', 'C'].map(shop => fixture(slot, `${slot}${shop}`, { shop })));
  }
  let spread = 0;
  for (let i = 0; i < 40; i++) {
    const fit = await buildFit(pool, { sizes: mine });
    if (fit.shops > 1) spread++;
  }
  assert.ok(spread >= 38, `spread ${spread}`);
});

test('under budget fits stay at or below 200 and keep the core pieces', async () => {
  for (let i = 0; i < 60; i++) {
    const fit = await buildFit(pricedPool(), { sizes: mine, budget: 200 });
    assert.ok(fit.total <= 200, `total ${fit.total}`);
    for (const slot of ['top', 'bottoms', 'shoes']) assert.ok(fit.pieces[slot], `missing ${slot}`);
  }
});

test('under budget picks a lane that can actually fit', async () => {
  const pool = new Pool();
  const both = ['washed', 'football'];
  pool.add([
    fixture('top', 't', { price: 25, lanes: both }),
    fixture('bottoms', 'b', { price: 40, lanes: both }),
    fixture('shoes', 'pricey', { price: 400, lanes: ['washed'] }),
    fixture('shoes', 'vans', { price: 70, lanes: ['football'] }),
  ]);
  for (let i = 0; i < 30; i++) {
    const fit = await buildFit(pool, { sizes: mine, budget: 200 });
    assert.equal(fit.lane, 'football');
    assert.ok(fit.total <= 200);
  }
  assert.ok(budgetFits(pool, mine, 200));
  assert.ok(!budgetFits(pool, mine, 100));
});

test('without a budget expensive pieces can appear', async () => {
  let over = 0;
  for (let i = 0; i < 40; i++) {
    const fit = await buildFit(pricedPool(), { sizes: mine });
    if (fit.total > 200) over++;
  }
  assert.ok(over > 0);
});

test('an expensive lock still gets the cheapest core pieces', async () => {
  const locked = fixture('top', 'grail', { price: 900 });
  const fit = await buildFit(pricedPool(), { sizes: mine, locked: [locked], budget: 200 });
  assert.equal(fit.pieces.top.id, 'grail');
  assert.equal(fit.pieces.bottoms.price, 49);
  assert.equal(fit.pieces.shoes.price, 75);
  assert.equal(fit.pieces.hat, undefined);
});

test('budget rerolls respect what is left', async () => {
  const pool = pricedPool();
  pool.add([fixture('hat', 'hatCheap', { price: 20 })]);
  const fit = await buildFit(pool, { sizes: mine, budget: 200 });
  fit.pieces.hat = { ...fixture('hat', 'hat0', { price: 30 }), price: 30 };
  const others = Object.values(fit.pieces).filter(p => p.slot !== 'hat').reduce((s, p) => s + p.price, 0);
  const next = await rerollSlot(pool, { fit, slot: 'hat', sizes: mine, budget: 200 });
  if (next) assert.ok(next.price + others <= 200);
});

test('normalizeProduct reads a Shopify product', () => {
  const store = { host: 'mnml.la', name: 'MNML', slots: ['bottoms'] };
  const piece = normalizeProduct({
    id: 1,
    title: 'Baggy Distressed Denim',
    handle: 'baggy',
    product_type: 'Denim',
    vendor: 'MNML',
    tags: [],
    options: [{ name: 'Color' }, { name: 'Size' }],
    images: [{ src: 'https://cdn.shopify.com/a.jpg?v=1' }],
    variants: [{ option1: 'Blue', option2: '32', title: 'Blue / 32', available: true, price: '98.00' }],
  }, store);
  assert.equal(piece.slot, 'bottoms');
  assert.equal(piece.variants[0].label, '32');
  assert.equal(piece.price, 98);
  assert.equal(piece.image, 'https://cdn.shopify.com/a.jpg?width=720');
  assert.equal(piece.url, 'https://mnml.la/products/baggy');
});

test('normalizeProduct drops a slot the store is not on the roster for', () => {
  const store = { host: 'x.test', name: 'X', slots: ['chain'] };
  const piece = normalizeProduct({ id: 1, title: 'Graphic Tee', product_type: 'Tees', images: [{ src: 'https://cdn.shopify.com/a.jpg' }], variants: [{ title: 'L', price: '20', available: true }] }, store);
  assert.equal(piece, null);
});

test('saved list loads and every entry passes the link rules', () => {
  const items = JSON.parse(fs.readFileSync(new URL('../public/data/saved.json', import.meta.url), 'utf8'));
  assert.ok(items.length > 40);
  let usable = 0;
  for (const item of items) {
    const piece = savedPiece(item);
    if (!piece) continue;
    usable++;
    assert.ok(isAllowedLink(piece.url), piece.url);
    assert.ok(isAllowedImage(piece.image), piece.image);
  }
  assert.ok(usable > 40);
});

test('every store only uses https hosts in the roster', () => {
  assert.equal(STORES.length, 27);
  for (const s of STORES) assert.ok(isAllowedLink(`https://${s.host}/products/x`));
});

test('share links round trip a fit', async () => {
  const pool = fullPool();
  const fit = await buildFit(pool, { sizes: mine });
  const code = await encodeFit(fit);
  assert.ok(/^[\w-]+$/.test(code));
  assert.ok(code.length < 4000, `length ${code.length}`);
  const back = await decodeFit(code);
  assert.equal(back.lane, fit.lane);
  assert.equal(back.total, fit.total);
  assert.deepEqual(Object.keys(back.pieces).sort(), Object.keys(fit.pieces).sort());
});

test('share links reject bad input and foreign urls', async () => {
  assert.equal(await decodeFit('not base64 at all'), null);
  assert.equal(await decodeFit('AAAA'), null);
  assert.equal(cleanPiece({ slot: 'top', url: 'https://evil.test/x', image: 'https://cdn.shopify.com/a.jpg' }), null);
  assert.equal(cleanPiece({ slot: 'top', url: 'javascript:alert(1)', image: 'https://cdn.shopify.com/a.jpg' }), null);
  assert.equal(cleanPiece({ slot: 'top', url: 'https://mnml.la/a', image: 'https://evil.test/a.jpg' }), null);
  assert.ok(cleanPiece({ slot: 'top', url: 'https://mnml.la/a', image: 'https://cdn.shopify.com/a.jpg' }));
});

function bandFixture(paint) {
  const size = 100;
  const rgb = new Uint8Array(size * size * 3);
  const mask = new Uint8Array(size * size).fill(255);
  for (let y = 0; y < size; y++) {
    const [r, g, b] = paint(y);
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 3;
      rgb[i] = r;
      rgb[i + 1] = g;
      rgb[i + 2] = b;
    }
  }
  return { rgb, mask, size, box: { top: 0, bottom: size - 1, left: 0, right: size - 1 } };
}

test('legBand crops a model down to the jeans', () => {
  const f = bandFixture(y => (y < 40 ? [180, 80, 70] : y < 90 ? [90, 120, 150] : [230, 230, 230]));
  const band = legBand(f.rgb, f.mask, f.size, f.box);
  assert.equal(band.top, 40);
  assert.equal(band.bottom, 89);
});

test('legBand leaves flat jeans alone', () => {
  const f = bandFixture(() => [90, 120, 150]);
  assert.deepEqual(legBand(f.rgb, f.mask, f.size, f.box), f.box);
});

test('cornerColour reads a plain backdrop and skips busy ones', () => {
  const size = 40;
  const plain = new Uint8Array(size * size * 3).fill(245);
  assert.deepEqual(cornerColour(plain, size, size, 3), [245, 245, 245]);
  const busy = new Uint8Array(size * size * 3).fill(245);
  for (let y = 0; y < 10; y++) for (let x = 0; x < 30; x++) busy.fill(0, (y * size + x) * 3, (y * size + x) * 3 + 3);
  assert.equal(cornerColour(busy, size, size, 3), null);
});

test('maskFromOutput normalises and finds the box', () => {
  const size = 10;
  const raw = new Float32Array(size * size).fill(0.1);
  for (let y = 2; y < 6; y++) for (let x = 3; x < 8; x++) raw[y * size + x] = 0.9;
  const { coverage, box, mask } = maskFromOutput(raw, size);
  assert.deepEqual(box, { top: 2, bottom: 5, left: 3, right: 7 });
  assert.equal(coverage, 0.2);
  assert.equal(mask[0], 0);
  assert.equal(mask[2 * size + 3], 255);
});

test('pieceColour picks the garment colour and uses white for black clothes', () => {
  const paint = (r, g, b) => {
    const data = new Uint8ClampedArray(16 * 4);
    for (let i = 0; i < 16; i++) data.set([r, g, b, 255], i * 4);
    return data;
  };
  assert.deepEqual(pieceColour(paint(15, 15, 15)), [255, 255, 255]);
  assert.deepEqual(pieceColour(paint(200, 200, 200)), [255, 255, 255]);
  const red = pieceColour(paint(180, 40, 40));
  assert.ok(red[0] > 200 && red[1] < 80);
  assert.deepEqual(pieceColour(new Uint8ClampedArray(16)), [255, 255, 255]);
});
