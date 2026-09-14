// FWYS Stealth — navigator.js
// JS-level fallback for navigator property spoofing
// Primary spoofing is at C++ level via patches 003, 007, 008, 009

const fp = __FWYS_FP__;

// Helper: define a property with native toString
function defineNative(obj, prop, value) {
  const descriptor = {
    get: function() { return value; },
    set: undefined,
    enumerable: true,
    configurable: true,
  };
  Object.defineProperty(obj, prop, descriptor);
}

// navigator.webdriver — most important, C++ patch handles this too
// This is the JS-level backup
if (navigator.webdriver) {
  Object.defineProperty(navigator, 'webdriver', {
    get: () => false,
    configurable: true,
    enumerable: true,
  });
}

// navigator.platform
if (fp.platform) {
  defineNative(navigator, 'platform', fp.platform);
}

// navigator.hardwareConcurrency (backup if C++ patch isn't active)
if (fp.hardware_concurrency) {
  defineNative(navigator, 'hardwareConcurrency', fp.hardware_concurrency);
}

// navigator.deviceMemory (backup)
if (fp.device_memory) {
  defineNative(navigator, 'deviceMemory', fp.device_memory);
}

// navigator.maxTouchPoints — set to 0 for desktop profiles
if (fp.max_touch_points !== undefined) {
  defineNative(navigator, 'maxTouchPoints', fp.max_touch_points);
}

// navigator.vendor
if (fp.vendor !== undefined) {
  defineNative(navigator, 'vendor', fp.vendor || 'Google Inc.');
}

// navigator.language + languages
if (fp.language) {
  defineNative(navigator, 'language', fp.language);
  defineNative(navigator, 'languages', fp.languages || [fp.language]);
}

// Remove automation-related chrome properties
if (window.chrome && window.chrome.runtime) {
  // Do not remove entirely — that itself is detectable
  // Just ensure runtime doesn't expose automation flags
  const origRuntime = window.chrome.runtime;
  const cleanRuntime = {};
  // Keep only public API methods
  if (origRuntime.sendMessage) cleanRuntime.sendMessage = origRuntime.sendMessage.bind(origRuntime);
  window.chrome.runtime = cleanRuntime;
}
