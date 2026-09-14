'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');
const StealthLoader = require('./src/stealth/StealthLoader');
const { generateFingerprint } = require('./src/profile/generator');

async function testIphey() {
    console.log('=== Iphey.com Anti-Detection Verification ===');

    const defaultPaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ];
    const chromePath = defaultPaths.find(p => fs.existsSync(p));
    if (!chromePath) {
        console.error('Chrome executable not found!');
        process.exit(1);
    }

    const fp = generateFingerprint({ profileId: 'iphey_test', osType: 'windows10' });
    const debugPort = 9564;
    const tmpDir = path.join(os.tmpdir(), `fwys_iphey_${Date.now()}`);
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

        const stealthScript = StealthLoader.buildScript(fp);
        await page.setUserAgent(fp.navigator.userAgent);
        await page.evaluateOnNewDocument(stealthScript);

        console.log('Navigating to https://iphey.com/ ...');
        await page.goto('https://iphey.com/', { waitUntil: 'networkidle2', timeout: 40000 });
        console.log('Waiting for Iphey results (8s)...');
        await new Promise(r => setTimeout(r, 8000));

        const result = await page.evaluate(() => {
            const body = document.body.innerText;
            const isTrustworthy = body.includes('Trustworthy') || !body.includes('Suspicious');
            const items = Array.from(document.querySelectorAll('.trustworthy, .untrustworthy, .badge, .status'))
                .map(el => el.innerText.trim())
                .filter(Boolean);
            return {
                isTrustworthy,
                snippet: body.slice(0, 1000),
                items
            };
        });

        console.log('Trustworthy status:', result.isTrustworthy);
        console.log('Detected status badges:', result.items);

        const screenshotPath = path.resolve(__dirname, 'iphey_result.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });
        console.log('Iphey screenshot saved to:', screenshotPath);

        console.log('\n=== Iphey Audit Completed! ===');

    } catch (err) {
        console.error('Error during Iphey test:', err);
    } finally {
        if (browser) try { await browser.disconnect(); } catch {}
        try { cp.kill(); } catch {}
    }
}

testIphey();
