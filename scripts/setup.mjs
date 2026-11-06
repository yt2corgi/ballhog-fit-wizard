import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const target = path.join(root, 'models', 'silueta.onnx');
const url = 'https://github.com/danielgatis/rembg/releases/download/v0.0.0/silueta.onnx';

fs.mkdirSync(path.dirname(target), { recursive: true });
if (fs.existsSync(target)) {
  console.log('model already here');
  process.exit(0);
}
const res = await fetch(url, { redirect: 'follow' });
if (!res.ok) throw new Error(`download failed ${res.status}`);
const buffer = Buffer.from(await res.arrayBuffer());
fs.writeFileSync(target, buffer);
console.log(`saved ${target} ${(buffer.length / 1e6).toFixed(1)} MB`);
