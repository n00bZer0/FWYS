// FWYS Stealth — speech.js
// P2: SpeechSynthesis.getVoices() spoofing
// Windows 10/11 specific voices per OS profile

const fp = __FWYS_FP__;
const speechFp = fp.speech || {};
const voices = speechFp.voices || [];

if (!voices.length || typeof SpeechSynthesis === 'undefined') return;

// Build fake SpeechSynthesisVoice objects
const fakeVoices = voices.map((v, i) => {
  const voice = {
    default:      i === 0,  // first voice is default
    lang:         v.lang || 'en-US',
    localService: true,
    name:         v.name || 'Microsoft David Desktop - English (United States)',
    voiceURI:     v.name || 'Microsoft David Desktop - English (United States)',
  };
  return Object.freeze(voice);
});

Object.freeze(fakeVoices);

// Override getVoices on the prototype
const origGetVoices = SpeechSynthesis.prototype.getVoices;
SpeechSynthesis.prototype.getVoices = function() {
  return fakeVoices;
};
Object.defineProperty(SpeechSynthesis.prototype.getVoices, 'toString', {
  value: () => 'function getVoices() { [native code] }',
  configurable: true,
});

// Fire voiceschanged once so sites that listen for it get our voices
try {
  window.speechSynthesis.dispatchEvent(new Event('voiceschanged'));
} catch { /* may not be available in all frames */ }
