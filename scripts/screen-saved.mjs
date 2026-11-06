import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classify } from '../server/rules.js';
import { configure, cutBuffer, skinShare } from '../server/cutout.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, 'data', 'saved.json');
const CHECKED = new Set(['top', 'hat', 'belt', 'bag', 'chain']);
const LIMIT = 0.08;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bhscreen-'));
configure({ dir, modelPath: path.join(root, 'models', 'silueta.onnx') });

const items = JSON.parse(fs.readFileSync(target, 'utf8'));
const kept = [];
const dropped = {};
let next = 0;

async function worker() {
  while (next < items.length) {
    const index = next++;
    const item = items[index];
    const tagged = classify({ title: item.title, type: '', vendor: item.brand, tags: [], colourOption: item.colour });
    if (!tagged || !CHECKED.has(tagged.slot)) {
      kept[index] = item;
      continue;
    }
    try {
      const res = await fetch(item.image, { signal: AbortSignal.timeout(10000), headers: { 'User-Agent': 'BallhogFitWizard/0.1' } });
      if (!res.ok) throw new Error(String(res.status));
      const input = Buffer.from(await res.arrayBuffer());
      const out = await cutBuffer(input, path.join(dir, `${index}.webp`), tagged.slot);
      const share = await skinShare(out);
      if (share > LIMIT) dropped[tagged.slot] = (dropped[tagged.slot] || 0) + 1;
      else kept[index] = item;
    } catch (err) {
      console.error('screen', item.title.slice(0, 40), err.message);
      dropped.failed = (dropped.failed || 0) + 1;
    }
  }
}

await Promise.all([worker(), worker(), worker()]);
const final = kept.filter(Boolean);
fs.writeFileSync(target, JSON.stringify(final, null, 2));
fs.rmSync(dir, { recursive: true, force: true });
console.log(`kept ${final.length} of ${items.length}`, dropped);
