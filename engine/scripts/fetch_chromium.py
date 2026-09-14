#!/usr/bin/env python3
"""
FWYS — Fetch ungoogled-chromium source
Clones ungoogled-chromium and sets up Chromium via fetch.
"""

import os
import sys
import subprocess
import shutil
from pathlib import Path

SCRIPT_DIR = Path(__file__).parent
ENGINE_DIR = SCRIPT_DIR.parent
DEPOT_TOOLS_DIR = ENGINE_DIR / "depot_tools"
CHROMIUM_DIR = ENGINE_DIR / "chromium"
UNGOOGLED_DIR = ENGINE_DIR / "ungoogled-chromium"

# ungoogled-chromium repo
UNGOOGLED_REPO = "https://github.com/ungoogled-software/ungoogled-chromium.git"

def run(cmd, cwd=None, env=None):
    """Run command, raise on failure."""
    print(f"  $ {' '.join(str(c) for c in cmd)}")
    result = subprocess.run(cmd, cwd=cwd, env=env)
    if result.returncode != 0:
        print(f"  [ERROR] Command failed with code {result.returncode}")
        sys.exit(result.returncode)

def get_env():
    """Build environment with depot_tools prepended."""
    env = os.environ.copy()
    env["PATH"] = str(DEPOT_TOOLS_DIR) + os.pathsep + env.get("PATH", "")
    env["DEPOT_TOOLS_WIN_TOOLCHAIN"] = "0"
    env["GYP_MSVS_VERSION"] = "2022"
    return env

def clone_ungoogled():
    print("\n  [1/4] Cloning ungoogled-chromium ...")
    if UNGOOGLED_DIR.exists():
        print(f"  [OK] Already cloned at {UNGOOGLED_DIR}")
        print("  Pulling latest ...")
        run(["git", "pull", "--rebase"], cwd=UNGOOGLED_DIR)
        return
    run(["git", "clone", "--depth=1", UNGOOGLED_REPO, str(UNGOOGLED_DIR)])

def fetch_chromium():
    print("\n  [2/4] Fetching Chromium source (~30GB, may take 1-3 hours) ...")
    CHROMIUM_DIR.mkdir(exist_ok=True)

    # Get the Chromium version ungoogled-chromium is based on
    version_file = UNGOOGLED_DIR / "chromium_version.txt"
    if not version_file.exists():
        print("  [ERROR] chromium_version.txt not found in ungoogled-chromium!")
        sys.exit(1)

    chromium_version = version_file.read_text().strip()
    print(f"  Target Chromium version: {chromium_version}")

    env = get_env()

    # Run fetch --nohooks chromium
    if not (CHROMIUM_DIR / "src").exists():
        run(["fetch", "--nohooks", "chromium"], cwd=CHROMIUM_DIR, env=env)
    else:
        print("  [OK] Chromium src already exists, syncing ...")

    # Checkout specific version
    run(
        ["git", "checkout", f"refs/tags/{chromium_version}"],
        cwd=CHROMIUM_DIR / "src",
        env=env
    )

def sync_dependencies():
    print("\n  [3/4] Syncing dependencies (gclient sync) ...")
    env = get_env()
    run(
        ["gclient", "sync", "--with_branch_heads", "--with_tags", "-D"],
        cwd=CHROMIUM_DIR / "src",
        env=env
    )

def apply_ungoogled_patches():
    print("\n  [4/4] Applying ungoogled-chromium patches ...")
    src_dir = CHROMIUM_DIR / "src"

    # ungoogled-chromium provides a utils script for patch application
    utils_script = UNGOOGLED_DIR / "utils" / "patches.py"
    if utils_script.exists():
        run(
            [sys.executable, str(utils_script), "apply",
             str(UNGOOGLED_DIR / "patches"),
             str(src_dir)],
            cwd=src_dir
        )
        print("  [OK] ungoogled-chromium patches applied")
    else:
        print("  [WARN] utils/patches.py not found, skipping ungoogled patches")
        print("         Apply manually: see ungoogled-chromium docs")

def main():
    print("\n  FWYS — Chromium Source Fetcher")
    print(f"  Target: {CHROMIUM_DIR}")
    print()

    if not DEPOT_TOOLS_DIR.exists():
        print("  [ERROR] depot_tools not found! Run setup_env.py first")
        sys.exit(1)

    clone_ungoogled()
    fetch_chromium()
    sync_dependencies()
    apply_ungoogled_patches()

    print("\n" + "="*56)
    print("  Chromium source ready!")
    print("  Next: python scripts\\apply_patches.py")
    print("="*56 + "\n")

if __name__ == "__main__":
    main()
