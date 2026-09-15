'use strict';

/**
 * FWYS — CDPManager
 * Manages Chrome DevTools Protocol connections per profile.
 *
 * Two modes:
 *   1. connect()     — legacy: spawns Chromium + attaches CDP
 *   2. attachOnly()  — new: Chromium already launched by Qt, just attach CDP
 *                      and inject stealth scripts
 */

const puppeteer     = require('puppeteer-core');
const http          = require('http');
const StealthLoader = require('../stealth/StealthLoader');

// Active sessions: profileId → CDPManager
const sessions = new Map();

class CDPManager {
  constructor(profileId, chromiumPath, debugPort, fingerprint, cookies = []) {
    this.profileId    = profileId;
    this.chromiumPath = chromiumPath;
    this.debugPort    = debugPort;
    this.fingerprint  = fingerprint || {};
    this.cookies      = Array.isArray(cookies) ? cookies : [];
    this.browser      = null;
    this.pid          = null;
  }

  // ── Mode 1: legacy — launch + attach ──────────────────────────────────
  async connect() {
    console.log(`  [CDP] Connecting to Chromium for profile: ${this.profileId}`);
    await this._connectAndInject();
    sessions.set(this.profileId, this);
    console.log(`  [CDP] ✓ Profile ${this.profileId} — stealth active`);
  }

  // ── Mode 2: attach-only (Qt launched Chrome, we just attach CDP) ───────
  static async attachOnly(profileId, debugPort, fingerprint, cookies = []) {
    const mgr = new CDPManager(profileId, null, debugPort, fingerprint, cookies);
    await mgr._connectAndInject();
    sessions.set(profileId, mgr);
    console.log(`  [CDP] ✓ Attached to profile ${profileId} on port ${debugPort}`);
    return mgr;
  }

  // ── Wait for debug port to become available ───────────────────────────
  async _waitForDebugPort(retries = 30, delay = 300) {
    for (let i = 0; i < retries; i++) {
      try {
        await new Promise((resolve, reject) => {
          const req = http.get(`http://127.0.0.1:${this.debugPort}/json/version`, (res) => {
            let data = '';
            res.on('data', d => data += d);
            res.on('end', () => {
              try {
                const json = JSON.parse(data);
                if (json.webSocketDebuggerUrl) resolve(json);
                else reject(new Error('No WS URL'));
              } catch (e) { reject(e); }
            });
          });
          req.on('error', reject);
          req.setTimeout(1500, () => { req.destroy(); reject(new Error('timeout')); });
        });
        return;
      } catch {
        await new Promise(r => setTimeout(r, delay));
      }
    }
    throw new Error(`Debug port ${this.debugPort} not available (profile: ${this.profileId})`);
  }

