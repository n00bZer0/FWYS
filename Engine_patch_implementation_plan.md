# FWYS Engine Patches — Detailed Technical Plan

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FWYS Anti-Detection Stack                    │
├──────────────┬──────────────────────┬───────────────────────────────┤
│  TIER 1      │  TIER 2              │  TIER 3                       │
│  C++ Patches │  CDP JS Injection    │  HTTP Layer                   │
│  (Engine)    │  (Runtime)           │  (Headers/TLS)                │
├──────────────┼──────────────────────┼───────────────────────────────┤
│ Blink patches│ Page.addScript...    │ proxy via socks-proxy-agent   │
│ compiled-in  │ before any page JS   │ User-Agent header             │
│ no JS detect │ overrides window.*   │ Accept-Language               │
│              │ iframes injected too │ Sec-CH-UA headers             │
└──────────────┴──────────────────────┴───────────────────────────────┘
```

### Rule: Tier 1 > Tier 2 > Tier 3
- **Tier 1** (C++ patch): Gold standard — cannot be detected by page JS, survives `delete`, `Object.getOwnPropertyDescriptor`, toString() checks.  
- **Tier 2** (CDP inject): Applied before page JS runs. Catches things patches miss, handles iframes.  
- **Tier 3** (HTTP proxy): Headers, TLS fingerprint, JA3 hash.

---

## Existing Patches — Status

| Patch | File | Status | Missing |
|---|---|---|---|
| `001-canvas-noise.patch` | `html_canvas_element.cc` | ✅ Basic noise | `getImageData` not patched, `OffscreenCanvas` not patched |
| `002-webgl-spoof.patch` | `webgl_rendering_context.cc` | ⚠️ Partial | `UNMASKED_VENDOR_WEBGL` still returns real value |
| `003-navigator-spoof.patch` | `navigator.cc` | ⚠️ Partial | `userAgentData` / client hints still real |
| `004-webrtc-leak-fix.patch` | `rtc_peer_connection.cc` | ✅ Good | STUN still responds with IP before ICE suppression |
| `005-audio-noise.patch` | `audio_destination_node.cc` | ❌ Wrong file | Should be `OfflineAudioContext` / `analyser_node.cc` |
| `006-font-metric.patch` | `font_cache.cc` | ⚠️ Partial | measureText timing side-channel not patched |
| `007-client-hints-and-hardware.patch` | `navigator_ua_data.cc` | ❌ Incomplete | `getHighEntropyValues()` async path not patched |

---

## Complete Patch Plan — All 18 Patches

---

### TIER 1 — C++ Blink Engine Patches

---

#### PATCH-001 (Rewrite) — Canvas Fingerprint

**File:** `third_party/blink/renderer/core/html/canvas/html_canvas_element.cc`

**Problem now:** Only `toDataURL()` is patched. Sites use `getImageData()`, `toBlob()`, `OffscreenCanvas`, and `createImageBitmap()` too.

**What to patch:**

```
HTMLCanvasElement::toDataURL()      ← already patched
HTMLCanvasElement::toBlob()         ← ADD noise here too
CanvasRenderingContext2D::getImageData()  ← ADD noise to pixel read
OffscreenCanvas::convertToBlob()    ← ADD noise
OffscreenCanvasRenderingContext2D::getImageData()  ← ADD noise
```

**Noise Strategy:**
```cpp
// Deterministic noise: same seed → same noise → consistent fingerprint
// But different from real GPU → defeats fingerprint
uint8_t fwys::NoiseByte(int x, int y, int channel) {
    uint64_t h = canvas_noise_seed ^ (x * PRIME1) ^ (y * PRIME2) ^ (channel * PRIME3);
    // 3-round xorshift64
    return (uint8_t)(h & 0x1);  // only 1 LSB — invisible to eye
}
```

**Command-line flag:** `--fwys-canvas-seed=<uint64>` (profile-specific)

---

#### PATCH-002 (Rewrite) — WebGL Spoofing

**Files:**
```
third_party/blink/renderer/modules/webgl/webgl_rendering_context_base.cc
third_party/blink/renderer/modules/webgl/webgl2_rendering_context.cc
```

**What to patch:**

```
getParameter(RENDERER)              → return fake renderer string
getParameter(VENDOR)                → return fake vendor string
getParameter(UNMASKED_RENDERER_WEBGL)  ← KEY — currently not patched
getParameter(UNMASKED_VENDOR_WEBGL)    ← KEY — currently not patched
getSupportedExtensions()            → filter real, add fake list
getExtension('WEBGL_debug_renderer_info') → return fake info
getShaderPrecisionFormat()          → return OS-consistent precision
```

**Profile value injected via flag:** `--fwys-webgl-vendor="Google Inc. (NVIDIA)"` + `--fwys-webgl-renderer="ANGLE (NVIDIA, ...)"`

---

#### PATCH-003 (Rewrite) — Navigator Complete Override

**Files:**
```
third_party/blink/renderer/core/frame/navigator.cc
third_party/blink/renderer/core/frame/navigator_id.cc
third_party/blink/renderer/core/frame/navigator_ua_data.cc   ← NEW
```

**What to patch:**

```cpp
// navigator.cc
navigator.platform()              → --fwys-platform
navigator.hardwareConcurrency()   → --fwys-hw-concurrency
navigator.deviceMemory()          → --fwys-device-memory
navigator.maxTouchPoints()        → --fwys-touch-points (0 = desktop)
navigator.cookieEnabled()         → always true
navigator.doNotTrack()            → null (not "1")
navigator.webdriver             → MUST return false (critical!)
navigator.pdfViewerEnabled      → true
navigator.vendor                → "Google Inc."

