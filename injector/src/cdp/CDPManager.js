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

const WebSocket   = require('ws');
const http        = require('http');
const StealthLoader = require('../stealth/StealthLoader');

// Active sessions: profileId → CDPSession
const sessions = new Map();

class CDPManager {
  constructor(profileId, chromiumPath, debugPort, fingerprint) {
    this.profileId    = profileId;
    this.chromiumPath = chromiumPath;
    this.debugPort    = debugPort;
    this.fingerprint  = fingerprint || {};
    this.pid          = null;
    this.ws           = null;
    this.msgId        = 0;
    this.callbacks    = new Map();
    this._scriptId    = null;    // ID of our injected script (for removal if needed)
  }

  // ── Mode 1: legacy — launch + attach ──────────────────────────────────
  async connect() {
    console.log(`  [CDP] Connecting to already-running Chromium for profile: ${this.profileId}`);
    await this._waitForDebugPort();
    await this._connectWebSocket();
    await this._setupStealth();
    sessions.set(this.profileId, this);
    console.log(`  [CDP] ✓ Profile ${this.profileId} — stealth active`);
  }

  // ── Mode 2: attach-only (Qt launched Chrome, we just attach CDP) ───────
  static async attachOnly(profileId, debugPort, fingerprint) {
    const mgr = new CDPManager(profileId, null, debugPort, fingerprint);
    await mgr._waitForDebugPort(30, 300);  // wait up to 9s for Chrome to start
    await mgr._connectWebSocket();
    await mgr._setupStealth();
    sessions.set(profileId, mgr);
    console.log(`  [CDP] ✓ Attached to profile ${profileId} on port ${debugPort}`);
    return mgr;
  }

  // ── Wait for Chromium debug port to become available ──────────────────
  async _waitForDebugPort(retries = 20, delay = 500) {
    for (let i = 0; i < retries; i++) {
      try {
        await this._getDebuggerUrl();
        return;
      } catch {
        await new Promise(r => setTimeout(r, delay));
      }
    }
    throw new Error(`Debug port ${this.debugPort} not available (profile: ${this.profileId})`);
  }

