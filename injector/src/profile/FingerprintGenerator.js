/**
 * FWYS — FingerprintGenerator
 * Generates consistent, realistic fingerprint profiles.
 * Seeds are deterministic from profileId — same profile always = same fingerprint.
 */

'use strict';

const crypto = require('crypto');

// Real-world WebGL GPU profiles (Windows desktop)
const GPU_PROFILES = [
  { vendor: 'Google Inc. (AMD)',    renderer: 'ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001638) Direct3D11 vs_5_0 ps_5_0, D3D11)' },
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0)' },
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1660 Super Direct3D11 vs_5_0 ps_5_0)' },
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 2070 Direct3D11 vs_5_0 ps_5_0)' },
  { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3070 Ti Direct3D11 vs_5_0 ps_5_0)' },
  { vendor: 'Google Inc. (AMD)',    renderer: 'ANGLE (AMD, AMD Radeon RX 6600 XT Direct3D11 vs_5_0 ps_5_0)' },
  { vendor: 'Google Inc. (AMD)',    renderer: 'ANGLE (AMD, AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0)' },
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0)' },
  { vendor: 'Google Inc. (Intel)', renderer: 'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics Direct3D11 vs_5_0 ps_5_0)' },
];

// Real UA strings (Windows Chrome)
const UA_TEMPLATES = [
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.8010.36 Safari/537.36', version: '153' },
  { ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.7977.82 Safari/537.36',  version: '152' },
];

const HW_CONCURRENCY_OPTIONS = [4, 6, 8, 10, 12, 16];
const DEVICE_MEMORY_OPTIONS  = [4, 8];
const SCREEN_SIZES = [
  [1920, 1080], [2560, 1440], [1366, 768],
  [1440, 900],  [1280, 1024], [1600, 900],
];
const LANGUAGES = [
  ['en-US', ['en-US', 'en']],
  ['en-GB', ['en-GB', 'en']],
  ['de-DE', ['de-DE', 'de', 'en-US', 'en']],
];
const TIMEZONES = [
  'America/New_York', 'America/Los_Angeles', 'America/Chicago',
  'Europe/London', 'Europe/Berlin', 'Europe/Paris',
  'Asia/Tokyo', 'Asia/Kolkata', 'Australia/Sydney',
];

class FingerprintGenerator {
  /**
   * Generate deterministic fingerprint from profileId.
   * @param {object} profile - profile object with id and user overrides
   * @returns {object} fingerprint config
   */
  static fromProfile(profile) {
    const seed = FingerprintGenerator._seedFromId(profile.id);

    // If profile has manual overrides, apply them on top
    const generated = FingerprintGenerator._generate(seed);
    return { ...generated, ...(profile.fingerprint_overrides || {}) };
  }

  /**
   * Generate a fresh random fingerprint (for new profiles).
   * @returns {object} fingerprint config
   */
  static generateRandom() {
    const seed = crypto.randomBytes(8).readBigUInt64LE();
    return FingerprintGenerator._generate(Number(seed));
  }

  static _seedFromId(profileId) {
    const hash = crypto.createHash('sha256').update(profileId).digest();
    return hash.readUInt32LE(0) * 0x100000000 + hash.readUInt32LE(4);
  }

  static _pick(arr, rng) {
    return arr[Math.floor(rng() * arr.length)];
  }

  static _generate(seed) {
    // Simple seeded PRNG (mulberry32)
    let s = seed >>> 0;
    const rng = () => {
      s |= 0; s = s + 0x6D2B79F5 | 0;
      let t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };

    const gpu = FingerprintGenerator._pick(GPU_PROFILES, rng);
    const ua  = FingerprintGenerator._pick(UA_TEMPLATES, rng);
    const hw  = FingerprintGenerator._pick(HW_CONCURRENCY_OPTIONS, rng);
    const mem = FingerprintGenerator._pick(DEVICE_MEMORY_OPTIONS, rng);
    const screen = FingerprintGenerator._pick(SCREEN_SIZES, rng);
    const lang = FingerprintGenerator._pick(LANGUAGES, rng);
    const tz = FingerprintGenerator._pick(TIMEZONES, rng);

    // Generate numeric seeds for C++ patches (must be same per profile)
    const canvasSeed = Math.floor(rng() * 0xFFFFFFFF);
    const audioSeed  = Math.floor(rng() * 0xFFFFFFFF);
    const fontSeed   = Math.floor(rng() * 0xFFFFFFFF);

    return {
      user_agent: ua.ua,
      ua_brand: 'Google Chrome',
      ua_version: ua.version,
      ua_platform: 'Windows',
      platform: 'Win32',
      webgl_vendor: gpu.vendor,
      webgl_renderer: gpu.renderer,
      hardware_concurrency: hw,
      device_memory: mem,
      screen_width: screen[0],
      screen_height: screen[1],
      language: lang[0],
      languages: lang[1],
      timezone: tz,
      canvas_seed: canvasSeed,
      audio_seed: audioSeed,
      font_seed: fontSeed,
      vendor: 'Google Inc.',
      max_touch_points: 0,
      webrtc_mode: 'filter_local', // 'allow' | 'filter_local' | 'block'
      proxy: null,
    };
  }

  static selfTest() {
    const fp = FingerprintGenerator.fromProfile({ id: 'test-profile-001' });
    const fp2 = FingerprintGenerator.fromProfile({ id: 'test-profile-001' });
    // Same ID = same fingerprint
    if (fp.canvas_seed !== fp2.canvas_seed)
      throw new Error('Fingerprint not deterministic!');
    // Different ID = different fingerprint
    const fp3 = FingerprintGenerator.fromProfile({ id: 'test-profile-002' });
    if (fp.canvas_seed === fp3.canvas_seed)
      throw new Error('Different profiles have same fingerprint!');
  }
}

module.exports = FingerprintGenerator;