// navigator_id.cc
navigator.appVersion()          → match UA
navigator.userAgent()           → --fwys-user-agent

// navigator_ua_data.cc  ← CURRENTLY NOT PATCHED
NavigatorUAData.brands[]        → match CH-UA header
NavigatorUAData.mobile          → false
NavigatorUAData.platform        → "Windows"
NavigatorUAData.getHighEntropyValues()  → async, return spoofed values:
    - platformVersion, architecture, bitness, fullVersionList, model, wow64
```

**webdriver detection — CRITICAL:**
```cpp
// In content/renderer/render_frame_impl.cc
// Remove automation flags from JS context
// Currently Chromium sets window.navigator.webdriver = true when:
//   --enable-automation flag present (we NEVER pass this)
//   devtools is attached (must spoof this)
```

---

#### PATCH-004 (Expand) — WebRTC Full Lockdown

**Files:**
```
third_party/blink/renderer/modules/peerconnection/rtc_peer_connection.cc  ← exists
third_party/blink/renderer/modules/mediastream/user_media_request.cc      ← NEW
net/socket/udp_socket_win.cc                                               ← NEW (OS level)
```

**Current problem:** ICE candidates are suppressed AFTER being generated. The STUN server already saw the real IP.

**Fix — block at network level:**
```cpp
// 1. RTCPeerConnection: Override iceServers to empty when fwys-block-webrtc
//    → STUN server never gets request at all

// 2. If fwys-webrtc-proxy-only:
//    Force all WebRTC traffic through proxy socket
//    (Requires chrome://flags/#force-webrtc-ip-handling-policy = disable_non_proxied_udp)
//    We set this via command line: --force-webrtc-ip-handling-policy=disable_non_proxied_udp

// 3. Block UDP at process level on Windows:
//    → WSASocket() with AF_INET/SOCK_DGRAM returns error when --fwys-block-udp
//    → WebRTC falls back to TCP relay (no STUN possible)
```

**Command-line flags:**
```
--force-webrtc-ip-handling-policy=disable_non_proxied_udp   ← use proxy for WebRTC
--fwys-block-webrtc                                          ← total block (safest)
```

---

#### PATCH-005 (Rewrite) — AudioContext Fingerprint

**Problem now:** Wrong file patched. AudioContext fingerprinting uses `OfflineAudioContext` to create a unique audio signature.

**Correct files:**
```
third_party/blink/renderer/modules/webaudio/offline_audio_destination_node.cc
third_party/blink/renderer/modules/webaudio/analyser_node.cc
third_party/blink/renderer/modules/webaudio/audio_buffer.cc
```

**What to patch:**
```cpp
// OfflineAudioContext renders audio to buffer → buffer is fingerprinted
// Patch: add deterministic noise to rendered buffer samples

