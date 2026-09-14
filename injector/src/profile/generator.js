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

// ─── Language mapping ──────────────────────────────────────────────────────

const COUNTRY_LANGUAGE = {
    US: ['en-US', 'en'],     GB: ['en-GB', 'en'],
    DE: ['de-DE', 'de'],     FR: ['fr-FR', 'fr'],
    JP: ['ja-JP', 'ja'],     CN: ['zh-CN', 'zh'],
    KR: ['ko-KR', 'ko'],     RU: ['ru-RU', 'ru'],
    BR: ['pt-BR', 'pt'],     ES: ['es-ES', 'es'],
    IT: ['it-IT', 'it'],     NL: ['nl-NL', 'nl'],
    PL: ['pl-PL', 'pl'],     IN: ['en-IN', 'en'],
    TR: ['tr-TR', 'tr'],     ID: ['id-ID', 'id'],
    TH: ['th-TH', 'th'],     VN: ['vi-VN', 'vi'],
    UA: ['uk-UA', 'uk'],     SE: ['sv-SE', 'sv'],
    NO: ['nb-NO', 'nb'],     DK: ['da-DK', 'da'],
    FI: ['fi-FI', 'fi'],     PT: ['pt-PT', 'pt'],
    AU: ['en-AU', 'en'],     CA: ['en-CA', 'en'],
    MX: ['es-MX', 'es'],     AR: ['es-AR', 'es'],
};

function getLanguages(countryCode) {
    return COUNTRY_LANGUAGE[countryCode?.toUpperCase()] || ['en-US', 'en'];
}

// ─── GPU profiles (realistic combos) ──────────────────────────────────────

const GPU_PROFILES = [
    { vendor: 'Google Inc. (Intel)',  renderer: 'ANGLE (Intel, Intel UHD Graphics 620 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
    { vendor: 'Google Inc. (Intel)',  renderer: 'ANGLE (Intel, Intel HD Graphics 630 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
    { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
    { vendor: 'Google Inc. (NVIDIA)', renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
    { vendor: 'Google Inc. (AMD)',    renderer: 'ANGLE (AMD, AMD Radeon RX 580 Direct3D11 vs_5_0 ps_5_0, D3D11)' },
    { vendor: 'Google Inc. (Intel)',  renderer: 'ANGLE (Intel, Intel Iris Xe Graphics Direct3D11 vs_5_0 ps_5_0, D3D11)' },
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
 *   noiseLevel      — 1|2|3 (canvas/audio noise level)
 */
function generateFingerprint(options = {}) {
    const {
        osType          = 'windows10',
        resolution      = null,
        ipData          = {},
        hardwareConcurrency = null,
        deviceMemory    = null,
        profileId       = 'default',
        noiseLevel      = 2,
    } = options;

    const os = OS_DATA[osType] || OS_DATA.windows10;
    const seed = profileId;

    // ── Browser version (Chrome latest) ──
    const chromeVersion = '131.0.0.0';
    const chromeMinor   = '131';
    const userAgent = `Mozilla/5.0 (${os.uaPlatform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${chromeVersion} Safari/537.36`;

    // ── Screen ──
    const resKey = resolution || Object.keys(SCREEN_RESOLUTIONS)[pseudoRandom(seed + 'res', 4)];
    const screen = SCREEN_RESOLUTIONS[resKey] || SCREEN_RESOLUTIONS['1920x1080'];
    const dpr = osType === 'windows11' ? 1.25 : 1.0;

    // Window = viewport (smaller than screen)
    const innerWidth  = Math.floor(screen.width  * 0.78);
    const innerHeight = Math.floor(screen.height * 0.80);

    // ── Hardware ──
    const cpuOptions = [2, 4, 6, 8, 12, 16];
    const ramOptions = [2, 4, 8, 16];
    const cpu = hardwareConcurrency || cpuOptions[pseudoRandom(seed + 'cpu', cpuOptions.length)];
    const ram = deviceMemory        || ramOptions[pseudoRandom(seed + 'ram', ramOptions.length)];

    // ── GPU ──
    const gpuProfile = GPU_PROFILES[pseudoRandom(seed + 'gpu', GPU_PROFILES.length)];

    // ── Geo / Language (IP-first) ──
    const countryCode = ipData.countryCode || 'US';
    const languages   = getLanguages(countryCode);
    const timezone    = ipData.timezone || 'America/New_York';
    const geoLat      = ipData.lat || 40.7128;
    const geoLng      = ipData.lng || -74.0060;

    // ── Fonts ──
    const fontList = [...os.fonts];

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
            seed:       parseInt(seed.replace(/[^0-9]/g, '').slice(0, 9)) || 12345678,
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
            seed:               parseInt(seed.replace(/[^0-9]/g, '').slice(1, 10)) || 87654321,
            sampleRate:         44100,
            channelCount:       2,
            maxChannelCount:    2,
            noiseLevel,
            baseLatency:        0.005,
            outputLatency:      0.012,
        },
        audioContext: {
            seed:               parseInt(seed.replace(/[^0-9]/g, '').slice(1, 10)) || 87654321,
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
            voices: os.speechVoices,
        },
        network: {
            connectionType: connType,
            downlink:       10 + pseudoRandom(seed + 'dl', 90),
            rtt:            20  + pseudoRandom(seed + 'rtt', 80),
            saveData:       false,
        },
        battery: {
            charging:        batteryLevel === 1.0,
            chargingTime:    batteryLevel === 1.0 ? 0 : Infinity,
            dischargingTime: Math.floor(3600 + pseudoRandom(seed + 'dis', 7200)),
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
                { brand: 'Chromium',             version: chromeMinor },
                { brand: 'Not?A_Brand',          version: '99' },
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
            'Sec-Ch-Ua':             `"Google Chrome";v="${chromeMinor}", "Chromium";v="${chromeMinor}", "Not?A_Brand";v="99"`,
            'Sec-Ch-Ua-Mobile':      '?0',
            'Sec-Ch-Ua-Platform':    osType.startsWith('windows') ? '"Windows"' : '"Linux"',
            'Sec-Ch-Ua-Platform-Version': osType === 'windows11' ? '"14.0.0"' : '"10.0.0"',
            'Sec-Ch-Ua-Arch':        '"x86"',
            'Sec-Ch-Ua-Bitness':     '"64"',
            'Sec-Ch-Ua-Full-Version-List': `"Google Chrome";v="${chromeVersion}", "Chromium";v="${chromeVersion}", "Not?A_Brand";v="99.0.0.0"`,
        },
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

    return fp;
}

module.exports = { generateFingerprint };
