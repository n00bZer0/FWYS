// FWYS Stealth — audio.js
// P1: AudioContext fingerprint noise (JS layer — C++ patch bhi hai)
// Adds noise to getChannelData, getFloatFrequencyData, getByteFrequencyData,
// getFloatTimeDomainData so each profile has unique audio fingerprint.
// Works ALONGSIDE C++ patch — double protection.

const _audioFP = __FWYS_FP__.audioContext || __FWYS_FP__.audio || {};
const _audioSeed = _audioFP.seed || 12345678;

// ── PRNG from seed ────────────────────────────────────────────────────────────
const _audioRand = (() => {
    let s = _audioSeed >>> 0;
    return () => {
        s ^= s << 13; s ^= s >> 17; s ^= s << 5;
        return (s >>> 0) / 4294967296;
    };
})();

// ── Helper: add tiny deterministic noise to Float32Array ─────────────────────
function _applyAudioNoise(arr) {
    if (!arr || !arr.length) return arr;
    const magnitude = 1e-7; // Undetectable by ear, detectable by hash
    for (let i = 0; i < arr.length; i++) {
        if (arr[i] !== 0) {
            arr[i] += (_audioRand() * 2 - 1) * magnitude;
        }
    }
    return arr;
}

// ── AudioBuffer.prototype.getChannelData ──────────────────────────────────────
const _origGetChannelData = AudioBuffer.prototype.getChannelData;
Object.defineProperty(AudioBuffer.prototype, 'getChannelData', {
    value: function(channel) {
        const data = _origGetChannelData.call(this, channel);
        return _applyAudioNoise(data);
    },
    configurable: true,
    writable: true,
});
Object.defineProperty(AudioBuffer.prototype.getChannelData, 'toString', {
    value: () => 'function getChannelData() { [native code] }',
    configurable: true,
});

// ── AnalyserNode.prototype patches ────────────────────────────────────────────
const _noiseAnalyser = (proto, method) => {
    const orig = proto[method];
    if (!orig) return;
    Object.defineProperty(proto, method, {
        value: function(arr) {
            orig.call(this, arr);
            _applyAudioNoise(arr);
        },
        configurable: true,
        writable: true,
    });
    Object.defineProperty(proto[method], 'toString', {
        value: () => `function ${method}() { [native code] }`,
        configurable: true,
    });
};

_noiseAnalyser(AnalyserNode.prototype, 'getFloatFrequencyData');
_noiseAnalyser(AnalyserNode.prototype, 'getByteFrequencyData');
_noiseAnalyser(AnalyserNode.prototype, 'getFloatTimeDomainData');
_noiseAnalyser(AnalyserNode.prototype, 'getByteTimeDomainData');

// ── AudioContext.prototype — spoof sampleRate ─────────────────────────────────
// Some fingerprinters check sampleRate varies per system
const _origAudioContextConstructor = window.AudioContext;
try {
    window.AudioContext = new Proxy(_origAudioContextConstructor, {
        construct(target, args) {
            const ctx = new target(...args);
            return ctx;
        }
    });
} catch(e) { /* ignore */ }
