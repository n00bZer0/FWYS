'use strict';

/**
 * FWYS — Node.js Injection Layer
 * Main entry point
 *
 * IPC Commands handled:
 *   launch_profile   — launch browser with profile
 *   close_profile    — close browser
 *   test_proxy       — test proxy, return IP info
 *   generate_fp      — generate fingerprint for profile
 *   get_profile      — read profile from DB
 */

const IPCServer          = require('./ipc/IPCServer');
const CDPManager         = require('./cdp/CDPManager');
const ProfileReader      = require('./profile/ProfileReader');
const FingerprintGenerator = require('./profile/FingerprintGenerator');
const { testProxy }      = require('./profile/iptest');
const { generateFingerprint } = require('./profile/generator');
const ProxyTunnel        = require('./proxy/ProxyTunnel');
const CookieHelper       = require('./profile/CookieHelper');

const TEST_MODE = process.argv.includes('--test');

async function main() {
  console.log('');
  console.log('  ╔══════════════════════════════════╗');
  console.log('  ║   FWYS Injection Layer v1.1.0   ║');
  console.log('  ╚══════════════════════════════════╝');
  console.log('');

  if (TEST_MODE) {
    console.log('  [TEST MODE] Running self-check...');
    await runTests();
    return;
  }

  const ipc = new IPCServer();
  await ipc.start();

  // ── Setup authenticated proxy tunnel ─────────────────────────────────────
  ipc.on('setup_proxy_tunnel', async (payload) => {
    const { profileId, localPort, proxyType, proxyHost, proxyPort } = payload;
    console.log(`  [IPC] setup_proxy_tunnel: profile=${profileId}, localPort=${localPort} -> ${proxyType}://${proxyHost}:${proxyPort}`);
    try {
      await ProxyTunnel.createTunnel(payload);
      ipc.send('proxy_tunnel_ready', { profileId, localPort, success: true });
    } catch (err) {
      console.error('  [ERROR] Proxy tunnel setup failed:', err.message);
      ipc.send('proxy_tunnel_ready', { profileId, localPort, success: false, error: err.message });
    }
  });

  // ── Launch browser with profile ──────────────────────────────────────────
  ipc.on('launch_profile', async (payload) => {
    const { profileId, chromiumPath, debugPort } = payload;
    console.log(`  [IPC] Launch: profile=${profileId}, port=${debugPort}`);

    try {
      const profile     = await ProfileReader.load(profileId);
      const fingerprint = FingerprintGenerator.fromProfile(profile);

      const cdp = new CDPManager(profileId, chromiumPath, debugPort, fingerprint);
      await cdp.connect();

      ipc.send('launch_result', { profileId, success: true, pid: cdp.pid });
    } catch (err) {
      console.error('  [ERROR] Launch failed:', err.message);
      ipc.send('launch_result', { profileId, success: false, error: err.message });
    }
  });

  // ── Close browser ────────────────────────────────────────────────────────
  ipc.on('close_profile', async (payload) => {
    const { profileId } = payload;
    CDPManager.closeProfile(profileId);
    ProxyTunnel.closeTunnel(profileId);
    ipc.send('close_result', { profileId, success: true });
  });

  // ── Attach CDP to already-running Chrome (launched by Qt BrowserLauncher) ─
  // This is the PRIMARY launch flow:
  //   1. Qt spawns chrome.exe with all --fwys-* flags (C++ patches active)
  //   2. Qt sends attach_cdp to us with debugPort + fingerprint
  //   3. We connect CDP and inject JS stealth scripts
  //   4. All C++ + JS patches now active
  ipc.on('attach_cdp', async (payload) => {
    const { profileId, debugPort, fingerprint, cookies } = payload;
    console.log(`  [IPC] attach_cdp: profile=${profileId}, port=${debugPort}`);

    try {
      let cookiesToInject = [];
      if (Array.isArray(cookies)) {
        cookiesToInject = cookies;
      } else if (typeof cookies === 'string' && cookies.trim()) {
        cookiesToInject = CookieHelper.parse(cookies);
      }

      const session = await CDPManager.attachOnly(profileId, debugPort, fingerprint, cookiesToInject);

      ipc.send('cdp_attached', {
        profileId,
        success: true,
        pid:     session.pid || 0,
        cookiesInjected: cookiesToInject.length,
      });
    } catch (err) {
      console.error('  [ERROR] CDP attach failed:', err.message);
      ipc.send('cdp_attached', {
        profileId,
        success: false,
        error:   err.message,
      });
    }
  });

  // ── Parse cookies (JSON or Netscape) ───────────────────────────────────
  ipc.on('parse_cookies', async (payload) => {
    const { raw } = payload;
    try {
      const parsed = CookieHelper.parse(raw);
      ipc.send('cookies_parsed', {
        success:  true,
        count:    parsed.length,
        cookies:  parsed,
        json:     CookieHelper.toJson(parsed),
        netscape: CookieHelper.toNetscape(parsed),
      });
    } catch (err) {
      ipc.send('cookies_parsed', {
        success: false,
        error:   err.message,
      });
    }
  });

  // ── Extract cookies from running browser ──────────────────────────────
  ipc.on('get_cookies', async (payload) => {
    const { profileId } = payload;
    try {
      const cookies = await CDPManager.getCookies(profileId);
      ipc.send('cookies_extracted', {
        profileId,
        success:  true,
        count:    cookies.length,
        cookies:  cookies,
        json:     CookieHelper.toJson(cookies),
        netscape: CookieHelper.toNetscape(cookies),
      });
    } catch (err) {
      ipc.send('cookies_extracted', {
        profileId,
        success: false,
        error:   err.message,
      });
    }
  });

  // ── Test proxy → return IP data ──────────────────────────────────────────
  ipc.on('test_proxy', async (payload) => {
    const { profileId, proxy } = payload;
    console.log(`  [IPC] Test proxy for profile=${profileId}:`, proxy?.type, proxy?.host);

    try {
      const ipData = await testProxy(proxy);
      ipc.send('proxy_test_result', {
        profileId,
        success: true,
        ipData,
      });
    } catch (err) {
      console.error('  [ERROR] Proxy test failed:', err.message);
      ipc.send('proxy_test_result', {
        profileId,
        success: false,
        error: err.message,
      });
    }
  });

  // ── Generate fingerprint for profile ────────────────────────────────────
  ipc.on('generate_fp', async (payload) => {
    const { profileId, osType, resolution, ipData,
            hardwareConcurrency, deviceMemory, noiseLevel, randomize } = payload;
    console.log(`  [IPC] Generate fingerprint for profile=${profileId}, os=${osType}, randomize=${randomize}`);

    try {
      const fp = generateFingerprint({
        profileId,
        osType:              osType || 'windows10',
        resolution:          randomize ? null : (resolution || null),
        ipData:              ipData || {},
        hardwareConcurrency: randomize ? null : (hardwareConcurrency || null),
        deviceMemory:        randomize ? null : (deviceMemory || null),
        noiseLevel:          noiseLevel || 2,
        randomize:           randomize !== undefined ? randomize : true,
      });

      ipc.send('fp_generated', {
        profileId,
        success:     true,
        fingerprint: fp,
      });
    } catch (err) {
      console.error('  [ERROR] FP generation failed:', err.message);
      ipc.send('fp_generated', {
        profileId,
        success: false,
        error: err.message,
      });
    }
  });

  console.log('  [READY] FWYS injection layer started');
  console.log('  [IPC] Waiting for Qt UI connection...');
}

