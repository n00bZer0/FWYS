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
[![Clearcote: 100/100 Coherent](https://img.shields.io/badge/Clearcote%20Labs-100%2F100%20(205%2F205%20Agreed)-brightgreen.svg)](https://www.clearcotelabs.com/audit)
[![Sannysoft: 57/57 Passed](https://img.shields.io/badge/Sannysoft-57%2F57%20Passed%20(100%25%20Clean)-brightgreen.svg)](https://bot.sannysoft.com)
[![CreepJS: Grade A](https://img.shields.io/badge/CreepJS-Grade%20A%20(0%20Lies)-brightgreen.svg)](https://abrahamjuliot.github.io/creepjs/)
[![BrowserLeaks: 0 Leaks](https://img.shields.io/badge/BrowserLeaks%20WebRTC-0%20Leaks%20Detected-brightgreen.svg)](https://browserleaks.com/webrtc)
[![IPHEY: Trustworthy](https://img.shields.io/badge/IPHEY-Trustworthy-brightgreen.svg)](https://iphey.com)
[![UI: Qt 6.8.2](https://img.shields.io/badge/UI-Qt%206.8.2%20QML-41CD52.svg)](https://www.qt.io/)
[![Engine: Google Chrome 153 / Ungoogled-Chromium 152](https://img.shields.io/badge/Engine-Chrome%20153%20%2F%20Chromium%20152-4285f4.svg)](https://github.com/n00bZer0/FWYS)
[![Injection: Node.js CDP](https://img.shields.io/badge/Injection-Node.js%20CDP-339933.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**FWYS (Finish What You Start)** is a high-performance, modular antidetect browser framework engineered to defeat modern digital fingerprinting and anti-bot systems (Cloudflare Turnstile, DataDome, Akamai, Kasada, PerimeterX / HUMAN, CreepJS, and Clearcote Labs).

Unlike basic automation wrappers that rely on superficial JavaScript prototype patching (which are easily flagged via prototype descriptor shape tampering, constructor inspection, or cross-realm `Function.prototype.toString` checks), FWYS implements a **dual-tier hybrid anti-detection architecture**:

1. **Kernel Engine Level (Blink / Chromium & CDP Integration):** Native browser parameters, command-line flags, and CDP session overrides for Client Hints (`Sec-CH-UA`, `Sec-CH-UA-Platform`, etc.), hardware parallelism synchronization, WebRTC candidate filtering, native timezone emulation via V8 ICU, and Google-signed Widevine CDM support.
2. **Runtime Stealth Bridge (Node.js CDP Injection):** Chrome DevTools Protocol engine providing dynamic `Page.addScriptToEvaluateOnNewDocument` hooks with **Native C++ Prototype Preservation** — native getters are never degraded to JavaScript functions if values match native hardware.
3. **Desktop Interface (C++ / Qt 6 + QML):** A modern, dark glassmorphic desktop GUI for profile creation, proxy testing, automated geographic fingerprint alignment (195+ countries), cookie import/export, and process lifecycle management.

---

## 🏆 Verified Detection Benchmarks

FWYS has been rigorously tested and verified against the industry's most stringent fingerprint auditing suites:

| Benchmark / Audit Suite | Result / Score | Verified Protection Details |
| :--- | :--- | :--- |
| **[Clearcote Labs Audit](https://www.clearcotelabs.com/audit)** | **100 / 100 Coherent (205 / 205 Agreed)** | **0 contradictions across all 16 subsystems.** Identity coherence 73/73, Automation surface 65/65, Environment 15/15, Render coherence 52/52. Dedicated, shared, and service workers match main realm 100%. |
| **[bot.sannysoft.com](https://bot.sannysoft.com)** | **57 / 57 Passed (100% CLEAN)** | Chrome CDC markers removed, `navigator.webdriver=false`, plugins/mimeTypes consistent, native Chrome runtime descriptors. |
| **[CreepJS](https://abrahamjuliot.github.io/creepjs/)** | **Grade A (0 Lies Detected)** | Zero prototype tampering detected; iframe cross-realm `Function.prototype.toString` returns genuine `[native code]`. |
| **[BrowserLeaks WebRTC](https://browserleaks.com/webrtc)** | **0 Leaks Detected (False)** | Local/Private IP candidate leaks blocked; public IP strictly locked to proxy exit node; mDNS masked. |
| **[BrowserLeaks Canvas](https://browserleaks.com/canvas)** | **Clean & Deterministic** | 1x1 probes, flat fills, and subrect windowed reads pass bit-exact tests; no statistical noise leakage. |
| **[IPHEY.com](https://iphey.com)** | **Status: Trustworthy** | Hardware, WebGL, screen bounds, operating system, and proxy geolocation 100% consistent. |

---

## 🏛 Architecture Overview

```
┌───────────────────────────────────────────────────────────┐
│                 Qt 6 + QML Desktop UI                     │
│   · Modern Glassmorphic Dashboard                         │
│   · Profile Manager & Fingerprint Configurator            │
│   · Free Multi-Source Proxy Latency Tester & Geo-Resolver │
│   · Netscape / JSON Cookie Importer & Exporter            │
└─────────────────────────────┬─────────────────────────────┘
                              │ IPC (Named Pipe: \\.\pipe\fwys_ipc)
┌─────────────────────────────▼─────────────────────────────┐
│               Node.js CDP Injection Layer                 │
│   · WebSocket CDP Client (Page.addScriptToEvaluate...)    │
│   · Local Authenticated Proxy Forwarder (ProxyTunnel.js)  │
│   · Seeded Fingerprint Generator (75+ Parameters)         │
│   · 195+ Country Language, Font & TTS Voice Engine        │
│   · Pure WebAssembly SQLite Profile Reader (sql.js)       │
│   · Netscape & JSON Cookie Engine (CookieHelper.js)       │
└─────────────────────────────┬─────────────────────────────┘
                              │ Remote Debugging Port + Chromium Flags
┌─────────────────────────────▼─────────────────────────────┐
│          Chromium Engine (System Chrome 153 / Portable)   │
│   · Google Chrome 153 with genuine signed Widevine CDM    │
│   · Ungoogled-Chromium Portable (v152) fallback           │
│   · --disable-blink-features=AutomationControlled         │
│   · Native C++ Navigator.prototype.webdriver === false   │
│   · Native Screen.prototype & Navigator.prototype getters │
│   · Real CPU-bound worker parallelism (12 cores / 32GB)   │
│   · OffscreenCanvas WebGL worker === main realm GPU       │
└───────────────────────────────────────────────────────────┘
```

---

## ✨ Features & Mitigations Matrix

| Category | Technique / Mitigation | Implementation Layer | Detection Resistance |
| :--- | :--- | :--- | :--- |
| **Cross-Realm Worker Coherence** | Dedicated, Shared, and Service Workers match main window identity, hardware, and GPU | C++ & CDP Session | Eliminates Kasada / PerimeterX cross-realm diffs |
| **Hardware Parallelism** | `hardwareConcurrency` synchronized with host CPU cores to pass 24-worker compute benchmarks | OS CPU detection + generator | Defeats physical CPU throughput checks |
| **Native Prototype Integrity** | Preserves Blink native C++ getters on `Navigator.prototype` & `Screen.prototype` | Stealth script optimization | `Function.prototype.toString` in throwaway iframes returns `[native code]` |
| **Automation Surface** | Native C++ `webdriver` accessor returning `false` via `--disable-blink-features=AutomationControlled` | Blink C++ Engine | No own-property shadow, no JS getter tell |
| **DRM & Codecs** | Google-signed Widevine CDM (`com.widevine.alpha`) + AAC/H.264 codecs | Google Chrome binary | Passes Google Chrome brand coherence checks |
| **WebGL & WebGPU** | Synchronized unmasked renderer between DOM canvas, WebGPU, and Worker `OffscreenCanvas` | C++ Graphics driver + CDP | 100% GPU agreement across all realms |
| **Global Geo Alignment** | 195+ country database mapping primary languages, regional fonts, and TTS speech voices | `countryData.js` | IP-to-locale harmony without inconsistencies |
| **W3C Battery Invariants** | Strict mutual-exclusion rules: charging implies dischargingTime=Infinity | `battery.js` | Complies with W3C Battery Status specification |
| **Network Information** | Chromium 25ms RTT quantization strictly enforced (`0, 25, 50, 75, 100ms`) | `network_info.js` & CDP | Matches Chromium native network stack behavior |
| **Timezone & DST** | Native ICU timezone emulation via CDP `page.emulateTimezone` | Chromium ICU Engine | Passes Date.now() vs performance.timeOrigin & DST checks |
| **Authenticated Proxy** | Built-in SOCKS5 & HTTP tunnel with username/password authentication | Node.js (`ProxyTunnel.js`) | Native Chrome proxy support without auth popups |
| **Cookie Engine** | Dual-format Netscape (`cookies.txt`) & JSON import/export | Node.js (`CookieHelper.js`) | Seamless session persistence |
| **Profile Isolation** | Dedicated `user-data-dir`, separate cookies, storage partitions, and cache | Chromium engine | Zero cross-profile data leakage |

---

## 📦 Standalone Portable Distribution

FWYS is available as a **100% self-contained portable build** that runs out-of-the-box on any 64-bit Windows machine without requiring Qt, Node.js, Python, or Visual Studio to be pre-installed.

### Pre-packaged Directory Structure (`dist/FWYS_Portable`):
```
dist/FWYS_Portable/
│
├── FWYS.exe                                # Main Qt 6 Desktop UI Application
├── Launch_FWYS.bat                         # 1-Click Launch entrypoint
├── README.txt                              # Release documentation
│
├── chromium/                               # Embedded Chromium Engine
│   ├── chrome.exe                          # Privacy-hardened Chromium binary
│   └── resources, locales, icu, etc.
│
├── node.exe                                # Embedded Node.js runtime (v24.20.0)
│
├── injector/                               # Stealth CDP injection backend
│   ├── package.json
│   ├── src/                                # index.js, ProxyTunnel.js, CookieHelper.js
│   └── node_modules/                       # Production puppeteer-core, socks, etc.
│
├── profiles/                               # Self-contained profile storage
│   ├── profiles.db                         # Local SQLite profiles database
│   └── user_data/                          # Isolated browser cache/session dirs
│
├── Qt6 Core & UI DLLs                      # Deployed via windeployqt
│   ├── Qt6Core.dll, Qt6Gui.dll, Qt6Widgets.dll, Qt6Quick.dll, Qt6Qml.dll
│   └── sqldrivers/ (qsqlite.dll), platforms/ (qwindows.dll)
│
└── MSVC C++ Runtime Libraries              # Zero-dependency on host Windows
    ├── vcruntime140.dll, vcruntime140_1.dll
    └── msvcp140.dll, msvcp140_1.dll, msvcp140_2.dll
```

---

## 📖 How To Use FWYS (Step-by-Step Guide)

### Method A: Using the Standalone Portable Build (Recommended)
1. Download or extract `FWYS_Portable_v1.0.0.zip` (or navigate to `dist\FWYS_Portable`).
2. Double-click **`Launch_FWYS.bat`** (or `FWYS.exe`).
3. The FWYS desktop dashboard will open immediately.

---

### Method B: Running from Developer Source
If developing or building from source:
```powershell
# 1. Compile Qt 6 UI (Release)
.\scripts\build_ui.ps1

# 2. Setup embedded Chromium
powershell -ExecutionPolicy Bypass -File .\scripts\setup_portable_chromium.ps1

# 3. Launch both Injector Daemon and UI concurrently
.\scripts\dev_start.ps1
```

---

### Step 1: Creating a Profile
1. On the **Dashboard**, click the **"+ New Profile"** button in the sidebar.
2. In the **Profile Editor**:
   * **Profile Name:** Give your profile an identifier (e.g. `US-Shop-Account`).
   * **OS Target:** Select target OS (`Windows 10` or `Windows 11`).
   * **Notes:** Add tags or credentials if needed.

---

### Step 2: Configuring & Testing a Proxy
FWYS features an **Exit-IP Driven Fingerprint Engine**. Adding a proxy automatically aligns all regional fingerprint attributes with the proxy's real location:
1. Paste your proxy string in the **Proxy** input field. Supported formats:
   * `socks5://username:password@host:port`
   * `http://username:password@host:port`
   * `host:port:username:password`
2. Click **"Test Proxy"**.
3. FWYS resolves the exit IP, checks connectivity, measures latency, and retrieves:
   * **Exit IP Address** & **ISP / Organization**
   * **Country**, **City**, and **Region**
   * **Timezone** (e.g. `America/New_York`)
   * **Latitude & Longitude** coordinates

---

### Step 3: Generating the Fingerprint
1. Switch to the **Fingerprint** tab.
2. Click **"Generate Fingerprint"**.
3. FWYS generates a mathematically plausible fingerprint:
   * **User-Agent & Client Hints:** Aligned to Chrome 153 on target Windows version.
   * **Hardware:** Core count and RAM synchronized with the host for worker parity.
   * **Screen Resolution:** Matches standard display (`1920x1080`).
   * **WebGL:** Consistent unmasked renderer strings and shader precisions.
   * **Timezone & Geolocation:** Automatically synced to proxy exit IP!

---

### Step 4: Importing Cookies (Optional)
If logging into pre-existing accounts:
1. Go to the **Cookies** tab in the Profile Editor.
2. Paste cookies in either:
   * **Netscape format** (`.example.com TRUE / FALSE 1735689600 session_id xyz123`)
   * **JSON array format** (`[{"name": "session_id", "value": "xyz123", "domain": ".example.com"}]`)
3. Click **"Import Cookies"**. FWYS automatically validates and stores them in the profile database.

---

### Step 5: Launching & Testing the Browser
1. Click **"Save Profile"**.
2. On the **Dashboard**, click the **"Launch"** button next to your profile.
3. FWYS will:
   * Launch the isolated browser engine with your dedicated profile data directory.
   * Connect via Chrome DevTools Protocol (CDP).
   * Start the authenticated local proxy forwarder if credentials are required.
   * Inject stealth scripts before any page JS runs (`Page.addScriptToEvaluateOnNewDocument`).
   * Apply all cookies directly to the browser storage.
4. Once the browser opens, verify your anonymity on:
   * `https://www.clearcotelabs.com/audit` — 100/100 Coherence score!
   * `https://bot.sannysoft.com` — 57/57 All green!
   * `https://abrahamjuliot.github.io/creepjs/` — Grade A, 0 lies!
   * `https://browserleaks.com/webrtc` — No IP leak!
   * `https://iphey.com` — Trustworthy!

---

## 🛠 Building & Packaging Scripts

All automation scripts are located in [`scripts/`](file:///d:/C_Camofoux_Node/scripts/):

| Script | Command | Purpose |
| :--- | :--- | :--- |
| **Full Packager** | `powershell -File .\scripts\package_portable.ps1` | Rebuilds `FWYS.exe`, deploys Qt6 DLLs, embeds `node.exe`, bundles `injector`, bundles Chromium, and produces `dist\FWYS_Portable_v1.0.0.zip`. |
| **Chromium Setup** | `powershell -File .\scripts\setup_portable_chromium.ps1` | Downloads and installs Chromium Portable in ~10 seconds. |
| **Verify Portable** | `powershell -File .\scripts\verify_portable.ps1` | Tests execution of `dist\FWYS_Portable\FWYS.exe` and verifies zero missing DLLs. |
| **Build UI** | `powershell -File .\scripts\build_ui.ps1` | Re-compiles Qt 6 desktop application using CMake and MSVC. |

---

## 🔒 Security & Anti-Detection Principles

1. **Native Prototype Preservation:** When native browser properties match the desired profile, scripts do not inject JavaScript wrapper functions. This preserves genuine C++ `[native code]` descriptors and passes iframe cross-realm stringification tests.
2. **Cross-Realm Invariance:** Every JavaScript realm (main window, throwaway iframe, DedicatedWorker, SharedWorker, ServiceWorker) receives identical identity and hardware attributes.
3. **Hardware Grounding:** Parallel worker throughput, CPU core reporting, and GPU driver capabilities are internally consistent, preventing hardware-based timing and capability contradictions.
4. **Flawless Internal Consistency:** All 75+ parameters (OS, fonts, WebGL vendor, client hints, timezone, language, and network metrics) are mathematically correlated without contradictions.

---

## 📄 License

This project is released under the **MIT License**. See [LICENSE](LICENSE) for details.

*Disclaimer: This software is developed strictly for privacy research, authorized security auditing, and educational purposes.*
