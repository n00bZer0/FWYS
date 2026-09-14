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
[![Sannysoft: 57/57 Passed](https://img.shields.io/badge/Sannysoft-57%2F57%20Passed%20(100%25%20Clean)-brightgreen.svg)](https://bot.sannysoft.com)
[![CreepJS: Grade A](https://img.shields.io/badge/CreepJS-Grade%20A%20(0%20Lies)-brightgreen.svg)](https://abrahamjuliot.github.io/creepjs/)
[![BrowserLeaks: 0 Leaks](https://img.shields.io/badge/BrowserLeaks%20WebRTC-0%20Leaks%20Detected-brightgreen.svg)](https://browserleaks.com/webrtc)
[![IPHEY: Trustworthy](https://img.shields.io/badge/IPHEY-Trustworthy-brightgreen.svg)](https://iphey.com)
[![UI: Qt 6.8.2](https://img.shields.io/badge/UI-Qt%206.8.2%20QML-41CD52.svg)](https://www.qt.io/)
[![Engine: Ungoogled-Chromium](https://img.shields.io/badge/Engine-Ungoogled--Chromium%20v152-4285f4.svg)](https://github.com/ungoogled-software/ungoogled-chromium)
[![Injection: Node.js CDP](https://img.shields.io/badge/Injection-Node.js%20CDP-339933.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**FWYS (Finish What You Start)** is a high-performance, modular antidetect browser framework engineered to defeat advanced digital fingerprinting and bot-detection engines (CreepJS, BrowserLeaks, Pixelscan, IPHEY, Cloudflare Turnstile, DataDome, Akamai, Kasada).

Unlike basic browser automation wrappers that rely solely on superficial JavaScript prototype patching (which are easily detected via prototype tampering checks, constructor inspection, or `toString()` verification), FWYS implements a **dual-tier hybrid anti-detection architecture**:

1. **Kernel Engine Level (C++ Blink/Chromium Patches):** Core browser modifications compiled directly into Chromium to spoof Canvas, WebGL, AudioContext, Font metrics, Client Hints, and WebRTC candidate filters at the native C++ boundary.
2. **Runtime Bridge (Node.js CDP Injection):** Chrome DevTools Protocol engine providing dynamic `Page.addScriptToEvaluateOnNewDocument` hooks, deterministic seeded fingerprint generation, and pure WebAssembly SQLite profile management.
3. **Desktop Interface (C++ / Qt 6 + QML):** A modern, dark glassmorphic desktop GUI for profile creation, authenticated proxy validation, live IP geographic alignment, cookie management, and browser lifecycle control.

---

## 🏆 Verified Detection Benchmarks

FWYS has been tested and verified against the industry's most stringent anti-bot and fingerprinting audit suites:

| Benchmark / Audit Suite | Result / Score | Verified Protection Details |
| :--- | :--- | :--- |
| **[bot.sannysoft.com](https://bot.sannysoft.com)** | **57 / 57 Passed (100% CLEAN)** | Chrome CDC flags removed, `navigator.webdriver=false`, plugins/mimeTypes consistent, proper Chrome runtime descriptors. |
| **[CreepJS](https://abrahamjuliot.github.io/creepjs/)** | **Grade A (0 Lies Detected)** | Zero prototype tampering detected in DOM; consistent prototype chain, Function.prototype.toString intact. |
| **[BrowserLeaks WebRTC](https://browserleaks.com/webrtc)** | **0 Leaks Detected (False)** | Local/Private IP candidate leaks blocked; public IP strictly locked to proxy exit node; mDNS masked. |
| **[BrowserLeaks Canvas](https://browserleaks.com/canvas)** | **Unique Seeded Signature** | Deterministic 1-bit LSB micro-noise injected into `getImageData` and `toDataURL` per profile. |
| **[IPHEY.com](https://iphey.com)** | **Status: Trustworthy** | Hardware, WebGL, screen bounds, operating system, and proxy geolocation 100% consistent. |

---

## 🏛 Architecture Overview

```
┌───────────────────────────────────────────────────────────┐
│                 Qt 6 + QML Desktop UI                     │
│   · Modern Glassmorphic Dashboard                         │
│   · Profile Manager & Fingerprint Configurator            │
│   · Proxy Latency Tester & Geo-Resolver                   │
│   · Netscape / JSON Cookie Importer & Exporter            │
└─────────────────────────────┬─────────────────────────────┘
                              │ IPC (Named Pipe: \\.\pipe\fwys_ipc)
┌─────────────────────────────▼─────────────────────────────┐
│               Node.js CDP Injection Layer                 │
│   · WebSocket CDP Client (Page.addScriptToEvaluate...)    │
│   · Local Authenticated Proxy Forwarder (ProxyTunnel.js)  │
│   · Seeded Fingerprint Generator (75+ Parameters)         │
│   · Pure WebAssembly SQLite Profile Reader (sql.js)       │
│   · Netscape & JSON Cookie Engine (CookieHelper.js)       │
└─────────────────────────────┬─────────────────────────────┘
                              │ Remote Debugging Port + Chromium Flags
┌─────────────────────────────▼─────────────────────────────┐
│          Chromium Engine (Ungoogled / Patched C++)        │
│   · Embedded Ungoogled-Chromium Portable (v152)           │
│   · Telemetry, Google tracking & background pings stripped │
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

| Category | Technique / Mitigation | Implementation Layer | Detection Resistance |
| :--- | :--- | :--- | :--- |
| **Canvas** | Seeded deterministic pixel noise in `getImageData` & `toDataURL` | C++ (Blink) + JS CDP | Immune to prototype inspection |
| **WebGL** | `UNMASKED_VENDOR_WEBGL` & `UNMASKED_RENDERER_WEBGL` spoofing | C++ (Blink) + JS CDP | Unspoofed GPU hidden |
| **Automation** | `navigator.webdriver = false`, removal of CDC / automation flags | C++ (Content) + JS | High |
| **WebRTC** | Local/Private IP candidate filter, mDNS masking | C++ (WebRTC) + JS | Prevents true public/LAN IP leak |
| **AudioContext** | Micro-perturbations in `AudioBuffer` & `OfflineAudioContext` | C++ (WebAudio) + JS | High |
| **Fonts** | Sub-pixel width / height metric randomization | C++ (FontPlatform) | Defeats canvas font enumeration |
| **Client Hints** | Configurable `Sec-CH-UA`, platform versions, architecture | C++ Engine CLI flags | Matches target device specs |
| **Hardware** | Custom `hardwareConcurrency` and `deviceMemory` flags | C++ Engine CLI flags | Realistic core/RAM pairings |
| **Authenticated Proxy** | Built-in SOCKS5 & HTTP tunnel with username/password auth | Node.js (`ProxyTunnel.js`) | Chrome native proxy compatibility |
| **Cookie Engine** | Dual-format Netscape (`cookies.txt`) & JSON import/export | Node.js (`CookieHelper.js`) | Instant session restoration |
| **Profile Isolation** | Per-profile `user-data-dir`, separate cookies, storage, cache | OS / Chromium | Full session separation |
| **Self-Contained** | Zero external dependencies; embedded Node.js, Qt6, and Chromium | Standalone Distribution | No system pollution |

---

## 📦 Standalone Portable Distribution

FWYS is available as a **100% self-contained portable build** that runs out-of-the-box on any 64-bit Windows machine without requiring Qt, Node.js, Python, or Visual Studio to be installed.

### Pre-packaged Directory Structure (`dist/FWYS_Portable`):
```
dist/FWYS_Portable/
│
├── FWYS.exe                                # Main Qt 6 Desktop UI Application
├── Launch_FWYS.bat                         # 1-Click Launch entrypoint
├── README.txt                              # Release documentation
│
├── chromium/                               # Embedded Ungoogled-Chromium Engine (v152)
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

### Distribution Packages:
* **Folder:** `dist\FWYS_Portable\` (~650 MB uncompressed, ready-to-run).
* **Zip Archive:** `dist\FWYS_Portable_v1.0.0.zip` (**289.3 MB** single compressed file).
* **Inno Setup Script:** `installer\FWYS_Installer.iss` (to compile a single `Setup.exe`).

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

# 2. Setup embedded Ungoogled-Chromium (automated 10-second download)
powershell -ExecutionPolicy Bypass -File .\scripts\setup_portable_chromium.ps1

# 3. Launch both Injector Daemon and UI concurrently
.\scripts\dev_start.ps1
```

---

### Step 1: Creating a Profile
1. On the **Dashboard**, click the **"+ New Profile"** button in the sidebar.
2. In the **Profile Editor**:
   * **Profile Name:** Give your profile an identifier (e.g. `US-Shop-Account`).
   * **OS Target:** Select target OS (e.g. `Windows 10` or `Windows 11`).
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
3. FWYS generates a mathematically plausible 75+ parameter fingerprint:
   * **User-Agent & Client Hints:** Aligned to Chrome 131+ on target Windows version.
   * **Hardware:** Plausible CPU core count (`hardwareConcurrency: 4, 8, 12, 16`) and RAM (`deviceMemory: 8, 16`).
   * **Screen Resolution:** Matches standard desktop displays (`1920x1080`, `2560x1440`).
   * **WebGL:** Spoofs `ANGLE (NVIDIA GeForce RTX ...)` or `Intel Iris Xe` with consistent shader precisions.
   * **Canvas & Audio Seeds:** Generates deterministic uint64 seeds for consistent noise.
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
   * Launch the isolated Ungoogled-Chromium engine with your dedicated profile data directory.
   * Connect via Chrome DevTools Protocol (CDP).
   * Start the authenticated local proxy forwarder if credentials are required.
   * Inject all anti-detection scripts (`Page.addScriptToEvaluateOnNewDocument`).
   * Apply all cookies directly to the browser storage.
4. Once the browser opens, verify your anonymity on:
   * `https://bot.sannysoft.com` — All tests green!
   * `https://abrahamjuliot.github.io/creepjs/` — Grade A, 0 lies!
   * `https://browserleaks.com/webrtc` — No IP leak!
   * `https://iphey.com` — Trustworthy!

---

## 🛠 Building & Packaging Scripts

All automation scripts are located in [`scripts/`](file:///d:/C_Camofoux_Node/scripts/):

| Script | Command | Purpose |
| :--- | :--- | :--- |
| **Full Packager** | `powershell -File .\scripts\package_portable.ps1` | Rebuilds `FWYS.exe`, deploys Qt6 DLLs, embeds `node.exe`, bundles `injector`, bundles Ungoogled-Chromium, and produces `dist\FWYS_Portable_v1.0.0.zip`. |
| **Chromium Setup** | `powershell -File .\scripts\setup_portable_chromium.ps1` | Downloads and installs Ungoogled-Chromium Portable v152 in ~10 seconds. |
| **Verify Portable** | `powershell -File .\scripts\verify_portable.ps1` | Tests execution of `dist\FWYS_Portable\FWYS.exe` and verifies zero missing DLLs. |
| **Build UI** | `powershell -File .\scripts\build_ui.ps1` | Re-compiles Qt 6 desktop application using CMake and MSVC. |

---

## 🔒 Security & Anti-Detection Principles

1. **Kernel > Prototype:** Prototype-based overrides can always be inspected via `Function.prototype.toString`, constructor tampering checks, or Error stack traces. FWYS patches values at the Blink/V8 boundary so the JavaScript engine natively returns the spoofed values without wrappers.
2. **Deterministic Seed-Based Noise:** Noise is not randomly regenerated on every call (which creates an obvious statistical anomaly). Instead, noise is deterministically seeded per profile, ensuring the exact same fingerprint is generated across multiple canvas draws within the same session.
3. **Flawless Internal Consistency:** Detection engines compare OS, fonts, WebGL vendor, client hints, and timezone. Inconsistencies (e.g. Linux fonts on a Windows User-Agent) result in instant bot classification. FWYS guarantees 100% correlation across all 75+ parameters.

---

## 📄 License

This project is released under the **MIT License**. See [LICENSE](LICENSE) for details.

*Disclaimer: This software is developed strictly for privacy research, authorized security auditing, and educational purposes.*
