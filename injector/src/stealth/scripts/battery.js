// FWYS Stealth — battery.js
// P2: navigator.getBattery() spoofing adhering strictly to W3C Battery Status invariants
// Strategy: wrap native getBattery — don't skip it! Native exists in Chromium.

const fp = __FWYS_FP__;
const bat = fp.battery || { charging: true, chargingTime: 0, dischargingTime: Infinity, level: 1.0 };

const navProto = (typeof Navigator !== 'undefined') ? Navigator.prototype : Object.getPrototypeOf(navigator);
if (!navProto) return;

// W3C Battery Status Spec Invariants:
// 1. If charging is true → dischargingTime MUST be Infinity, chargingTime is finite (or 0).
// 2. If charging is false → chargingTime MUST be Infinity, dischargingTime is finite.
// 3. level is in range [0.0, 1.0].
const isCharging = (bat.charging === true || bat.level === 1.0);
const safeLevel  = (typeof bat.level === 'number' && bat.level >= 0 && bat.level <= 1) ? bat.level : 1.0;

const fakeBattery = {
  charging:        isCharging,
  chargingTime:    isCharging ? 0 : Infinity,
  dischargingTime: isCharging ? Infinity : (bat.dischargingTime || 5400),
  level:           safeLevel,
  onchargingchange:        null,
  onchargingtimechange:    null,
  ondischargingtimechange: null,
  onlevelchange:           null,
  addEventListener:    function() {},
  removeEventListener: function() {},
  dispatchEvent:       function() { return true; },
};
Object.freeze(fakeBattery);

// ── Always wrap getBattery — even if native exists ────────────────────────────
// Old code returned early here if native exists. That was wrong.
// We wrap via prototype so native calls are intercepted and our fake battery is returned.
const wrapperObj = {
  getBattery(...args) {
    // Brand-check: must be invoked on a Navigator instance
    if (!(this instanceof Navigator) && this !== navProto) {
      throw new TypeError("Failed to execute 'getBattery' on 'Navigator': Illegal invocation");
    }
    return Promise.resolve(fakeBattery);
  }
};
const nativeGetBattery = wrapperObj.getBattery;
try { delete nativeGetBattery.prototype; } catch (e) {}

Object.defineProperty(nativeGetBattery, 'name', { value: 'getBattery', configurable: true });
Object.defineProperty(nativeGetBattery, 'toString', {
  value: () => 'function getBattery() { [native code] }',
  configurable: true,
});

// Override on prototype (covers all frames, workers that inherit it)
try {
  Object.defineProperty(navProto, 'getBattery', {
    value: nativeGetBattery,
    writable: true,
    configurable: true,
    enumerable: true,
  });
} catch (e) {}
