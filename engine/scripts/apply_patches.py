#!/usr/bin/env python3
"""
FWYS — Apply FWYS fingerprint patches to Chromium source.
Applies all patches from engine/patches/ directory.
Supports rollback if a patch fails.
"""

import os
import sys
import subprocess
import shutil
from pathlib import Path
from datetime import datetime

SCRIPT_DIR = Path(__file__).parent
ENGINE_DIR = SCRIPT_DIR.parent
PATCHES_DIR = ENGINE_DIR / "patches"
CHROMIUM_SRC = ENGINE_DIR / "chromium" / "src"
LOG_DIR = ENGINE_DIR / "patch_logs"

def header(msg):
    print(f"\n{'='*56}\n  {msg}\n{'='*56}")

def git_apply(patch_file: Path, dry_run=False) -> bool:
    """Apply a single patch file using git apply."""
    cmd = ["git", "apply", "--ignore-whitespace"]
    if dry_run:
        cmd.append("--check")
    cmd.append(str(patch_file))

    result = subprocess.run(
        cmd,
        cwd=CHROMIUM_SRC,
        capture_output=True,
        text=True
    )
    if result.returncode != 0:
        print(f"    [FAIL] {result.stderr.strip()}")
        return False
    return True

def create_restore_point():
    """Create a git stash as restore point."""
    print("  Creating restore point (git stash)...")
    subprocess.run(
        ["git", "stash", "push", "-m", f"fwys-pre-patch-{datetime.now():%Y%m%d%H%M%S}"],
        cwd=CHROMIUM_SRC,
        capture_output=True
    )

def restore_from_stash():
    """Pop the restore point stash."""
    print("  [ROLLBACK] Restoring from stash...")
    subprocess.run(["git", "stash", "pop"], cwd=CHROMIUM_SRC)

def main():
    header("FWYS — Patch Applier")

    if not CHROMIUM_SRC.exists():
        print(f"  [ERROR] Chromium source not found at {CHROMIUM_SRC}")
        print("          Run fetch_chromium.py first!")
        sys.exit(1)

    patches = sorted(PATCHES_DIR.glob("*.patch"))
    if not patches:
        print(f"  [ERROR] No .patch files found in {PATCHES_DIR}")
        sys.exit(1)

    print(f"  Found {len(patches)} patches to apply:")
    for p in patches:
        print(f"    - {p.name}")

    # Dry-run check first
    print("\n  [Phase 1] Dry-run check (no changes yet)...")
    failed_dry = []
    for patch in patches:
        print(f"    Checking {patch.name} ...", end=" ")
        if git_apply(patch, dry_run=True):
            print("OK")
        else:
            print("FAIL")
            failed_dry.append(patch.name)

    if failed_dry:
        print(f"\n  [ERROR] {len(failed_dry)} patches will fail to apply:")
        for f in failed_dry:
            print(f"    - {f}")
        print("\n  Chromium source version may not match patch targets.")
        print("  Check if ungoogled-chromium version matches your patches.")
        sys.exit(1)

    # Apply patches for real
    print("\n  [Phase 2] Applying patches...")
    create_restore_point()
    LOG_DIR.mkdir(exist_ok=True)
    applied = []
    log_file = LOG_DIR / f"patch_run_{datetime.now():%Y%m%d%H%M%S}.log"

    with open(log_file, "w") as log:
        log.write(f"FWYS Patch Run — {datetime.now()}\n\n")

        for patch in patches:
            print(f"  Applying {patch.name} ...", end=" ")
            if git_apply(patch):
                print("[OK]")
                applied.append(patch.name)
                log.write(f"[OK] {patch.name}\n")
            else:
                print("[FAILED]")
                log.write(f"[FAILED] {patch.name}\n")
                print(f"\n  [ERROR] Failed to apply {patch.name}")
                print(f"  Successfully applied before failure: {applied}")
                restore_from_stash()
                print("  All patches rolled back.")
                sys.exit(1)

    print(f"\n  [OK] All {len(applied)} patches applied successfully!")
    print(f"  Log: {log_file}")
    print("\n  Next: python scripts\\build_chromium.py")

if __name__ == "__main__":
    main()
