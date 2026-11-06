import test from 'node:test';
import assert from 'node:assert/strict';
import { classify, displaySize, fitVariant, harmony, isBlocked, pickVariant, readShoe, readTop, readWaist } from '../server/rules.js';
import { buildFit, Pool, rerollSlot } from '../server/generator.js';
import { sizeFromTitle, normalizeItem } from '../server/ebay.js';
import { normalizeProduct } from '../server/shopify.js';
import { applyVerdict, configure, vetPiece } from '../server/claude.js';
import { isAllowedImage } from '../server/stores.js';
import { configure as configureCut, cornerColour, cutBuffer, legBand, skinShare } from '../server/cutout.js';
import { checkLinks } from '../server/saved.js';
import sharp from 'sharp';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

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

test('jnco jeans count as baggy without the word', () => {
  const tagged = classify({ title: 'Cheyenne. 20". Superdark Stone.', type: 'Jeans', vendor: 'JNCO' });
  assert.equal(tagged.slot, 'bottoms');
  assert.ok(tagged.lanes.includes('football'));
});

test('jnco rave widths and novelty collabs are out', () => {
  assert.equal(classify({ title: 'Polar Bear. 28". Vintage Stone.', type: 'Jeans', vendor: 'JNCO' }), null);
  assert.equal(classify({ title: 'Minecraft Herschel Classic XL Backpack' }), null);
  assert.equal(classify({ title: 'Persona 5 Royal x King Ice Necklace' }), null);
  assert.equal(classify({ title: 'Twin Cannon. 20". Vintage Stone.', type: 'Jeans', vendor: 'JNCO' }).slot, 'bottoms');
});

test('size labels read cleanly', () => {
  assert.equal(displaySize('top', 'Size US L'), 'L');
  assert.equal(displaySize('belt', 'Size OS'), null);
  assert.equal(displaySize('shoes', '43'), 'EU 43');
  assert.equal(displaySize('shoes', '10.5'), '10.5');
  assert.equal(displaySize('bottoms', '32'), '32');
  assert.equal(displaySize('hat', 'One Size'), null);
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
  assert.equal(readTop('Size US XL'), 'XL');
  assert.equal(readTop('50'), 'L');
  assert.equal(readShoe('10.5'), 10.5);
  assert.equal(readShoe('US 10'), 10);
  assert.equal(readShoe('M 10 / W 11.5'), 10);
  assert.equal(readShoe('UK 9'), 10);
  assert.equal(readShoe('43'), 10);
});

test('sizes up bottoms and tops but keeps shoes exact', () => {
  assert.ok(fitVariant('bottoms', '32', mine) >= 0);
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
  return {
    id,
    slot,
    source: 'shopify',
    shop: extra.shop || `Shop ${id}`,
    title: id,
    url: `https://x.test/${id}`,
    image: `https://x.test/${id}.jpg`,
    price: 50,
    colour: 'black',
    wash: slot === 'bottoms' ? 'mid' : null,
    lanes: ['washed'],
    score: 1,
    variants: [{ label: slot === 'bottoms' ? '34' : slot === 'top' ? 'XL' : slot === 'shoes' ? '10' : 'Default Title', available: true, price: 50 }],
    fetchedAt: Date.now(),
    ...extra,
  };
}

function fullPool() {
  const pool = new Pool();
  for (const slot of ['hat', 'chain', 'top', 'belt', 'bag', 'bottoms', 'shoes']) {
    pool.add([fixture(slot, `${slot}1`), fixture(slot, `${slot}2`)]);
  }
  return pool;
}

test('buildFit fills every slot and totals the price', async () => {
  const fit = await buildFit(fullPool(), { sizes: mine });
  assert.equal(Object.keys(fit.pieces).length, 7);
  assert.equal(fit.total, 350);
  assert.equal(fit.lane, 'washed');
  assert.ok(fit.note.length > 0);
  assert.ok(!/[,.]/.test(fit.note));
});

test('buildFit keeps locked pieces and skips seen ones', async () => {
  const locked = { ...fixture('top', 'mytop'), size: 'XL' };
  const fit = await buildFit(fullPool(), { sizes: mine, locked: [locked], seen: ['bottoms1'] });
  assert.equal(fit.pieces.top.id, 'mytop');
  assert.equal(fit.pieces.bottoms.id, 'bottoms2');
});

test('buildFit drops pieces that fail the Claude check or sold out', async () => {
  const fit = await buildFit(fullPool(), {
    sizes: mine,
    hooks: {
      vet: async p => ({ keep: p.id !== 'shoes1' }),
      verify: async p => p.id !== 'hat1',
    },
  });
  assert.equal(fit.pieces.shoes.id, 'shoes2');
  assert.equal(fit.pieces.hat.id, 'hat2');
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
    pool.add([fixture(slot, `${slot}A`, { shop: 'A' }), fixture(slot, `${slot}B`, { shop: 'B' }), fixture(slot, `${slot}C`, { shop: 'C' })]);
  }
  let spread = 0;
  for (let i = 0; i < 40; i++) {
    const fit = await buildFit(pool, { sizes: mine });
    if (fit.shops > 1) spread++;
  }
  assert.ok(spread >= 38, `spread ${spread}`);
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
  assert.equal(piece.image, 'https://cdn.shopify.com/a.jpg?width=900');
  assert.equal(piece.url, 'https://mnml.la/products/baggy');
});