// In offline_audio_destination_node.cc — Render() method:
void OfflineAudioDestinationHandler::Render(...) {
    // ... original render ...
    
    // FWYS: Add noise to output buffer
    if (fwys::audio_noise_seed != 0) {
        for (int ch = 0; ch < output_bus->NumberOfChannels(); ++ch) {
            float* data = output_bus->Channel(ch)->MutableData();
            for (size_t i = 0; i < output_bus->length(); ++i) {
                // Tiny noise: ±1e-7 range — inaudible, defeats fingerprint
                data[i] += fwys::AudioNoise(i, ch) * 1e-7f;
            }
        }
    }
}
```

**Command-line flag:** `--fwys-audio-seed=<uint64>`

---

#### PATCH-006 (Expand) — Font Metrics

**Problem now:** Only font list presence is patched. Sites fingerprint via:
1. `measureText()` — exact pixel width differs per GPU/OS
2. `getBoundingClientRect()` on text elements
3. CSS `font-face` load timing

**Files:**
```
third_party/blink/renderer/platform/fonts/font_metrics.cc      ← width noise
third_party/blink/renderer/core/layout/layout_text.cc          ← bounding rect
third_party/blink/renderer/platform/fonts/font_cache.cc        ← font presence
```

**What to patch:**
```cpp
// font_metrics.cc — add ±0.01px deterministic noise to text metrics
float FontMetrics::FloatAscent() {
    float real = /* original */;
    return real + fwys::MetricNoise(real, 'A') * 0.01f;
}

// font_cache.cc — spoof available font list from profile
// Return true/false for each font based on profile font list
// (already partially done in patch 006)
```

---

#### PATCH-007 (Rewrite) — Client Hints Complete

**Files:**
```
third_party/blink/renderer/core/frame/navigator_ua_data.cc
services/network/public/cpp/client_hints.cc
net/http/http_request_headers.cc   ← Sec-CH-UA HTTP headers
```

**What to patch:**

```
HTTP Headers (request level):
  Sec-CH-UA                        → from profile brands[]
  Sec-CH-UA-Mobile                 → ?0
  Sec-CH-UA-Platform               → "Windows"
  Sec-CH-UA-Platform-Version       → "10.0.0" or "14.0.0"
  Sec-CH-UA-Arch                   → "x86"
  Sec-CH-UA-Bitness                → "64"
  Sec-CH-UA-Full-Version-List      → full brand versions

JS API (navigator.userAgentData):
  brands                           → spoofed
  mobile                           → false
  platform                         → "Windows"
  getHighEntropyValues([...])      → async — returns:
    platformVersion                → "10.0.0"
    architecture                   → "x86"
    bitness                        → "64"
    model                          → ""
    fullVersionList                → match brands
    wow64                          → false
    uaFullVersion                  → full Chrome version
```

---

#### PATCH-008 (NEW) — Screen & Window Dimensions

**File:** `third_party/blink/renderer/core/frame/screen.cc`

```
screen.width / height             → from --fwys-screen-width/height
screen.availWidth / availHeight   → height - taskbar offset
screen.colorDepth / pixelDepth    → 24
window.innerWidth / innerHeight   → browser viewport
window.outerWidth / outerHeight   → screen size
window.screenX / screenY          → 0, 0
window.devicePixelRatio           → from --fwys-dpr
```

**Important:** `window.innerWidth/Height` changes as user resizes. Use MutationObserver proxy in JS layer to re-lock.

---

#### PATCH-009 (NEW) — Performance Timing Attack Prevention

**File:** `third_party/blink/renderer/core/timing/performance.cc`

Sites use `performance.now()` timing differences to fingerprint CPU speed.

```cpp
// Add ±0-2ms jitter to performance.now() 
// (already somewhat done by Chromium's --disable-reading-from-canvas)
// Our patch: round to nearest 0.1ms + add seed-based micro-jitter

