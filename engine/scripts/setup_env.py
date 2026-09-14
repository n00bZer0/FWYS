#!/usr/bin/env python3
"""
FWYS — Chromium Build Environment Setup (Windows)
Downloads depot_tools and verifies prerequisites.
"""

import os
import sys
import subprocess
import shutil
import urllib.request
import zipfile
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
ENGINE_DIR = SCRIPT_DIR.parent
PROJECT_ROOT = ENGINE_DIR.parent

DEPOT_TOOLS_URL = "https://storage.googleapis.com/chrome-infra-packages/depot_tools.zip"
DEPOT_TOOLS_DIR = ENGINE_DIR / "depot_tools"

def header(msg):
    print(f"\n{'='*56}")
    print(f"  {msg}")
    print(f"{'='*56}")

def ok(msg): print(f"  [OK] {msg}")
def warn(msg): print(f"  [WARN] {msg}")
def err(msg): print(f"  [ERROR] {msg}")
def info(msg): print(f"  [INFO] {msg}")

def check_python():
    header("Checking Python")
    v = sys.version_info
    if v.major < 3 or (v.major == 3 and v.minor < 9):
        err(f"Python 3.9+ required. Found {v.major}.{v.minor}")
        sys.exit(1)
    ok(f"Python {v.major}.{v.minor}.{v.micro}")

def check_git():
    header("Checking Git")
    git = shutil.which("git")
    if not git:
        err("Git not found! Download: https://git-scm.com/download/win")
        sys.exit(1)
    result = subprocess.run(["git", "--version"], capture_output=True, text=True)
    ok(result.stdout.strip())

def check_vs2022():
    header("Checking Visual Studio 2022")
    vs_path = Path(os.environ.get("ProgramFiles", "C:\\Program Files")) / \
              "Microsoft Visual Studio" / "2022"
    if not vs_path.exists():
        err("Visual Studio 2022 not found!")
        err("Download: https://visualstudio.microsoft.com/downloads/")
        err("Required workload: 'Desktop development with C++'")
        sys.exit(1)
    ok(f"Visual Studio 2022 found at {vs_path}")

def check_disk_space():
    header("Checking Disk Space")
    import shutil as su
    total, used, free = su.disk_usage(ENGINE_DIR.drive or "C:\\")
    free_gb = free / (1024**3)
    if free_gb < 60:
        warn(f"Low disk space: {free_gb:.1f}GB free. Chromium needs ~60GB")
    else:
        ok(f"Disk space: {free_gb:.1f}GB free (sufficient)")

def download_depot_tools():
    header("Setting up depot_tools")
    if DEPOT_TOOLS_DIR.exists():
        ok(f"depot_tools already at {DEPOT_TOOLS_DIR}")
        return

    info("Downloading depot_tools.zip ...")
    zip_path = ENGINE_DIR / "depot_tools.zip"

    def progress(count, block_size, total_size):
        pct = int(count * block_size * 100 / total_size)
        print(f"\r  Downloading... {pct}%", end="", flush=True)

    urllib.request.urlretrieve(DEPOT_TOOLS_URL, zip_path, progress)
    print()

    info("Extracting depot_tools ...")
    with zipfile.ZipFile(zip_path, 'r') as z:
        z.extractall(DEPOT_TOOLS_DIR)
    zip_path.unlink()
    ok(f"depot_tools extracted to {DEPOT_TOOLS_DIR}")

def add_to_path():
    header("Adding depot_tools to PATH")
    depot_str = str(DEPOT_TOOLS_DIR)
    current_path = os.environ.get("PATH", "")
    if depot_str.lower() not in current_path.lower():
        # Write to a .env file for PowerShell to source
        env_file = PROJECT_ROOT / "scripts" / ".env_chromium.ps1"
        with open(env_file, "w") as f:
            f.write(f'$env:PATH = "{depot_str};" + $env:PATH\n')
            f.write(f'$env:DEPOT_TOOLS_WIN_TOOLCHAIN = "0"\n')
            f.write(f'$env:GYP_MSVS_VERSION = "2022"\n')
        ok(f"Environment file written: {env_file}")
        info("Run this before building: . .\\scripts\\.env_chromium.ps1")
    else:
        ok("depot_tools already in PATH")

def main():
    print("\n  FWYS — Chromium Build Environment Setup")
    print("  Windows 10/11 · Visual Studio 2022 · Python 3.9+")

    check_python()
    check_git()
    check_vs2022()
    check_disk_space()
    download_depot_tools()
    add_to_path()

    header("Setup Complete!")
    print("  Next step: python scripts\\fetch_chromium.py")
    print()

if __name__ == "__main__":
    main()