test('normalizeProduct drops a slot the store is not on the roster for', () => {
  const store = { host: 'x.test', name: 'X', slots: ['chain'] };
  const piece = normalizeProduct({ id: 1, title: 'Graphic Tee', product_type: 'Tees', images: [{ src: 'https://cdn.shopify.com/a.jpg' }], variants: [{ title: 'L', price: '20', available: true }] }, store);
  assert.equal(piece, null);
});

test('eBay titles give sizes and reject unsized clothing', () => {
  assert.equal(sizeFromTitle('bottoms', 'True Religion Baggy Jeans 34x32 Distressed'), '34 / 32');
  assert.equal(sizeFromTitle('bottoms', 'Baggy Jeans Size 36'), '36');
  assert.equal(sizeFromTitle('top', 'Vintage Band Tee Size XL'), 'XL');
  assert.equal(sizeFromTitle('shoes', 'Vans Sk8 Hi Mens 10.5'), '10.5');
  const item = { itemId: '9', title: 'Baggy Distressed Jeans', price: { value: '40', currency: 'USD' }, image: { imageUrl: 'https://i.ebayimg.com/a.jpg' }, itemWebUrl: 'https://www.ebay.com/itm/9' };
  assert.equal(normalizeItem(item, 'bottoms'), null);
  assert.equal(normalizeItem({ ...item, title: 'Baggy Distressed Jeans 34x32' }, 'bottoms').variants[0].label, '34 / 32');
});