DOMHighResTimeStamp Performance::now() {
    DOMHighResTimeStamp real = /* original */;
    if (fwys::timing_noise_seed) {
        // Round to 0.1ms granularity + tiny noise
        real = std::round(real * 10.0) / 10.0;
        real += fwys::TimingNoise() * 0.05;  // ±0.05ms
    }
    return real;
}
```

---

#### PATCH-010 (NEW) — Permissions API Override

**File:** `third_party/blink/renderer/modules/permissions/permissions.cc`

Sites call `navigator.permissions.query({name: 'notifications'})` to detect automation (automation contexts return different states).

```cpp
// Force permissions to return "default" (not prompted)
// matching real browser behavior
Permissions::query() → always return "default" or "denied" per profile config
```

---

#### PATCH-011 (NEW) — Battery API Spoof

**File:** `third_party/blink/renderer/modules/battery/battery_manager.cc`

```cpp
// Return profile values
navigator.getBattery() → {
    charging: false,
    chargingTime: Infinity,
    dischargingTime: profile.battery_discharging_time,
    level: profile.battery_level  // 0.0–1.0
}
```

---

#### PATCH-012 (NEW) — Speech Synthesis Voices

**File:** `third_party/blink/renderer/modules/speech/speech_synthesis.cc`

```cpp
// Return OS-appropriate voice list from profile
// Windows 10: "Microsoft David", "Microsoft Zira", "Microsoft Mark"
// Windows 11: + "Microsoft Jenny Online" etc.
// Linux: [] (empty — matches real Linux Chrome)

SpeechSynthesis::getVoices() → from --fwys-speech-voices-json
```

---

#### PATCH-013 (NEW) — Network Information API

**File:** `third_party/blink/renderer/modules/network_information/network_information.cc`

```cpp
navigator.connection → {
    type: "wifi",                      // from profile
    effectiveType: "4g",
    downlink: 10.0,
    rtt: 50,
    saveData: false
}
```

---

### TIER 1b — Chromium Command-Line Flags (No Recompile Needed)

These are standard Chromium switches that directly help our goals:

```
--disable-blink-features=AutomationControlled    ← hides webdriver flag (CRITICAL)
--disable-features=IsolateOrigins                ← avoids site isolation fingerprinting
--force-webrtc-ip-handling-policy=disable_non_proxied_udp  ← WebRTC through proxy
--disable-background-networking                  ← stops background requests on real IP
--disable-sync                                   ← no Google account sync
--no-pings                                       ← no hyperlink auditing
--disable-client-side-phishing-detection         ← no phone-home
--password-store=basic                           ← no system keychain
--metrics-recording-only                         ← no metrics upload
--no-first-run                                   ← clean start
--disable-default-apps                           ← no default extensions
--window-size=<w>,<h>                            ← match profile screen
```

---

### TIER 2 — CDP JavaScript Injection (Runtime)

**How:** `Page.addScriptToEvaluateOnNewDocument` — runs before ANY page script.

**Key advantage:** Runs in iframes, workers, and all execution contexts automatically.

---

#### JS-001 — navigator.js (Expand)

**Current:** Basic platform/UA overrides  
**Add:**
```js
// webdriver — most critical
Object.defineProperty(navigator, 'webdriver', { get: () => false });

// navigator.userAgentData (client hints JS API)
Object.defineProperty(navigator, 'userAgentData', {
    get: () => ({
        brands: FP.clientHints.brands,
        mobile: false,
        platform: FP.clientHints.platform,
        getHighEntropyValues: async (hints) => {
            const map = {
                platformVersion:  FP.clientHints.platformVersion,
                architecture:     FP.clientHints.architecture,
                bitness:          FP.clientHints.bitness,
                model:            '',
                fullVersionList:  FP.clientHints.brands.map(b => ({...b, version: FP.browser.fullVersion})),
                wow64:            false,
                uaFullVersion:    FP.browser.fullVersion,
            };
            return Object.fromEntries(hints.map(h => [h, map[h]]));
        }
    })
});

