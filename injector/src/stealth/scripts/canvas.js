// FWYS Stealth — canvas.js
// Subpixel canvas noise that preserves flat fill uniformity,
// 1x1 probe integrity, and subrect (windowed) read consistency.

const fp = __FWYS_FP__;
const _canvasSeed = fp.canvas_seed || fp.canvas?.seed;
if (!_canvasSeed || fp.canvas?.mode === 'off' || fp.noiseLevel === 0 || fp.canvas_noise === false) {
  // Preserve native C++ CanvasRenderingContext2D.prototype.getImageData to pass [native code] integrity
  return;
}

// ── Check if buffer is a flat uniform color (don't perturb flat fills) ────────
function isUniformBuffer(data) {
  if (data.length < 16) return true;
  const r0 = data[0], g0 = data[1], b0 = data[2], a0 = data[3];
  // Sample every 8th pixel up to 64 pixels
  const step = Math.max(4, Math.floor(data.length / 64) * 4);
  for (let i = step; i < data.length; i += step) {
    if (data[i] !== r0 || data[i + 1] !== g0 || data[i + 2] !== b0 || data[i + 3] !== a0) {
      return false;
    }
  }
  return true;
}

// ── Apply deterministic coordinate-based noise ────────────────────────────────
// Deterministic per absolute (absX, absY) so windowed reads match full canvas reads!
function perturbSubrect(data, sx, sy, sw, sh, seed) {
  // Probes (1x1, 2x2) or flat fills are deliberately NOT perturbed
  if (sw <= 2 || sh <= 2 || isUniformBuffer(data)) {
    return;
  }

  for (let y = 0; y < sh; y++) {
    const absY = sy + y;
    for (let x = 0; x < sw; x++) {
      const absX = sx + x;
      const idx = (y * sw + x) * 4;
      const a = data[idx + 3];
      if (a === 0) continue; // Skip fully transparent pixels

      // Fast coordinate-based hash
      let h = (absX * 374761393 + absY * 668265263 + seed) >>> 0;
      h = ((h ^ (h >>> 13)) * 1274126177) >>> 0;

      // Flip 1 bit on lowest bit of B channel with 25% chance
      if ((h & 3) === 1) {
        data[idx + 2] ^= 1;
      }
    }
  }
}

// ── Patch CanvasRenderingContext2D.prototype.getImageData ─────────────────────
if (typeof CanvasRenderingContext2D !== 'undefined' && CanvasRenderingContext2D.prototype.getImageData) {
  const _origGetImageData = CanvasRenderingContext2D.prototype.getImageData;

  const wrapperObj = {
    getImageData(sx, sy, sw, sh, ...rest) {
      if (!(this instanceof CanvasRenderingContext2D)) {
        throw new TypeError("Failed to execute 'getImageData' on 'CanvasRenderingContext2D': Illegal invocation");
      }
      const img = _origGetImageData.call(this, sx, sy, sw, sh, ...rest);
      if (sw > 2 && sh > 2) {
        perturbSubrect(img.data, sx, sy, sw, sh, _canvasSeed);
      }
      return img;
    }
  };
  const nativeGetImageData = wrapperObj.getImageData;
  try { delete nativeGetImageData.prototype; } catch (e) {}

  Object.defineProperty(nativeGetImageData, 'name', { value: 'getImageData', configurable: true });
  Object.defineProperty(nativeGetImageData, 'toString', {
    value: () => 'function getImageData() { [native code] }',
    configurable: true,
  });

  CanvasRenderingContext2D.prototype.getImageData = nativeGetImageData;
}
