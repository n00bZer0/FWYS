// FWYS Stealth — navigator.js
// P0/P1: Complete navigator + userAgentData + timezone + chrome object spoofing
// Runs before ANY page JS via CDP Page.addScriptToEvaluateOnNewDocument

const fp = __FWYS_FP__;
const nav = fp.navigator || {};
const hints = fp.clientHints || {};

// ── Helper: define accessor on Navigator.prototype with [native code] ────
const navProto = (typeof Navigator !== 'undefined') ? Navigator.prototype : Object.getPrototypeOf(navigator);

function defNavProto(prop, getter) {
  try {
    delete navigator[prop]; // Ensure navigator instance has NO own property shadowing the prototype
  } catch (e) {}
  if (!navProto) return;

  const nativeGetter = function() {
    if (!(this instanceof navProto.constructor) && this !== navProto) {
      throw new TypeError("Illegal invocation");
    }
    return getter.call(this);
  };
  Object.defineProperty(nativeGetter, 'name', { value: `get ${prop}`, configurable: true });
  Object.defineProperty(nativeGetter, 'toString', {
    value: () => `function get ${prop}() { [native code] }`,
    configurable: true,
  });

  Object.defineProperty(navProto, prop, {
    get: nativeGetter,
    set: undefined,
    enumerable: true,
    configurable: true,
  });
}

// ─────────────────────────────────────────────────────────────────────────
// P0 — navigator.webdriver
// Chromium launched with --disable-blink-features=AutomationControlled already
// exposes a genuine C++ native getter on Navigator.prototype returning false.
// We only ensure no own property exists on the navigator instance.
// ─────────────────────────────────────────────────────────────────────────
if (Object.prototype.hasOwnProperty.call(navigator, 'webdriver')) {
  try {
    delete navigator.webdriver;
  } catch (e) {}
}

// ── Only hook properties if they differ from Chromium's native C++ values ──
// Leaving native getters untouched ensures Function.prototype.toString returns
// genuine "[native code]" across all iframes and worker realms!
if (nav.platform && nav.platform !== navigator.platform) {
  defNavProto('platform', () => nav.platform);
}

if (nav.hardwareConcurrency && nav.hardwareConcurrency !== navigator.hardwareConcurrency) {
  defNavProto('hardwareConcurrency', () => nav.hardwareConcurrency);
}

if (nav.deviceMemory && nav.deviceMemory !== navigator.deviceMemory) {
  defNavProto('deviceMemory', () => nav.deviceMemory);
}

if (nav.maxTouchPoints !== undefined && nav.maxTouchPoints !== navigator.maxTouchPoints) {
  defNavProto('maxTouchPoints', () => nav.maxTouchPoints);
}

if (nav.vendor && nav.vendor !== navigator.vendor) {
  defNavProto('vendor', () => nav.vendor);
}

if (nav.language && nav.language !== navigator.language) {
  defNavProto('language',  () => nav.language);
  defNavProto('languages', () => Object.freeze(nav.languages || [nav.language]));
}

// Ensure no stray own properties shadow prototype
try { delete navigator.cookieEnabled; } catch (e) {}
try { delete navigator.doNotTrack; } catch (e) {}
try { delete navigator.pdfViewerEnabled; } catch (e) {}


// ─────────────────────────────────────────────────────────────────────────
// P1 — navigator.userAgentData (Client Hints JS API)
// Modern sites ALWAYS check this. Must match Sec-CH-UA headers exactly.
// ─────────────────────────────────────────────────────────────────────────
// Dynamic from fingerprint — never hardcode versions here
const _chromeMinor = String(fp.browser?.version || hints.brands?.[0]?.version || '153');
const _chromeFull  = String(fp.browser?.fullVersion || `${_chromeMinor}.0.8010.36`);

const uaDataBrands = hints.brands || [
  { brand: 'Google Chrome', version: _chromeMinor },
  { brand: 'Not_A Brand',   version: '8'          },
  { brand: 'Chromium',      version: _chromeMinor },
];
const uaDataPlatform = hints.platform || 'Windows';
const uaDataMobile   = hints.mobile   || false;