// Override Intl for timezone
const origDateTimeFormat = Intl.DateTimeFormat;
Intl.DateTimeFormat = function(locale, opts) {
    if (!opts) opts = {};
    if (!opts.timeZone) opts.timeZone = FP.timezone;
    return new origDateTimeFormat(locale || FP.locale, opts);
};
```

---

#### JS-002 — canvas.js (Expand)

**Current:** Basic toDataURL proxy  
**Add:**
```js
// Also proxy: getImageData, toBlob, createImageBitmap, OffscreenCanvas
const origGetImageData = CanvasRenderingContext2D.prototype.getImageData;
CanvasRenderingContext2D.prototype.getImageData = function(x, y, w, h) {
    const data = origGetImageData.call(this, x, y, w, h);
    // Add 1-bit noise to pixel array
    for (let i = 0; i < data.data.length; i += 4) {
        data.data[i]   ^= noisePixel(i, 0);  // R
        data.data[i+1] ^= noisePixel(i, 1);  // G  
        data.data[i+2] ^= noisePixel(i, 2);  // B
    }
    return data;
};
```

---

#### JS-003 — webgl.js (Expand)

**Current:** Basic vendor/renderer  
**Add:**
```js
// WEBGL_debug_renderer_info extension (most important)
const origGetExtension = WebGLRenderingContext.prototype.getExtension;
WebGLRenderingContext.prototype.getExtension = function(name) {
    if (name === 'WEBGL_debug_renderer_info') {
        return {
            UNMASKED_VENDOR_WEBGL:   0x9245,
            UNMASKED_RENDERER_WEBGL: 0x9246,
        };
    }
    return origGetExtension.call(this, name);
};

const origGetParameter = WebGLRenderingContext.prototype.getParameter;
WebGLRenderingContext.prototype.getParameter = function(param) {
    if (param === 0x9245) return FP.gpu.vendor;    // UNMASKED_VENDOR
    if (param === 0x9246) return FP.gpu.renderer;  // UNMASKED_RENDERER
    return origGetParameter.call(this, param);
};
// Also patch WebGL2RenderingContext
```

---

#### JS-004 (NEW) — timezone.js

```js
// Override Date to always use profile timezone
// Many sites fingerprint via new Date().getTimezoneOffset()
const origDate = Date;
// Proxy Date constructor + getTimezoneOffset()
Date.prototype.getTimezoneOffset = function() {
    // Return offset matching FP.timezone (e.g. America/New_York = 300 in winter)
    return FP.timezoneOffset;  // minutes west of UTC
};
// Also patch Intl.DateTimeFormat (already in navigator.js)
```

---

#### JS-005 (NEW) — battery.js

```js
navigator.getBattery = async function() {
    return {
        charging:        FP.battery.charging,
        chargingTime:    FP.battery.chargingTime,
        dischargingTime: FP.battery.dischargingTime,
        level:           FP.battery.level,
        addEventListener: () => {},
        removeEventListener: () => {},
    };
};
```

---

#### JS-006 (NEW) — speech.js

```js
// Override speechSynthesis.getVoices()
const origGetVoices = SpeechSynthesis.prototype.getVoices;
Object.defineProperty(SpeechSynthesis.prototype, 'getVoices', {
    value: function() {
        return FP.speech.voices.map(v => ({
            default: true,
            lang: v.lang,
            localService: true,
            name: v.name,
            voiceURI: v.name,
        }));
    }
});
// Also fire voiceschanged event once
window.speechSynthesis.dispatchEvent(new Event('voiceschanged'));
```

---

#### JS-007 (NEW) — iframe_isolation.js

**Critical:** Sites inject fingerprint scripts in iframes, cross-origin workers. Our injections must propagate.

```js
// Proxy HTMLIFrameElement.contentWindow to apply patches in iframe context
// This runs via CDP Page.addScriptToEvaluateOnNewDocument which already
// applies to ALL frames automatically — no extra work needed.
// BUT: confirm in CDPManager that worldName is not set (must be main world)

