'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');
const StealthLoader = require('./src/stealth/StealthLoader');
const { generateFingerprint } = require('./src/profile/generator');

async function testCreepJS() {
    console.log('=== CreepJS Stealth Verification ===');

    const defaultPaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ];
    const chromePath = defaultPaths.find(p => fs.existsSync(p));
    if (!chromePath) {
        console.error('Chrome executable not found!');
        process.exit(1);
    }

    const fp = generateFingerprint({ profileId: 'creepjs_test', osType: 'windows10' });
    const debugPort = 9560;
    const tmpDir = path.join(os.tmpdir(), `fwys_creep_${Date.now()}`);
    fs.mkdirSync(tmpDir, { recursive: true });

    const chromeArgs = [
        `--remote-debugging-port=${debugPort}`,
        `--user-data-dir=${tmpDir}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-blink-features=AutomationControlled',
        '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
        '--window-size=1280,800',
        '--headless=new'
    ];

    console.log('Spawning Chrome on port', debugPort);
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
                    if (Date.now() - start > 12000) {
                        clearInterval(iv);
                        reject(new Error('Timeout waiting for debug port'));
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

        // Inject stealth script
        const stealthScript = StealthLoader.buildScript(fp);
        await page.setUserAgent(fp.navigator.userAgent);
        await page.evaluateOnNewDocument(stealthScript);

        console.log('Navigating to https://abrahamjuliot.github.io/creepjs/ ...');
        await page.goto('https://abrahamjuliot.github.io/creepjs/', { waitUntil: 'networkidle2', timeout: 45000 });

        console.log('Waiting for CreepJS analysis (10s)...');
        await new Promise(r => setTimeout(r, 10000));

        // Evaluate results
        const result = await page.evaluate(() => {
            // Find trust score / lies count
            const text = document.body.innerText;
            const liesElements = Array.from(document.querySelectorAll('.lie, .untrusted, .grade-F, .grade-D, .grade-C, .grade-B, .grade-A'));
            const lies = liesElements.map(el => ({
                text: el.innerText.trim(),
                className: el.className
            })).filter(x => x.text);

            // Look for FP ID or score
            const scoreEl = document.querySelector('.time') || document.querySelector('#fingerprint-data');

            return {
                lies,
                totalLiesDetected: document.querySelectorAll('.lie').length,
                hasLies: text.includes('lie') || text.includes('tampering'),
                snippet: text.slice(0, 1500)
            };
        });

        console.log('\n--- CreepJS Detection Summary ---');
        console.log('Total Lies Detected in DOM:', result.totalLiesDetected);
        console.log('Detected anomalies / grades:', JSON.stringify(result.lies, null, 2));

        const screenshotPath = path.resolve(__dirname, 'creepjs_result.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log('Screenshot saved to:', screenshotPath);

    } catch (err) {
        console.error('Error during CreepJS test:', err);
    } finally {
        if (browser) try { await browser.disconnect(); } catch {}
        try { cp.kill(); } catch {}
    }
}

testCreepJS();
