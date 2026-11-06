import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import * as ort from 'onnxruntime-node';

const SIZE = 320;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];

let session = null;
let sessionFailed = false;
let dir = 'cache/cut';
let modelPath = 'models/silueta.onnx';
const LIMIT = 3;
let active = 0;
const waiting = [];
const running = new Map();

async function withSlot(job) {
  if (active >= LIMIT) await new Promise(resolve => waiting.push(resolve));
  active++;
  try {
    return await job();
  } finally {
    active--;
    waiting.shift()?.();
  }
}

export function configure(options) {
  dir = options.dir;
  modelPath = options.modelPath;
  fs.mkdirSync(dir, { recursive: true });
}

async function getSession() {
  if (session) return session;
  if (sessionFailed || !fs.existsSync(modelPath)) return null;
  try {
    session = await ort.InferenceSession.create(modelPath, {
      executionProviders: ['cpu'],
      intraOpNumThreads: 2,
      interOpNumThreads: 1,
    });
    return session;
  } catch (err) {
    sessionFailed = true;
    console.error('cutout model failed to load', err.message);
    return null;
  }
}

export function keyFor(src, slot = '') {
  return crypto.createHash('sha1').update(`${slot}|${src}`).digest('hex').slice(0, 20);
}

export function legBand(rgb, mask, size, box) {
  const height = box.bottom - box.top + 1;
  if (height < 40) return box;
  const rows = [];
  for (let y = box.top; y <= box.bottom; y++) {
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      if (mask[i] < 128) continue;
      r += rgb[i * 3];
      g += rgb[i * 3 + 1];
      b += rgb[i * 3 + 2];
      n++;
    }
    rows.push(n ? [r / n, g / n, b / n] : null);
  }
  const from = Math.floor(height * 0.58);
  const to = Math.floor(height * 0.72);
  const ref = [0, 0, 0];
  let count = 0;
  for (let i = from; i <= to; i++) {
    if (!rows[i]) continue;
    ref[0] += rows[i][0];
    ref[1] += rows[i][1];
    ref[2] += rows[i][2];
    count++;
  }
  if (!count) return box;
  ref[0] /= count;
  ref[1] /= count;
  ref[2] /= count;
  const differs = row => !row || Math.hypot(row[0] - ref[0], row[1] - ref[1], row[2] - ref[2]) > 55;
  const SUSTAIN = 4;
  let top = 0;
  for (let i = from; i >= SUSTAIN; i--) {
    let shifted = true;
    for (let k = 0; k < SUSTAIN; k++) if (!differs(rows[i - k])) shifted = false;
    if (shifted) {
      top = i + 1;
      break;
    }
  }
  let bottom = height - 1;
  for (let i = to; i < height - SUSTAIN; i++) {
    let shifted = true;
    for (let k = 0; k < SUSTAIN; k++) if (!differs(rows[i + k])) shifted = false;
    if (shifted) {
      bottom = i - 1;
      break;
    }
  }
  if (top < height * 0.08 || top > height * 0.55) top = 0;
  if (bottom > height * 0.97 || bottom < height * 0.8) bottom = height - 1;
  if (top === 0 && bottom === height - 1) return box;
  return { ...box, top: box.top + top, bottom: box.top + bottom };
}

