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
[![UI: Qt 6 + QML](https://img.shields.io/badge/UI-Qt%206%20%2B%20QML-41cd52.svg)](https://www.qt.io/)
[![Engine: Chromium](https://img.shields.io/badge/Engine-ungoogled--chromium-4285f4.svg)](https://github.com/ungoogled-software/ungoogled-chromium)
[![Injection: Node.js CDP](https://img.shields.io/badge/Injection-Node.js%20CDP-339933.svg)](https://nodejs.org/)
[![Language: C++20](https://img.shields.io/badge/C%2B%2B-20-00599C.svg)](https://isocpp.org/)

**FWYS (Finish What You Start)** is a high-performance, modular antidetect browser framework designed to defeat modern browser fingerprinting systems (CreepJS, BrowserLeaks, Pixelscan, IPHEY, Cloudflare Turnstile, DataDome).

Unlike typical antidetect solutions that rely purely on JavaScript-level prototype patching (which can be easily detected via prototype pollution inspections or `toString()` checks), FWYS utilizes a **hybrid dual-layer architecture**:
1. **Engine Level (C++ Blink/Chromium Patches):** Deep kernel-level spoofing of Canvas, WebGL, AudioContext, Font metrics, Client Hints, and WebRTC.
2. **Runtime Level (Node.js CDP Bridge):** Chrome DevTools Protocol injection, automated fingerprint generation, dynamic stealth scripts, proxy orchestration, and profile storage.
3. **Desktop Interface (C++ / Qt 6 + QML):** Sleek, dark glassmorphism dashboard for managing profiles, testing proxies, configuring fingerprints, and launching browser instances.

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
                              │ Launch Flags & CDP Port
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
│   ├── CMakeLists.txt                       # CMake configuration for MSVC 2022
│   ├── src/
│   │   ├── main.cpp                         # Qt GUI entry point
│   │   ├── core/                            # Business logic controllers
│   │   │   ├── App.h / App.cpp              # Application lifecycle coordinator
│   │   │   ├── BrowserLauncher.h / .cpp     # Spawns Chromium process with flags
│   │   │   ├── DatabaseManager.h / .cpp     # Local SQLite storage wrapper
│   │   │   ├── FingerprintConfig.h / .cpp   # Fingerprint data models
│   │   │   ├── ProfileManager.h / .cpp      # Profile CRUD operations
│   │   │   └── ProxyManager.h / .cpp        # Proxy tester & configuration
│   │   └── models/
│   │       └── ProfileListModel.h / .cpp    # QAbstractListModel for QML views
│   └── qml/                                 # QML user interface
│       ├── main.qml                         # Root window & glassmorphic theme
│       ├── components/                      # Custom UI widgets (Sidebar, Cards, Badges)
│       └── pages/                           # Dashboard, ProfileEditor, ProxyPage, Settings
│
├── profiles/                                # Profile storage directory
│   ├── profiles.db                          # SQLite profile metadata database
│   └── user_data/                           # Isolated Chromium browser data dirs
│
└── scripts/                                 # Developer convenience scripts
    ├── install_qt6.ps1                      # Windows Qt 6 automated installer
    ├── build_ui.ps1                         # PowerShell script to compile Qt UI
    └── dev_start.ps1                        # Quick launcher for local dev environment
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Operating System:** Windows 10 or 11 (64-bit)
- **Node.js:** v18.0.0 or higher
- **Python:** 3.9+ (with `requests` installed)
- **C++ Compiler:** Visual Studio 2022 (MSVC with "Desktop development with C++" workload)
- **Qt 6:** Qt 6.5+ (Qt Quick, QML, Core, Gui, Sql modules)
- **CMake:** 3.20+

---

### Step 1: Install Node.js Dependencies
The injector layer uses pure WebAssembly SQLite (`sql.js`) to ensure 100% compatibility across all Node versions without requiring native C++ node-gyp compilation:
```powershell
cd injector
npm install
cd ..
```

---

### Step 2: Build the Qt 6 Desktop UI
You can compile the modern desktop frontend using CMake:
```powershell
# Automated script (detects Qt6 installation path)
.\scripts\build_ui.ps1

# Or build manually with CMake:
cmake -B ui/build -S ui -DCMAKE_PREFIX_PATH="C:/Qt/6.8.0/msvc2022_64"
cmake --build ui/build --config Release
```

---

### Step 3: Build Patched Chromium Engine (One-Time)
Building Chromium produces the custom patched binary containing the C++ engine-level spoofing hooks:
```powershell
cd engine

# 1. Download Google depot_tools and configure environment
python scripts\setup_env.py

# 2. Fetch ungoogled-chromium source tree
python scripts\fetch_chromium.py

# 3. Apply the 7 C++ antidetect patches
python scripts\apply_patches.py

# 4. Generate build configuration and compile Chromium with Ninja
python scripts\build_chromium.py
```
> **Note:** Compiling Chromium requires ~40 GB disk space and takes 4–8 hours depending on your CPU. In the meantime, you can test the UI and Node.js injection layer with standard Chrome or Edge by passing the `--browser-path` flag in `BrowserLauncher`.

---

### Step 4: Launching in Development Mode
To start the injector IPC daemon and the Qt UI concurrently:
```powershell
.\scripts\dev_start.ps1
```

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
