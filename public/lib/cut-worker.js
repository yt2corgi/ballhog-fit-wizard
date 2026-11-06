import * as ort from '../vendor/ort.wasm.min.mjs';
import { cornerColour, legBand, maskFromOutput } from './pixels.js';

const SIZE = 320;
const MAX = 720;
const MEAN = [0.485, 0.456, 0.406];
const STD = [0.229, 0.224, 0.225];
const CACHE = 'bh-cuts-v1';

ort.env.wasm.numThreads = 1;
ort.env.wasm.wasmPaths = new URL('../vendor/', import.meta.url).href;

let session = null;

function getSession() {
  if (!session) {
    session = ort.InferenceSession.create(new URL('../models/u2netp.onnx', import.meta.url).href, { executionProviders: ['wasm'] });
  }
  return session;
}

function cacheRequest(src, slot) {
  return new Request(new URL(`__cut/${slot}/${encodeURIComponent(src)}`, self.location.href).href);
}

async function fromCache(src, slot) {
  try {
    const store = await caches.open(CACHE);
    const hit = await store.match(cacheRequest(src, slot));
    return hit ? await hit.blob() : null;
  } catch {
    return null;
  }
}

async function toCache(src, slot, blob) {
  try {
    const store = await caches.open(CACHE);
    await store.put(cacheRequest(src, slot), new Response(blob, { headers: { 'Content-Type': blob.type } }));
  } catch {}
}

async function encode(pixels, width, height, box) {
  const canvas = new OffscreenCanvas(width, height);
  canvas.getContext('2d').putImageData(new ImageData(pixels, width, height), 0, 0);
  const out = new OffscreenCanvas(box.w, box.h);
  out.getContext('2d').drawImage(canvas, box.x, box.y, box.w, box.h, 0, 0, box.w, box.h);
  return out.convertToBlob({ type: 'image/webp', quality: 0.85 });
}

function keyed(pixels, width, height, backdrop) {
  let left = width;
  let right = -1;
  let top = height;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const gap = Math.hypot(pixels[i] - backdrop[0], pixels[i + 1] - backdrop[1], pixels[i + 2] - backdrop[2]);
      const a = Math.max(0, Math.min(1, (gap - 14) / 26));
      pixels[i + 3] = Math.round(a * 255);
      if (a > 0.5) {
        if (x < left) left = x;
        if (x > right) right = x;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
      }
    }
  }
  if (right < 0) return { x: 0, y: 0, w: width, h: height };
  const pad = 6;
  const x = Math.max(0, left - pad);
  const y = Math.max(0, top - pad);
  return { x, y, w: Math.min(width - x, right - left + 1 + pad * 2), h: Math.min(height - y, bottom - top + 1 + pad * 2) };
}

async function cut(src, slot) {
  const cached = await fromCache(src, slot);
  if (cached) return cached;
  const res = await fetch(src, { mode: 'cors', credentials: 'omit' });
  if (!res.ok) throw new Error(`image ${res.status}`);
  const bitmap = await createImageBitmap(await res.blob());
  const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const stage = new OffscreenCanvas(width, height);
  const ctx = stage.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  const full = ctx.getImageData(0, 0, width, height);
  if (slot === 'chain') {
    const backdrop = cornerColour(full.data, width, height, 4);
    if (backdrop) {
      const box = keyed(full.data, width, height, backdrop);
      const blob = await encode(full.data, width, height, box);
      await toCache(src, slot, blob);
      return blob;
    }
  }
  const small = new OffscreenCanvas(SIZE, SIZE);
  const smallCtx = small.getContext('2d', { willReadFrequently: true });
  smallCtx.drawImage(stage, 0, 0, SIZE, SIZE);
  const rgba = smallCtx.getImageData(0, 0, SIZE, SIZE).data;
  const tensor = new Float32Array(3 * SIZE * SIZE);
  const rgb = new Uint8Array(3 * SIZE * SIZE);
  for (let i = 0; i < SIZE * SIZE; i++) {
    for (let c = 0; c < 3; c++) {
      const v = rgba[i * 4 + c];
      rgb[i * 3 + c] = v;
      tensor[c * SIZE * SIZE + i] = (v / 255 - MEAN[c]) / STD[c];
    }
  }
  const model = await getSession();
  const output = await model.run({ [model.inputNames[0]]: new ort.Tensor('float32', tensor, [1, 3, SIZE, SIZE]) });
  const { mask, coverage, box } = maskFromOutput(output[model.outputNames[0]].data, SIZE);
  if (coverage < 0.03 || coverage > 0.92) throw new Error('coverage');
  const maskCanvas = new OffscreenCanvas(SIZE, SIZE);
  const maskCtx = maskCanvas.getContext('2d');
  const maskPixels = new ImageData(SIZE, SIZE);
  for (let i = 0; i < SIZE * SIZE; i++) {
    maskPixels.data[i * 4] = mask[i];
    maskPixels.data[i * 4 + 3] = 255;
  }
  maskCtx.putImageData(maskPixels, 0, 0);
  const scaled = new OffscreenCanvas(width, height);
  const scaledCtx = scaled.getContext('2d', { willReadFrequently: true });
  scaledCtx.imageSmoothingEnabled = true;
  scaledCtx.imageSmoothingQuality = 'high';
  scaledCtx.drawImage(maskCanvas, 0, 0, width, height);
  const alpha = scaledCtx.getImageData(0, 0, width, height).data;
  for (let i = 0; i < width * height; i++) {
    const a = Math.max(0, Math.min(1, (alpha[i * 4] / 255 - 0.38) / 0.24));
    full.data[i * 4 + 3] = Math.round(a * 255);
  }
  const band = slot === 'bottoms' ? legBand(rgb, mask, SIZE, box) : box;
  const sx = width / SIZE;
  const sy = height / SIZE;
  const pad = 6;
  const x = Math.max(0, Math.floor(band.left * sx) - pad);
  const y = Math.max(0, Math.floor(band.top * sy) - pad);
  const blob = await encode(full.data, width, height, {
    x,
    y,
    w: Math.min(width - x, Math.ceil((band.right - band.left + 1) * sx) + pad * 2),
    h: Math.min(height - y, Math.ceil((band.bottom - band.top + 1) * sy) + pad * 2),
  });
  await toCache(src, slot, blob);
  return blob;
}

self.onmessage = async ({ data }) => {
  try {
    const blob = await cut(data.src, data.slot);
    self.postMessage({ id: data.id, blob });
  } catch (err) {
    self.postMessage({ id: data.id, error: String(err?.message || err) });
  }
};
