// FWYS Stealth — speech.js
// P2: SpeechSynthesis.getVoices() spoofing
// Windows 10/11 specific voices per OS profile
// Strategy: Override on SpeechSynthesis.prototype properly with native-looking wrapper

const fp = __FWYS_FP__;
const speechFp = fp.speech || {};
const voices   = speechFp.voices || [];

if (!voices.length || typeof SpeechSynthesis === 'undefined') return;

// Build fake SpeechSynthesisVoice-like objects
const fakeVoices = voices.map((v, i) => Object.freeze({
  default:      i === 0,
  lang:         v.lang     || 'en-US',
  localService: true,
  name:         v.name     || 'Microsoft David Desktop - English (United States)',
  voiceURI:     v.voiceURI || v.name || 'Microsoft David Desktop - English (United States)',
}));
Object.freeze(fakeVoices);

// ── Override SpeechSynthesis.prototype.getVoices properly ────────────────────
// Must use ES6 shorthand on object so wrapper has no .prototype property (native-like)
const _getVoicesWrapper = {
  getVoices() {
    if (!(this instanceof SpeechSynthesis)) {
      throw new TypeError("Failed to execute 'getVoices' on 'SpeechSynthesis': Illegal invocation");
    }
    return fakeVoices;
  }
};
const nativeGetVoices = _getVoicesWrapper.getVoices;
try { delete nativeGetVoices.prototype; } catch (e) {}

Object.defineProperty(nativeGetVoices, 'name', { value: 'getVoices', configurable: true });
Object.defineProperty(nativeGetVoices, 'toString', {
  value: () => 'function getVoices() { [native code] }',
  configurable: true,
});

// Define on prototype — covers window.speechSynthesis.getVoices() and all frames
Object.defineProperty(SpeechSynthesis.prototype, 'getVoices', {
  value: nativeGetVoices,
  writable: true,
  configurable: true,
  enumerable: true,
});

// ── Intercept onvoiceschanged so real native voices can't replace ours ────────
// When native voices load they fire voiceschanged. Sites call getVoices() in that handler.
// We already override getVoices so the handler will get our voices — but we also fire
// voiceschanged ourselves so sites that listen for it get triggered correctly.
try {
  const synth = window.speechSynthesis;
  if (synth) {
    // Immediately fire voiceschanged so synchronous listeners get triggered
    setTimeout(() => {
      try {
        synth.dispatchEvent(new Event('voiceschanged'));
      } catch (e) {}
    }, 0);
  }
} catch (e) {}