// page.addScriptToEvaluateOnNewDocument({
//     source: stealthScript,
//     // NO worldName — must be in page's main world, not isolated world
// })
```

---

#### JS-008 (NEW) — chrome_object.js

Sites check for `window.chrome` object to detect non-Chrome browsers.

```js
// Ensure window.chrome looks real
if (!window.chrome) {
    window.chrome = {
        loadTimes: function() { return {}; },
        csi:       function() { return { startE: Date.now(), onloadT: Date.now(), pageT: 1000, tran: 15 }; },
        app: {
            isInstalled: false,
            InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
            RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
        },
        runtime: {},
    };
}
```

---

### TIER 3 — HTTP/Network Layer

#### HTTP-001 — Request Headers

Injected by Node.js proxy layer (via puppeteer `page.setExtraHTTPHeaders`):

```
User-Agent:              FP.headers['User-Agent']
Accept-Language:         FP.headers['Accept-Language']
Sec-CH-UA:              FP.headers['Sec-CH-UA']
Sec-CH-UA-Mobile:       ?0
Sec-CH-UA-Platform:     "Windows"
```

#### HTTP-002 — TLS/JA3 Fingerprint

**Problem:** TLS handshake reveals browser identity via cipher order, extension list = JA3 hash.

**Solution:** Use `go-tls-client` or `cycletls` library as MITM proxy that spoofs the TLS handshake.

```
Real Chrome JA3: 
  771,4865-4866-4867-49196-49195...-255,0-11-10-13-16...,29-23-24,...

Our JA3 should match the Chrome version we're emulating.
Implementation: cycletls or uTLS-based proxy between Node.js and remote.
```

> **Note:** JA3 spoofing requires a separate proxy process. Planned for Phase 2.

#### HTTP-003 — HTTP/2 Fingerprint (AKAMAI)

Sites fingerprint HTTP/2 SETTINGS frames, HEADERS frame order, and WINDOW_UPDATE.

```
Chrome sends SETTINGS in specific order:
  HEADER_TABLE_SIZE=65536, ENABLE_PUSH=1, INITIAL_WINDOW_SIZE=6291456, MAX_HEADER_LIST_SIZE=262144

Our H2 connection must match this exactly.
Implementation: Custom HTTP/2 client or Chromium net/ patch.
```

---

## Command-Line Flags — Complete Profile Launch Command

```bash
chromium.exe \
  # Anti-detection flags
  --disable-blink-features=AutomationControlled \
  --force-webrtc-ip-handling-policy=disable_non_proxied_udp \
  --disable-background-networking \
  --no-pings \
  --disable-sync \
  --no-first-run \
  --disable-default-apps \
  --disable-extensions-except=<path_to_our_extension> \
  
  # FWYS profile-specific flags (custom)
  --fwys-canvas-seed=<uint64> \
  --fwys-audio-seed=<uint64> \
  --fwys-platform=Win32 \
  --fwys-hw-concurrency=8 \
  --fwys-device-memory=8 \
  --fwys-user-agent="Mozilla/5.0 ..." \
  --fwys-webgl-vendor="Google Inc. (NVIDIA)" \
  --fwys-webgl-renderer="ANGLE (NVIDIA, ...)" \
  --fwys-screen-width=1920 \
  --fwys-screen-height=1080 \
  --fwys-dpr=1.0 \
  --fwys-block-webrtc \
  --fwys-speech-voices-json='[{"name":"Microsoft David","lang":"en-US"}]' \
  
  # Proxy
  --proxy-server=socks5://127.0.0.1:<local_port> \
  
  # Profile isolation
  --user-data-dir=<profiles/user_data/<profile_id>> \
  --remote-debugging-port=<cdp_port> \
  
  # Window
  --window-size=1920,1080 \
  --window-position=0,0
