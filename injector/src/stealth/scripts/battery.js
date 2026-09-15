// FWYS Stealth — battery.js
// P2: navigator.getBattery() spoofing adhering strictly to W3C Battery Status invariants

const fp = __FWYS_FP__;
const bat = fp.battery || { charging: true, chargingTime: 0, dischargingTime: Infinity, level: 1.0 };

const navProto = (typeof Navigator !== 'undefined') ? Navigator.prototype : Object.getPrototypeOf(navigator);
if (typeof navigator !== 'undefined' && typeof navigator.getBattery === 'function') {
  // Chromium implements getBattery() natively in C++.
  // Preserving native implementation ensures Function.prototype.toString returns [native code].
  return;
}
if (!navProto) return;

// W3C Battery Status Spec Invariants:
// 1. If charging is true -> dischargingTime MUST be Infinity, chargingTime is finite (or 0).
// 2. If charging is false -> chargingTime MUST be Infinity, dischargingTime is finite.
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

try {
  delete navigator.getBattery; // Ensure no own property shadows prototype
} catch (e) {}

const getBatteryFn = function() {
  if (!(this instanceof Navigator) && this !== navProto) {
    throw new TypeError("Failed to execute 'getBattery' on 'Navigator': Illegal invocation");
  }
  return Promise.resolve(fakeBattery);
};

const wrapperObj = {
  getBattery(...args) {
    return getBatteryFn.apply(this, args);
  }
};
const nativeGetBattery = wrapperObj.getBattery;
try { delete nativeGetBattery.prototype; } catch (e) {}

Object.defineProperty(nativeGetBattery, 'name', { value: 'getBattery', configurable: true });
Object.defineProperty(nativeGetBattery, 'toString', {
  value: () => 'function getBattery() { [native code] }',
  configurable: true,
});

navProto.getBattery = nativeGetBattery;
