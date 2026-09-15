'use strict';

/**
 * generator.js — Fingerprint Generation Engine
 *
 * Generates a complete 75+ parameter browser fingerprint by:
 *   1. Calling fpgen (Python) for hardware/browser fingerprint
 *   2. Merging with IP-derived geo data (language, timezone, geo coords)
 *   3. Adding consistency-checked values (fonts, speech voices, etc.)
 *
 * Philosophy:
 *   - IP-derived fields ALWAYS override fpgen fields (proxy-first)
 *   - All fields must be internally consistent (no mismatches)
 *   - Per-profile deterministic — same inputs → same fingerprint
 */

const { spawnSync } = require('child_process');
const path = require('path');

// ─── OS-specific data tables ───────────────────────────────────────────────

const OS_DATA = {
    windows10: {
        platform:    'Win32',
        oscpu:       undefined,
        buildNumber: '19045',
        uaPlatform:  'Windows NT 10.0; Win64; x64',
        // Common Windows 10 fonts
        fonts: [
            'Arial', 'Arial Black', 'Calibri', 'Cambria', 'Comic Sans MS',
            'Consolas', 'Courier New', 'Georgia', 'Impact', 'Lucida Console',
            'Lucida Sans Unicode', 'Microsoft Sans Serif', 'Segoe UI',
            'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana',
            'Wingdings', 'Wingdings 2', 'Wingdings 3',
            // Windows 10 specific
            'Yu Gothic', 'Yu Gothic UI', 'Malgun Gothic', 'Leelawadee UI',
            'Nirmala UI', 'Sitka Text', 'Sitka Subheading',
        ],
        speechVoices: [
            { name: 'Microsoft David Desktop - English (United States)', lang: 'en-US' },
            { name: 'Microsoft Zira Desktop - English (United States)',  lang: 'en-US' },
            { name: 'Microsoft Mark Desktop - English (United States)',  lang: 'en-US' },
        ],
    },
    windows11: {
        platform:    'Win32',
        oscpu:       undefined,
        buildNumber: '22631',
        uaPlatform:  'Windows NT 10.0; Win64; x64',
        fonts: [
            'Arial', 'Arial Black', 'Calibri', 'Cambria', 'Comic Sans MS',
            'Consolas', 'Courier New', 'Georgia', 'Impact', 'Lucida Console',
            'Segoe UI', 'Segoe UI Variable', 'Tahoma', 'Times New Roman',
            'Trebuchet MS', 'Verdana',
            'Yu Gothic', 'Yu Gothic UI', 'Malgun Gothic',
        ],
        speechVoices: [
            { name: 'Microsoft David - English (United States)', lang: 'en-US' },
            { name: 'Microsoft Zira - English (United States)',  lang: 'en-US' },
            { name: 'Microsoft Jenny Online (Natural) - English (United States)', lang: 'en-US' },
        ],
    },
    linux: {
        platform:    'Linux x86_64',
        oscpu:       'Linux x86_64',
        buildNumber: '',
        uaPlatform:  'X11; Linux x86_64',
        fonts: [
            'DejaVu Sans', 'DejaVu Serif', 'DejaVu Sans Mono',
            'Liberation Sans', 'Liberation Serif', 'Liberation Mono',
            'Ubuntu', 'Ubuntu Mono', 'Noto Sans', 'Noto Serif',
            'FreeSans', 'FreeSerif', 'FreeMono',
        ],
        speechVoices: [],
    },
};

const SCREEN_RESOLUTIONS = {
    '1920x1080': { width: 1920, height: 1080, availHeight: 1040 },
    '2560x1440': { width: 2560, height: 1440, availHeight: 1400 },
    '1366x768':  { width: 1366, height: 768,  availHeight: 728  },
    '1440x900':  { width: 1440, height: 900,  availHeight: 860  },
    '1280x720':  { width: 1280, height: 720,  availHeight: 680  },
    '3840x2160': { width: 3840, height: 2160, availHeight: 2120 },
};

// ─── fpgen Python subprocess ───────────────────────────────────────────────

