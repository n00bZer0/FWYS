// FWYS Stealth — fonts.js
// P1: Font fingerprint spoofing via measureText noise
// Canvas measureText() is the PRIMARY font detection method.
// We add sub-pixel noise to width measurement — consistent per profile.
// Also spoof document.fonts API.

const _fontFP   = __FWYS_FP__.fonts || {};
const _fontList = _fontFP.list || [];
const _fontSeed = (__FWYS_FP__.canvas && __FWYS_FP__.canvas.seed) || 87654321;

// ── PRNG from canvas seed (same seed as canvas noise for consistency) ─────────
const _fontRand = (() => {
    let s = (_fontSeed ^ 0x1337BEEF) >>> 0;
    return () => {
        s ^= s << 13; s ^= s >> 17; s ^= s << 5;
        return (s >>> 0) / 4294967296;
    };
})();

// ── Per-glyph noise magnitude ─────────────────────────────────────────────────
const NOISE_MAG = 0.000001; // Undetectable visually, changes fingerprint hash

// ── CanvasRenderingContext2D.prototype.measureText ────────────────────────────
const _origMeasureText = CanvasRenderingContext2D.prototype.measureText;
Object.defineProperty(CanvasRenderingContext2D.prototype, 'measureText', {
    value: function(text) {
        const result = _origMeasureText.call(this, text);
        // Create a proxy that adds noise to all numeric properties
        return new Proxy(result, {
            get(target, prop) {
                const val = target[prop];
                if (typeof val === 'number') {
                    // Add deterministic noise based on text + prop
                    const noise = (_fontRand() * 2 - 1) * NOISE_MAG;
                    return val + noise;
                }
                return val;
            }
        });
    },
    configurable: true,
    writable: true,
});
Object.defineProperty(CanvasRenderingContext2D.prototype.measureText, 'toString', {
    value: () => 'function measureText() { [native code] }',
    configurable: true,
});

// ── OffscreenCanvasRenderingContext2D too (same patch) ────────────────────────
try {
    if (typeof OffscreenCanvasRenderingContext2D !== 'undefined') {
        const _origMeasureOff = OffscreenCanvasRenderingContext2D.prototype.measureText;
        Object.defineProperty(OffscreenCanvasRenderingContext2D.prototype, 'measureText', {
            value: function(text) {
                const result = _origMeasureOff.call(this, text);
                return new Proxy(result, {
                    get(target, prop) {
                        const val = target[prop];
                        if (typeof val === 'number') {
                            return val + (_fontRand() * 2 - 1) * NOISE_MAG;
                        }
                        return val;
                    }
                });
            },
            configurable: true,
            writable: true,
        });
    }
} catch(e) { /* ignore if not available */ }

// ── document.fonts.check() — pretend profile fonts are installed ──────────────
// Sites call this to enumerate available fonts
try {
    const _origFontsCheck = FontFaceSet.prototype.check;
    if (_origFontsCheck && _fontList.length > 0) {
        const _fontSet = new Set(_fontList.map(f => f.toLowerCase()));

        Object.defineProperty(FontFaceSet.prototype, 'check', {
            value: function(font, text) {
                // Extract font family from CSS font string
                // e.g. '12px "Arial"' → 'arial'
                const match = font.match(/"([^"]+)"|'([^']+)'|(\S+)$/);
                if (match) {
                    const family = (match[1] || match[2] || match[3] || '').toLowerCase();
                    if (_fontSet.has(family)) return true;
                    // Fallback to real check for non-profile fonts
                }
                return _origFontsCheck.call(this, font, text);
            },
            configurable: true,
            writable: true,
        });
        Object.defineProperty(FontFaceSet.prototype.check, 'toString', {
            value: () => 'function check() { [native code] }',
            configurable: true,
        });
    }
} catch(e) { /* ignore */ }