```

---

## Implementation Priority Order

| Priority | Patch | Detection Risk if Missing | Effort |
|---|---|---|---|
| 🔴 P0 | `navigator.webdriver = false` (JS-001) | ALWAYS detected | LOW — CDP |
| 🔴 P0 | WebRTC block (004 + cmdline flag) | Real IP leaks | LOW — flag |
| 🔴 P0 | `--disable-blink-features=AutomationControlled` | ALWAYS detected | ZERO |
| 🔴 P0 | User-Agent + CH headers (HTTP-001) | Mismatch instant fail | LOW |
| 🟠 P1 | Canvas noise (001 rewrite) | Most sites fingerprint | MEDIUM |
| 🟠 P1 | WebGL UNMASKED (002 rewrite) | Frequent fingerprint | MEDIUM |
| 🟠 P1 | Client Hints JS (007 rewrite) | New standard, widely used | MEDIUM |
| 🟠 P1 | Timezone override (JS-004) | Always checked | LOW |
| 🟡 P2 | AudioContext noise (005 rewrite) | Used by advanced sites | MEDIUM |
| 🟡 P2 | Font metrics noise (006 expand) | Advanced fingerprinting | HIGH |
| 🟡 P2 | navigator.userAgentData async (003) | Modern sites | MEDIUM |
| 🟡 P2 | Speech voices (JS-006) | Medium use | LOW |
| 🟡 P2 | Battery API (011 + JS-005) | Some sites check | LOW |
| 🟢 P3 | Performance.now() noise (009) | Advanced timing attacks | MEDIUM |
| 🟢 P3 | Network info API (013) | Low use currently | LOW |
| 🟢 P3 | chrome object (JS-008) | Some bot detectors | LOW |
| 🔵 P4 | TLS/JA3 (HTTP-002) | Akamai, Cloudflare Enterprise | VERY HIGH |
| 🔵 P4 | HTTP/2 fingerprint (HTTP-003) | Same | VERY HIGH |

---

## File Structure After All Patches

```
engine/
├── patches/
│   ├── 001-canvas-noise.patch              ← REWRITE
│   ├── 002-webgl-spoof.patch               ← REWRITE  
│   ├── 003-navigator-spoof.patch           ← REWRITE (+ ua_data)
│   ├── 004-webrtc-leak-fix.patch           ← EXPAND (STUN fix)
│   ├── 005-audio-noise.patch               ← REWRITE (right file)
│   ├── 006-font-metric.patch               ← EXPAND (measureText)
│   ├── 007-client-hints-and-hardware.patch ← REWRITE (async path)
│   ├── 008-screen-window.patch             ← NEW
│   ├── 009-performance-timing.patch        ← NEW
│   ├── 010-permissions-api.patch           ← NEW
│   ├── 011-battery-api.patch               ← NEW
│   ├── 012-speech-synthesis.patch          ← NEW
│   └── 013-network-info-api.patch          ← NEW
│
injector/src/stealth/
├── StealthLoader.js                        ← EXPAND
└── scripts/
    ├── navigator.js                        ← EXPAND (userAgentData, timezone)
    ├── canvas.js                           ← EXPAND (getImageData, toBlob)
    ├── webgl.js                            ← EXPAND (UNMASKED params)
    ├── webrtc.js                           ← stays
    ├── plugins.js                          ← stays
    ├── permissions.js                      ← stays
    ├── timezone.js                         ← NEW
    ├── battery.js                          ← NEW
    ├── speech.js                           ← NEW
    ├── chrome_object.js                    ← NEW
    ├── network_info.js                     ← NEW
    └── iframe_isolation.js                 ← NEW (diagnostic only)
```

---

## Detection Test Sites — Verification Checklist

After each patch, test against:

| Site | Tests |
|---|---|
| https://browserleaks.com | Navigator, Canvas, WebGL, Fonts, Geo |
| https://coveryourtracks.eff.org | Full fingerprint entropy |
| https://pixelscan.net | Bot detection, IP score |
| https://www.deviceinfo.me | Hardware, Battery, Speech |
| https://iphey.com | Trustworthiness score |
| https://bot.sannysoft.com | Automation detection checklist |
| https://arh.antoinevastel.com/bots/areyouheadless | Headless detection |
| https://infosimples.github.io/detect-headless | 16 headless checks |

---

## Phase 2 — TLS/JA3 Spoofing (Advanced)

This requires a separate component — a TLS MITM proxy:

```
Browser → [our socks5 proxy] → [tls-client (utls)] → Remote Server
                                    ↑
                            Mimics Chrome's TLS fingerprint:
                            - Same cipher suites order
                            - Same TLS extensions
                            - Same GREASE values
                            - Same signature algorithms
```

**Libraries:**
- Go: `github.com/bogdanfinn/tls-client` (wraps uTLS)
- Node.js: `cycletls` npm package

**Effort:** Medium — separate Go binary + IPC
