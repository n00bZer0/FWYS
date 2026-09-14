#!/usr/bin/env python3
"""
FWYS — Build Chromium with FWYS patches.
Uses gn + ninja for an optimized Release build.
"""

import os
import sys
import subprocess
import shutil
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
ENGINE_DIR = SCRIPT_DIR.parent
CHROMIUM_SRC = ENGINE_DIR / "chromium" / "src"
DEPOT_TOOLS_DIR = ENGINE_DIR / "depot_tools"
BUILD_OUTPUT_DIR = CHROMIUM_SRC / "out" / "FWYS_Release"
PROJECT_ROOT = ENGINE_DIR.parent
DIST_DIR = PROJECT_ROOT / "dist" / "chromium"

def get_env():
    env = os.environ.copy()
    env["PATH"] = str(DEPOT_TOOLS_DIR) + os.pathsep + env.get("PATH", "")
    env["DEPOT_TOOLS_WIN_TOOLCHAIN"] = "0"
    env["GYP_MSVS_VERSION"] = "2022"
    return env

def run(cmd, cwd=None):
    print(f"\n  $ {' '.join(str(c) for c in cmd)}")
    r = subprocess.run(cmd, cwd=cwd or CHROMIUM_SRC, env=get_env())
    if r.returncode != 0:
        print(f"  [ERROR] Exit code: {r.returncode}")
        sys.exit(r.returncode)

def write_gn_args():
    """Write optimized GN build args for FWYS."""
    BUILD_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    args_file = BUILD_OUTPUT_DIR / "args.gn"

    # Read from our config file
    config_file = ENGINE_DIR / "config" / "gn_args_windows.txt"
    if config_file.exists():
        shutil.copy(config_file, args_file)
        print(f"  [OK] GN args from {config_file}")
    else:
        # Fallback: write defaults
        args_content = """
# FWYS — GN Build Arguments (Windows Release)
is_debug = false
is_official_build = true
is_component_build = false

# Target
target_cpu = "x64"
target_os = "win"

# Optimizations
enable_nacl = false
blink_symbol_level = 0
symbol_level = 0

# Remove Google services
google_api_key = ""
google_default_client_id = ""
google_default_client_secret = ""

# Disable telemetry
enable_reporting = false
enable_background_mode = false

# V8
v8_enable_i18n_support = true
icu_use_data_file = true

# Component selection — build only what we need
build_angle_wgpu_end2end_tests = false
build_dawn_tests = false
"""
        args_file.write_text(args_content.strip())
        print("  [OK] Default GN args written")

def gn_gen():
    print("\n  [1/3] Generating build files (gn gen)...")
    run(["gn", "gen", str(BUILD_OUTPUT_DIR)])

def ninja_build():
    import multiprocessing
    jobs = min(multiprocessing.cpu_count(), 8)
    print(f"\n  [2/3] Building with ninja ({jobs} jobs)...")
    print("        This will take 4-8 hours on first build...")
    run(["ninja", "-C", str(BUILD_OUTPUT_DIR), "-j", str(jobs), "chrome"])

def copy_to_dist():
    print("\n  [3/3] Copying build artifacts to dist/ ...")
    DIST_DIR.mkdir(parents=True, exist_ok=True)

    copy_files = [
        "chrome.exe",
        "chrome.dll",
        "chrome_elf.dll",
        "v8_context_snapshot.bin",
        "icudtl.dat",
        "resources.pak",
        "chrome_100_percent.pak",
        "chrome_200_percent.pak",
    ]

    for fname in copy_files:
        src = BUILD_OUTPUT_DIR / fname
        if src.exists():
            shutil.copy2(src, DIST_DIR / fname)
            print(f"  [OK] {fname}")
        else:
            print(f"  [WARN] {fname} not found in build output")

    # Locales
    locale_src = BUILD_OUTPUT_DIR / "locales"
    locale_dst = DIST_DIR / "locales"
    if locale_src.exists():
        if locale_dst.exists():
            shutil.rmtree(locale_dst)
        shutil.copytree(locale_src, locale_dst)
        print(f"  [OK] locales/ copied")

    print(f"\n  [OK] FWYS Chromium binary ready at:\n       {DIST_DIR}")

def main():
    print("\n  FWYS — Chromium Builder")
    print(f"  Output: {BUILD_OUTPUT_DIR}")

    if not CHROMIUM_SRC.exists():
        print("  [ERROR] Chromium source not found! Run fetch_chromium.py first.")
        sys.exit(1)

    write_gn_args()
    gn_gen()
    ninja_build()
    copy_to_dist()

    print("\n" + "="*56)
    print("  BUILD COMPLETE!")
    print(f"  Chromium: {DIST_DIR / 'chrome.exe'}")
    print("  Next: .\scripts\build_ui.ps1")
    print("="*56 + "\n")

if __name__ == "__main__":
    main()