test('Claude verdicts are saved so each listing is paid once', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bh-'));
  try {
    configure(dir);
    let calls = 0;
    const api = {
      beta: {
        messages: {
          create: async req => {
            calls++;
            assert.equal(req.output_config.format.type, 'json_schema');
            assert.equal(req.messages[0].content[0].source.type, 'url');
            return {
              stop_reason: 'end_turn',
              usage: { input_tokens: 1000, output_tokens: 100 },
              content: [{ type: 'text', text: JSON.stringify({ keep: true, slot: 'top', lanes: ['wax'], colour: 'black', wash: 'none' }) }],
            };
          },
        },
      },
    };
    const piece = { id: 'p1', title: 'Tee', shop: 'S', slot: 'top', lanes: ['washed'], colour: 'unknown', wash: null, thumb: 'https://x.test/a.jpg' };
    const first = await vetPiece(piece, api);
    const second = await vetPiece(piece, api);
    assert.equal(calls, 1);
    assert.equal(first.keep, true);
    assert.deepEqual(second, first);
    const applied = applyVerdict(piece, first);
    assert.deepEqual(applied.lanes, ['wax']);
    assert.equal(applied.colour, 'black');
  } finally {
    configure('cache');
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('Claude refusals and spend cap leave the piece unjudged', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bh-'));
  try {
    configure(dir);
    const refusing = { beta: { messages: { create: async () => ({ stop_reason: 'refusal', usage: { input_tokens: 10, output_tokens: 0 }, content: [] }) } } };
    const piece = { id: 'p2', title: 'Tee', shop: 'S', slot: 'top', thumb: 'https://x.test/a.jpg' };
    assert.equal(await vetPiece(piece, refusing), null);
    process.env.CLAUDE_DAILY_CAP_USD = '0';
    const never = { beta: { messages: { create: async () => { throw new Error('should not call'); } } } };
    assert.equal(await vetPiece({ ...piece, id: 'p3' }, never), null);
  } finally {
    delete process.env.CLAUDE_DAILY_CAP_USD;
    configure('cache');
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function bandFixture(paint) {
  const size = 100;
  const rgb = Buffer.alloc(size * size * 3);
  const mask = Buffer.alloc(size * size, 255);
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
  const plain = Buffer.alloc(size * size * 3, 245);
  assert.deepEqual(cornerColour(plain, size, size, 3), [245, 245, 245]);
  const busy = Buffer.alloc(size * size * 3, 245);
  for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) busy.fill(0, (y * size + x) * 3, (y * size + x) * 3 + 3);
  assert.equal(cornerColour(busy, size, size, 3), null);
});

test('skinShare spots a body shot and passes a black belt', async () => {
  const solid = colour => sharp({ create: { width: 60, height: 60, channels: 4, background: colour } }).webp().toBuffer();
  assert.ok(await skinShare(await solid({ r: 214, g: 160, b: 130, alpha: 1 })) > 0.9);
  assert.equal(await skinShare(await solid({ r: 20, g: 20, b: 20, alpha: 1 })), 0);
  assert.equal(await skinShare(await solid({ r: 214, g: 160, b: 130, alpha: 0 })), 0);
});

test('saved links are not rechecked within a day', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bhsaved-'));
  try {
    const file = path.join(dir, 'saved.json');
    fs.writeFileSync(file, JSON.stringify([{ url: 'https://x.test/a', checkedAt: new Date().toISOString() }]));
    let calls = 0;
    const out = await checkLinks(file, async () => { calls++; return { status: 200 }; });
    assert.equal(calls, 0);
    assert.equal(out.checked, 0);
    fs.writeFileSync(file, JSON.stringify([{ url: 'https://x.test/a' }]));
    const again = await checkLinks(file, async () => { calls++; return { status: 404 }; });
    assert.equal(calls, 1);
    assert.equal(again.dead, 1);
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8'))[0].dead, true);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('a thin chain on a plain backdrop gets keyed out', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bhkey-'));
  try {
    configureCut({ dir, modelPath: path.resolve('models/silueta.onnx') });
    const input = await sharp({ create: { width: 500, height: 500, channels: 3, background: '#f4f4f4' } })
      .composite([{ input: await sharp({ create: { width: 6, height: 300, channels: 3, background: '#303030' } }).png().toBuffer(), left: 240, top: 100 }])
      .png()
      .toBuffer();
    const file = path.join(dir, 'chain.webp');
    await cutBuffer(input, file, 'chain');
    const written = fs.readFileSync(file);
    const meta = await sharp(written).metadata();
    const stats = await sharp(written).stats();
    assert.ok(meta.hasAlpha);
    assert.ok(meta.width < 40, `width ${meta.width}`);
    assert.ok(stats.channels[3].max > 200);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('sold out picks get replaced after the parallel check', async () => {
  let checks = 0;
  const pool = fullPool();
  const fit = await buildFit(pool, {
    sizes: mine,
    hooks: {
      verify: async p => {
        checks++;
        return p.id !== 'top1' && p.id !== 'bottoms1';
      },
    },
    random: () => 0,
  });
  assert.equal(fit.pieces.top.id, 'top2');
  assert.equal(fit.pieces.bottoms.id, 'bottoms2');
  assert.ok(checks >= 7);
});

test('real alpha lands in the cut image', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bhcut-'));
  try {
    configureCut({ dir, modelPath: path.resolve('models/silueta.onnx') });
    const input = await sharp({ create: { width: 600, height: 600, channels: 3, background: '#ffffff' } })
      .composite([{ input: await sharp({ create: { width: 300, height: 400, channels: 3, background: '#1b2a6b' } }).png().toBuffer(), left: 150, top: 100 }])
      .jpeg()
      .toBuffer();
    const file = path.join(dir, 'x.webp');
    await cutBuffer(input, file, 'top');
    const written = fs.readFileSync(file);
    const meta = await sharp(written).metadata();
    const stats = await sharp(written).stats();
    assert.ok(meta.hasAlpha);
    assert.ok(stats.channels[3].min < 40);
    assert.ok(stats.channels[3].max > 200);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('cut route only accepts known image hosts', () => {
  assert.ok(isAllowedImage('https://cdn.shopify.com/a.jpg'));
  assert.ok(!isAllowedImage('https://evil.test/a.jpg'));
  assert.ok(!isAllowedImage('http://cdn.shopify.com/a.jpg'));
  assert.ok(!isAllowedImage('file:///etc/passwd'));
});
