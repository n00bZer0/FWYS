/**
 * FWYS — Node.js Injection Layer
 * Main entry point
 *
 * Responsibilities:
 *  1. Start IPC server (named pipe) — receives commands from Qt UI
 *  2. Launch / attach to Chromium via CDP
 *  3. Inject stealth scripts on every new page
 *  4. Manage per-profile proxy + fingerprint config
 */

'use strict';

const IPCServer = require('./ipc/IPCServer');
const CDPManager = require('./cdp/CDPManager');
const ProfileReader = require('./profile/ProfileReader');
const FingerprintGenerator = require('./profile/FingerprintGenerator');

const TEST_MODE = process.argv.includes('--test');

async function main() {
  console.log('');
  console.log('  ╔══════════════════════════════════╗');
  console.log('  ║   FWYS Injection Layer v1.0.0   ║');
  console.log('  ╚══════════════════════════════════╝');
  console.log('');

  if (TEST_MODE) {
    console.log('  [TEST MODE] Running self-check...');
    await runTests();
    return;
  }

  // Start IPC server — Qt UI connects to this
  const ipc = new IPCServer();
  await ipc.start();

  // Listen for launch commands from Qt UI
  ipc.on('launch_profile', async (payload) => {
    const { profileId, chromiumPath, debugPort } = payload;
    console.log(`  [IPC] Launch request: profile=${profileId}, port=${debugPort}`);

    try {
      const profile = await ProfileReader.load(profileId);
      const fingerprint = FingerprintGenerator.fromProfile(profile);

      const cdp = new CDPManager(profileId, chromiumPath, debugPort, fingerprint);
      await cdp.connect();

      ipc.send('launch_result', { profileId, success: true, pid: cdp.pid });
    } catch (err) {
      console.error(`  [ERROR] Launch failed:`, err.message);
      ipc.send('launch_result', { profileId, success: false, error: err.message });
    }
  });

  ipc.on('close_profile', async (payload) => {
    const { profileId } = payload;
    CDPManager.closeProfile(profileId);
    ipc.send('close_result', { profileId, success: true });
  });

  console.log('  [READY] FWYS injection layer started');
  console.log('  [IPC] Waiting for Qt UI connection...');
}

async function runTests() {
  const tests = [
    { name: 'ProfileReader', fn: () => require('./profile/ProfileReader').selfTest() },
    { name: 'FingerprintGenerator', fn: () => require('./profile/FingerprintGenerator').selfTest() },
    { name: 'StealthLoader', fn: () => require('./stealth/StealthLoader').selfTest() },
    { name: 'IPCServer', fn: () => require('./ipc/IPCServer').selfTest() },
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