function callFpgen(osType, browserName = 'Chrome') {
    // Map our os_type to fpgen os param
    const fpgenOs = osType.startsWith('windows') ? 'Windows' : 'Linux';

    const script = `
import json, sys
try:
    import fpgen
    result = fpgen.generate(os='${fpgenOs}', browser='${browserName}')
    # flatten to dict
    def flatten(d, prefix=''):
        out = {}
        for k, v in d.items():
            key = (prefix + '.' + k) if prefix else k
            if isinstance(v, dict):
                out.update(flatten(v, key))
            else:
                out[key] = v
        return out
    print(json.dumps(result if isinstance(result, dict) else vars(result)))
except ImportError:
    print(json.dumps({'error': 'fpgen not installed'}))
except Exception as e:
    print(json.dumps({'error': str(e)}))
`;

    const result = spawnSync('python', ['-c', script], {
        encoding: 'utf8',
        timeout: 15000,
    });

    if (result.error || result.status !== 0) {
        console.warn('[generator] fpgen failed:', result.error || result.stderr);
        return null;
    }

    try {
        const data = JSON.parse(result.stdout.trim());
        if (data.error) {
            console.warn('[generator] fpgen error:', data.error);
            return null;
        }
        return data;
    } catch {
        console.warn('[generator] fpgen JSON parse failed');
        return null;
    }
}

// ─── Language, Speech Voice & Font mapping (195+ countries) ───────────────
const {
    getLanguages,
    getSpeechVoices,
    getRegionalFonts,
} = require('./countryData');

// ─── GPU profiles (realistic combos) ──────────────────────────────────────

// ─── GPU profiles (realistic combos) ──────────────────────────────────────

