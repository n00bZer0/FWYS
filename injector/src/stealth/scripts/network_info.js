// FWYS Stealth — network_info.js
// P3: navigator.connection (Network Information API) spoofing
// Obey Chromium 25ms RTT quantization strictly
// Strategy: patch NetworkInformation prototype properties — don't skip native!

const fp = __FWYS_FP__;
const net = fp.network || {};

const connType = net.connectionType || '4g';
const downlink = typeof net.downlink === 'number' ? net.downlink : 10;
// Chromium NetworkInformation strictly quantizes RTT to 25ms multiples (0, 25, 50, 75, 100...)
const rawRtt      = Number(net.rtt) || 50;
const quantizedRtt = Math.max(0, Math.round(rawRtt / 25) * 25);
const saveData    = net.saveData || false;

// ── Strategy 1: Patch via NetworkInformation.prototype (preferred) ─────────────
// Chromium's native navigator.connection is a NetworkInformation C++ object.
// We override its getters on the prototype so our values show through.
try {
  const conn = navigator.connection;
  if (conn) {
    const NI = Object.getPrototypeOf(conn);  // NetworkInformation prototype

    // Helper: define a native-looking getter on the prototype
    function defNI(prop, value) {
      const getter = function() { return value; };
      Object.defineProperty(getter, 'name', { value: `get ${prop}`, configurable: true });
      Object.defineProperty(getter, 'toString', {
        value: () => `function get ${prop}() { [native code] }`,
        configurable: true,
      });
      Object.defineProperty(NI, prop, {
        get: getter,
        set: undefined,
        enumerable: true,
        configurable: true,
      });
    }

    defNI('effectiveType', connType);
    defNI('rtt',           quantizedRtt);
    defNI('downlink',      downlink);
    defNI('saveData',      saveData);
    defNI('type',          'wifi');
    // downlinkMax is non-standard but some fingerprinters check it
    try {
      defNI('downlinkMax', Infinity);
    } catch (e) {}
  }
} catch (e) {}

// ── Strategy 2: Fallback — define connection on Navigator.prototype ────────────
// Used when native connection doesn't exist (system Chrome may have it disabled)
try {
  if (!navigator.connection) {
    const navProto = (typeof Navigator !== 'undefined')
      ? Navigator.prototype
      : Object.getPrototypeOf(navigator);

    if (!navProto) return;

    const fakeConnection = Object.create(null);
    Object.defineProperties(fakeConnection, {
      type:           { get: () => 'wifi',       enumerable: true, configurable: true },
      effectiveType:  { get: () => connType,     enumerable: true, configurable: true },
      downlink:       { get: () => downlink,     enumerable: true, configurable: true },
      downlinkMax:    { get: () => Infinity,     enumerable: true, configurable: true },
      rtt:            { get: () => quantizedRtt, enumerable: true, configurable: true },
      saveData:       { get: () => saveData,     enumerable: true, configurable: true },
      onchange:       { get: () => null, set: () => {}, enumerable: true, configurable: true },
      addEventListener:    { value: function() {}, writable: true, configurable: true },
      removeEventListener: { value: function() {}, writable: true, configurable: true },
      dispatchEvent:       { value: function() { return true; }, writable: true, configurable: true },
    });

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
  }
} catch (e) {}