const uaDataObj = {
  brands:   Object.freeze(uaDataBrands.map(b => Object.freeze({ ...b }))),
  mobile:   uaDataMobile,
  platform: uaDataPlatform,

  getHighEntropyValues: async function(hints_) {
    const fullVersionList = (uaDataBrands || []).map(b => ({
      brand:   b.brand,
      version: _chromeFull,
    }));

    const highEntropy = {
      brands:            uaDataBrands,
      mobile:            uaDataMobile,
      platform:          uaDataPlatform,
      platformVersion:   fp.clientHints?.platformVersion   || '10.0.0',
      architecture:      fp.clientHints?.architecture       || 'x86',
      bitness:           fp.clientHints?.bitness            || '64',
      model:             fp.clientHints?.model              || '',
      fullVersionList,
      uaFullVersion:     _chromeFull,
      wow64:             fp.clientHints?.wow64              || false,
    };

    // Return only requested hints
    if (hints_ && hints_.length) {
      const result = {};
      for (const h of hints_) {
        if (h in highEntropy) result[h] = highEntropy[h];
      }
      return result;
    }
    return highEntropy;
  },

  toJSON: function() {
    return { brands: this.brands, mobile: this.mobile, platform: this.platform };
  },
};

// Make getHighEntropyValues toString look native
Object.defineProperty(uaDataObj.getHighEntropyValues, 'toString', {
  value: () => 'function getHighEntropyValues() { [native code] }',
  configurable: true,
});

// ── ALWAYS override userAgentData — even if native exists ─────────────────
// System Chrome has native userAgentData returning the real binary version.
// Old code: if (!navigator.userAgentData) → skips injection on system Chrome.
// Fix: unconditionally override on Navigator.prototype so our brands always win.
defNavProto('userAgentData', () => uaDataObj);

// ─────────────────────────────────────────────────────────────────────────
// Timezone: Handled natively at Chromium ICU level via CDP page.emulateTimezone
// No userland JS hooks on Date or Intl to prevent DST transition contradictions!
// ─────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────
// P0 — window.chrome object
// Absence of window.chrome = instant detection. Must look real.
// ─────────────────────────────────────────────────────────────────────────
if (!window.chrome) {
  window.chrome = {};
}

// chrome.app
if (!window.chrome.app) {
  window.chrome.app = {
    isInstalled: false,
    InstallState: {
      DISABLED:      'disabled',
      INSTALLED:     'installed',
      NOT_INSTALLED: 'not_installed',
    },
    RunningState: {
      CANNOT_RUN:   'cannot_run',
      READY_TO_RUN: 'ready_to_run',
      RUNNING:      'running',
    },
    getDetails:     function() { return null; },
    getIsInstalled: function() { return false; },
    installState:   function(cb) { cb('not_installed'); },
    runningState:   function()   { return 'cannot_run'; },
  };
}

// chrome.runtime
if (!window.chrome.runtime) {
  window.chrome.runtime = {
    // Must exist but not expose automation details
    PlatformOs: { ANDROID: 'android', CROS: 'cros', LINUX: 'linux', MAC: 'mac', OPENBSD: 'openbsd', WIN: 'win' },
    PlatformArch: { ARM: 'arm', X86_32: 'x86-32', X86_64: 'x86-64' },
    RequestUpdateCheckStatus: { NO_UPDATE: 'no_update', THROTTLED: 'throttled', UPDATE_AVAILABLE: 'update_available' },
    OnInstalledReason: { CHROME_UPDATE: 'chrome_update', INSTALL: 'install', SHARED_MODULE_UPDATE: 'shared_module_update', UPDATE: 'update' },
    OnRestartRequiredReason: { APP_UPDATE: 'app_update', OS_UPDATE: 'os_update', PERIODIC: 'periodic' },
  };
}

// chrome.csi — called by some fingerprinters
if (!window.chrome.csi) {
  window.chrome.csi = function() {
    return {
      startE:   Date.now(),
      onloadT:  Date.now(),
      pageT:    performance.now(),
      tran:     15,
    };
  };
}

// chrome.loadTimes — deprecated but fingerprinters still check it
if (!window.chrome.loadTimes) {
  window.chrome.loadTimes = function() {
    return {
      commitLoadTime:     Date.now() / 1000,
      connectionInfo:     'http/2+quic/46',
      finishDocumentLoadTime: 0,
      finishLoadTime:     0,
      firstPaintAfterLoadTime: 0,
      firstPaintTime:     0,
      navigationType:     'Other',
      npnNegotiatedProtocol: 'h3',
      requestTime:        Date.now() / 1000,
      startLoadTime:      Date.now() / 1000,
      wasAlternateProtocolAvailable: false,
      wasFetchedViaSpdy: true,
      wasNpnNegotiated:  true,
    };
  };
}

// ── Clean up automation runtime properties ───────────────────────────────
// Some automation frameworks leave traces in window.chrome.runtime
if (window.chrome.runtime && window.chrome.runtime.connect) {
  // Keep connect but remove internal automation metadata
  const origConnect = window.chrome.runtime.connect;
  window.chrome.runtime.connect = function(...args) {
    try { return origConnect.apply(this, args); } catch { return null; }
  };
}
