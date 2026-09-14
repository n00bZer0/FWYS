// FWYS Stealth — canvas.js
// JS-level canvas noise (fallback if C++ patch not active)

const fp = __FWYS_FP__;
if (!fp.canvas_seed) return;

// Seeded PRNG (same algorithm as C++ patch for consistency)
function hash64(seed, x, y, c) {
  let h = BigInt(seed) ^ (BigInt(x) * 2654435761n) ^ (BigInt(y) * 40503n) ^ (BigInt(c) * 7919n);
  h ^= h >> 33n; h = BigInt.asUintN(64, h * 0xff51afd7ed558ccdbn);
  h ^= h >> 33n; h = BigInt.asUintN(64, h * 0xc4ceb9fe1a85ec53bn);
  h ^= h >> 33n;
  return Number(h & 1n); // 0 or 1
}

const seed = fp.canvas_seed;

// Patch toDataURL
const origToDataURL = HTMLCanvasElement.prototype.toDataURL;
HTMLCanvasElement.prototype.toDataURL = function(...args) {
  applyNoise(this);
  return origToDataURL.apply(this, args);
};
HTMLCanvasElement.prototype.toDataURL.toString = () =>
  'function toDataURL() { [native code] }';

// Patch getImageData
const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
CanvasRenderingContext2D.prototype.getImageData = function(sx, sy, sw, sh, ...rest) {
  const imageData = origGetImageData.call(this, sx, sy, sw, sh, ...rest);
  const data = imageData.data;
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const idx = (y * sw + x) * 4;
      data[idx]     ^= hash64(seed, x + sx, y + sy, 0); // R
      data[idx + 1] ^= hash64(seed, x + sx, y + sy, 1); // G
      data[idx + 2] ^= hash64(seed, x + sx, y + sy, 2); // B
      // alpha unchanged
    }
  }
  return imageData;
};
CanvasRenderingContext2D.prototype.getImageData.toString = () =>
  'function getImageData() { [native code] }';

function applyNoise(canvas) {
  try {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const w = canvas.width, h = canvas.height;
    if (!w || !h) return;
    const id = origGetImageData.call(ctx, 0, 0, w, h);
    const data = id.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        data[idx]     ^= hash64(seed, x, y, 0);
        data[idx + 1] ^= hash64(seed, x, y, 1);
        data[idx + 2] ^= hash64(seed, x, y, 2);
      }
    }
    ctx.putImageData(id, 0, 0);
  } catch (e) { /* silent */ }
}
