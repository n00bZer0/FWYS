# FWYS — Finish What You Start
### Production-Grade Antidetect Browser Framework

```
  ███████╗██╗    ██╗██╗   ██╗███████╗
  ██╔════╝██║    ██║╚██╗ ██╔╝██╔════╝
  █████╗  ██║ █╗ ██║ ╚████╔╝ ███████╗
  ██╔══╝  ██║███╗██║  ╚██╔╝  ╚════██║
  ██║     ╚███╔███╔╝   ██║   ███████║
  ╚═╝      ╚══╝╚══╝    ╚═╝   ╚══════╝
```

[![Platform: Windows](https://img.shields.io/badge/Platform-Windows%2010%2F11%20x64-blue.svg)](https://github.com/n00bZer0/FWYS)
[![UI Build: Passing](https://img.shields.io/badge/UI%20Build-Passing%20(Qt%206.8.2)-brightgreen.svg)](https://github.com/n00bZer0/FWYS)
[![Injector Tests: 4/4 Passed](https://img.shields.io/badge/Injector%20Tests-4%2F4%20Passed-brightgreen.svg)](https://github.com/n00bZer0/FWYS)
[![Engine: Chromium](https://img.shields.io/badge/Engine-ungoogled--chromium-4285f4.svg)](https://github.com/ungoogled-software/ungoogled-chromium)
[![Injection: Node.js CDP](https://img.shields.io/badge/Injection-Node.js%20CDP-339933.svg)](https://nodejs.org/)
[![Language: C++20](https://img.shields.io/badge/C%2B%2B-20-00599C.svg)](https://isocpp.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**FWYS (Finish What You Start)** is a high-performance, modular antidetect browser framework designed to withstand advanced digital fingerprinting and bot-detection engines (CreepJS, BrowserLeaks, Pixelscan, IPHEY, Cloudflare Turnstile, DataDome).

Unlike traditional antidetect tools that rely solely on surface-level JavaScript prototype patching (which are easily flagged via prototype pollution checks, constructor tampering tests, or `toString()` inspection), FWYS implements a **dual-tier hybrid anti-detection architecture**:

1. **Kernel Engine Level (C++ Blink/Chromium Patches):** Core browser modifications compiled directly into Chromium to spoof Canvas, WebGL, AudioContext, Font metrics, Client Hints, and WebRTC candidate filters at the native C++ boundary.
2. **Runtime Bridge (Node.js CDP Injection):** Chrome DevTools Protocol engine providing dynamic `Page.addScriptToEvaluateOnNewDocument` hooks, deterministic seeded fingerprint generation, and pure WebAssembly SQLite profile management.
3. **Desktop Interface (C++ / Qt 6 + QML):** A modern, dark glassmorphic desktop GUI for profile creation, proxy validation, fingerprint customization, and browser instance lifecycle management.

---

## 🏛 Architecture Overview

```
┌───────────────────────────────────────────────────────────┐
│                 Qt 6 + QML Desktop UI                     │
│    Profile Manager  ·  Proxy Tester  ·  Settings / Config │
└─────────────────────────────┬─────────────────────────────┘
                              │ IPC (Named Pipe: \\.\pipe\fwys_ipc)
┌─────────────────────────────▼─────────────────────────────┐
│               Node.js CDP Injection Layer                 │
│   · WebSocket CDP Client (Page.addScriptToEvaluate...)    │
│   · Seeded Fingerprint Generator (Hardware, OS, Screen)   │
│   · Pure WebAssembly SQLite Profile Reader (sql.js)       │
│   · Dynamic Fallback Stealth Polyfills                    │
└─────────────────────────────┬─────────────────────────────┘
                              │ Launch Flags & CDP Remote Debug Port
┌─────────────────────────────▼─────────────────────────────┐
│          Patched Chromium Engine (C++ / Blink)            │
│   · 001-canvas-noise.patch      (Seeded pixel jitter)     │
│   · 002-webgl-spoof.patch       (GPU vendor & renderer)   │
│   · 003-navigator-spoof.patch   (webdriver=false, flags)  │
│   · 004-webrtc-leak-fix.patch   (Local IP leak blocker)   │
│   · 005-audio-noise.patch       (AudioBuffer variance)    │
│   · 006-font-metric.patch       (Sub-pixel text offsets)  │
│   · 007-client-hints.patch      (Sec-CH-UA & HW overrides)│
└───────────────────────────────────────────────────────────┘
```

---

## ✨ Features & Mitigations Matrix

| Category | Component / Technique | Implementation Layer | Detection Resistance |
| :--- | :--- | :--- | :--- |
| **Canvas** | Seeded deterministic pixel noise in `getImageData` & `toDataURL` | C++ (Blink) + JS Fallback | High (Immune to JS prototype checks) |
| **WebGL** | `UNMASKED_VENDOR_WEBGL` & `UNMASKED_RENDERER_WEBGL` spoofing | C++ (Blink) + JS Fallback | High |
| **Automation** | `navigator.webdriver = false`, removal of CDC / automation flags | C++ (Content) + JS | High |
| **WebRTC** | Local/Private IP candidate filter, mDNS masking | C++ (WebRTC) + JS | Prevents true public/LAN IP leak |
| **Audio** | Micro-perturbations in `AudioBuffer` & `OfflineAudioContext` | C++ (WebAudio) | High |
| **Fonts** | Sub-pixel width / height metric randomization | C++ (FontPlatform) | Defeats canvas/DOM font enumeration |
| **Client Hints** | Configurable `Sec-CH-UA`, platform versions, architecture | C++ Engine CLI flags | Native network header alignment |
| **Hardware** | Custom `hardwareConcurrency` and `deviceMemory` flags | C++ Engine CLI flags | Matches target device specs |
| **Profile Isolation** | Per-profile `user-data-dir`, separate cookies, storage, cache | OS / Chromium | Full session separation |
| **Proxy Engine** | Per-profile SOCKS5, HTTP, HTTPS with live latency test | Node.js + Qt UI | Isolates network routing per profile |
| **Database** | Pure WebAssembly SQLite (`sql.js`) storage | Node.js + Qt C++ | No native toolchain compile conflicts |

---

## 🖥 Desktop GUI Overview

The Qt 6 + QML desktop interface provides complete management of your anti-detect environment:

* **Dashboard (`DashboardPage.qml`):** Responsive grid of configured profiles with real-time status badges (Idle, Running, Error), proxy indicators, and one-click **Launch** / **Stop** controls.
* **Profile Editor (`ProfileEditorPage.qml`):** Customize profile names, proxy strings (`socks5://user:pass@host:port`), User-Agent strings, and operating system targets.
* **Fingerprint Configurator (`FingerprintPage.qml`):** Inspect and tune hardware concurrency, screen resolution, WebGL vendor/renderer strings, and canvas noise seeds with instant regeneration.
* **Proxy Manager (`ProxyPage.qml`):** Quick-test panel for SOCKS5 and HTTP proxies with latency and connectivity verification.
* **Settings (`SettingsPage.qml`):** Automatic detection of installed browsers (Google Chrome / ungoogled-chromium) and Node.js binary path.

---

## 📂 Repository Structure

```
FWYS/
├── engine/                                  # Chromium patches & compilation toolchain
│   ├── patches/                             # Upstream ungoogled-chromium patch files
│   │   ├── 001-canvas-noise.patch           # Canvas pixel noise injection
│   │   ├── 002-webgl-spoof.patch            # WebGL vendor/renderer spoofing
│   │   ├── 003-navigator-spoof.patch        # Automation flag removal (webdriver=false)
│   │   ├── 004-webrtc-leak-fix.patch        # WebRTC private IP leak blocker
│   │   ├── 005-audio-noise.patch            # AudioContext signature scrambler
│   │   ├── 006-font-metric.patch            # Font measurement randomization
│   │   └── 007-client-hints-and-hardware.patch # Client hints, memory, & CPU core spoofing
│   ├── scripts/                             # Automation scripts
│   │   ├── setup_env.py                     # Installs Google depot_tools & dependencies
│   │   ├── fetch_chromium.py                # Clones ungoogled-chromium source tree
│   │   ├── apply_patches.py                 # Applies all FWYS engine patches
│   │   └── build_chromium.py                # Runs gn gen & ninja to build target binary
│   └── config/
│       ├── gn_args_windows.txt              # Production GN compiler arguments
│       └── gn_args_debug.txt                # Debug GN compiler arguments
│
├── injector/                                # Node.js CDP injection & stealth runtime
│   ├── src/
│   │   ├── index.js                         # Injector entry point & CLI
│   │   ├── cdp/
│   │   │   ├── CDPManager.js                # Chrome DevTools Protocol connection lifecycle
│   │   │   └── PageController.js            # evaluateOnNewDocument stealth injection
│   │   ├── ipc/
│   │   │   └── IPCServer.js                 # Windows Named Pipe server for Qt GUI
│   │   ├── profile/
│   │   │   ├── FingerprintGenerator.js      # Seeded, consistent profile generator
│   │   │   └── ProfileReader.js             # sql.js profile reader (SQLite WebAssembly)
│   │   └── stealth/
│   │       ├── StealthLoader.js             # Dynamic stealth script bundler
│   │       └── scripts/                     # Modular JS stealth overrides (fallback)
│   │           ├── navigator.js             # Navigator & platform spoof
│   │           ├── webgl.js                 # WebGL parameter emulation
│   │           ├── canvas.js                # Canvas noise fallback
│   │           ├── webrtc.js                # WebRTC ICE candidate interceptor
│   │           ├── permissions.js           # Notification & geolocation permissions
│   │           └── plugins.js               # MimeTypes & plugins list polyfill
│   └── package.json
│
├── ui/                                      # Qt 6 + QML Desktop Management Interface
│   ├── CMakeLists.txt                       # CMake configuration for MSVC
│   ├── src/
│   │   ├── main.cpp                         # Qt GUI entry point & logging subsystem
│   │   ├── core/                            # Business logic controllers
│   │   │   ├── App.h / App.cpp              # Application lifecycle coordinator
│   │   │   ├── BrowserLauncher.h / .cpp     # Spawns Chromium/Chrome process with flags
│   │   │   ├── DatabaseManager.h / .cpp     # Local SQLite storage wrapper
│   │   │   ├── FingerprintConfig.h / .cpp   # Fingerprint data models
│   │   │   ├── ProfileManager.h / .cpp      # Profile CRUD operations
│   │   │   └── ProxyManager.h / .cpp        # Proxy tester & configuration
│   │   └── models/
│   │       └── ProfileListModel.h / .cpp    # QAbstractListModel for QML views
│   └── qml/                                 # QML user interface
│       ├── main.qml                         # Root window & glassmorphic theme
│       ├── components/                      # Custom widgets (Sidebar, ProfileCard, LoadingSpinner)
│       └── pages/                           # Dashboard, ProfileEditor, Fingerprint, Proxy, Settings
│
├── profiles/                                # Profile storage directory
│   ├── profiles.db                          # SQLite profile metadata database
│   └── user_data/                           # Isolated Chromium browser data dirs
│
└── scripts/                                 # Developer convenience scripts
    ├── install_qt6.ps1                      # Windows Qt 6 automated environment helper
    ├── build_ui.ps1                         # Compiles Qt 6 UI and deploys runtime DLLs
    └── dev_start.ps1                        # Launches injector daemon + Qt GUI concurrently
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Operating System:** Windows 10 or 11 (64-bit)
- **Node.js:** v18.0.0 or higher (v24 compatible)
- **Python:** 3.9+ (with `requests` installed)
- **C++ Compiler:** Visual Studio 2022 / 2026 (MSVC with "Desktop development with C++" workload)
- **CMake:** 3.20+ (bundled with Visual Studio)

---

### Step 1: Install Qt 6 SDK
Run the automated environment helper to detect or install Qt 6:
```powershell
.\scripts\install_qt6.ps1
```
Or install directly using Python's headless CLI installer:
```powershell
python -m pip install aqtinstall
python -m aqt install-qt windows desktop 6.8.2 win64_msvc2022_64 -m qtwebsockets -O C:\Qt
```

---

### Step 2: Install Node.js Injector Dependencies
The injector layer uses pure WebAssembly SQLite (`sql.js`), eliminating native build errors on modern Node.js versions:
```powershell
cd injector
npm install
node src/index.js --test
cd ..
```

---

### Step 3: Build the Desktop Application (`FWYS.exe`)
Compile the native C++ Qt 6 desktop application. The build script automatically detects Visual Studio, runs CMake, and uses `windeployqt` to bundle all runtime dependencies:
```powershell
.\scripts\build_ui.ps1
```
*Output binary will be generated at:* `ui\build\Release\FWYS.exe`

---

### Step 4: Launching FWYS
You can start both the Node.js injection daemon and the Qt desktop UI concurrently:
```powershell
.\scripts\dev_start.ps1
```
Or run the compiled executable directly:
```powershell
.\ui\build\Release\FWYS.exe
```

---

### Step 5: Testing with Regular Chrome (Out of the Box)
FWYS automatically detects installed standard browsers like **Google Chrome** (`C:\Program Files\Google\Chrome\Application\chrome.exe`):
1. Open FWYS.
2. Go to **Settings** to confirm the detected browser path.
3. On the **Dashboard**, create a new profile and click **Launch**.
4. Chrome will launch in isolated mode with dynamic CDP injection active!

---

### Step 6: Building the Full Patched Chromium Engine (Optional)
To achieve kernel-level C++ spoofing (impervious to all JavaScript prototype detection):
```powershell
cd engine

# 1. Download Google depot_tools
python scripts\setup_env.py

# 2. Fetch ungoogled-chromium source tree
python scripts\fetch_chromium.py

# 3. Apply the 7 FWYS C++ patches
python scripts\apply_patches.py

# 4. Compile Chromium with Ninja
python scripts\build_chromium.py
```
> **Note:** Compiling Chromium requires ~40 GB disk space and takes 4–8 hours depending on your CPU.

---

## 🎯 What We Need To Do

This roadmap outlines the complete technical execution blueprint for FWYS to counter next-generation bot-detection algorithms, deep iframe/worker script inspection, and statistical browser fingerprinting engines.

### 1. Core Operating Philosophy: Proxy-First & Zero-Leak Architecture
* **Exit-IP Driven Identity:** Every fingerprint property that correlates with network geography (`navigator.language`, `navigator.languages`, `Intl.DateTimeFormat().resolvedOptions().timeZone`, system date offsets, Accept-Language HTTP headers, and Geolocation latitude/longitude) **MUST** be strictly derived from the proxy's verified exit IP.
* **Strict Proxy Kill-Switch:** Real public and local IP addresses must never be leaked under any circumstance. If a proxy disconnects or drops packets during an active session, the browser profile must immediately freeze or terminate rather than falling back to the host machine's direct connection.
* **Full Network Stack Confinement:** WebRTC candidates, STUN requests, ICE negotiation, DNS queries, and TLS handshakes must be routed entirely through the proxy tunnel. WebRTC local IP enumeration is blocked at the native C++ level.
* **Flawless Internal Consistency:** Detection systems (Cloudflare Turnstile, DataDome, Akamai, Kasada, CreepJS) cross-validate internal correlations. An inconsistent profile is flagged immediately. FWYS enforces 100% attribute alignment:
  * Windows OS $\rightarrow$ `Win32` platform $\rightarrow$ Windows NT User-Agent $\rightarrow$ Windows system fonts $\rightarrow$ DirectX/ANGLE WebGL renderers $\rightarrow$ Windows SAPI speech voices.
  * Target Country $\rightarrow$ Proxy IP $\rightarrow$ Localized Accept-Language $\rightarrow$ Aligned Timezone $\rightarrow$ Regional coordinates.

---

### 2. Comprehensive 10-Layer Fingerprint Spoofing & Defense Matrix

| Layer | Target Fingerprint Surface | Spoofing & Neutralization Method | Detection Vector Addressed |
| :--- | :--- | :--- | :--- |
| **1. HTTP & Network Headers** | `User-Agent`, `Accept-Language`, `Sec-CH-UA`, `Sec-CH-UA-Platform`, `Sec-CH-UA-Mobile`, `Sec-Fetch-*` | CDP dynamic header override & native C++ command-line flags | Discrepancies between JavaScript navigator and HTTP request headers |
| **2. TLS & Transport** | JA3/JA4 TLS ClientHello fingerprints, HTTP/2 frame priority/window settings, TCP/IP stack signatures | Tunneled proxy routing + Chromium C++ network stack defaults | Network-layer fingerprint matching (e.g., Akamai / Cloudflare edge scoring) |
| **3. JavaScript Navigator** | `navigator.webdriver`, `hardwareConcurrency`, `deviceMemory`, `maxTouchPoints`, `plugins`, `mimeTypes` | **C++ Blink kernel patch** (`webdriver = false`) + CDP runtime emulation | Primary bot/automation flags, Selenium/Puppeteer detection |
| **4. Screen & Viewport** | `screen.width/height`, `availWidth/availHeight`, `devicePixelRatio`, `innerWidth/innerHeight`, `screenX/Y` | CDP window bounds configuration with realistic taskbar offsets | Viewport vs monitor resolution mismatch, headless dimensions detection |
| **5. Canvas & WebGL** | 2D Canvas rendering hash, `WEBGL_debug_renderer_info`, WebGL extensions, WebGPU, OffscreenCanvas | **C++ Blink/Skia patch** (seeded deterministic pixel noise + unmasked vendor/renderer spoof) | Canvas hash tracking, GPU model profiling, prototype hooking detection |
| **6. AudioContext** | `AudioBuffer`, `OfflineAudioContext`, oscillator frequency analysis, `sampleRate` | **C++ WebAudio patch** (seeded micro-perturbations in audio sample output) | Audio hardware/codec signature identification |
| **7. Font Fingerprinting** | Installed system fonts enumeration via CSS `@font-face` and Canvas measureText | **C++ FontPlatform patch** + OS-specific font whitelist injection | Operating system mismatch (e.g., Linux fonts on Windows User-Agent) |
| **8. Timing & Bot Behavior** | `performance.now()` precision, timestamp consistency, high-resolution timers | C++ timer quantization and jitter injection | Fingerprinting timing attacks, automated execution detection |
| **9. Hardware & System APIs** | `navigator.getBattery()`, Gamepad API, WebUSB, WebBluetooth, SpeechSynthesis voices | C++ API containment (returning realistic empty/mocked descriptors matching the OS) | API surface fingerprinting across specialized hardware interfaces |
| **10. Deep Injections & Iframes** | Hidden cross-origin iframes, Web Workers, `ServiceWorker`, `SharedWorker` contexts | **C++ Blink native integration** ensuring patches persist across all execution realms | Evasion checks where scripts execute inside iframes/workers to bypass window prototype hooks |

---

### 3. Integration Blueprint: `scrapfly/fingerprint-generator` (Offline Model)
* **Role in FWYS:** Used as a Bayesian neural network generator during **profile creation** to generate mathematically realistic, real-world hardware and client combinations (eliminating impossible configurations like 32-core mobile devices or incompatible GPU/OS pairs).
* **Execution Flow:**
  1. Profile configuration invokes local Python `fpgen` module via Node.js IPC.
  2. `fpgen` generates base hardware attributes (GPU vendor, renderer, screen bounds, fonts, concurrency, memory).
  3. Live Proxy IP inspection extracts network geography (Country, Language, Timezone, ASN, ISP).
  4. Network parameters override the base template to create a consistent profile stored in `profiles.db`.
  5. At launch, C++ engine flags and CDP injection scripts consume the saved JSON profile without any runtime Python overhead.

---

### 4. Next Implementation Milestones
- [ ] **Universal Proxy Parser & Manager:** Auto-parse pasted proxy strings in any format (`HTTP`, `HTTPS`, `SOCKS4`, `SOCKS5`, `SSH`), bulk management, latency testing, and fail-safe kill-switch.
- [ ] **Multi-Source IP Intelligence Engine:** Query `ip-api.com`, `ipdata.co`, and `ipinfo.io` in parallel to aggregate risk scores, ISP classification, and exact timezone/coordinates.
- [ ] **Extended Profile Creator UI (QML/C++):** Intuitive controls for OS selection, resolution presets, proxy linking, and extension bundle management.
- [ ] **Worker & Iframe Defense Verification:** Implement automated tests confirming that Canvas, WebGL, and Navigator spoofs hold true inside nested iframes and Web Workers.

---

## 🧪 Testing & Verification

Verify your spoofed profiles against top industry fingerprint detection and bot-scoring platforms:

- **[BrowserLeaks](https://browserleaks.com/)**: Test Canvas noise, WebGL report, WebRTC IP leaks, and Font detection.
- **[CreepJS](https://abrahamjuliot.github.io/creepjs/)**: Advanced fingerprint analysis (verifies prototype integrity, worker scope, and Lie detection score).
- **[Pixelscan](https://pixelscan.net/)**: Checks browser consistency, proxy headers, and hardware signatures.
- **[IPHEY](https://iphey.com/)**: Validates digital trustworthiness and IP correlation.

---

## 🔒 Security & Anti-Detection Philosophy

1. **Kernel > Prototype:** Script-injected overrides can always be inspected via `Function.prototype.toString`, constructor tampering checks, or Error stack traces. FWYS patches values at the Blink/V8 boundary so the JavaScript engine natively returns the spoofed values without wrappers.
2. **Deterministic Seed-Based Noise:** Noise is not randomly regenerated on every call (which creates an obvious statistical anomaly). Instead, noise is deterministically seeded per profile, ensuring the exact same fingerprint is generated across multiple canvas draws within the same session.
3. **Hardware / Network Correlation:** When configuring a profile, CPU cores, RAM, WebGL renderer, OS platform, and screen resolution are validated to ensure plausible, real-world hardware combinations.

---

## 📄 License

This project is released under the **MIT License**. See [LICENSE](LICENSE) for details.

*Disclaimer: This software is developed strictly for privacy research, authorized security testing, and educational purposes.*
