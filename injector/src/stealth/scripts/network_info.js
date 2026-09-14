// FWYS Stealth — network_info.js
// P3: navigator.connection (Network Information API) spoofing

const fp = __FWYS_FP__;
const net = fp.network || {};

if (!navigator.connection && !NetworkInformation) return;

const connType       = net.connectionType || '4g';
const downlink       = net.downlink       || 10;
const rtt            = net.rtt           || 50;
const saveData       = net.saveData      || false;

const fakeConnection = {
  type:           'wifi',
  effectiveType:  connType,
  downlink:       downlink,
  downlinkMax:    Infinity,
  rtt:            rtt,
  saveData:       saveData,
  onchange:       null,
  addEventListener:    function() {},
  removeEventListener: function() {},
  dispatchEvent:       function() { return true; },
};
Object.freeze(fakeConnection);

if (navigator.connection !== undefined) {
  Object.defineProperty(navigator, 'connection', {
    get: () => fakeConnection,
    enumerable:   true,
    configurable: true,
  });
}