const GPU_PROFILES = [
    { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
    { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
    { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
    { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 2060 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
    { vendor: 'Google Inc. (AMD)',    renderer: 'ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001638) Direct3D11 vs_5_0 ps_5_0, D3D11)' },
    { vendor: 'Google Inc. (AMD)',    renderer: 'ANGLE (AMD, AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
    { vendor: 'Google Inc. (AMD)',    renderer: 'ANGLE (AMD, AMD Radeon RX 6700 XT Direct3D11 vs_5_0 ps_5_0, D3D11)' },
    { vendor: 'Google Inc. (Intel)',  renderer: 'ANGLE (Intel, Intel Iris Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)' },
    { vendor: 'Google Inc. (Intel)',  renderer: 'ANGLE (Intel, Intel UHD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
    { vendor: 'Google Inc. (Intel)',  renderer: 'ANGLE (Intel, Intel UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
];

const RESOLUTION_CHOICES = [
    '1920x1080', '1920x1080', '1920x1080', '2560x1440', '1440x900', '1366x768', '1280x720'
];

function pseudoRandom(seed, max) {
    // Deterministic pseudo-random from string seed
    let h = 0;
    for (let i = 0; i < seed.length; i++) {
        h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
    }
    return Math.abs(h) % max;
}

// ─── Main export ──────────────────────────────────────────────────────────

/**
 * generateFingerprint(options) → fingerprint object
 *
 * @param {Object} options
 *   osType          — 'windows10'|'windows11'|'linux'
 *   resolution      — '1920x1080' etc. or null for random
 *   ipData          — { ip, country, countryCode, timezone, lat, lng, ... }
 *   hardwareConcurrency — 2|4|8|16 or null for random
 *   deviceMemory    — 2|4|8|16 or null
 *   profileId       — used as seed for deterministic random
 *   noiseLevel      — 0|1|2|3 (canvas/audio noise level, 0=clean native)
 */
function generateFingerprint(options = {}) {
    const {
        osType          = 'windows10',
        resolution      = null,
        ipData          = {},
        hardwareConcurrency = null,
        deviceMemory    = null,
        profileId       = 'default',
        noiseLevel      = 0,
    } = options;

    const os = OS_DATA[osType] || OS_DATA.windows10;
    const isRandom = options.randomize || profileId === 'temp' || !profileId;
    const seed = isRandom
        ? (profileId + '_' + Date.now() + '_' + Math.floor(Math.random() * 100000))
        : (profileId || 'default');

    // ── Browser version (Chrome 153 matching system Chrome) ──
    const chromeVersion = '153.0.8010.36';
    const chromeMinor   = '153';
    const userAgent = `Mozilla/5.0 (${os.uaPlatform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;

    // ── Hardware ──
    const osModule = require('os');
    const hostCpus = (osModule.cpus && osModule.cpus() && osModule.cpus().length) ? osModule.cpus().length : 12;
    const hostRam  = Math.round(osModule.totalmem() / (1024 * 1024 * 1024));

    let cpu = hardwareConcurrency;
    if (!cpu) {
        if (isRandom) {
            const cpuChoices = [4, 6, 8, 8, 8, 12, 16];
            cpu = cpuChoices[pseudoRandom(seed + 'cpu', cpuChoices.length)];
        } else {
            cpu = hostCpus;
        }
    }

    let ram = deviceMemory;
    if (!ram) {
        if (isRandom) {
            if (cpu <= 4) {
                ram = [4, 8][pseudoRandom(seed + 'ram', 2)];
            } else if (cpu <= 6) {
                ram = [8, 16][pseudoRandom(seed + 'ram', 2)];
            } else if (cpu <= 8) {
                ram = [8, 16, 32][pseudoRandom(seed + 'ram', 3)];
            } else {
                ram = [16, 32, 64][pseudoRandom(seed + 'ram', 3)];
            }
        } else {
            ram = (hostRam >= 24 ? 32 : (hostRam >= 16 ? 16 : 8));
        }
    }

    // Screen Resolution
    let resKey = resolution;
    if (!resKey) {
        if (isRandom) {
            resKey = RESOLUTION_CHOICES[pseudoRandom(seed + 'res', RESOLUTION_CHOICES.length)];
        } else {
            resKey = '1920x1080';
        }
    }
    const screen = SCREEN_RESOLUTIONS[resKey] || SCREEN_RESOLUTIONS['1920x1080'];

    let dpr = 1.0;
    if (screen.width >= 2560) {
        dpr = [1.25, 1.5, 2.0][pseudoRandom(seed + 'dpr', 3)];
    } else if (screen.width === 1920) {
        dpr = (osType === 'windows11') ? 1.25 : 1.0;
    } else {
        dpr = 1.0;
    }

    // Window = viewport (slightly smaller than screen, realistic)
    const innerWidth  = Math.floor(screen.width  * 0.78);
    const innerHeight = Math.floor(screen.height * 0.80);

    // ── GPU ──
    let gpuProfile = options.gpu;
    if (!gpuProfile) {
        if (isRandom) {
            gpuProfile = GPU_PROFILES[pseudoRandom(seed + 'gpu', GPU_PROFILES.length)];
        } else {
            gpuProfile = GPU_PROFILES[0];
        }
    }

    // ── Geo / Language (IP-first) ──
    const countryCode = (ipData.countryCode || ipData.country || 'US').toUpperCase();
    const languages   = getLanguages(countryCode);
    const timezone    = ipData.timezone || 'America/New_York';
    const geoLat      = ipData.lat || 40.7128;
    const geoLng      = ipData.lng || -74.0060;

    // ── Fonts (Base OS + Country-specific regional fonts) ──
    const regionalFonts = getRegionalFonts(countryCode);
    const fontList = Array.from(new Set([...os.fonts, ...regionalFonts]));

    // ── Speech Voices (Matched to Country & OS) ──
    const speechVoices = getSpeechVoices(countryCode, os);

    // ── WebGL params (consistent with GPU) ──
    const glParams = {
        MAX_TEXTURE_SIZE:             16384,
        MAX_VIEWPORT_DIMS:            [32767, 32767],
        MAX_VERTEX_ATTRIBS:           16,
        MAX_VERTEX_UNIFORM_VECTORS:   4096,
        MAX_FRAGMENT_UNIFORM_VECTORS: 1024,
        MAX_VARYING_VECTORS:          32,
        MAX_TEXTURE_IMAGE_UNITS:      16,
        MAX_COMBINED_TEXTURE_IMAGE_UNITS: 32,
        MAX_CUBE_MAP_TEXTURE_SIZE:    16384,
        MAX_RENDERBUFFER_SIZE:        16384,
        SHADING_LANGUAGE_VERSION:     'WebGL GLSL ES 3.00 (OpenGL ES GLSL ES 3.0 Chromium)',
        VERSION:                      'WebGL 2.0 (OpenGL ES 3.0 Chromium)',
    };

    // ── Battery (realistic) ──
    const batteryLevels = [0.73, 0.82, 0.91, 0.64, 0.55, 0.88, 1.0];
    const batteryLevel  = batteryLevels[pseudoRandom(seed + 'bat', batteryLevels.length)];

    // ── Network connection ──
    const connectionTypes = ['4g', '4g', '4g', 'wifi'];
    const connType = connectionTypes[pseudoRandom(seed + 'net', connectionTypes.length)];

    // ── Build complete fingerprint ──
    const fp = {
        screen_resolution:   resKey,
        hardware_concurrency:cpu,
        device_memory:       ram,
        navigator: {
            userAgent,
            platform:            os.platform,
            language:            languages[0],
            languages,
            hardwareConcurrency: cpu,
            deviceMemory:        ram,
            maxTouchPoints:      0,
            cookieEnabled:       true,
            doNotTrack:          null,
            pdfViewerEnabled:    true,
            webdriver:           false,     // CRITICAL — always false
            appCodeName:         'Mozilla',
            appName:             'Netscape',
            appVersion:          userAgent.replace('Mozilla/', ''),
            vendor:              'Google Inc.',
            vendorSub:           '',
            productSub:          '20030107',
            oscpu:               os.oscpu,
        },
        screen: {
            width:           screen.width,
            height:          screen.height,
            availWidth:      screen.width,
            availHeight:     screen.availHeight,
            availLeft:       0,
            availTop:        0,
            colorDepth:      24,
            pixelDepth:      24,
            devicePixelRatio:dpr,
            orientation:     { type: 'landscape-primary', angle: 0 },
        },
        window: {
            innerWidth,
            innerHeight,
            outerWidth:  screen.width,
            outerHeight: screen.height,
            screenX:     0,
            screenY:     0,
            pageXOffset: 0,
            pageYOffset: 0,
            devicePixelRatio: dpr,
        },
        gpu: {
            vendor:   gpuProfile.vendor,
            renderer: gpuProfile.renderer,
        },
        canvas: {
            seed:       pseudoRandom(seed + 'cvs', 0x7FFFFFFF) + 1,   // 1..2147483647
            noiseLevel,     // 1=subtle 2=normal 3=strong
            noiseType: 'pixel',
        },
        webgl: {
            vendor:     gpuProfile.vendor,
            renderer:   gpuProfile.renderer,
            version:    glParams.VERSION,
            glslVersion:glParams.SHADING_LANGUAGE_VERSION,
            params:     glParams,
            extensions: [
                'ANGLE_instanced_arrays',
                'EXT_blend_minmax',
                'EXT_color_buffer_half_float',
                'EXT_disjoint_timer_query',
                'EXT_float_blend',
                'EXT_frag_depth',
                'EXT_shader_texture_lod',
                'EXT_texture_compression_bptc',
                'EXT_texture_compression_rgtc',
                'EXT_texture_filter_anisotropic',
                'EXT_sRGB',
                'KHR_parallel_shader_compile',
                'OES_element_index_uint',
                'OES_fbo_render_mipmap',
                'OES_standard_derivatives',
                'OES_texture_float',
                'OES_texture_float_linear',
                'OES_texture_half_float',
                'OES_texture_half_float_linear',
                'OES_vertex_array_object',
                'WEBGL_color_buffer_float',
                'WEBGL_compressed_texture_s3tc',
                'WEBGL_compressed_texture_s3tc_srgb',
                'WEBGL_debug_renderer_info',
                'WEBGL_debug_shaders',
                'WEBGL_depth_texture',
                'WEBGL_draw_buffers',
                'WEBGL_lose_context',
                'WEBGL_multi_draw',
            ],
        },
        audio: {
            seed:               pseudoRandom(seed + 'aud', 0x7FFFFFFF) + 1,
            sampleRate:         44100,
            channelCount:       2,
            maxChannelCount:    2,
            noiseLevel,
            baseLatency:        0.005,
            outputLatency:      0.012,
        },
        audioContext: {
            seed:               pseudoRandom(seed + 'actx', 0x7FFFFFFF) + 1,
            sampleRate:         44100,
            noiseLevel,
        },
        fonts: {
            list:   fontList,
            method: 'os_match',
        },
        geo: {
            mode:     'proxy',      // proxy / custom / disabled
            lat:      geoLat,
            lng:      geoLng,
            accuracy: 50.0 + pseudoRandom(seed + 'acc', 100),
            altitude: null,
            altitudeAccuracy: null,
            heading:  null,
            speed:    null,
        },
        timezone,
        locale:   languages[0],
        speech: {
            voices: speechVoices,
        },
        network: {
            connectionType: connType,
            downlink:       10 + pseudoRandom(seed + 'dl', 90),
            rtt:            25 * (1 + pseudoRandom(seed + 'rtt', 4)), // 25ms steps: 25, 50, 75, 100
            saveData:       false,
        },
        battery: {
            charging:        batteryLevel === 1.0,
            chargingTime:    batteryLevel === 1.0 ? 0 : Infinity,
            dischargingTime: batteryLevel === 1.0 ? Infinity : Math.floor(3600 + pseudoRandom(seed + 'dis', 7200)),
            level:           batteryLevel,
        },
        plugins: [
            { name: 'PDF Viewer',                    filename: 'internal-pdf-viewer',     description: 'Portable Document Format' },
            { name: 'Chrome PDF Viewer',             filename: 'internal-pdf-viewer',     description: '' },
            { name: 'Chromium PDF Viewer',           filename: 'internal-pdf-viewer',     description: '' },
            { name: 'Microsoft Edge PDF Viewer',     filename: 'internal-pdf-viewer',     description: '' },
            { name: 'WebKit built-in PDF',           filename: 'internal-pdf-viewer',     description: '' },
        ],
        mimeTypes: [
            { type: 'application/pdf',       description: 'Portable Document Format', suffixes: 'pdf' },
            { type: 'text/pdf',              description: '',                          suffixes: 'pdf' },
        ],
        chrome: {
            // window.chrome object must exist and look real
            loadTimes: {},
            csi:       {},
            app:       { isInstalled: false, InstallState: {}, RunningState: {} },
        },
        os: {
            type:        osType,
            buildNumber: os.buildNumber,
        },
        browser: {
            name:    'Chrome',
            version: chromeMinor,
            fullVersion: chromeVersion,
        },
        clientHints: {
            brands: [
                { brand: 'Google Chrome',       version: chromeMinor },
                { brand: 'Not_A Brand',         version: '8' },
                { brand: 'Chromium',            version: chromeMinor },
            ],
            mobile:          false,
            platform:        osType.startsWith('windows') ? 'Windows' : 'Linux',
            platformVersion: osType === 'windows11' ? '14.0.0' : '10.0.0',
            architecture:    'x86',
            bitness:         '64',
            wow64:           false,
        },
        headers: {
            'User-Agent':            userAgent,
            'Accept-Language':       languages.join(',') + ';q=0.9',
            'Sec-CH-UA':             `"Google Chrome";v="${chromeMinor}", "Not_A Brand";v="8", "Chromium";v="${chromeMinor}"`,
            'Sec-CH-UA-Mobile':      '?0',
            'Sec-CH-UA-Platform':    osType.startsWith('windows') ? '"Windows"' : '"Linux"',
            'Sec-CH-UA-Platform-Version': osType === 'windows11' ? '"14.0.0"' : '"10.0.0"',
            'Sec-CH-UA-Arch':        '"x86"',
            'Sec-CH-UA-Bitness':     '"64"',
            'Sec-CH-UA-Full-Version-List': `"Google Chrome";v="${chromeVersion}", "Not_A Brand";v="8.0.0.0", "Chromium";v="${chromeVersion}"`,
            'Device-Memory':         `${ram}`,
            'Sec-CH-Device-Memory':  `${ram}`,
            'DPR':                   `${dpr}`,
            'Sec-CH-DPR':            `${dpr}`,
            'Viewport-Width':        `${innerWidth}`,
            'Sec-CH-Viewport-Width': `${innerWidth}`,
            'Sec-CH-Viewport-Height':`${innerHeight}`,
            'RTT':                   '50',
            'Downlink':              '1.75',
            'ECT':                   '4g',
        },
        webrtc: {
            mode:     'filter_local',
            publicIp: ipData.ip || '',
        },
        publicIp: ipData.ip || '',
        meta: {
            generatedAt:     new Date().toISOString(),
            generationMode:  'auto',
            profileId,
            osType,
            resolution:      resKey,
            ipSource:        ipData.ip || '',
        },
    };

    // ── Flat aliases for easy access ─────────────────────────────────────────
    // These duplicate nested values at the top level for QML / test convenience
    fp.language            = fp.navigator.language;
    fp.languages           = fp.navigator.languages;
    fp.hardwareConcurrency = fp.navigator.hardwareConcurrency;
    fp.deviceMemory        = fp.navigator.deviceMemory;
    fp.publicIp            = fp.meta.ipSource;

    return fp;
}

module.exports = { generateFingerprint };
