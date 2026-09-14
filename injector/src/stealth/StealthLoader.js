/**
 * FWYS — StealthLoader
 * Builds a combined JS stealth script from all stealth modules.
 * This script is injected via CDP Page.addScriptToEvaluateOnNewDocument.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SCRIPTS_DIR = path.join(__dirname, 'scripts');

class StealthLoader {
  /**
   * Build a combined stealth script for a given fingerprint profile.
   * @param {object} fingerprint
   * @returns {string} combined JS string
   */
  static buildScript(fingerprint) {
    const scripts = [
      'navigator.js',
      'plugins.js',
      'permissions.js',
      'webgl.js',
      'canvas.js',
      'webrtc.js',
    ];

    let combined = `
// FWYS Stealth Scripts (JS fallback layer)
// These complement the C++ engine patches.
// C++ patches handle the primary spoofing; these handle edge cases.
(function() {
  'use strict';
  const __FWYS_FP__ = ${JSON.stringify(fingerprint)};
`;

    for (const script of scripts) {
      const scriptPath = path.join(SCRIPTS_DIR, script);
      if (fs.existsSync(scriptPath)) {
        const code = fs.readFileSync(scriptPath, 'utf8');
        combined += `\n  // === ${script} ===\n`;
        combined += `  try {\n`;
        combined += code.split('\n').map(l => '    ' + l).join('\n');
        combined += `\n  } catch(e) { /* non-fatal: ${script} */ }\n`;
      }
    }

    combined += '\n})();';
    return combined;
  }

  static selfTest() {
    const fp = {
      user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      hardware_concurrency: 8,
      device_memory: 8,
      platform: 'Win32',
      webgl_vendor: 'Google Inc. (NVIDIA)',
      webgl_renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060)',
    };
    const script = StealthLoader.buildScript(fp);
    if (typeof script !== 'string' || script.length < 100)
      throw new Error('buildScript returned invalid result');
  }
}

module.exports = StealthLoader;