  // ── Core: connect via puppeteer and inject stealth ────────────────────
  async _connectAndInject() {
    await this._waitForDebugPort();

    this.browser = await puppeteer.connect({
      browserURL: `http://127.0.0.1:${this.debugPort}`,
      defaultViewport: null,
    });

    const fp = this.fingerprint;
    const stealthScript = StealthLoader.buildScript(fp);

    const applyToPage = async (page) => {
      try {
        // Evaluate stealth script before any page scripts load
        await page.evaluateOnNewDocument(stealthScript);

        // Emulate User-Agent with full Client Hints metadata
        const userAgent = fp.navigator?.userAgent || fp.user_agent;
        const chromeMinor = fp.browser?.version || '153';
        const chromeFull = fp.browser?.fullVersion || '153.0.8010.36';
        const brands = fp.clientHints?.brands || [
          { brand: 'Google Chrome', version: chromeMinor },
          { brand: 'Not_A Brand',   version: '8' },
          { brand: 'Chromium',      version: chromeMinor },
        ];

        const userAgentMetadata = {
          brands,
          fullVersion: chromeFull,
          platform: fp.clientHints?.platform || 'Windows',
          platformVersion: fp.clientHints?.platformVersion || '10.0.0',
          architecture: fp.clientHints?.architecture || 'x86',
          model: '',
          mobile: false,
          bitness: fp.clientHints?.bitness || '64',
          wow64: false,
        };

        if (userAgent) {
          await page.setUserAgent(userAgent, userAgentMetadata).catch(() => {});
        }

        // Direct CDP session override for maximum consistency
        try {
          const client = await page.target().createCDPSession();
          await client.send('Network.setUserAgentOverride', {
            userAgent: userAgent || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.8010.36 Safari/537.36',
            acceptLanguage: (fp.navigator?.languages || ['en-US', 'en']).join(','),
            platform: 'Win32',
            userAgentMetadata,
          });
        } catch (e) {
          // session may already exist or fail on some targets
        }

        // Emulate Timezone
        if (fp.timezone) {
          await page.emulateTimezone(fp.timezone).catch(() => {});
        }

        // Emulate Geolocation
        const geo = fp.geo || {};
        if (geo.lat && geo.lng) {
          await page.setGeolocation({
            latitude:  Number(geo.lat),
            longitude: Number(geo.lng),
            accuracy:  Number(geo.accuracy || 50),
          }).catch(() => {});
        }

        // Build complete Client Hints & HTTP headers
        const ram = String(fp.navigator?.deviceMemory || 8);
        const dpr = String(fp.screen?.devicePixelRatio || 1);
        const vpW = String(fp.window?.innerWidth || fp.screen?.width || 1920);
        const vpH = String(fp.window?.innerHeight || fp.screen?.height || 1080);
        const extraHeaders = Object.assign({
          'Sec-CH-UA':             `"Google Chrome";v="${chromeMinor}", "Not_A Brand";v="8", "Chromium";v="${chromeMinor}"`,
          'Sec-CH-UA-Mobile':      '?0',
          'Sec-CH-UA-Platform':    '"Windows"',
          'Sec-CH-UA-Platform-Version': '"10.0.0"',
          'Sec-CH-UA-Arch':        '"x86"',
          'Sec-CH-UA-Bitness':     '"64"',
          'Sec-CH-UA-Full-Version-List': `"Google Chrome";v="${chromeFull}", "Not_A Brand";v="8.0.0.0", "Chromium";v="${chromeFull}"`,
          'Device-Memory':         ram,
          'Sec-CH-Device-Memory':  ram,
          'DPR':                   dpr,
          'Sec-CH-DPR':            dpr,
          'Viewport-Width':        vpW,
          'Sec-CH-Viewport-Width': vpW,
          'Sec-CH-Viewport-Height':vpH,
          'RTT':                   String(fp.network?.rtt || 50),
          'Downlink':              '1.75',
          'ECT':                   '4g',
        }, fp.headers || {});

        await page.setExtraHTTPHeaders(extraHeaders).catch(() => {});
      } catch (err) {
        // Page may have closed or navigated
      }
    };

    // Apply to all current pages
    const pages = await this.browser.pages();
    for (const p of pages) {
      await applyToPage(p);
    }

    // Inject cookies into active page if provided
    if (this.cookies.length > 0 && pages.length > 0) {
      try {
        await pages[0].setCookie(...this.cookies);
        console.log(`  [CDP] ✓ Injected ${this.cookies.length} cookies into profile ${this.profileId}`);
      } catch (err) {
        console.warn(`  [CDP] Cookie injection warning:`, err.message);
      }
    }

    // Apply stealth script to worker targets (dedicated, shared, service workers)
    const applyToWorker = async (target) => {
      try {
        const session = await target.createCDPSession();
        await session.send('Runtime.enable');
        await session.send('Runtime.evaluate', {
          expression: stealthScript,
          returnByValue: true,
        });
      } catch (err) {
        // worker may have finished or already attached
      }
    };

    // Automatically apply to any newly created tab/window or worker target
    this.browser.on('targetcreated', async (target) => {
      const type = target.type();
      if (type === 'page') {
        const newPage = await target.page();
        if (newPage) {
          await applyToPage(newPage);
        }
      } else if (['service_worker', 'shared_worker', 'other', 'worker'].includes(type)) {
        await applyToWorker(target);
      }
    });

    this.browser.on('disconnected', () => {
      console.log(`  [CDP] Browser disconnected for profile ${this.profileId}`);
      sessions.delete(this.profileId);
    });

    console.log(`  [Stealth] ✓ All patches injected for profile ${this.profileId}`);
  }

  // ── Extract cookies from browser ──────────────────────────────────────
  static async getCookies(profileId) {
    const session = sessions.get(profileId);
    if (!session || !session.browser) return [];
    try {
      const pages = await session.browser.pages();
      if (pages.length > 0) {
        return await pages[0].cookies();
      }
    } catch (e) {
      console.warn(`  [CDP] getCookies error:`, e.message);
    }
    return [];
  }

  // ── Close session ─────────────────────────────────────────────────────
  static async closeProfile(profileId) {
    const session = sessions.get(profileId);
    if (session) {
      if (session.browser) {
        try { await session.browser.disconnect(); } catch {}
      }
      sessions.delete(profileId);
      console.log(`  [CDP] Profile ${profileId} detached`);
    }
  }

  static getSession(profileId) {
    return sessions.get(profileId) || null;
  }

  static listSessions() {
    return [...sessions.keys()];
  }
}

module.exports = CDPManager;