  _getDebuggerUrl() {
    return new Promise((resolve, reject) => {
      const req = http.get(`http://127.0.0.1:${this.debugPort}/json/version`, (res) => {
        let data = '';
        res.on('data', d => data += d);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (!json.webSocketDebuggerUrl) throw new Error('No WebSocket URL');
            resolve(json.webSocketDebuggerUrl);
          } catch (e) { reject(e); }
        });
      });
      req.on('error', reject);
      req.setTimeout(3000, () => { req.destroy(); reject(new Error('timeout')); });
    });
  }

  // ── WebSocket CDP connection ──────────────────────────────────────────
  async _connectWebSocket() {
    const wsUrl = await this._getDebuggerUrl();
    console.log(`  [CDP] WS: ${wsUrl}`);

    this.ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => {
      this.ws.on('open', res);
      this.ws.on('error', rej);
    });

    this.ws.on('message', (data) => {
      try { this._onMessage(JSON.parse(data.toString())); }
      catch { /* non-JSON frames */ }
    });

    this.ws.on('close', () => {
      console.log(`  [CDP] WS closed for profile ${this.profileId}`);
      sessions.delete(this.profileId);
    });

    this.ws.on('error', (err) => {
      console.error(`  [CDP] WS error profile ${this.profileId}:`, err.message);
    });
  }

  // ── CDP command send/receive ──────────────────────────────────────────
  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.msgId;
      this.callbacks.set(id, { resolve, reject });

      const timeout = setTimeout(() => {
        if (this.callbacks.has(id)) {
          this.callbacks.delete(id);
          reject(new Error(`CDP timeout: ${method}`));
        }
      }, 10000);

      this.callbacks.get(id)._timeout = timeout;

      try {
        this.ws.send(JSON.stringify({ id, method, params }));
      } catch (e) {
        clearTimeout(timeout);
        this.callbacks.delete(id);
        reject(e);
      }
    });
  }

  _onMessage(msg) {
    if (msg.id && this.callbacks.has(msg.id)) {
      const { resolve, reject, _timeout } = this.callbacks.get(msg.id);
      clearTimeout(_timeout);
      this.callbacks.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else           resolve(msg.result);
    }
  }

  // ── Core: inject stealth scripts via CDP ─────────────────────────────
  async _setupStealth() {
    const fp = this.fingerprint;

    // Build combined stealth script from all modules
    const stealthScript = StealthLoader.buildScript(fp);

    // Enable domains
    await this.send('Page.enable').catch(() => {});
    await this.send('Network.enable').catch(() => {});
    await this.send('Runtime.enable').catch(() => {});

    // ── CRITICAL: inject before ANY page JS runs ──
    // worldName NOT set → runs in page's main world (not isolated)
    // This means our patches share the same window object as page JS
    const result = await this.send('Page.addScriptToEvaluateOnNewDocument', {
      source: stealthScript,
      // NO worldName — must be main world for prototype patches to work
    });
    this._scriptId = result?.identifier;

    // ── User-Agent header override ────────────────────────────────────
    const userAgent = fp.navigator?.userAgent || fp.user_agent;
    if (userAgent) {
      const langs = fp.navigator?.languages || ['en-US', 'en'];
      await this.send('Network.setUserAgentOverride', {
        userAgent,
        acceptLanguage: langs.join(',') + ';q=0.9',
        // platform is set via navigator patch (no CDP param for it)
      });
    }

    // ── Extra HTTP headers (Sec-CH-UA etc.) ──────────────────────────
    const headers = fp.headers || {};
    const extraHeaders = {};
    if (headers['Sec-CH-UA'])                  extraHeaders['Sec-CH-UA']                  = headers['Sec-CH-UA'];
    if (headers['Sec-CH-UA-Mobile'])            extraHeaders['Sec-CH-UA-Mobile']            = headers['Sec-CH-UA-Mobile'];
    if (headers['Sec-CH-UA-Platform'])          extraHeaders['Sec-CH-UA-Platform']          = headers['Sec-CH-UA-Platform'];
    if (headers['Sec-CH-UA-Platform-Version'])  extraHeaders['Sec-CH-UA-Platform-Version']  = headers['Sec-CH-UA-Platform-Version'];
    if (headers['Sec-CH-UA-Arch'])              extraHeaders['Sec-CH-UA-Arch']              = headers['Sec-CH-UA-Arch'];
    if (headers['Sec-CH-UA-Bitness'])           extraHeaders['Sec-CH-UA-Bitness']           = headers['Sec-CH-UA-Bitness'];
    if (headers['Sec-CH-UA-Full-Version-List']) extraHeaders['Sec-CH-UA-Full-Version-List'] = headers['Sec-CH-UA-Full-Version-List'];

    if (Object.keys(extraHeaders).length) {
      await this.send('Network.setExtraHTTPHeaders', { headers: extraHeaders });
    }

    // ── Geolocation override ──────────────────────────────────────────
    const geo = fp.geo || {};
    if (geo.mode === 'proxy' || geo.mode === 'custom') {
      await this.send('Emulation.setGeolocationOverride', {
        latitude:  geo.lat      || 40.7128,
        longitude: geo.lng      || -74.0060,
        accuracy:  geo.accuracy || 50,
      }).catch(() => {});
    } else if (geo.mode === 'disabled') {
      await this.send('Emulation.setGeolocationOverride', {}).catch(() => {});
    }

    // ── Timezone override ─────────────────────────────────────────────
    if (fp.timezone) {
      await this.send('Emulation.setTimezoneOverride', {
        timezoneId: fp.timezone,
      }).catch(() => {});
    }

    // ── Locale override ───────────────────────────────────────────────
    if (fp.locale) {
      await this.send('Emulation.setLocaleOverride', {
        locale: fp.locale,
      }).catch(() => {});
    }

    // ── Screen/viewport ───────────────────────────────────────────────
    const screen = fp.screen || {};
    if (screen.width && screen.height) {
      await this.send('Emulation.setDeviceMetricsOverride', {
        width:             fp.window?.innerWidth  || screen.width,
        height:            fp.window?.innerHeight || screen.height,
        deviceScaleFactor: screen.devicePixelRatio || 1,
        mobile:            false,
        screenWidth:       screen.width,
        screenHeight:      screen.height,
      }).catch(() => {});
    }

    // ── Touch emulation (disable for desktop profiles) ────────────────
    if ((fp.navigator?.maxTouchPoints || 0) === 0) {
      await this.send('Emulation.setTouchEmulationEnabled', {
        enabled: false,
      }).catch(() => {});
    }

    console.log(`  [Stealth] ✓ All patches injected for profile ${this.profileId}`);
  }

  // ── Close session ─────────────────────────────────────────────────────
  static closeProfile(profileId) {
    const session = sessions.get(profileId);
    if (session) {
      if (session.ws && session.ws.readyState === WebSocket.OPEN) {
        session.ws.close();
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