async function runTests() {
  const tests = [
    { name: 'ProfileReader',     fn: () => require('./profile/ProfileReader').selfTest() },
    { name: 'FingerprintGenerator', fn: () => require('./profile/FingerprintGenerator').selfTest() },
    { name: 'StealthLoader',     fn: () => require('./stealth/StealthLoader').selfTest() },
    { name: 'IPCServer',         fn: () => require('./ipc/IPCServer').selfTest() },
    { name: 'Generator',         fn: () => {
        const fp = generateFingerprint({ profileId: 'test', osType: 'windows10' });
        if (!fp.navigator || !fp.screen || !fp.gpu) throw new Error('Missing fields');
        if (fp.navigator.webdriver !== false) throw new Error('webdriver must be false');
    }},
    { name: 'ProxyTunnel',       fn: async () => {
        const port = await ProxyTunnel.createTunnel({
          profileId: 'selftest_tunnel',
          localPort: 29876,
          proxyType: 'http',
          proxyHost: '127.0.0.1',
          proxyPort: 8080,
          proxyUser: 'user',
          proxyPass: 'pass'
        });
        if (port !== 29876) throw new Error('Port mismatch');
        ProxyTunnel.closeTunnel('selftest_tunnel');
    }},
    { name: 'CookieHelper',      fn: () => CookieHelper.selfTest() },
  ];

  let passed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log(`  [PASS] ${t.name}`);
      passed++;
    } catch (e) {
      console.log(`  [FAIL] ${t.name}: ${e.message}`);
    }
  }

  console.log(`\n  Results: ${passed}/${tests.length} passed`);
  process.exit(passed === tests.length ? 0 : 1);
}

main().catch((err) => {
  console.error('  [FATAL]', err);
  process.exit(1);
});
