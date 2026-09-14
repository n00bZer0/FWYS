'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');
const StealthLoader = require('./src/stealth/StealthLoader');
const { generateFingerprint } = require('./src/profile/generator');

async function testBrowserLeaks() {
    console.log('=== BrowserLeaks & WebRTC Leak Verification ===');

    const defaultPaths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ];
    const chromePath = defaultPaths.find(p => fs.existsSync(p));
    if (!chromePath) {
        console.error('Chrome executable not found!');
        process.exit(1);
    }

    const fp = generateFingerprint({ profileId: 'browserleaks_test', osType: 'windows10' });
    const debugPort = 9562;
    const tmpDir = path.join(os.tmpdir(), `fwys_leaks_${Date.now()}`);
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

        // 1. Test Canvas
        console.log('Testing https://browserleaks.com/canvas ...');
        await page.goto('https://browserleaks.com/canvas', { waitUntil: 'networkidle2', timeout: 35000 });
        await new Promise(r => setTimeout(r, 2000));

        const canvasData = await page.evaluate(() => {
            const hash = document.querySelector('#crc')?.innerText || 'N/A';
            const signature = document.querySelector('#signature')?.innerText || 'N/A';
            return { hash, signature };
        });
        console.log('Canvas Fingerprint Hash:', canvasData.hash, '| Signature:', canvasData.signature);
        const canvasScreenshot = path.resolve(__dirname, 'browserleaks_canvas.png');
        await page.screenshot({ path: canvasScreenshot });
        console.log('Canvas screenshot saved:', canvasScreenshot);

        // 2. Test WebRTC IP Leak
        console.log('\nTesting https://browserleaks.com/webrtc ...');
        await page.goto('https://browserleaks.com/webrtc', { waitUntil: 'networkidle2', timeout: 35000 });
        await new Promise(r => setTimeout(r, 2000));

        const webrtcData = await page.evaluate(() => {
            const rtcSupport = document.querySelector('#webrtc-support')?.innerText || 'N/A';
            const publicIp = document.querySelector('#rtc-public-ip')?.innerText || 'N/A';
            const localIp = document.querySelector('#rtc-local-ip')?.innerText || 'N/A';
            const leakDetected = document.body.innerText.includes('Leak Detected');
            return { rtcSupport, publicIp, localIp, leakDetected };
        });
        console.log('WebRTC Support:', webrtcData.rtcSupport);
        console.log('WebRTC Public IP leak:', webrtcData.publicIp);
        console.log('WebRTC Local IP leak:', webrtcData.localIp);
        console.log('Leak Detected in page:', webrtcData.leakDetected);

        const webrtcScreenshot = path.resolve(__dirname, 'browserleaks_webrtc.png');
        await page.screenshot({ path: webrtcScreenshot });
        console.log('WebRTC screenshot saved:', webrtcScreenshot);

        console.log('\n=== All BrowserLeaks Audits Completed Successfully! ===');

    } catch (err) {
        console.error('Error during BrowserLeaks test:', err);
    } finally {
        if (browser) try { await browser.disconnect(); } catch {}
        try { cp.kill(); } catch {}
    }
}

testBrowserLeaks();
