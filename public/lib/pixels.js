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

export function cornerColour(pixels, width, height, channels) {
  const patch = Math.min(8, Math.floor(Math.min(width, height) / 4));
  const corners = [[0, 0], [width - patch, 0], [0, height - patch], [width - patch, height - patch]].map(([cx, cy]) => {
    const sum = [0, 0, 0];
    for (let y = cy; y < cy + patch; y++) {
      for (let x = cx; x < cx + patch; x++) {
        const i = (y * width + x) * channels;
        sum[0] += pixels[i];
        sum[1] += pixels[i + 1];
        sum[2] += pixels[i + 2];
      }
    }
    return sum.map(v => v / (patch * patch));
  });
  const mean = [0, 1, 2].map(c => corners.reduce((s, k) => s + k[c], 0) / 4);
  const uneven = corners.some(k => Math.hypot(k[0] - mean[0], k[1] - mean[1], k[2] - mean[2]) > 30);
  return uneven ? null : mean;
}

export function maskFromOutput(raw, size) {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < size * size; i++) {
    if (raw[i] < min) min = raw[i];
    if (raw[i] > max) max = raw[i];
  }
  const range = max - min || 1;
  const mask = new Uint8ClampedArray(size * size);
  let covered = 0;
  let top = size;
  let bottom = -1;
  let left = size;
  let right = -1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const v = (raw[i] - min) / range;
      mask[i] = Math.round(v * 255);
      if (v > 0.5) {
        covered++;
        if (y < top) top = y;
        if (y > bottom) bottom = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  return { mask, coverage: covered / (size * size), box: { top, bottom, left, right } };
}

export function pieceColour(data) {
  let weight = 0;
  let r = 0;
  let g = 0;
  let b = 0;
  let solid = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    solid++;
    const max = Math.max(data[i], data[i + 1], data[i + 2]);
    const min = Math.min(data[i], data[i + 1], data[i + 2]);
    const w = (max - min) * (max / 255) + 0.5;
    r += data[i] * w;
    g += data[i + 1] * w;
    b += data[i + 2] * w;
    weight += w;
  }
  if (!solid || !weight) return [255, 255, 255];
  const out = [r / weight, g / weight, b / weight];
  const top = Math.max(...out);
  const low = Math.min(...out);
  if (top < 70 || top - low < 24) return [255, 255, 255];
  const lift = 230 / top;
  return out.map(v => Math.min(255, Math.round(v * lift)));
}
