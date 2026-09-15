// FWYS Stealth — network_info.js
// P3: navigator.connection (Network Information API) spoofing
// Obey Chromium 25ms RTT quantization strictly

const fp = __FWYS_FP__;
const net = fp.network || {};

if (typeof navigator !== 'undefined' && navigator.connection) {
  // Chromium already implements navigator.connection natively in C++.
  // Preserving native implementation ensures Function.prototype.toString returns [native code].
  return;
}

const navProto = (typeof Navigator !== 'undefined') ? Navigator.prototype : ((typeof navigator !== 'undefined') ? Object.getPrototypeOf(navigator) : null);
if (!navProto) return;

const connType = net.connectionType || '4g';
const downlink = net.downlink || 10;
// Chromium NetworkInformation strictly quantizes RTT to 25ms multiples (0, 25, 50, 75, 100...)
const rawRtt = Number(net.rtt) || 50;
const quantizedRtt = Math.max(0, Math.round(rawRtt / 25) * 25);
const saveData = net.saveData || false;

const fakeConnection = {
  type:           'wifi',
  effectiveType:  connType,
  downlink:       downlink,
  downlinkMax:    Infinity,
  rtt:            quantizedRtt,
  saveData:       saveData,
  onchange:       null,
  addEventListener:    function() {},
  removeEventListener: function() {},
  dispatchEvent:       function() { return true; },
};
Object.freeze(fakeConnection);

try {
  delete navigator.connection;
} catch (e) {}

const connectionGetter = function() {
  if (!(this instanceof Navigator) && this !== navProto) {
    throw new TypeError("Failed to execute 'get connection' on 'Navigator': Illegal invocation");
  }
  return fakeConnection;
};
Object.defineProperty(connectionGetter, 'name', { value: 'get connection', configurable: true });
Object.defineProperty(connectionGetter, 'toString', {
  value: () => 'function get connection() { [native code] }',
  configurable: true,
});

Object.defineProperty(navProto, 'connection', {
  get: connectionGetter,
  enumerable: true,
  configurable: true,
});
