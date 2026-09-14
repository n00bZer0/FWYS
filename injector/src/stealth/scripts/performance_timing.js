// FWYS Stealth — performance_timing.js
// P3: performance.now() jitter to defeat CPU timing fingerprinting
// Also patches performance.timeOrigin to be consistent

const fp = __FWYS_FP__;

// Only apply if fingerprint has timing noise enabled (noiseLevel > 0)
const noiseLevel = fp.canvas?.noiseLevel || fp.audio?.noiseLevel || 0;
if (!noiseLevel) return;

// Jitter magnitude in milliseconds (0.05ms max at level 2)
const jitterMs = noiseLevel * 0.025;

// Seeded noise: deterministic per call index, not truly random
// Prevents timing correlation attacks while being consistent
let _callIdx = 0;
let _seed = fp.meta?.profileId
  ? parseInt(fp.meta.profileId.replace(/[^0-9]/g, '').slice(0, 8) || '42', 10)
  : 42;

function seededJitter() {
  // xorshift32 — fast, deterministic
  _seed ^= _seed << 13;
  _seed ^= _seed >> 17;
  _seed ^= _seed << 5;
  _callIdx++;
  // Map to [-jitterMs, +jitterMs]
  return ((_seed & 0x7FFFFFFF) / 0x7FFFFFFF - 0.5) * 2 * jitterMs;
}

const origNow = performance.now.bind(performance);
performance.now = function() {
  const real = origNow();
  // Round to 0.1ms granularity (matches Chromium's TimerCapping)
  // then add tiny deterministic jitter
  const rounded = Math.round(real * 10) / 10;
  return rounded + seededJitter();
};

Object.defineProperty(performance.now, 'toString', {
  value: () => 'function now() { [native code] }',
  configurable: true,
});

// Also patch Date.now() for consistency
const origDateNow = Date.now;
Date.now = function() {
  return origDateNow() + Math.round(seededJitter());
};
Object.defineProperty(Date.now, 'toString', {
  value: () => 'function now() { [native code] }',
  configurable: true,
});