async function predictMask(input) {
  const model = await getSession();
  if (!model) return null;
  const { data } = await sharp(input)
    .resize(SIZE, SIZE, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const tensor = new Float32Array(3 * SIZE * SIZE);
  for (let i = 0; i < SIZE * SIZE; i++) {
    for (let c = 0; c < 3; c++) {
      tensor[c * SIZE * SIZE + i] = (data[i * 3 + c] / 255 - MEAN[c]) / STD[c];
    }
  }
  const feeds = { [model.inputNames[0]]: new ort.Tensor('float32', tensor, [1, 3, SIZE, SIZE]) };
  const output = await model.run(feeds);
  const raw = output[model.outputNames[0]].data;
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < SIZE * SIZE; i++) {
    if (raw[i] < min) min = raw[i];
    if (raw[i] > max) max = raw[i];
  }
  const range = max - min || 1;
  const mask = Buffer.alloc(SIZE * SIZE);
  let covered = 0;
  let top = SIZE;
  let bottom = -1;
  let left = SIZE;
  let right = -1;
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const i = y * SIZE + x;
      const v = (raw[i] - min) / range;
      const a = Math.max(0, Math.min(1, (v - 0.3) / 0.4));
      mask[i] = Math.round(a * 255);
      if (a > 0.5) {
        covered++;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  return { mask, rgb: data, coverage: covered / (SIZE * SIZE), box: { top, bottom, left, right } };
}

export async function skinShare(webp) {
  const { data, info } = await sharp(webp).ensureAlpha().resize(160, 160, { fit: 'inside' }).raw().toBuffer({ resolveWithObject: true });
  let solid = 0;
  let skin = 0;
  for (let i = 0; i < info.width * info.height; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    if (data[i * 4 + 3] < 128) continue;
    solid++;
    const spread = Math.max(r, g, b) - Math.min(r, g, b);
    if (r > 95 && g > 40 && b > 20 && spread > 15 && r - g > 15 && r > b && g > b * 0.8) skin++;
  }
  return solid ? skin / solid : 0;
}

export function cornerColour(rgb, width, height, channels) {
  const patch = Math.min(8, Math.floor(Math.min(width, height) / 4));
  const corners = [[0, 0], [width - patch, 0], [0, height - patch], [width - patch, height - patch]].map(([cx, cy]) => {
    const sum = [0, 0, 0];
    for (let y = cy; y < cy + patch; y++) {
      for (let x = cx; x < cx + patch; x++) {
        const i = (y * width + x) * channels;
        sum[0] += rgb[i];
        sum[1] += rgb[i + 1];
        sum[2] += rgb[i + 2];
      }
    }
    return sum.map(v => v / (patch * patch));
  });
  const mean = [0, 1, 2].map(c => corners.reduce((s, k) => s + k[c], 0) / 4);
  const uneven = corners.some(k => Math.hypot(k[0] - mean[0], k[1] - mean[1], k[2] - mean[2]) > 30);
  return uneven ? null : mean;
}

async function rawFallback(input, file) {
  const out = await sharp(input).rotate().resize(1000, 1000, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  fs.writeFileSync(file, out);
  return out;
}

export async function cutBuffer(input, file, slot = '') {
  const oriented = await sharp(input)
    .rotate()
    .resize(1000, 1000, { fit: 'inside', withoutEnlargement: true })
    .flatten({ background: '#ffffff' })
    .png()
    .toBuffer();
  const { data: rgb, info } = await sharp(oriented).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const backdrop = slot === 'chain' ? cornerColour(rgb, width, height, info.channels) : null;
  if (backdrop) return keyedCut(rgb, info, backdrop, file);
  const result = await predictMask(oriented);
  if (!result || result.coverage < 0.03 || result.coverage > 0.92) return rawFallback(input, file);
  const sigma = Math.max(0.6, (Math.max(width, height) / SIZE) * 0.7);
  const alpha = await sharp(result.mask, { raw: { width: SIZE, height: SIZE, channels: 1 } })
    .resize(width, height, { fit: 'fill', kernel: 'cubic' })
    .blur(sigma)
    .extractChannel(0)
    .raw()
    .toBuffer();
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = rgb[i * info.channels];
    rgba[i * 4 + 1] = rgb[i * info.channels + 1];
    rgba[i * 4 + 2] = rgb[i * info.channels + 2];
    const a = Math.max(0, Math.min(1, (alpha[i] / 255 - 0.38) / 0.24));
    rgba[i * 4 + 3] = Math.round(a * 255);
  }
  const box = slot === 'bottoms' ? legBand(result.rgb, result.mask, SIZE, result.box) : result.box;
  const sx = width / SIZE;
  const sy = height / SIZE;
  const pad = 8;
  const left = Math.max(0, Math.floor(box.left * sx) - pad);
  const top = Math.max(0, Math.floor(box.top * sy) - pad);
  const w = Math.min(width - left, Math.ceil((box.right - box.left + 1) * sx) + pad * 2);
  const h = Math.min(height - top, Math.ceil((box.bottom - box.top + 1) * sy) + pad * 2);
  const out = await sharp(rgba, { raw: { width, height, channels: 4 } })
    .extract({ left, top, width: w, height: h })
    .webp({ quality: 84, alphaQuality: 90, effort: 2 })
    .toBuffer();
  fs.writeFileSync(file, out);
  return out;
}

async function keyedCut(rgb, info, backdrop, file) {
  const { width, height, channels } = info;
  const rgba = Buffer.alloc(width * height * 4);
  let left = width;
  let right = -1;
  let top = height;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const r = rgb[i * channels];
      const g = rgb[i * channels + 1];
      const b = rgb[i * channels + 2];
      const gap = Math.hypot(r - backdrop[0], g - backdrop[1], b - backdrop[2]);
      const a = Math.max(0, Math.min(1, (gap - 14) / 26));
      rgba[i * 4] = r;
      rgba[i * 4 + 1] = g;
      rgba[i * 4 + 2] = b;
      rgba[i * 4 + 3] = Math.round(a * 255);
      if (a > 0.5) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  const pad = 8;
  const x0 = right < 0 ? 0 : Math.max(0, left - pad);
  const y0 = right < 0 ? 0 : Math.max(0, top - pad);
  const w = right < 0 ? width : Math.min(width - x0, right - left + 1 + pad * 2);
  const h = right < 0 ? height : Math.min(height - y0, bottom - top + 1 + pad * 2);
  const out = await sharp(rgba, { raw: { width, height, channels: 4 } })
    .extract({ left: x0, top: y0, width: w, height: h })
    .webp({ quality: 84, alphaQuality: 90, effort: 2 })
    .toBuffer();
  fs.writeFileSync(file, out);
  return out;
}

export function cutout(src, slot = '', fetcher = fetch) {
  const key = keyFor(src, slot);
  const file = path.join(dir, `${key}.webp`);
  if (fs.existsSync(file)) return Promise.resolve(fs.readFileSync(file));
  if (running.has(key)) return running.get(key);
  const job = (async () => {
    const res = await fetcher(src, {
      signal: AbortSignal.timeout(10000),
      headers: { 'User-Agent': 'BallhogFitWizard/0.1', Accept: 'image/avif,image/webp,image/*' },
    });
    if (!res.ok) throw new Error(`image ${res.status}`);
    const length = Number(res.headers.get('content-length') || 0);
    if (length > 15 * 1024 * 1024) throw new Error('image too large');
    const input = Buffer.from(await res.arrayBuffer());
    return withSlot(() => cutBuffer(input, file, slot));
  })().finally(() => running.delete(key));
  running.set(key, job);
  return job;
}
