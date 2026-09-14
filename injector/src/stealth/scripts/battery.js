// FWYS Stealth — battery.js
// P2: navigator.getBattery() spoofing

const fp = __FWYS_FP__;
const bat = fp.battery || { charging: false, chargingTime: Infinity, dischargingTime: 54000, level: 0.82 };

if (!navigator.getBattery) return;

// Fake BatteryManager object
const fakeBattery = {
  charging:        bat.charging,
  chargingTime:    bat.chargingTime,
  dischargingTime: bat.dischargingTime,
  level:           bat.level,
  addEventListener:    function() {},
  removeEventListener: function() {},
  dispatchEvent:       function() { return true; },
};

// Freeze it so it can't be mutated to detect the spoof
Object.freeze(fakeBattery);

navigator.getBattery = function() {
  return Promise.resolve(fakeBattery);
};

Object.defineProperty(navigator.getBattery, 'toString', {
  value: () => 'function getBattery() { [native code] }',
  configurable: true,
});
