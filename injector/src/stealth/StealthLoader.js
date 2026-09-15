'use strict';

/**
 * FWYS — StealthLoader
 * Builds a combined JS stealth script from all stealth modules.
 * Injected via CDP Page.addScriptToEvaluateOnNewDocument.
 *
 * IMPORTANT: Script runs in page's MAIN WORLD.
 * All prototype patches must be done here — before page JS runs.
 * Order matters: navigator.js must be first (sets up __FWYS_FP__).
 */

const fs   = require('fs');
const path = require('path');

const SCRIPTS_DIR = path.join(__dirname, 'scripts');

// Ordered list — navigator FIRST (critical), then others
const SCRIPT_ORDER = [
  'navigator.js',           // P0: webdriver, platform, userAgentData, chrome object
  'screen.js',              // P0: window.screen, devicePixelRatio
  'plugins.js',             // P0: plugins + mimeTypes
  'canvas.js',              // P1: canvas coordinate noise
  'audio.js',               // P1: deterministic audio noise
  'webgl.js',               // P1: WebGL & WebGPU UNMASKED vendor/renderer
  'fonts.js',               // P1: document.fonts.check()
  'webrtc.js',              // P0: WebRTC IP leak block
  'battery.js',             // P2: getBattery() with W3C invariants
  'speech.js',              // P2: speechSynthesis.getVoices()
  'network_info.js',        // P3: navigator.connection with 25ms RTT quantization
];


class StealthLoader {
  /**
   * Build combined stealth script for a fingerprint profile.
   * @param {object} fingerprint — full fingerprint object from generator.js
   * @returns {string} — JS to inject via CDP
   */
  static buildScript(fingerprint) {
    // Normalize fingerprint to flat form for legacy scripts
    // that use fp.webgl_vendor etc. (flat keys)
    const fp = StealthLoader._normalize(fingerprint);

    let combined = `// FWYS Stealth v2 — ${new Date().toISOString()}
// Runs in page main world before any page JS.
(function() {
  'use strict';
  // Full fingerprint object — accessed by all stealth modules
  const __FWYS_FP__ = ${JSON.stringify(fp, null, 0)};
`;

    let loaded = 0;
    for (const script of SCRIPT_ORDER) {
      const scriptPath = path.join(SCRIPTS_DIR, script);
      if (!fs.existsSync(scriptPath)) {
        console.warn(`  [Stealth] Script not found: ${script}`);
        continue;
      }
      const code = fs.readFileSync(scriptPath, 'utf8');
      combined += `
  // ══ ${script} ══════════════════════════════════
  try {
${code.split('\n').map(l => '    ' + l).join('\n')}
  } catch (_e) {
    // Non-fatal: ${script}
    if (typeof console !== 'undefined') console.warn('[FWYS] ${script} error:', _e);
  }
`;
      loaded++;
    }

    combined += '\n})();';

    console.log(`  [Stealth] Built script: ${loaded}/${SCRIPT_ORDER.length} modules, ${combined.length} bytes`);
    return combined;
  }

  /**
   * Normalize fingerprint object:
   * Adds flat alias keys (e.g. fp.webgl_vendor) alongside nested (fp.gpu.vendor)
   * so legacy scripts that use flat keys still work.
   */
  static _normalize(fp) {
    if (!fp || typeof fp !== 'object') return {};

    const norm = JSON.parse(JSON.stringify(fp));  // deep clone

    // Flat aliases for backward compat
    if (fp.gpu) {
      norm.webgl_vendor   = norm.webgl_vendor   || fp.gpu.vendor;
      norm.webgl_renderer = norm.webgl_renderer || fp.gpu.renderer;
    }
    if (fp.navigator) {
      norm.platform              = norm.platform              || fp.navigator.platform;
      norm.hardware_concurrency  = norm.hardware_concurrency  || fp.navigator.hardwareConcurrency;
      norm.device_memory         = norm.device_memory         || fp.navigator.deviceMemory;
      norm.language              = norm.language              || fp.navigator.language;
      norm.languages             = norm.languages             || fp.navigator.languages;
      norm.user_agent            = norm.user_agent            || fp.navigator.userAgent;
      norm.max_touch_points      = norm.max_touch_points      !== undefined
                                    ? norm.max_touch_points
                                    : fp.navigator.maxTouchPoints;
    }
    if (fp.canvas) {
      norm.canvas_seed = norm.canvas_seed || fp.canvas.seed || fp.canvas.noiseLevel;
    }
    if (fp.audio) {
      norm.audio_seed = norm.audio_seed || fp.audio.seed || fp.audio.noiseLevel;
    }

    // Add timezone offset (minutes west of UTC) for Date.getTimezoneOffset()
    if (fp.timezone && norm.timezoneOffset === undefined) {
      norm.timezoneOffset = StealthLoader._getTimezoneOffset(fp.timezone);
    }

    return norm;
  }

  /**
   * Calculate timezone offset in minutes for a timezone ID.
   * e.g. 'America/New_York' → 300 (EST) or 240 (EDT)
   */
  static _getTimezoneOffset(tz) {
    try {
      const now = new Date();
      // Format current date in the target timezone
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone:    tz,
        year:        'numeric',
        month:       '2-digit',
        day:         '2-digit',
        hour:        '2-digit',
        minute:      '2-digit',
        second:      '2-digit',
        hour12:      false,
      });
      const parts = formatter.formatToParts(now);
      const get = (type) => parseInt(parts.find(p => p.type === type)?.value || '0', 10);
      const tzDate = new Date(Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second')));
      const offset = (now.getTime() - tzDate.getTime()) / 60000;
      return Math.round(offset);
    } catch {
      return 0;
    }
  }

  static selfTest() {
    const fp = {
      navigator: {
        userAgent:          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        platform:           'Win32',
        hardwareConcurrency:8,
        deviceMemory:       8,
        language:           'en-US',
        languages:          ['en-US', 'en'],
        maxTouchPoints:     0,
        vendor:             'Google Inc.',
      },
      gpu: {
        vendor:   'Google Inc. (NVIDIA)',
        renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)',
      },
      canvas:   { noiseLevel: 2 },
      audio:    { noiseLevel: 1 },
      timezone: 'America/New_York',
      locale:   'en-US',
      battery:  { charging: false, level: 0.82, dischargingTime: 54000, chargingTime: Infinity },
      speech:   { voices: [{ name: 'Microsoft David Desktop - English (United States)', lang: 'en-US' }] },
    };

    const script = StealthLoader.buildScript(fp);
    if (typeof script !== 'string') throw new Error('buildScript returned non-string');
    if (script.length < 500)        throw new Error('Script too short — modules missing?');
    if (!script.includes('webdriver')) throw new Error('navigator.js not included');
    if (!script.includes('getParameter')) throw new Error('webgl.js not included');
  }
}

module.exports = StealthLoader;
