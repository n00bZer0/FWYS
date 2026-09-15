// FWYS Stealth — fonts.js
// Font fingerprint spoofing via FontFaceSet.prototype.check
// We deliberately DO NOT inject random noise into measureText, because:
// 1. Text advances in Chromium strictly adhere to a 1/512 sub-pixel grid.
// 2. Random noise breaks glyph additivity (m*2 != mm), instantly flagging farble/noise spoofing.
// 3. Repeating measurements must return bit-exact numbers across passes and worker realms.

const _fontFP   = __FWYS_FP__.fonts || {};
const _fontList = _fontFP.list || [];

// ── document.fonts.check() — accurately match profile's installed fonts ────────
try {
  if (typeof FontFaceSet !== 'undefined' && FontFaceSet.prototype && FontFaceSet.prototype.check) {
    const _origFontsCheck = FontFaceSet.prototype.check;
    if (_fontList.length > 0) {
      const _fontSet = new Set(_fontList.map(f => f.toLowerCase()));

      const checkFn = function(font, text) {
        if (!(this instanceof FontFaceSet)) {
          throw new TypeError("Failed to execute 'check' on 'FontFaceSet': Illegal invocation");
        }
        const match = font.match(/"([^"]+)"|'([^']+)'|(\S+)$/);
        if (match) {
          const family = (match[1] || match[2] || match[3] || '').toLowerCase();
          if (_fontSet.has(family)) return true;
        }
        return _origFontsCheck.call(this, font, text);
      };

      const wrapper = {
        check(...args) {
          return checkFn.apply(this, args);
        }
      };
      const nativeCheck = wrapper.check;
      try { delete nativeCheck.prototype; } catch (e) {}

      Object.defineProperty(nativeCheck, 'name', { value: 'check', configurable: true });
      Object.defineProperty(nativeCheck, 'toString', {
        value: () => 'function check() { [native code] }',
        configurable: true,
      });

      FontFaceSet.prototype.check = nativeCheck;
    }
  }
} catch (e) {}
