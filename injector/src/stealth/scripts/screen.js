// FWYS Stealth — screen.js
// P1: Override Screen.prototype properties and devicePixelRatio
// Real browsers expose screen dimensions via Screen.prototype getters, NOT own properties on screen instance.

const fp = __FWYS_FP__;
const sc = fp.screen || {};

if (!sc.width) return; // no screen config — skip

const screenProto = (typeof Screen !== 'undefined') ? Screen.prototype : Object.getPrototypeOf(screen);

// ── Helper: define native getter on Screen.prototype ─────────────────────────
function defScreenProto(prop, value) {
  try {
    delete screen[prop]; // Ensure no own property shadows the prototype
  } catch (e) {}

  if (!screenProto) return;

  const getter = function() {
    if (!(this instanceof Screen) && this !== screenProto) {
      throw new TypeError("Illegal invocation");
    }
    return value;
  };
  Object.defineProperty(getter, 'name', { value: `get ${prop}`, configurable: true });
  Object.defineProperty(getter, 'toString', {
    value: () => `function get ${prop}() { [native code] }`,
    configurable: true,
  });

  Object.defineProperty(screenProto, prop, {
    get: getter,
    set: undefined,
    enumerable: true,
    configurable: true,
  });
}

// ── Screen.prototype dimensions & depths ─────────────────────────────────────
// Only override if configured value differs from native C++ getters.
// Leaving native getters untouched guarantees genuine C++ [native code] across all iframes!
if (sc.width && sc.width !== screen.width) {
  defScreenProto('width', sc.width);
}
if (sc.height && sc.height !== screen.height) {
  defScreenProto('height', sc.height);
}
if (sc.availWidth && sc.availWidth !== screen.availWidth) {
  defScreenProto('availWidth', sc.availWidth);
}
if (sc.availHeight && sc.availHeight !== screen.availHeight) {
  defScreenProto('availHeight', sc.availHeight);
}
if (sc.colorDepth && sc.colorDepth !== screen.colorDepth) {
  defScreenProto('colorDepth', sc.colorDepth);
}
if (sc.pixelDepth && sc.pixelDepth !== screen.pixelDepth) {
  defScreenProto('pixelDepth', sc.pixelDepth);
}

// ── screen.orientation ────────────────────────────────────────────────────────
if (screen.orientation) {
  try {
    const ori = sc.orientation || { type: 'landscape-primary', angle: 0 };
    Object.defineProperty(screen.orientation, 'type',  { get: () => ori.type,  configurable: true });
    Object.defineProperty(screen.orientation, 'angle', { get: () => ori.angle, configurable: true });
  } catch(e) {}
}

// ── window.devicePixelRatio ───────────────────────────────────────────────────
if (sc.devicePixelRatio) {
  try {
    const dpr = sc.devicePixelRatio;
    Object.defineProperty(window, 'devicePixelRatio', {
      get: function() { return dpr; },
      configurable: true,
      enumerable: true,
    });
  } catch(e) {}
}

// NOTE: We deliberately do NOT override window.innerWidth / innerHeight / outerWidth / outerHeight in JS!
// Overriding them in JS causes fatal contradictions with CSS @media viewport, visualViewport,
// and physical pointer event screenX/clientX arithmetic. Window dimensions are sized naturally
// via Chromium's --window-size launch flag!
