#!/usr/bin/env python3
"""
FWYS Engine Patch Applicator
Usage: python apply_patches.py <chromium_src_root>

Applies all FWYS anti-detection patches to a Chromium source tree.
Run this BEFORE building Chromium.
"""

import sys
import os
import subprocess
import argparse

PATCHES_DIR = os.path.dirname(os.path.abspath(__file__))
CHROMIUM_SRC = None

# All patches in order — order matters for shared namespaces
PATCH_ORDER = [
    # C++ Engine patches (Tier 1)
    ("001-canvas-noise.patch",              "P0 Canvas fingerprint noise"),
    ("002-webgl-spoof.patch",               "P0 WebGL UNMASKED vendor/renderer"),
    ("003-navigator-spoof.patch",           "P0 navigator complete override"),
    ("004-webrtc-leak-fix.patch",           "P0 WebRTC IP leak prevention"),
    ("005-audio-noise.patch",               "P1 AudioContext fingerprint noise"),
    ("006-font-metric.patch",               "P1 Font metric + measureText noise"),
    ("007-client-hints-and-hardware.patch", "P1 Client hints JS + HTTP headers"),
    ("008-screen-window.patch",             "P1 Screen dimensions + devicePixelRatio"),
    ("009-performance-timing.patch",        "P2 performance.now() jitter"),
    ("010-permissions-api.patch",           "P2 Permissions API state spoofing"),
    ("011-battery-api.patch",               "P2 Battery API spoofing"),
    ("012-speech-synthesis.patch",          "P2 Speech synthesis voice list"),
    ("013-network-info-api.patch",          "P3 Network Information API"),
]


def run(cmd, cwd=None):
    result = subprocess.run(
        cmd, shell=True, capture_output=True, text=True, cwd=cwd
    )
    return result.returncode, result.stdout, result.stderr


def apply_patch(patch_file, src_root):
    patch_path = os.path.join(PATCHES_DIR, patch_file)
    if not os.path.exists(patch_path):
        return False, f"Patch file not found: {patch_path}"

    # Try git apply first (strict)
    code, out, err = run(
        f'git apply --check "{patch_path}"', cwd=src_root
    )
    if code == 0:
        code, out, err = run(
            f'git apply "{patch_path}"', cwd=src_root
        )
        if code == 0:
            return True, "git apply OK"
        else:
            return False, f"git apply failed: {err}"
    else:
        # Try patch -p1 with fuzzy matching
        code, out, err = run(
            f'patch -p1 --fuzz=3 < "{patch_path}"', cwd=src_root
        )
        if code == 0:
            return True, "patch -p1 OK (fuzzy)"
        else:
            return False, f"patch -p1 failed: {err}"


def check_prerequisites(src_root):
    """Verify this looks like a Chromium source tree"""
    markers = [
        "third_party/blink/renderer",
        "content/renderer",
        "net/BUILD.gn",
        "components/embedder_support",
    ]
    missing = []
    for m in markers:
        if not os.path.exists(os.path.join(src_root, m)):
            missing.append(m)
    return missing


def main():
    parser = argparse.ArgumentParser(description="Apply FWYS patches to Chromium source")
    parser.add_argument("chromium_src", help="Path to Chromium src/ directory")
    parser.add_argument("--dry-run", action="store_true",
                        help="Check patches without applying")
    parser.add_argument("--from-patch", default=None,
                        help="Start from this patch number (e.g. 005)")
    args = parser.parse_args()

    src_root = os.path.abspath(args.chromium_src)

    print(f"\n{'='*60}")
    print(f"  FWYS Engine Patch Applicator")
    print(f"{'='*60}")
    print(f"  Chromium source: {src_root}")
    print(f"  Patches dir:     {PATCHES_DIR}")
    print(f"  Mode:            {'DRY RUN' if args.dry_run else 'APPLY'}")
    print(f"{'='*60}\n")

    # Check prerequisites
    missing = check_prerequisites(src_root)
    if missing:
        print(f"[WARN] Some Chromium directories not found:")
        for m in missing:
            print(f"       - {m}")
        print(f"       Continuing anyway (some patches may fail)\n")

    results = []
    skip = bool(args.from_patch)

    for patch_file, description in PATCH_ORDER:
        patch_num = patch_file.split("-")[0]

        if skip:
            if patch_num == args.from_patch:
                skip = False
            else:
                results.append((patch_file, description, "SKIPPED", ""))
                continue

        if args.dry_run:
            patch_path = os.path.join(PATCHES_DIR, patch_file)
            exists = os.path.exists(patch_path)
            status = "EXISTS" if exists else "MISSING"
            results.append((patch_file, description, status, ""))
            symbol = "✓" if exists else "✗"
            print(f"  [{symbol}] {patch_num} - {description}")
        else:
            print(f"  [>] Applying {patch_num}: {description}...")
            success, msg = apply_patch(patch_file, src_root)
            status = "APPLIED" if success else "FAILED"
            results.append((patch_file, description, status, msg))
            symbol = "✓" if success else "✗"
            print(f"      [{symbol}] {status}: {msg}")

    # Summary
    print(f"\n{'='*60}")
    print(f"  Results:")
    print(f"{'='*60}")

    applied = sum(1 for _, _, s, _ in results if s in ("APPLIED", "EXISTS"))
    failed  = sum(1 for _, _, s, _ in results if s == "FAILED")
    skipped = sum(1 for _, _, s, _ in results if s in ("SKIPPED", "MISSING"))

    print(f"  ✓ Applied/OK: {applied}")
    print(f"  ✗ Failed:     {failed}")
    print(f"  - Skipped:    {skipped}")
    print(f"\n  Total patches: {len(PATCH_ORDER)}")

    if failed > 0:
        print(f"\n[!] {failed} patch(es) failed. Check Chromium version compatibility.")
        print(f"    Patches are written for Chromium 131. May need adjustment for other versions.")
        sys.exit(1)
    else:
        print(f"\n[OK] All patches applied successfully.")
        print(f"\nNext steps:")
        print(f"  1. cd {src_root}")
        print(f"  2. gn gen out/FWYS --args='is_debug=false enable_nacl=false'")
        print(f"  3. autoninja -C out/FWYS chrome")
        sys.exit(0)


if __name__ == "__main__":
    main()
