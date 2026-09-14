// FWYS Stealth — navigator.js
// P0/P1: Complete navigator + userAgentData + timezone + chrome object spoofing
// Runs before ANY page JS via CDP Page.addScriptToEvaluateOnNewDocument

const fp = __FWYS_FP__;
const nav = fp.navigator || {};
const hints = fp.clientHints || {};

// ── Helper: define property with [native code] toString ─────────────────
function defNative(obj, prop, get, set_) {
  const desc = { enumerable: true, configurable: true };
  if (get !== undefined) desc.get = get;
  if (set_ !== undefined) desc.set = set_;
  Object.defineProperty(obj, prop, desc);
  // Make getter toString look native
  if (desc.get) {
    Object.defineProperty(desc.get, 'toString', {
      value: () => `function get ${prop}() { [native code] }`,
      configurable: true,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────
// P0 — navigator.webdriver (MOST CRITICAL)
// Must be missing from own properties and not true on prototype
// ─────────────────────────────────────────────────────────────────────────
try {
  delete Object.getPrototypeOf(navigator).webdriver;
} catch (e) {}
try {
  delete navigator.webdriver;
} catch (e) {}


// ── navigator.platform ───────────────────────────────────────────────────
if (nav.platform) defNative(navigator, 'platform', () => nav.platform);

// ── navigator.hardwareConcurrency ───────────────────────────────────────
if (nav.hardwareConcurrency)
  defNative(navigator, 'hardwareConcurrency', () => nav.hardwareConcurrency);

// ── navigator.deviceMemory ───────────────────────────────────────────────
if (nav.deviceMemory)
  defNative(navigator, 'deviceMemory', () => nav.deviceMemory);

// ── navigator.maxTouchPoints (0 = desktop) ───────────────────────────────
if (nav.maxTouchPoints !== undefined)
  defNative(navigator, 'maxTouchPoints', () => nav.maxTouchPoints);

// ── navigator.vendor ────────────────────────────────────────────────────
defNative(navigator, 'vendor', () => nav.vendor || 'Google Inc.');

// ── navigator.language + languages ──────────────────────────────────────
if (nav.language) {
  defNative(navigator, 'language',  () => nav.language);
  defNative(navigator, 'languages', () => Object.freeze(nav.languages || [nav.language]));
}

// ── navigator.cookieEnabled ──────────────────────────────────────────────
defNative(navigator, 'cookieEnabled', () => true);

// ── navigator.doNotTrack ─────────────────────────────────────────────────
defNative(navigator, 'doNotTrack', () => null);

// ── navigator.pdfViewerEnabled ───────────────────────────────────────────
defNative(navigator, 'pdfViewerEnabled', () => true);

// ── navigator.userAgent + appVersion ─────────────────────────────────────
if (nav.userAgent) {
  defNative(navigator, 'userAgent', () => nav.userAgent);
  defNative(navigator, 'appVersion',
    () => nav.userAgent.replace(/^Mozilla\//, ''));
}


// ─────────────────────────────────────────────────────────────────────────
// P1 — navigator.userAgentData (Client Hints JS API)
// Modern sites ALWAYS check this. Must match Sec-CH-UA headers exactly.
// ─────────────────────────────────────────────────────────────────────────
const uaDataBrands = hints.brands || [
  { brand: 'Google Chrome',  version: '131' },
  { brand: 'Chromium',       version: '131' },
  { brand: 'Not?A_Brand',    version: '99'  },
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
      version: fp.browser?.fullVersion || '131.0.0.0',
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
      uaFullVersion:     fp.browser?.fullVersion            || '131.0.0.0',
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

defNative(navigator, 'userAgentData', () => uaDataObj);

// ─────────────────────────────────────────────────────────────────────────
// P1 — Timezone override via Intl
// Sites fingerprint via new Date().getTimezoneOffset() and Intl.DateTimeFormat
// ─────────────────────────────────────────────────────────────────────────
const profileTimezone = fp.timezone || 'America/New_York';
const profileLocale   = fp.locale   || 'en-US';

// Calculate offset from timezone name
// We pre-calculate this from the IP data and store in fp.timezoneOffset
// Fallback: let Intl handle it by resolving timezone name
const origDateTimeFormat = Intl.DateTimeFormat;
Intl.DateTimeFormat = function(locale, opts) {
  if (!opts) opts = {};
  if (!opts.timeZone) opts.timeZone = profileTimezone;
  const resolvedLocale = locale || profileLocale;
  return new origDateTimeFormat(resolvedLocale, opts);
};
Intl.DateTimeFormat.prototype        = origDateTimeFormat.prototype;
Intl.DateTimeFormat.supportedLocalesOf = origDateTimeFormat.supportedLocalesOf;
Object.defineProperty(Intl.DateTimeFormat, 'toString', {
  value: () => 'function DateTimeFormat() { [native code] }',
  configurable: true,
});

// Override Date.prototype.getTimezoneOffset
if (fp.timezoneOffset !== undefined) {
  const origGetTimezoneOffset = Date.prototype.getTimezoneOffset;
  Date.prototype.getTimezoneOffset = function() {
    return fp.timezoneOffset;
  };
  Object.defineProperty(Date.prototype.getTimezoneOffset, 'toString', {
    value: () => 'function getTimezoneOffset() { [native code] }',
    configurable: true,
  });
}

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
