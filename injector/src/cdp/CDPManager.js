/**
 * FWYS — CDPManager
 * Manages Chrome DevTools Protocol connections per profile.
 * Launches Chromium with correct flags and connects via CDP WebSocket.
 */

'use strict';

const { spawn } = require('child_process');
const WebSocket = require('ws');
const http = require('http');
const StealthLoader = require('../stealth/StealthLoader');

// Active sessions: profileId -> CDPSession
const sessions = new Map();

class CDPManager {
  /**
   * @param {string} profileId
   * @param {string} chromiumPath - path to chrome.exe
   * @param {number} debugPort - remote debugging port (unique per profile)
   * @param {object} fingerprint - fingerprint config
   */
  constructor(profileId, chromiumPath, debugPort, fingerprint) {
    this.profileId = profileId;
    this.chromiumPath = chromiumPath;
    this.debugPort = debugPort;
    this.fingerprint = fingerprint;
    this.pid = null;
    this.ws = null;
    this.msgId = 0;
    this.callbacks = new Map();
    this.pageController = null;
  }

  /**
   * Build Chromium command-line flags from fingerprint config.
   */
  buildFlags(userDataDir) {
    const fp = this.fingerprint;
    const flags = [
      `--remote-debugging-port=${this.debugPort}`,
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
      '--disable-breakpad',
      '--disable-client-side-phishing-detection',
      '--disable-component-extensions-with-background-pages',
      '--disable-default-apps',
      '--disable-extensions',
      '--disable-hang-monitor',
      '--disable-ipc-flooding-protection',
      '--disable-popup-blocking',
      '--disable-prompt-on-repost',
      '--disable-sync',
      '--disable-translate',
      '--disable-windows10-custom-titlebar',
      '--metrics-recording-only',
      '--no-sandbox',
      '--safebrowsing-disable-auto-update',
      '--password-store=basic',
      '--use-mock-keychain',
      '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
    ];

    // FWYS fingerprint flags (these are read by our C++ patches)
    if (fp.canvas_seed) flags.push(`--fwys-canvas-seed=${fp.canvas_seed}`);
    if (fp.audio_seed) flags.push(`--fwys-audio-seed=${fp.audio_seed}`);
    if (fp.font_seed) flags.push(`--fwys-font-seed=${fp.font_seed}`);
    if (fp.webgl_vendor) flags.push(`--fwys-webgl-vendor=${fp.webgl_vendor}`);
    if (fp.webgl_renderer) flags.push(`--fwys-webgl-renderer=${fp.webgl_renderer}`);
    if (fp.hardware_concurrency) flags.push(`--fwys-hw-concurrency=${fp.hardware_concurrency}`);
    if (fp.device_memory) flags.push(`--fwys-device-memory=${fp.device_memory}`);
    if (fp.ua_brand) flags.push(`--fwys-ua-brand=${fp.ua_brand}`);
    if (fp.ua_version) flags.push(`--fwys-ua-version=${fp.ua_version}`);
    if (fp.ua_platform) flags.push(`--fwys-ua-platform=${fp.ua_platform}`);

    // WebRTC policy
    if (fp.webrtc_mode === 'block') flags.push('--fwys-block-webrtc');
    else if (fp.webrtc_mode === 'filter_local') flags.push('--fwys-webrtc-filter-local');

    // Proxy
    if (fp.proxy) {
      flags.push(`--proxy-server=${fp.proxy}`);
      if (fp.proxy_bypass) flags.push(`--proxy-bypass-list=${fp.proxy_bypass}`);
    }

    // Screen resolution
    if (fp.screen_width && fp.screen_height) {
      flags.push(`--window-size=${fp.screen_width},${fp.screen_height}`);
    }

    // User agent (full UA string override via switch)
    if (fp.user_agent) flags.push(`--user-agent=${fp.user_agent}`);

    return flags;
  }

  /**
   * Launch Chromium and connect CDP.
   */
  async connect() {
    const path = require('path');
    const os = require('os');

    const userDataDir = path.join(
      process.cwd(), '..', 'profiles', 'user_data', this.profileId
    );

    const flags = this.buildFlags(userDataDir);

    console.log(`  [CDP] Launching Chromium for profile: ${this.profileId}`);
    console.log(`  [CDP] Debug port: ${this.debugPort}`);

    // Launch Chromium process
    this.process = spawn(this.chromiumPath, flags, {
      detached: false,
      stdio: 'ignore',
    });

    this.pid = this.process.pid;
    console.log(`  [CDP] Chromium PID: ${this.pid}`);

    this.process.on('exit', (code) => {
      console.log(`  [CDP] Profile ${this.profileId} Chromium exited (code=${code})`);
      sessions.delete(this.profileId);
    });

    // Wait for Chromium to start debugging port
    await this._waitForDebugPort();

    // Get WebSocket URL for first page
    const wsUrl = await this._getDebuggerUrl();
    console.log(`  [CDP] WebSocket: ${wsUrl}`);

    // Connect WebSocket
    this.ws = new WebSocket(wsUrl);
    await new Promise((res, rej) => {
      this.ws.on('open', res);
      this.ws.on('error', rej);
    });

    this.ws.on('message', (data) => this._onMessage(JSON.parse(data)));

    // Setup stealth injection for all new pages
    await this._setupStealth();

    sessions.set(this.profileId, this);
    console.log(`  [CDP] Profile ${this.profileId} connected and stealth active`);
  }

  async _waitForDebugPort(retries = 20, delay = 500) {
    for (let i = 0; i < retries; i++) {
      try {
        await this._getDebuggerUrl();
        return;
      } catch {
        await new Promise(r => setTimeout(r, delay));
      }
    }
    throw new Error(`Chromium debug port ${this.debugPort} not available after ${retries} retries`);
  }

  _getDebuggerUrl() {
    return new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${this.debugPort}/json/version`, (res) => {
        let data = '';
        res.on('data', d => data += d);
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            resolve(json.webSocketDebuggerUrl);
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
  }

  async send(method, params = {}) {
    const id = ++this.msgId;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  _onMessage(msg) {
    if (msg.id && this.callbacks.has(msg.id)) {
      const { resolve, reject } = this.callbacks.get(msg.id);
      this.callbacks.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  }

  async _setupStealth() {
    const stealthScript = StealthLoader.buildScript(this.fingerprint);

    // Enable Page domain
    await this.send('Page.enable');

    // Inject stealth script on every new document
    await this.send('Page.addScriptToEvaluateOnNewDocument', {
      source: stealthScript,
    });

    // Also inject User-Agent override at network level
    if (this.fingerprint.user_agent) {
      await this.send('Network.enable');
      await this.send('Network.setUserAgentOverride', {
        userAgent: this.fingerprint.user_agent,
      });
    }

    console.log(`  [Stealth] Scripts injected for profile ${this.profileId}`);
  }

  static closeProfile(profileId) {
    const session = sessions.get(profileId);
    if (session) {
      if (session.ws) session.ws.close();
      if (session.process) session.process.kill();
      sessions.delete(profileId);
      console.log(`  [CDP] Profile ${profileId} closed`);
    }
  }
}

module.exports = CDPManager;
