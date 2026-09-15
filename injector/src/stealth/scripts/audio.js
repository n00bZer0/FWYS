// FWYS Stealth — audio.js
// AudioContext fingerprinting protection: deterministic, reproducible across passes,
// and respects constant DC signal checks and silence integrity.

const _audioFP = __FWYS_FP__.audioContext || __FWYS_FP__.audio || {};
const _audioSeed = _audioFP.seed || 12345678;

// ── Deterministic noise pure function of sample index (NO shifting PRNG state) ─
function _applyDeterministicAudioNoise(arr) {
  if (!arr || !arr.length) return arr;

  // Check if signal is a constant DC probe (0, 0.5, 0.25, 0.125) or uniform
  const first = arr[0];
  let isConstant = true;
  for (let i = 1; i < Math.min(arr.length, 32); i++) {
    if (Math.abs(arr[i] - first) > 1e-6) {
      isConstant = false;
      break;
    }
  }
  if (isConstant) return arr; // Never perturb constant DC signals or silence!

  const magnitude = 1e-7;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] !== 0) {
      // Deterministic pseudo-sine wave based on index + seed
      const n = (Math.sin((i + _audioSeed) * 0.1234) * 43758.5453) % 1;
      arr[i] += n * magnitude;
    }
  }
  return arr;
}

// ── AudioBuffer.prototype.getChannelData ──────────────────────────────────────
if (typeof AudioBuffer !== 'undefined' && AudioBuffer.prototype.getChannelData) {
  const _origGetChannelData = AudioBuffer.prototype.getChannelData;
  const wrapperObj = {
    getChannelData(channel) {
      if (!(this instanceof AudioBuffer)) {
        throw new TypeError("Failed to execute 'getChannelData' on 'AudioBuffer': Illegal invocation");
      }
      const data = _origGetChannelData.call(this, channel);
      return _applyDeterministicAudioNoise(data);
    }
  };
  const nativeFn = wrapperObj.getChannelData;
  try { delete nativeFn.prototype; } catch (e) {}

  Object.defineProperty(nativeFn, 'name', { value: 'getChannelData', configurable: true });
  Object.defineProperty(nativeFn, 'toString', {
    value: () => 'function getChannelData() { [native code] }',
    configurable: true,
  });

  AudioBuffer.prototype.getChannelData = nativeFn;
}
