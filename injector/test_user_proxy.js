'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');

const { testProxy } = require('./src/profile/iptest');
const { generateFingerprint } = require('./src/profile/generator');
const StealthLoader = require('./src/stealth/StealthLoader');
const ProxyTunnel = require('./src/proxy/ProxyTunnel');

const proxyConfig = {
    type: 'socks5',
    host: '47.90.224.62',
    port: 40000,
    user: 'indeep',
    pass: '9816aa866f28f34c'
};

async function runTest() {
    console.log('====================================================');
    console.log('  Testing User Proxy & Fingerprint Generation Flow');
    console.log('====================================================');
    console.log(`Proxy: ${proxyConfig.type}://${proxyConfig.user}:***@${proxyConfig.host}:${proxyConfig.port}\n`);

    // ── STEP 1: Test Proxy & Fetch Geo/IP Data ────────────────────────
    console.log('[STEP 1] Testing Proxy Connectivity...');
    let ipData;
    try {
        ipData = await testProxy(proxyConfig);
        console.log('✓ Proxy Connected Successfully!');
        console.log('  Exit IP:     ', ipData.ip);
        console.log('  Country:     ', `${ipData.country} (${ipData.countryCode})`);
        console.log('  City:        ', ipData.city);
        console.log('  Timezone:    ', ipData.timezone);
        console.log('  ISP:         ', ipData.isp);
        console.log('  ASN:         ', ipData.asn);
        console.log('  Type:        ', ipData.type);
        console.log('  Coordinates: ', `${ipData.lat}, ${ipData.lng}`);
    } catch (err) {
        console.error('✗ Proxy test failed:', err.message);
        return;
    }

    // ── STEP 2: Generate IP-Aligned Fingerprint ───────────────────────
    console.log('\n[STEP 2] Generating Deterministic Fingerprint...');
    const fp = generateFingerprint({
        profileId: 'user_proxy_profile',
        osType: 'windows10',
        ipData: ipData,
        noiseLevel: 2
    });

    console.log('✓ Fingerprint Generated:');
    console.log('  User-Agent:    ', fp.navigator.userAgent);
    console.log('  Language:      ', fp.navigator.language, fp.navigator.languages);
    console.log('  Timezone:      ', fp.timezone);
    console.log('  Geo Lat/Lng:   ', fp.geo.lat, fp.geo.lng);
    console.log('  Platform:      ', fp.navigator.platform);
    console.log('  CPU Cores:     ', fp.navigator.hardwareConcurrency);
    console.log('  Memory (GB):   ', fp.navigator.deviceMemory);
    console.log('  GPU Renderer:  ', fp.gpu.renderer);
    console.log('  Canvas Seed:   ', fp.canvas_seed);

    // ── STEP 3: Create Local Authenticated Proxy Tunnel ──────────────
    console.log('\n[STEP 3] Initializing Local Proxy Tunnel (for Chromium auth)...');
    const localTunnelPort = 29955;
    try {
        await ProxyTunnel.createTunnel({
            profileId: 'user_proxy_tunnel',
            localPort: localTunnelPort,
            proxyType: proxyConfig.type,
            proxyHost: proxyConfig.host,
            proxyPort: proxyConfig.port,
            proxyUser: proxyConfig.user,
            proxyPass: proxyConfig.pass
        });
        console.log(`✓ Proxy Tunnel active on 127.0.0.1:${localTunnelPort}`);
    } catch (err) {
        console.error('✗ Failed to start proxy tunnel:', err.message);
        return;
    }

    // ── STEP 4: Launch Real Chromium Instance ────────────────────────
    console.log('\n[STEP 4] Launching Real Chrome via Tunnel...');
    const defaultPaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ];
    const chromePath = defaultPaths.find(p => fs.existsSync(p));
    if (!chromePath) {
        console.error('Chrome executable not found!');
        ProxyTunnel.closeTunnel('user_proxy_tunnel');
        return;
    }

    const debugPort = 9570;
    const tmpDir = path.join(os.tmpdir(), `fwys_user_proxy_${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    const chromeArgs = [
        `--remote-debugging-port=${debugPort}`,
        `--user-data-dir=${tmpDir}`,
        `--proxy-server=socks5://127.0.0.1:${localTunnelPort}`,
        '--proxy-bypass-list=<-loopback>',
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-blink-features=AutomationControlled',
        '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
        `--window-size=${fp.screen?.width || 1280},${fp.screen?.height || 720}`,
        '--headless=new'
    ];

    const cp = spawn(chromePath, chromeArgs, { stdio: 'ignore' });
    let browser = null;

    try {
        await new Promise((resolve, reject) => {
            const start = Date.now();
            const iv = setInterval(() => {
                const req = http.get(`http://127.0.0.1:${debugPort}/json/version`, () => {
                    clearInterval(iv);
                    resolve();
                });
                req.on('error', () => {
                    if (Date.now() - start > 15000) {
                        clearInterval(iv);
                        reject(new Error('Timeout waiting for Chrome debug port'));
                    }
                });
                req.setTimeout(1000, () => req.destroy());
            }, 300);
        });

        browser = await puppeteer.connect({
            browserURL: `http://127.0.0.1:${debugPort}`,
            defaultViewport: null
        });

        const pages = await browser.pages();
        const page = pages[0] || await browser.newPage();

        // ── STEP 5: Inject Stealth Scripts & Set Geo/Timezone ────────
        console.log('[STEP 5] Injecting CDP Stealth Patches...');
        const stealthScript = StealthLoader.buildScript(fp);
        await page.setUserAgent(fp.navigator.userAgent);
        await page.evaluateOnNewDocument(stealthScript);

        if (fp.timezone) {
            await page.emulateTimezone(fp.timezone).catch(() => {});
        }
        if (fp.geo?.lat && fp.geo?.lng) {
            await page.setGeolocation({
                latitude: Number(fp.geo.lat),
                longitude: Number(fp.geo.lng),
                accuracy: 50
            }).catch(() => {});
        }

        // ── STEP 6: Navigate & Verify on Sannysoft ───────────────────
        console.log('\n[STEP 6] Navigating to https://bot.sannysoft.com through proxy...');
        const t0 = Date.now();
        await page.goto('https://bot.sannysoft.com', { waitUntil: 'networkidle2', timeout: 45000 });
        console.log(`✓ Page loaded in ${Date.now() - t0}ms`);

        // Check tests
        const results = await page.evaluate(() => {
            const rows = document.querySelectorAll('table tr');
            let passed = 0;
            let failed = 0;
            const items = [];
            rows.forEach(r => {
                const cols = r.querySelectorAll('td, th');
                if (cols.length >= 2) {
                    const name = cols[0].innerText.trim().replace(/\s+/g, ' ');
                    const val = cols[1].innerText.trim().replace(/\s+/g, ' ');
                    if (name && name !== 'Test Name') {
                        const isFail = cols[1].classList.contains('failed') || cols[1].style.backgroundColor === 'red';
                        if (isFail) failed++; else passed++;
                        items.push({ name, val, passed: !isFail });
                    }
                }
            });
            return { passed, failed, total: passed + failed, items };
        });

        console.log(`\n====================================================`);
        console.log(`  Live Detection Results on bot.sannysoft.com`);
        console.log(`  Passed: ${results.passed} / ${results.total} (${Math.round((results.passed/results.total)*100)}%)`);
        console.log(`====================================================`);

        const screenshotPath = path.resolve(__dirname, 'user_proxy_sannysoft_result.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log(`\n✓ Full screenshot saved to: ${screenshotPath}`);

    } catch (err) {
        console.error('Error during live test:', err);
    } finally {
        if (browser) try { await browser.disconnect(); } catch {}
        try { cp.kill(); } catch {}
        ProxyTunnel.closeTunnel('user_proxy_tunnel');
    }
}

runTest();
